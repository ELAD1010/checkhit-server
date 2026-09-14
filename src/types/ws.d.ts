declare module "ws" {
  import type { IncomingMessage } from "node:http";
  import type { Duplex } from "node:stream";

  export class WebSocket {
    static readonly OPEN: number;
    readonly readyState: number;
    on(event: "close" | "error", listener: (...args: unknown[]) => void): this;
    send(data: string): void;
    terminate(): void;
  }

  export class WebSocketServer {
    constructor(options: { noServer: true });
    on(
      event: "connection",
      listener: (socket: WebSocket, request: IncomingMessage) => void,
    ): this;
    handleUpgrade(
      request: IncomingMessage,
      socket: Duplex,
      head: Buffer,
      callback: (client: WebSocket) => void,
    ): void;
    emit(event: "connection", socket: WebSocket, request: IncomingMessage): boolean;
    close(callback?: () => void): void;
  }
}
