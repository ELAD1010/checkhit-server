import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from "typeorm";
import { Appeal } from "./appeal.js";
import { decimalToNumber } from "./decimal-to-number.transformer.js";
import { EvaluationStatus } from "./enums.js";
import { Submission } from "./submission.js";

@Entity({ name: "evaluations" })
@Index("IDX_evaluation_submission", ["submissionId"])
@Index("UQ_evaluation_id_submission", ["id", "submissionId"], { unique: true })
@Index("UQ_evaluation_final_per_submission", ["submissionId"], {
  unique: true,
  where: `"is_final" = true`,
})
@Check("CHK_evaluation_max_score", `"max_score" > 0`)
@Check(
  "CHK_evaluation_score",
  `"score" IS NULL OR ("score" >= 0 AND "score" <= "max_score")`,
)
export class Evaluation {
  @PrimaryGeneratedColumn("uuid", { name: "evaluation_id" })
  id!: string;

  @Column("uuid", { name: "submission_id" })
  submissionId!: string;

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

  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage!: string | null;

  @OneToMany(() => Appeal, (appeal) => appeal.evaluation)
  appeals!: Relation<Appeal>[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
