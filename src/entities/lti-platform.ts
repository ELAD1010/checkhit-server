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
import { LtiCourseContext } from "./lti-course-context.js";
import { LtiResourceLink } from "./lti-resource-link.js";
import { LtiUserIdentity } from "./lti-user-identity.js";

@Entity({ name: "lti_platforms" })
@Index(
  "UQ_lti_platform_registration",
  ["issuer", "clientId", "deploymentId"],
  { unique: true },
)
export class LtiPlatform {
  @PrimaryGeneratedColumn("uuid", { name: "platform_id" })
  id!: string;

  @Column({ type: "text" })
  issuer!: string;

  @Column({ name: "client_id", type: "varchar", length: 255 })
  clientId!: string;

  @Column({ name: "deployment_id", type: "varchar", length: 255 })
  deploymentId!: string;

  @OneToMany(() => LtiUserIdentity, (identity) => identity.platform)
  userIdentities!: Relation<LtiUserIdentity>[];

  @OneToMany(() => LtiCourseContext, (context) => context.platform)
  courseContexts!: Relation<LtiCourseContext>[];

  @OneToMany(() => LtiResourceLink, (resourceLink) => resourceLink.platform)
  resourceLinks!: Relation<LtiResourceLink>[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
