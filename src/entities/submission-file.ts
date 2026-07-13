import {
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Relation,
} from "typeorm";
import { FileAsset } from "./file-asset.js";
import { Submission } from "./submission.js";

@Entity({ name: "submission_files" })
export class SubmissionFile {
  @PrimaryColumn("uuid", { name: "submission_id" })
  submissionId!: string;

  @PrimaryColumn("uuid", { name: "file_id" })
  fileId!: string;

  @ManyToOne(() => Submission, (submission) => submission.files, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "submission_id" })
  submission!: Relation<Submission>;

  @ManyToOne(() => FileAsset, (file) => file.submissionLinks, {
    onDelete: "RESTRICT",
  })
  @JoinColumn({ name: "file_id" })
  file!: Relation<FileAsset>;
}
