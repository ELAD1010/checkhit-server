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
import { Lecturer } from "./lecturer.js";
import { LecturerPermission } from "./enums.js";

@Entity({ name: "course_lecturers" })
export class CourseLecturer {
  @PrimaryColumn("uuid", { name: "course_id" })
  courseId!: string;

  @PrimaryColumn("uuid", { name: "lecturer_id" })
  lecturerId!: string;

  @ManyToOne(() => Course, (course) => course.lecturers, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "course_id" })
  course!: Relation<Course>;

  @ManyToOne(() => Lecturer, (lecturer) => lecturer.courseAssignments, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "lecturer_id" })
  lecturer!: Relation<Lecturer>;

  @Column({
    name: "permission_level",
    type: "enum",
    enum: LecturerPermission,
    enumName: "lecturer_permission",
    default: LecturerPermission.EDITOR,
  })
  permissionLevel!: LecturerPermission;

  @CreateDateColumn({ name: "assigned_at", type: "timestamptz" })
  assignedAt!: Date;
}
