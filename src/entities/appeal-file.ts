import {
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Relation,
} from "typeorm";
import { Appeal } from "./appeal.js";
import { FileAsset } from "./file-asset.js";

@Entity({ name: "appeal_files" })
export class AppealFile {
  @PrimaryColumn("uuid", { name: "appeal_id" })
  appealId!: string;

  @PrimaryColumn("uuid", { name: "file_id" })
  fileId!: string;

  @ManyToOne(() => Appeal, (appeal) => appeal.files, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "appeal_id" })
  appeal!: Relation<Appeal>;

  @ManyToOne(() => FileAsset, (file) => file.appealLinks, {
    onDelete: "RESTRICT",
  })
  @JoinColumn({ name: "file_id" })
  file!: Relation<FileAsset>;
}
