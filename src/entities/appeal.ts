import {
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
import { AppealFile } from "./appeal-file.js";
import { AppealStatus } from "./enums.js";
import { Evaluation } from "./evaluation.js";
import { Lecturer } from "./lecturer.js";
import { Student } from "./student.js";
import { Submission } from "./submission.js";

@Entity({ name: "appeals" })
@Index("IDX_appeal_submission", ["submissionId"])
@Index("IDX_appeal_evaluation", ["evaluationId"])
@Index("IDX_appeal_student", ["studentId"])
export class Appeal {
  @PrimaryGeneratedColumn("uuid", { name: "appeal_id" })
  id!: string;

  @Column("uuid", { name: "submission_id" })
  submissionId!: string;

  @Column("uuid", { name: "evaluation_id" })
  evaluationId!: string;

  @Column("uuid", { name: "student_id" })
  studentId!: string;

  @Column("uuid", { name: "reviewer_id", nullable: true })
  reviewerId!: string | null;

  @ManyToOne(() => Submission, (submission) => submission.appeals, {
    onDelete: "CASCADE",
  })
  @JoinColumn([
    { name: "submission_id", referencedColumnName: "id" },
    { name: "student_id", referencedColumnName: "studentId" },
  ])
  submission!: Relation<Submission>;

  @ManyToOne(() => Evaluation, (evaluation) => evaluation.appeals, {
    onDelete: "RESTRICT",
  })
  @JoinColumn([
    { name: "evaluation_id", referencedColumnName: "id" },
    { name: "submission_id", referencedColumnName: "submissionId" },
  ])
  evaluation!: Relation<Evaluation>;

  @ManyToOne(() => Student, (student) => student.appeals, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "student_id" })
  student!: Relation<Student>;

  @ManyToOne(() => Lecturer, (lecturer) => lecturer.reviewedAppeals, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "reviewer_id" })
  reviewer!: Relation<Lecturer> | null;

  @Column({ type: "text" })
  reason!: string;

  @Column({
    type: "enum",
    enum: AppealStatus,
    enumName: "appeal_status",
    default: AppealStatus.SUBMITTED,
  })
  status!: AppealStatus;

  @Column({ type: "text", nullable: true })
  resolution!: string | null;

  @Column({ name: "resolved_at", type: "timestamptz", nullable: true })
  resolvedAt!: Date | null;

  @OneToMany(() => AppealFile, (appealFile) => appealFile.appeal)
  files!: Relation<AppealFile>[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
