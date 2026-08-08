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
import { AssignmentQuestion } from "./assignment-question.js";
import { QuestionImportStatus } from "./enums.js";
import { FileAsset } from "./file-asset.js";

@Entity({ name: "assignment_question_imports" })
@Index("IDX_question_import_assignment", ["assignmentId"])
@Index("IDX_question_import_status", ["status"])
@Index("IDX_question_import_claim", ["status", "nextAttemptAt"])
@Check("CHK_question_import_attempt_count", `"attempt_count" >= 0`)
export class AssignmentQuestionImport {
  @PrimaryGeneratedColumn("uuid", { name: "import_id" })
  id!: string;

  @Column("uuid", { name: "assignment_id" })
  assignmentId!: string;

  @ManyToOne(() => Assignment, (assignment) => assignment.questionImports, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "assignment_id" })
  assignment!: Relation<Assignment>;

  @Column("uuid", { name: "file_id" })
  fileId!: string;

  @ManyToOne(() => FileAsset, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "file_id" })
  file!: Relation<FileAsset>;

  @Column({
    type: "enum",
    enum: QuestionImportStatus,
    enumName: "question_import_status",
    default: QuestionImportStatus.PENDING,
  })
  status!: QuestionImportStatus;

  @Column({ type: "varchar", length: 200 })
  model!: string;

  @Column({ name: "prompt_version", type: "varchar", length: 100 })
  promptVersion!: string;

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

  @Column({ name: "raw_response", type: "jsonb", nullable: true })
  rawResponse!: Record<string, unknown> | null;

  @OneToMany(
    () => AssignmentQuestion,
    (question) => question.import,
  )
  questions!: Relation<AssignmentQuestion>[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
