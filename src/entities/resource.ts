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
} from "typeorm";
import { Course } from "./course.js";
import { ResourceFile } from "./resource-file.js";

@Entity({ name: "resources" })
@Index("IDX_resource_course", ["courseId"])
export class Resource {
  @PrimaryGeneratedColumn("uuid", { name: "resource_id" })
  id!: string;

  @Column("uuid", { name: "course_id" })
  courseId!: string;

  @ManyToOne(() => Course, (course) => course.resources, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "course_id" })
  course!: Relation<Course>;

  @Column({ type: "varchar", length: 255 })
  title!: string;

  @Column({ type: "varchar", length: 100 })
  type!: string;

  @Column({
    name: "external_url",
    type: "text",
    nullable: true,
  })
  externalUrl!: string | null;

  @OneToMany(() => ResourceFile, (resourceFile) => resourceFile.resource)
  files!: Relation<ResourceFile>[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
