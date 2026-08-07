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
import { Assignment } from "./assignment.js";
import { Course } from "./course.js";
import { LtiPlatform } from "./lti-platform.js";

@Entity({ name: "lti_resource_links" })
@Index("IDX_lti_resource_link_assignment", ["assignmentId"])
@Index("IDX_lti_resource_link_course", ["courseId"])
export class LtiResourceLink {
  @PrimaryColumn("uuid", { name: "platform_id" })
  platformId!: string;

  @PrimaryColumn({ name: "resource_link_id", type: "varchar", length: 255 })
  resourceLinkId!: string;

  @Column("uuid", { name: "assignment_id" })
  assignmentId!: string;

  @Column("uuid", { name: "course_id" })
  courseId!: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  title!: string | null;

  @Column({ name: "line_item_url", type: "text", nullable: true })
  lineItemUrl!: string | null;

  @ManyToOne(() => LtiPlatform, (platform) => platform.resourceLinks, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "platform_id" })
  platform!: Relation<LtiPlatform>;

  @ManyToOne(() => Assignment, { onDelete: "CASCADE" })
  @JoinColumn({ name: "assignment_id" })
  assignment!: Relation<Assignment>;

  @ManyToOne(() => Course, { onDelete: "CASCADE" })
  @JoinColumn({ name: "course_id" })
  course!: Relation<Course>;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
