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
import { Assignment } from "./assignment.js";
import { Evaluation } from "./evaluation.js";
import { SubmissionStatus } from "./enums.js";
import { Student } from "./student.js";
import { SubmissionFile } from "./submission-file.js";

@Entity({ name: "submissions" })
@Index(
  "UQ_submission_assignment_student_attempt",
  ["assignmentId", "studentId", "attemptNumber"],
  { unique: true },
)
@Index("UQ_submission_id_student", ["id", "studentId"], { unique: true })
@Index("IDX_submission_assignment", ["assignmentId"])
@Index("IDX_submission_student", ["studentId"])
@Check("CHK_submission_attempt", `"attempt_number" > 0`)
export class Submission {
  @PrimaryGeneratedColumn("uuid", { name: "submission_id" })
  id!: string;

  @Column("uuid", { name: "assignment_id" })
  assignmentId!: string;

  @Column("uuid", { name: "student_id" })
  studentId!: string;

  @ManyToOne(() => Assignment, (assignment) => assignment.submissions, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "assignment_id" })
  assignment!: Relation<Assignment>;

  @ManyToOne(() => Student, (student) => student.submissions, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "student_id" })
  student!: Relation<Student>;

  @Column({ name: "attempt_number", type: "integer" })
  attemptNumber!: number;

  @Column({ name: "answer_text", type: "text", nullable: true })
  answerText!: string | null;

  @Column({
    type: "enum",
    enum: SubmissionStatus,
    enumName: "submission_status",
    default: SubmissionStatus.DRAFT,
  })
  status!: SubmissionStatus;

  @Column({ name: "submitted_at", type: "timestamptz", nullable: true })
  submittedAt!: Date | null;

  @OneToMany(() => Evaluation, (evaluation) => evaluation.submission)
  evaluations!: Relation<Evaluation>[];

  @OneToMany(() => Appeal, (appeal) => appeal.submission)
  appeals!: Relation<Appeal>[];

  @OneToMany(() => SubmissionFile, (submissionFile) => submissionFile.submission)
  files!: Relation<SubmissionFile>[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
