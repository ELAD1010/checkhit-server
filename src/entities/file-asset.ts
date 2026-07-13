import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
} from "typeorm";
import { AppealFile } from "./appeal-file.js";
import { ResourceFile } from "./resource-file.js";
import { SubmissionFile } from "./submission-file.js";

@Entity({ name: "file_assets" })
export class FileAsset {
  @PrimaryGeneratedColumn("uuid", { name: "file_id" })
  id!: string;

  @Index({ unique: true })
  @Column({ name: "object_key", type: "text" })
  objectKey!: string;

  @Column({ name: "original_name", type: "varchar", length: 255 })
  originalName!: string;

  @Column({ name: "mime_type", type: "varchar", length: 255 })
  mimeType!: string;

  @Column({ name: "size_bytes", type: "bigint" })
  sizeBytes!: string;

  @Column({ type: "varchar", length: 128 })
  checksum!: string;

  @OneToMany(() => ResourceFile, (resourceFile) => resourceFile.file)
  resourceLinks!: Relation<ResourceFile>[];

  @OneToMany(() => SubmissionFile, (submissionFile) => submissionFile.file)
  submissionLinks!: Relation<SubmissionFile>[];

  @OneToMany(() => AppealFile, (appealFile) => appealFile.file)
  appealLinks!: Relation<AppealFile>[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
