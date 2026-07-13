import {
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryColumn,
  Relation,
} from "typeorm";
import { Appeal } from "./appeal.js";
import { Enrollment } from "./enrollment.js";
import { Submission } from "./submission.js";
import { User } from "./user.js";

@Entity({ name: "students" })
export class Student {
  @PrimaryColumn("uuid", { name: "user_id" })
  userId!: string;

  @OneToOne(() => User, (user) => user.student, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: Relation<User>;

  @OneToMany(() => Enrollment, (enrollment) => enrollment.student)
  enrollments!: Relation<Enrollment>[];

  @OneToMany(() => Submission, (submission) => submission.student)
  submissions!: Relation<Submission>[];

  @OneToMany(() => Appeal, (appeal) => appeal.student)
  appeals!: Relation<Appeal>[];
}
