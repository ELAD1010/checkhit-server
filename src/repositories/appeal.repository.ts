import { DataSource, Repository } from "typeorm";
import { AppDataSource } from "../database/data-source.js";
import { Appeal } from "../entities/appeal.js";
import { Student } from "../entities/student.js";

export class AppealStudentNotFoundError extends Error {
  constructor(studentId: string) {
    super(`Student with ID ${studentId} was not found`);
    this.name = "AppealStudentNotFoundError";
  }
}

export class AppealRepository {
  private appealRepo: Repository<Appeal>;
  private studentRepo: Repository<Student>;

  constructor(dataSource: DataSource = AppDataSource) {
    this.appealRepo = dataSource.getRepository(Appeal);
    this.studentRepo = dataSource.getRepository(Student);
  }

  async findAppealsByStudentId(studentId: string): Promise<Appeal[]> {
    const student = await this.studentRepo.findOne({
      where: { userId: studentId },
    });

    if (!student) {
      throw new AppealStudentNotFoundError(studentId);
    }

    return this.appealRepo.find({
      where: { studentId },
      relations: {
        submission: {
          assignment: {
            course: true,
          },
        },
        evaluation: true,
        reviewer: {
          user: true,
        },
        files: {
          file: true,
        },
      },
      order: {
        createdAt: "DESC",
      },
    });
  }
}
