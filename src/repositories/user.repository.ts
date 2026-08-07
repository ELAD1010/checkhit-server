import { DataSource, EntityManager } from "typeorm";
import { AppDataSource } from "../database/data-source.js";
import { Lecturer } from "../entities/lecturer.js";
import { Student } from "../entities/student.js";
import { MembershipStatus, UserRole } from "../entities/enums.js";
import { User } from "../entities/user.js";

export type CreateUserInput = {
  name: string;
  email: string;
};

export class UserRepository {
  constructor(private readonly dataSource: DataSource = AppDataSource) {}

  async createStudent(input: CreateUserInput): Promise<Student> {
    return this.dataSource.transaction(async (manager) => {
      const user = await this.createUser(manager, input, UserRole.STUDENT);
      const studentRepository = manager.getRepository(Student);

      await studentRepository.save(
        studentRepository.create({
          userId: user.id,
          user,
        }),
      );

      return studentRepository.findOneOrFail({
        where: { userId: user.id },
        relations: { user: true },
      });
    });
  }

  async createLecturer(input: CreateUserInput): Promise<Lecturer> {
    return this.dataSource.transaction(async (manager) => {
      const user = await this.createUser(manager, input, UserRole.LECTURER);
      const lecturerRepository = manager.getRepository(Lecturer);

      await lecturerRepository.save(
        lecturerRepository.create({
          userId: user.id,
          user,
        }),
      );

      return lecturerRepository.findOneOrFail({
        where: { userId: user.id },
        relations: { user: true },
      });
    });
  }

  async findStudentById(userId: string): Promise<Student | null> {
    return this.dataSource.getRepository(Student).findOne({
      where: { userId },
      relations: { user: true },
    });
  }

  async findLecturerById(userId: string): Promise<Lecturer | null> {
    return this.dataSource.getRepository(Lecturer).findOne({
      where: { userId },
      relations: { user: true },
    });
  }

  async findStudentsByCourseId(courseId: string): Promise<Student[]> {
    return this.dataSource
      .getRepository(Student)
      .createQueryBuilder("student")
      .innerJoin(
        "student.enrollments",
        "enrollment",
        "enrollment.course_id = :courseId AND enrollment.status = :status",
        {
          courseId,
          status: MembershipStatus.ACTIVE,
        },
      )
      .innerJoinAndSelect("student.user", "user")
      .orderBy("user.name", "ASC")
      .getMany();
  }

  private async createUser(
    manager: EntityManager,
    input: CreateUserInput,
    role: UserRole,
  ): Promise<User> {
    const userRepository = manager.getRepository(User);
    const user = userRepository.create({
      name: input.name,
      email: input.email,
      ltiSubject: null,
      role,
    });

    return userRepository.save(user);
  }
}
