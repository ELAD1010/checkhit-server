import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from "typeorm";
import { Assignment } from "./assignment.js";
import { CourseLecturer } from "./course-lecturer.js";
import { Enrollment } from "./enrollment.js";
import { Message } from "./message.js";
import { Resource } from "./resource.js";

@Entity({ name: "courses" })
@Index("IDX_course_lti_context", ["ltiContextId"])
export class Course {
  @PrimaryGeneratedColumn("uuid", { name: "course_id" })
  id!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "varchar", length: 100 })
  semester!: string;

  @Column({ name: "academic_year", type: "smallint" })
  academicYear!: number;

  @Column({
    name: "lti_context_id",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  ltiContextId!: string | null;

  @OneToMany(
    () => CourseLecturer,
    (courseLecturer) => courseLecturer.course,
  )
  lecturers!: Relation<CourseLecturer>[];

  @OneToMany(() => Enrollment, (enrollment) => enrollment.course)
  enrollments!: Relation<Enrollment>[];

  @OneToMany(() => Resource, (resource) => resource.course)
  resources!: Relation<Resource>[];

  @OneToMany(() => Assignment, (assignment) => assignment.course)
  assignments!: Relation<Assignment>[];

  @OneToMany(() => Message, (message) => message.course)
  messages!: Relation<Message>[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  // Unmapped/virtual aggregated property populated by query builders
  studentsCount?: number;
  openAssignmentsCount?: number;
  nextDueAt?: Date | null;
}

