import {
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Relation,
} from "typeorm";
import { FileAsset } from "./file-asset.js";
import { Resource } from "./resource.js";

@Entity({ name: "resource_files" })
export class ResourceFile {
  @PrimaryColumn("uuid", { name: "resource_id" })
  resourceId!: string;

  @PrimaryColumn("uuid", { name: "file_id" })
  fileId!: string;

  @ManyToOne(() => Resource, (resource) => resource.files, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "resource_id" })
  resource!: Relation<Resource>;

  @ManyToOne(() => FileAsset, (file) => file.resourceLinks, {
    onDelete: "RESTRICT",
  })
  @JoinColumn({ name: "file_id" })
  file!: Relation<FileAsset>;
}
