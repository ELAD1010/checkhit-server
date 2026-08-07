import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from "typeorm";
import { AssignmentQuestion } from "./assignment-question.js";
import { decimalToNumber } from "./decimal-to-number.transformer.js";
import { Evaluation } from "./evaluation.js";

@Entity({ name: "evaluation_question_results" })
@Index("UQ_evaluation_question_result", ["evaluationId", "questionId"], {
  unique: true,
})
@Index("IDX_evaluation_question_result_evaluation", ["evaluationId"])
@Index("IDX_evaluation_question_result_question", ["questionId"])
@Check("CHK_eqr_max_score", `"max_score" > 0`)
@Check("CHK_eqr_score", `"score" >= 0 AND "score" <= "max_score"`)
@Check(
  "CHK_eqr_confidence",
  `"confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1)`,
)
export class EvaluationQuestionResult {
  @PrimaryGeneratedColumn("uuid", { name: "result_id" })
  id!: string;

  @Column("uuid", { name: "evaluation_id" })
  evaluationId!: string;

  @ManyToOne(() => Evaluation, (evaluation) => evaluation.questionResults, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "evaluation_id" })
  evaluation!: Relation<Evaluation>;

  @Column("uuid", { name: "question_id" })
  questionId!: string;

  @ManyToOne(
    () => AssignmentQuestion,
    (question) => question.evaluationResults,
    { onDelete: "RESTRICT" },
  )
  @JoinColumn({ name: "question_id" })
  question!: Relation<AssignmentQuestion>;

  @Column({
    type: "numeric",
    precision: 8,
    scale: 2,
    transformer: decimalToNumber,
  })
  score!: number;

  @Column({
    name: "max_score",
    type: "numeric",
    precision: 8,
    scale: 2,
    transformer: decimalToNumber,
  })
  maxScore!: number;

  @Column({ type: "text" })
  feedback!: string;

  @Column({ type: "text", nullable: true })
  evidence!: string | null;

  @Column({ name: "is_answered", type: "boolean" })
  isAnswered!: boolean;

  @Column({ name: "counts_toward_total", type: "boolean" })
  countsTowardTotal!: boolean;

  @Column({ name: "selection_reason", type: "text" })
  selectionReason!: string;

  @Column({
    type: "numeric",
    precision: 5,
    scale: 4,
    nullable: true,
    transformer: decimalToNumber,
  })
  confidence!: number | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
