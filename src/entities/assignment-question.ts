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
import { Assignment } from "./assignment.js";
import { AssignmentQuestionImport } from "./assignment-question-import.js";
import { decimalToNumber } from "./decimal-to-number.transformer.js";
import { QuestionSource } from "./enums.js";
import { EvaluationQuestionResult } from "./evaluation-question-result.js";

@Entity({ name: "assignment_questions" })
@Index(
  "UQ_assignment_question_set_key",
  ["assignmentId", "questionSetId", "questionKey"],
  {
  unique: true,
  },
)
@Index(
  "UQ_assignment_question_set_order",
  ["assignmentId", "questionSetId", "orderIndex"],
  {
  unique: true,
  },
)
@Index("IDX_assignment_question_assignment", ["assignmentId", "isActive"])
@Check("CHK_assignment_question_max_score", `"max_score" > 0`)
@Check("CHK_assignment_question_order", `"order_index" >= 0`)
export class AssignmentQuestion {
  @PrimaryGeneratedColumn("uuid", { name: "question_id" })
  id!: string;

  @Column("uuid", { name: "assignment_id" })
  assignmentId!: string;

  @ManyToOne(() => Assignment, (assignment) => assignment.questions, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "assignment_id" })
  assignment!: Relation<Assignment>;

  @Column({ name: "question_key", type: "varchar", length: 100 })
  questionKey!: string;

  @Column("uuid", { name: "question_set_id" })
  questionSetId!: string;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @Column({ name: "order_index", type: "integer" })
  orderIndex!: number;

  @Column({ type: "text" })
  prompt!: string;

  @Column({ type: "text", nullable: true })
  rubric!: string | null;

  @Column({
    name: "max_score",
    type: "numeric",
    precision: 8,
    scale: 2,
    transformer: decimalToNumber,
  })
  maxScore!: number;

  @Column({
    type: "enum",
    enum: QuestionSource,
    enumName: "question_source",
    default: QuestionSource.MANUAL,
  })
  source!: QuestionSource;

  @Column("uuid", { name: "import_id", nullable: true })
  importId!: string | null;

  @ManyToOne(
    () => AssignmentQuestionImport,
    (questionImport) => questionImport.questions,
    { onDelete: "SET NULL", nullable: true },
  )
  @JoinColumn({ name: "import_id" })
  import!: Relation<AssignmentQuestionImport> | null;

  @OneToMany(
    () => EvaluationQuestionResult,
    (result) => result.question,
  )
  evaluationResults!: Relation<EvaluationQuestionResult>[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
