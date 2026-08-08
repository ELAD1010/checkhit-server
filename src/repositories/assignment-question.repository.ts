import { randomUUID } from "node:crypto";
import { DataSource, EntityManager } from "typeorm";
import { AppDataSource } from "../database/data-source.js";
import { Assignment } from "../entities/assignment.js";
import { AssignmentQuestion } from "../entities/assignment-question.js";
import { QuestionSource } from "../entities/enums.js";

export type QuestionInput = {
  questionKey: string;
  orderIndex: number;
  prompt: string;
  rubric?: string | null;
  maxScore: number;
  source?: QuestionSource;
  importId?: string | null;
};

export class AssignmentNotFoundError extends Error {
  constructor(readonly assignmentId: string) {
    super(`Assignment not found: ${assignmentId}`);
    this.name = "AssignmentNotFoundError";
  }
}

export class QuestionScoreMismatchError extends Error {
  constructor(
    readonly assignmentMaxScore: number,
    readonly questionsMaxScore: number,
  ) {
    super(
      `Question max scores (${questionsMaxScore}) must be at least the assignment max score (${assignmentMaxScore})`,
    );
    this.name = "QuestionScoreMismatchError";
  }
}

const roundScore = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export class AssignmentQuestionRepository {
  constructor(private readonly dataSource: DataSource = AppDataSource) {}

  async listByAssignmentId(
    assignmentId: string,
  ): Promise<AssignmentQuestion[]> {
    return this.dataSource.getRepository(AssignmentQuestion).find({
      where: { assignmentId, isActive: true },
      order: { orderIndex: "ASC" },
    });
  }

  async listByQuestionSetId(
    assignmentId: string,
    questionSetId: string,
  ): Promise<AssignmentQuestion[]> {
    return this.dataSource.getRepository(AssignmentQuestion).find({
      where: { assignmentId, questionSetId },
      order: { orderIndex: "ASC" },
    });
  }

  async replaceQuestions(
    assignmentId: string,
    questions: QuestionInput[],
  ): Promise<AssignmentQuestion[]> {
    return this.dataSource.transaction(async (manager) => {
      const assignment = await manager.getRepository(Assignment).findOne({
        where: { id: assignmentId },
        lock: { mode: "pessimistic_write" },
      });

      if (!assignment) {
        throw new AssignmentNotFoundError(assignmentId);
      }

      this.assertQuestionScoreSum(assignment.maxScore, questions);

      if (questions.length === 0) {
        return [];
      }

      assignment.questionSelectionInstructions = null;
      await manager.getRepository(Assignment).save(assignment);

      const repository = manager.getRepository(AssignmentQuestion);
      await repository.update(
        { assignmentId, isActive: true },
        { isActive: false },
      );
      const questionSetId = randomUUID();
      return repository.save(
        questions.map((question) =>
          repository.create({
            assignmentId,
            questionSetId,
            isActive: true,
            questionKey: question.questionKey,
            orderIndex: question.orderIndex,
            prompt: question.prompt,
            rubric: question.rubric ?? null,
            maxScore: question.maxScore,
            source: question.source ?? QuestionSource.MANUAL,
            importId: question.importId ?? null,
          }),
        ),
      );
    });
  }

  async replaceQuestionsWithManager(
    manager: EntityManager,
    assignmentId: string,
    assignmentMaxScore: number,
    questions: QuestionInput[],
  ): Promise<AssignmentQuestion[]> {
    this.assertQuestionScoreSum(assignmentMaxScore, questions);

    if (questions.length === 0) {
      return [];
    }

    const assignment = await manager.getRepository(Assignment).findOne({
      where: { id: assignmentId },
      lock: { mode: "pessimistic_write" },
    });
    if (!assignment) {
      throw new AssignmentNotFoundError(assignmentId);
    }

    const repository = manager.getRepository(AssignmentQuestion);
    await repository.update(
      { assignmentId, isActive: true },
      { isActive: false },
    );
    const questionSetId = randomUUID();
    return repository.save(
      questions.map((question) =>
        repository.create({
          assignmentId,
          questionSetId,
          isActive: true,
          questionKey: question.questionKey,
          orderIndex: question.orderIndex,
          prompt: question.prompt,
          rubric: question.rubric ?? null,
          maxScore: question.maxScore,
          source: question.source ?? QuestionSource.MANUAL,
          importId: question.importId ?? null,
        }),
      ),
    );
  }

  assertQuestionScoreSum(
    assignmentMaxScore: number,
    questions: Array<{ maxScore: number }>,
  ): void {
    const total = roundScore(
      questions.reduce((sum, question) => sum + question.maxScore, 0),
    );
    const expected = roundScore(assignmentMaxScore);

    if (questions.length > 0 && total < expected) {
      throw new QuestionScoreMismatchError(expected, total);
    }
  }
}
