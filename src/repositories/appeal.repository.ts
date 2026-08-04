import { DataSource, FindOptionsWhere, In, Repository } from "typeorm";
import { AppDataSource } from "../database/data-source.js";
import { Appeal } from "../entities/appeal.js";
import { AppealStatus } from "../entities/enums.js";
import { Student } from "../entities/student.js";

export class AppealStudentNotFoundError extends Error {
  constructor(studentId: string) {
    super(`Student with ID ${studentId} was not found`);
    this.name = "AppealStudentNotFoundError";
  }
}

export interface StudentAppealsQueryOptions {
  limit?: number;
  status?: "IN_PROGRESS" | "PENDING" | AppealStatus | string;
}

export class AppealRepository {
  private appealRepo: Repository<Appeal>;
  private studentRepo: Repository<Student>;

  constructor(dataSource: DataSource = AppDataSource) {
    this.appealRepo = dataSource.getRepository(Appeal);
    this.studentRepo = dataSource.getRepository(Student);
  }

  async findAppealsByStudentId(
    studentId: string,
    options?: StudentAppealsQueryOptions,
  ): Promise<Appeal[]> {
    const student = await this.studentRepo.findOne({
      where: { userId: studentId },
    });

    if (!student) {
      throw new AppealStudentNotFoundError(studentId);
    }

    const whereClause: FindOptionsWhere<Appeal> = { studentId };

    if (options?.status) {
      const statusUpper = options.status.toUpperCase();
      if (statusUpper === "IN_PROGRESS" || statusUpper === "PENDING") {
        whereClause.status = In([
          AppealStatus.SUBMITTED,
          AppealStatus.UNDER_REVIEW,
        ]);
      } else if (Object.values(AppealStatus).includes(statusUpper as AppealStatus)) {
        whereClause.status = statusUpper as AppealStatus;
      }
    }

    return this.appealRepo.find({
      where: whereClause,
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
      take: options?.limit && options.limit > 0 ? options.limit : undefined,
    });
  }
}

