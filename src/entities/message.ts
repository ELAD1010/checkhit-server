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
  UpdateDateColumn,
} from "typeorm";
import { Course } from "./course.js";
import { MessageTargetType } from "./enums.js";
import { MessageRecipient } from "./message-recipient.js";
import { User } from "./user.js";

@Entity({ name: "messages" })
@Index("IDX_message_sender", ["senderId"])
@Index("IDX_message_course", ["courseId"])
@Index("IDX_message_parent", ["parentMessageId"])
@Index("IDX_message_created_at", ["createdAt"])
export class Message {
  @PrimaryGeneratedColumn("uuid", { name: "message_id" })
  id!: string;

  @Column("uuid", { name: "sender_id" })
  senderId!: string;

  @ManyToOne(() => User, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "sender_id" })
  sender!: Relation<User>;

  @Column("uuid", { name: "course_id", nullable: true })
  courseId!: string | null;

  @ManyToOne(() => Course, {
    onDelete: "SET NULL",
    nullable: true,
  })
  @JoinColumn({ name: "course_id" })
  course!: Relation<Course> | null;

  @Column({
    name: "target_type",
    type: "enum",
    enum: MessageTargetType,
    enumName: "message_target_type",
    default: MessageTargetType.DIRECT,
  })
  targetType!: MessageTargetType;

  @Column({ type: "varchar", length: 300 })
  subject!: string;

  @Column({ type: "text" })
  content!: string;

  @Column({ name: "is_priority", type: "boolean", default: false })
  isPriority!: boolean;

  @Column("uuid", { name: "parent_message_id", nullable: true })
  parentMessageId!: string | null;

  @ManyToOne(() => Message, (message) => message.replies, {
    onDelete: "CASCADE",
    nullable: true,
  })
  @JoinColumn({ name: "parent_message_id" })
  parentMessage!: Relation<Message> | null;

  @OneToMany(() => Message, (message) => message.parentMessage)
  replies!: Relation<Message>[];

  @OneToMany(() => MessageRecipient, (recipient) => recipient.message)
  recipients!: Relation<MessageRecipient>[];

  @Column({ name: "is_deleted_by_sender", type: "boolean", default: false })
  isDeletedBySender!: boolean;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;

  // Unmapped/virtual computed properties for API responses
  snippet?: string;
  isRead?: boolean;
  readAt?: Date | null;
  isArchived?: boolean;
  isSentByMe?: boolean;
  recipientCount?: number;
  readCount?: number;
  repliesCount?: number;
}
