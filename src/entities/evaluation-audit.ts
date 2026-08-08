import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  Relation,
} from "typeorm";
import { Evaluation } from "./evaluation.js";

@Entity({ name: "evaluation_audits" })
export class EvaluationAudit {
  @PrimaryColumn("uuid", { name: "evaluation_id" })
  evaluationId!: string;

  @OneToOne(() => Evaluation, (evaluation) => evaluation.audit, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "evaluation_id" })
  evaluation!: Relation<Evaluation>;

  @Column({ name: "request_payload", type: "jsonb", nullable: true })
  requestPayload!: Record<string, unknown> | null;

  @Column({ name: "raw_response", type: "jsonb", nullable: true })
  rawResponse!: Record<string, unknown> | null;

  @Column({ name: "provider_request_id", type: "varchar", length: 255, nullable: true })
  providerRequestId!: string | null;

  @Column({ name: "token_usage", type: "jsonb", nullable: true })
  tokenUsage!: Record<string, unknown> | null;

  @Column({ name: "latency_ms", type: "integer", nullable: true })
  latencyMs!: number | null;

  @Column({ name: "validation_errors", type: "jsonb", nullable: true })
  validationErrors!: Record<string, unknown> | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
