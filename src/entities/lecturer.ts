import {
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryColumn,
  Relation,
} from "typeorm";
import { Appeal } from "./appeal.js";
import { CourseLecturer } from "./course-lecturer.js";
import { User } from "./user.js";

@Entity({ name: "lecturers" })
export class Lecturer {
  @PrimaryColumn("uuid", { name: "user_id" })
  userId!: string;

  @OneToOne(() => User, (user) => user.lecturer, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: Relation<User>;

  @OneToMany(
    () => CourseLecturer,
    (courseLecturer) => courseLecturer.lecturer,
  )
  courseAssignments!: Relation<CourseLecturer>[];

  @OneToMany(() => Appeal, (appeal) => appeal.reviewer)
  reviewedAppeals!: Relation<Appeal>[];
}
