import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { AppDataSource } from "../database/data-source.js";
import { Evaluation } from "../entities/evaluation.js";
import type { EvaluationStatus } from "../entities/enums.js";

const TICKET_TTL_MS = 30_000;
const WEBSOCKET_PATH = "/api/realtime/ws";

type ConnectionTicket = {
  userId: string;
  expiresAt: number;
};

export type EvaluationStatusEvent = {
  type: "evaluation.status_changed";
  evaluationId: string;
  submissionId: string;
  assignmentId: string;
  courseId: string;
  status: EvaluationStatus;
  score: number | null;
  maxScore: number;
  occurredAt: string;
};

class EvaluationRealtime {
  private readonly tickets = new Map<string, ConnectionTicket>();
  private readonly clients = new Map<string, Set<WebSocket>>();
  private webSocketServer: WebSocketServer | null = null;

  issueTicket(userId: string): { ticket: string; expiresInMs: number } {
    this.removeExpiredTickets();
    const ticket = randomBytes(32).toString("base64url");
    this.tickets.set(ticket, {
      userId,
      expiresAt: Date.now() + TICKET_TTL_MS,
    });
    return { ticket, expiresInMs: TICKET_TTL_MS };
  }

  attach(server: Server): void {
    if (this.webSocketServer) return;

    const webSocketServer = new WebSocketServer({ noServer: true });
    this.webSocketServer = webSocketServer;

    server.on("upgrade", (request, socket, head) => {
      const url = new URL(request.url || "/", "http://localhost");
      if (url.pathname !== WEBSOCKET_PATH) {
        socket.destroy();
        return;
      }

      const userId = this.consumeTicket(url.searchParams.get("ticket"));
      if (!userId) {
        socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
      }

      webSocketServer.handleUpgrade(request, socket, head, (client) => {
        this.registerClient(userId, client);
        webSocketServer.emit("connection", client, request);
      });
    });
  }

  publish(userId: string, event: EvaluationStatusEvent): void {
    const clients = this.clients.get(userId);
    if (!clients) return;

    const payload = JSON.stringify(event);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  async publishEvaluation(evaluationId: string): Promise<void> {
    if (this.clients.size === 0) return;

    try {
      const evaluation = await AppDataSource.getRepository(Evaluation).findOne({
        where: { id: evaluationId },
        relations: {
          submission: {
            assignment: true,
          },
        },
      });

      if (!evaluation?.submission?.assignment) return;

      this.publish(evaluation.submission.studentId, {
        type: "evaluation.status_changed",
        evaluationId: evaluation.id,
        submissionId: evaluation.submissionId,
        assignmentId: evaluation.submission.assignmentId,
        courseId: evaluation.submission.assignment.courseId,
        status: evaluation.status,
        score: evaluation.score,
        maxScore: evaluation.maxScore,
        occurredAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to publish evaluation status:", error);
    }
  }

  close(): void {
    for (const clients of this.clients.values()) {
      for (const client of clients) client.terminate();
    }
    this.clients.clear();
    this.tickets.clear();
    this.webSocketServer?.close();
    this.webSocketServer = null;
  }

  private consumeTicket(ticket: string | null): string | null {
    if (!ticket) return null;
    const connectionTicket = this.tickets.get(ticket);
    this.tickets.delete(ticket);

    if (!connectionTicket || connectionTicket.expiresAt < Date.now()) {
      return null;
    }
    return connectionTicket.userId;
  }

  private registerClient(userId: string, client: WebSocket): void {
    const clients = this.clients.get(userId) ?? new Set<WebSocket>();
    clients.add(client);
    this.clients.set(userId, clients);

    const removeClient = () => {
      clients.delete(client);
      if (clients.size === 0) this.clients.delete(userId);
    };
    client.on("close", removeClient);
    client.on("error", removeClient);
  }

  private removeExpiredTickets(): void {
    const now = Date.now();
    for (const [ticket, value] of this.tickets) {
      if (value.expiresAt < now) this.tickets.delete(ticket);
    }
  }
}

export const evaluationRealtime = new EvaluationRealtime();
