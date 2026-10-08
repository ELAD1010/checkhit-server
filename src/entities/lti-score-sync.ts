import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Relation,
  UpdateDateColumn,
} from "typeorm";
import { decimalToNumber } from "./decimal-to-number.transformer.js";
import { LtiScoreSyncStatus } from "./enums.js";
import { LtiResourceLink } from "./lti-resource-link.js";
import { User } from "./user.js";

/** Last grade sent to the platform's AGS line item for one student and resource link. */
@Entity({ name: "lti_score_syncs" })
@Index("IDX_lti_score_sync_retry", ["status", "nextAttemptAt"])
export class LtiScoreSync {
  @PrimaryColumn("uuid", { name: "platform_id" })
  platformId!: string;

  @PrimaryColumn({ name: "resource_link_id", type: "varchar", length: 255 })
  resourceLinkId!: string;

  @PrimaryColumn("uuid", { name: "student_id" })
  studentId!: string;

  @ManyToOne(() => LtiResourceLink, { onDelete: "CASCADE" })
  @JoinColumn([
    { name: "platform_id", referencedColumnName: "platformId" },
    { name: "resource_link_id", referencedColumnName: "resourceLinkId" },
  ])
  resourceLink!: Relation<LtiResourceLink>;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "student_id" })
  student!: Relation<User>;

  @Column("uuid", { name: "evaluation_id" })
  evaluationId!: string;

  @Column({
    name: "score_given",
    type: "numeric",
    precision: 8,
    scale: 2,
    transformer: decimalToNumber,
  })
  scoreGiven!: number;

  @Column({
    name: "score_maximum",
    type: "numeric",
    precision: 8,
    scale: 2,
    transformer: decimalToNumber,
  })
  scoreMaximum!: number;

  @Column({
    type: "enum",
    enum: LtiScoreSyncStatus,
    enumName: "lti_score_sync_status",
  })
  status!: LtiScoreSyncStatus;

  @Column({ name: "attempt_count", type: "integer", default: 0 })
  attemptCount!: number;

  @Column({ name: "last_error", type: "text", nullable: true })
  lastError!: string | null;

  @Column({ name: "next_attempt_at", type: "timestamptz", nullable: true })
  nextAttemptAt!: Date | null;

  @Column({ name: "synced_at", type: "timestamptz", nullable: true })
  syncedAt!: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
