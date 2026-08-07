import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from "typeorm";
import { Appeal } from "./appeal.js";
import { decimalToNumber } from "./decimal-to-number.transformer.js";
import { EvaluationStatus } from "./enums.js";
import { EvaluationAudit } from "./evaluation-audit.js";
import { EvaluationQuestionResult } from "./evaluation-question-result.js";
import { Submission } from "./submission.js";

@Entity({ name: "evaluations" })
@Index("IDX_evaluation_submission", ["submissionId"])
@Index("UQ_evaluation_id_submission", ["id", "submissionId"], { unique: true })
@Index("UQ_evaluation_final_per_submission", ["submissionId"], {
  unique: true,
  where: `"is_final" = true`,
})
@Index("UQ_evaluation_active_per_submission", ["submissionId"], {
  unique: true,
  where: `"status" IN ('PENDING', 'PROCESSING')`,
})
@Index("IDX_evaluation_status_claim", ["status", "nextAttemptAt"])
@Check("CHK_evaluation_max_score", `"max_score" > 0`)
@Check(
  "CHK_evaluation_score",
  `"score" IS NULL OR ("score" >= 0 AND "score" <= "max_score")`,
)
@Check("CHK_evaluation_attempt_count", `"attempt_count" >= 0`)
export class Evaluation {
  @PrimaryGeneratedColumn("uuid", { name: "evaluation_id" })
  id!: string;

  @Column("uuid", { name: "submission_id" })
  submissionId!: string;

  @Column("uuid", { name: "question_set_id" })
  questionSetId!: string;

  @ManyToOne(() => Submission, (submission) => submission.evaluations, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "submission_id" })
  submission!: Relation<Submission>;

  @Column({
    type: "numeric",
    precision: 8,
    scale: 2,
    nullable: true,
    transformer: decimalToNumber,
  })
  score!: number | null;

  @Column({
    name: "max_score",
    type: "numeric",
    precision: 8,
    scale: 2,
    transformer: decimalToNumber,
  })
  maxScore!: number;

  @Column({ type: "text", nullable: true })
  feedback!: string | null;

  @Column({ name: "selection_summary", type: "text", nullable: true })
  selectionSummary!: string | null;

  @Column({ type: "varchar", length: 200 })
  model!: string;

  @Column({ name: "prompt_version", type: "varchar", length: 100 })
  promptVersion!: string;

  @Column({
    type: "numeric",
    precision: 5,
    scale: 4,
    nullable: true,
    transformer: decimalToNumber,
  })
  confidence!: number | null;

  @Column({
    type: "enum",
    enum: EvaluationStatus,
    enumName: "evaluation_status",
    default: EvaluationStatus.PENDING,
  })
  status!: EvaluationStatus;

  @Column({ name: "is_final", type: "boolean", default: false })
  isFinal!: boolean;

  @Column({ name: "attempt_count", type: "integer", default: 0 })
  attemptCount!: number;

  @Column({ name: "max_attempts", type: "integer", default: 3 })
  maxAttempts!: number;

  @Column({ name: "next_attempt_at", type: "timestamptz", nullable: true })
  nextAttemptAt!: Date | null;

  @Column({ name: "started_at", type: "timestamptz", nullable: true })
  startedAt!: Date | null;

  @Column({ name: "completed_at", type: "timestamptz", nullable: true })
  completedAt!: Date | null;

  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage!: string | null;

  @OneToMany(() => Appeal, (appeal) => appeal.evaluation)
  appeals!: Relation<Appeal>[];

  @OneToMany(
    () => EvaluationQuestionResult,
    (result) => result.evaluation,
  )
  questionResults!: Relation<EvaluationQuestionResult>[];

  @OneToOne(() => EvaluationAudit, (audit) => audit.evaluation)
  audit!: Relation<EvaluationAudit> | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
