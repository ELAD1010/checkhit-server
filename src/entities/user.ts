import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToOne,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from "typeorm";
import { Lecturer } from "./lecturer.js";
import { Student } from "./student.js";
import { UserRole } from "./enums.js";

@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn("uuid", { name: "user_id" })
  id!: string;

  @Column({ type: "varchar", length: 200 })
  name!: string;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 320, nullable: true })
  email!: string | null;

  @Column({ type: "enum", enum: UserRole, enumName: "user_role" })
  role!: UserRole;

  @Column({ name: "lti_subject", type: "varchar", length: 255, nullable: true })
  ltiSubject!: string | null;

  @OneToOne(() => Student, (student) => student.user)
  student!: Relation<Student> | null;

  @OneToOne(() => Lecturer, (lecturer) => lecturer.user)
  lecturer!: Relation<Lecturer> | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
