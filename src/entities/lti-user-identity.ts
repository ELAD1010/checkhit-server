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
import { LtiPlatform } from "./lti-platform.js";
import { User } from "./user.js";

@Entity({ name: "lti_user_identities" })
@Index("IDX_lti_user_identity_user", ["userId"])
export class LtiUserIdentity {
  @PrimaryColumn("uuid", { name: "platform_id" })
  platformId!: string;

  @PrimaryColumn({ name: "subject", type: "varchar", length: 255 })
  subject!: string;

  @Column("uuid", { name: "user_id" })
  userId!: string;

  @ManyToOne(() => LtiPlatform, (platform) => platform.userIdentities, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "platform_id" })
  platform!: Relation<LtiPlatform>;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: Relation<User>;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
