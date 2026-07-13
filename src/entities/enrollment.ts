import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Relation,
} from "typeorm";
import { Course } from "./course.js";
import { MembershipStatus } from "./enums.js";
import { Student } from "./student.js";

@Entity({ name: "enrollments" })
export class Enrollment {
  @PrimaryColumn("uuid", { name: "student_id" })
  studentId!: string;

  @PrimaryColumn("uuid", { name: "course_id" })
  courseId!: string;

  @ManyToOne(() => Student, (student) => student.enrollments, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "student_id" })
  student!: Relation<Student>;

  @ManyToOne(() => Course, (course) => course.enrollments, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "course_id" })
  course!: Relation<Course>;

  @Column({
    type: "enum",
    enum: MembershipStatus,
    enumName: "membership_status",
    default: MembershipStatus.ACTIVE,
  })
  status!: MembershipStatus;

  @CreateDateColumn({ name: "enrolled_at", type: "timestamptz" })
  enrolledAt!: Date;
}
