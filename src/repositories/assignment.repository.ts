import { DataSource } from "typeorm";
import { AppDataSource } from "../database/data-source.js";
import { Assignment } from "../entities/assignment.js";
import { Course } from "../entities/course.js";
import { AssignmentStatus } from "../entities/enums.js";

export type CreateAssignmentInput = {
  courseId: string;
  name: string;
  description: string;
  type: string;
  evaluationInstructions: string;
  maxScore: number;
  startAt?: Date | null;
  dueAt?: Date | null;
  status?: AssignmentStatus;
  ltiResourceLinkId?: string | null;
  ltiLineItemUrl?: string | null;
};

export class AssignmentCourseNotFoundError extends Error {
  constructor(readonly courseId: string) {
    super(`Course not found: ${courseId}`);
    this.name = "AssignmentCourseNotFoundError";
  }
}

export class AssignmentRepository {
  constructor(private readonly dataSource: DataSource = AppDataSource) {}

  async createAssignment(input: CreateAssignmentInput): Promise<Assignment> {
    const courseExists = await this.dataSource
      .getRepository(Course)
      .existsBy({ id: input.courseId });

    if (!courseExists) {
      throw new AssignmentCourseNotFoundError(input.courseId);
    }

    const assignmentRepository = this.dataSource.getRepository(Assignment);
    return assignmentRepository.save(
      assignmentRepository.create({
        courseId: input.courseId,
        name: input.name,
        description: input.description,
        type: input.type,
        evaluationInstructions: input.evaluationInstructions,
        maxScore: input.maxScore,
        startAt: input.startAt ?? null,
        dueAt: input.dueAt ?? null,
        status: input.status ?? AssignmentStatus.DRAFT,
        ltiResourceLinkId: input.ltiResourceLinkId ?? null,
        ltiLineItemUrl: input.ltiLineItemUrl ?? null,
      }),
    );
  }

  async findAssignmentById(assignmentId: string): Promise<Assignment | null> {
    return this.dataSource.getRepository(Assignment).findOne({
      where: { id: assignmentId },
      relations: { course: true },
    });
  }

  async findAssignmentsByCourseId(courseId: string): Promise<Assignment[]> {
    const courseExists = await this.dataSource
      .getRepository(Course)
      .existsBy({ id: courseId });

    if (!courseExists) {
      throw new AssignmentCourseNotFoundError(courseId);
    }

    return this.dataSource.getRepository(Assignment).find({
      where: { courseId },
      order: {
        createdAt: "DESC",
      },
    });
  }

  async deleteAssignment(assignmentId: string): Promise<boolean> {
    const result = await this.dataSource
      .getRepository(Assignment)
      .delete(assignmentId);
    return result.affected === 1;
  }
}
