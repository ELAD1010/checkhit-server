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
import { Course } from "./course.js";
import { decimalToNumber } from "./decimal-to-number.transformer.js";
import { AssignmentStatus } from "./enums.js";
import { Submission } from "./submission.js";

@Entity({ name: "assignments" })
@Index("IDX_assignment_course", ["courseId"])
@Check(
  "CHK_assignment_dates",
  `"due_at" IS NULL OR "start_at" IS NULL OR "due_at" > "start_at"`,
)
@Check("CHK_assignment_max_score", `"max_score" > 0`)
export class Assignment {
  @PrimaryGeneratedColumn("uuid", { name: "assignment_id" })
  id!: string;

  @Column("uuid", { name: "course_id" })
  courseId!: string;

  @ManyToOne(() => Course, (course) => course.assignments, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "course_id" })
  course!: Relation<Course>;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "text" })
  description!: string;

  @Column({ type: "varchar", length: 100 })
  type!: string;

  @Column({ name: "evaluation_instructions", type: "text" })
  evaluationInstructions!: string;

  @Column({
    name: "max_score",
    type: "numeric",
    precision: 8,
    scale: 2,
    transformer: decimalToNumber,
  })
  maxScore!: number;

  @Column({ name: "start_at", type: "timestamptz", nullable: true })
  startAt!: Date | null;

  @Column({ name: "due_at", type: "timestamptz", nullable: true })
  dueAt!: Date | null;

  @Column({
    type: "enum",
    enum: AssignmentStatus,
    enumName: "assignment_status",
    default: AssignmentStatus.DRAFT,
  })
  status!: AssignmentStatus;

  @Column({
    name: "lti_resource_link_id",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  ltiResourceLinkId!: string | null;

  @Column({ name: "lti_line_item_url", type: "text", nullable: true })
  ltiLineItemUrl!: string | null;

  @OneToMany(() => Submission, (submission) => submission.assignment)
  submissions!: Relation<Submission>[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
