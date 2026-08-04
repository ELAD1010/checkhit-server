import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from "typeorm";
import { NotificationCategory } from "./enums.js";
import { User } from "./user.js";

@Entity({ name: "notifications" })
@Index("IDX_notification_recipient", ["recipientId"])
@Index("IDX_notification_recipient_unread", ["recipientId", "isRead"])
@Index("IDX_notification_recipient_created", ["recipientId", "createdAt"])
export class Notification {
  @PrimaryGeneratedColumn("uuid", { name: "notification_id" })
  id!: string;

  @Column("uuid", { name: "recipient_id" })
  recipientId!: string;

  @ManyToOne(() => User, (user) => user.notifications, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "recipient_id" })
  recipient!: Relation<User>;

  @Column({ type: "varchar", length: 255 })
  title!: string;

  @Column({ type: "text" })
  body!: string;

  @Column({
    type: "enum",
    enum: NotificationCategory,
    enumName: "notification_category",
  })
  category!: NotificationCategory;

  @Column({ name: "is_read", type: "boolean", default: false })
  isRead!: boolean;

  @Column({ type: "varchar", length: 500, nullable: true })
  link!: string | null;

  @Column({ type: "jsonb", nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ name: "read_at", type: "timestamptz", nullable: true })
  readAt!: Date | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
