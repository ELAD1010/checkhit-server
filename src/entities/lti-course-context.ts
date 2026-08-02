import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Relation,
  UpdateDateColumn,
} from "typeorm";
import { Course } from "./course.js";
import { LtiPlatform } from "./lti-platform.js";

@Entity({ name: "lti_course_contexts" })
@Index("IDX_lti_course_context_course", ["courseId"])
export class LtiCourseContext {
  @PrimaryColumn("uuid", { name: "platform_id" })
  platformId!: string;

  @PrimaryColumn({ name: "context_id", type: "varchar", length: 255 })
  contextId!: string;

  @Column("uuid", { name: "course_id" })
  courseId!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  title!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  label!: string | null;

  @ManyToOne(() => LtiPlatform, (platform) => platform.courseContexts, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "platform_id" })
  platform!: Relation<LtiPlatform>;

  @ManyToOne(() => Course, { onDelete: "CASCADE" })
  @JoinColumn({ name: "course_id" })
  course!: Relation<Course>;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
