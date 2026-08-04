import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { Message } from "./message.js";
import { User } from "./user.js";

@Entity({ name: "message_recipients" })
@Unique("UQ_message_recipient", ["messageId", "recipientId"])
@Index("IDX_message_recipient_user", ["recipientId"])
@Index("IDX_message_recipient_user_unread", ["recipientId", "isRead"])
@Index("IDX_message_recipient_user_archived", ["recipientId", "isArchived"])
@Index("IDX_message_recipient_message", ["messageId"])
export class MessageRecipient {
  @PrimaryGeneratedColumn("uuid", { name: "recipient_entry_id" })
  id!: string;

  @Column("uuid", { name: "message_id" })
  messageId!: string;

  @ManyToOne(() => Message, (message) => message.recipients, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "message_id" })
  message!: Relation<Message>;

  @Column("uuid", { name: "recipient_id" })
  recipientId!: string;

  @ManyToOne(() => User, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "recipient_id" })
  recipient!: Relation<User>;

  @Column({ name: "is_read", type: "boolean", default: false })
  isRead!: boolean;

  @Column({ name: "read_at", type: "timestamptz", nullable: true })
  readAt!: Date | null;

  @Column({ name: "is_archived", type: "boolean", default: false })
  isArchived!: boolean;

  @Column({ name: "is_deleted", type: "boolean", default: false })
  isDeleted!: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
