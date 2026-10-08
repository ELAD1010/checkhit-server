import { Provider } from "ltijs";
import { DataSource, In, IsNull, Not } from "typeorm";
import { AppDataSource } from "../database/data-source.js";
import {
  EvaluationStatus,
  LtiScoreSyncStatus,
  SubmissionStatus,
} from "../entities/enums.js";
import type { Evaluation } from "../entities/evaluation.js";
import { LtiResourceLink } from "../entities/lti-resource-link.js";
import { LtiScoreSync } from "../entities/lti-score-sync.js";
import { LtiUserIdentity } from "../entities/lti-user-identity.js";
import { Submission } from "../entities/submission.js";

export type AgsScore = {
  userId: string;
  scoreGiven: number;
  scoreMaximum: number;
  activityProgress: "Completed";
  gradingProgress: "FullyGraded";
};

export type ScoreSubmitter = (
  platform: { issuer: string; clientId: string },
  lineItemUrl: string,
  score: AgsScore,
) => Promise<void>;

export type GradeToSync = {
  studentId: string;
  evaluationId: string;
  scoreGiven: number;
  scoreMaximum: number;
};

export type GradePassbackResult = { synced: number; failed: number };

const RETRY_BASE_MS = 60_000;
const RETRY_MAX_MS = 6 * 60 * 60 * 1000;

export const retryDelayMs = (attemptCount: number): number =>
  Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.max(0, attemptCount - 1));

const sameGrade = (previous: LtiScoreSync, grade: GradeToSync): boolean =>
  previous.evaluationId === grade.evaluationId &&
  previous.scoreGiven === grade.scoreGiven &&
  previous.scoreMaximum === grade.scoreMaximum;

export const shouldSendGrade = (
  previous: LtiScoreSync | undefined,
  grade: GradeToSync,
  now: Date,
): boolean => {
  if (!previous || !sameGrade(previous, grade)) return true;
  if (previous.status === LtiScoreSyncStatus.SYNCED) return false;
  return !previous.nextAttemptAt || previous.nextAttemptAt.getTime() <= now.getTime();
};

const isFinalGrade = (evaluation: Evaluation): boolean =>
  evaluation.isFinal &&
  evaluation.status === EvaluationStatus.COMPLETED &&
  evaluation.score !== null;

/**
 * The gradebook mirrors the most recent attempt that has a final grade, which
 * is the grade students see once grading of their latest attempt completes.
 */
export const selectGradesToSync = (submissions: Submission[]): GradeToSync[] => {
  const byStudent = new Map<string, GradeToSync>();
  const ordered = [...submissions].sort((a, b) => b.attemptNumber - a.attemptNumber);
  for (const submission of ordered) {
    if (submission.status !== SubmissionStatus.SUBMITTED) continue;
    if (byStudent.has(submission.studentId)) continue;
    const evaluation = (submission.evaluations ?? [])
      .filter(isFinalGrade)
      .sort(
        (a, b) =>
          (b.completedAt?.getTime() ?? b.createdAt.getTime()) -
          (a.completedAt?.getTime() ?? a.createdAt.getTime()),
      )[0];
    if (!evaluation) continue;
    byStudent.set(submission.studentId, {
      studentId: submission.studentId,
      evaluationId: evaluation.id,
      scoreGiven: evaluation.score as number,
      scoreMaximum: evaluation.maxScore,
    });
  }
  return [...byStudent.values()];
};

const withTimeout = async <T>(operation: Promise<T>, timeoutMs: number): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`AGS score submission timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const errorMessage = (error: unknown): string => {
  const response = (error as { response?: { statusCode?: number; body?: unknown } })
    ?.response;
  const base = error instanceof Error ? error.message : String(error);
  if (!response?.statusCode) return base;
  const body =
    typeof response.body === "string" ? response.body : JSON.stringify(response.body);
  return `${base} (HTTP ${response.statusCode}: ${String(body ?? "").slice(0, 500)})`;
};

// @types/ltijs still describes the 4.x grade API; ltijs 5.x exposes submitScore.
type LtijsAgsService = {
  submitScore(
    idtoken: { iss: string; clientId: string },
    lineItemUrl: string,
    score: AgsScore,
  ): Promise<unknown>;
};

export const submitScoreWithLtijs: ScoreSubmitter = async (
  platform,
  lineItemUrl,
  score,
) => {
  // ltijs only reads iss and clientId to resolve the registered platform.
  await (Provider.Grade as unknown as LtijsAgsService).submitScore(
    { iss: platform.issuer, clientId: platform.clientId },
    lineItemUrl,
    { ...score },
  );
};

export class GradePassbackService {
  constructor(
    private readonly dataSource: DataSource = AppDataSource,
    private readonly submitScore: ScoreSubmitter = submitScoreWithLtijs,
    private readonly timeoutOverrideMs?: number,
  ) {}

  private get timeoutMs(): number {
    return (
      this.timeoutOverrideMs ??
      (Number(process.env.GRADE_PASSBACK_TIMEOUT_MS) || 15_000)
    );
  }

  async syncPendingGrades(now: Date = new Date()): Promise<GradePassbackResult> {
    const result: GradePassbackResult = { synced: 0, failed: 0 };
    const links = await this.dataSource.getRepository(LtiResourceLink).find({
      where: { lineItemUrl: Not(IsNull()) },
      relations: { platform: true },
    });

    for (const link of links) {
      const linkResult = await this.syncResourceLink(link, now);
      result.synced += linkResult.synced;
      result.failed += linkResult.failed;
    }
    return result;
  }

  private async syncResourceLink(
    link: LtiResourceLink,
    now: Date,
  ): Promise<GradePassbackResult> {
    const result: GradePassbackResult = { synced: 0, failed: 0 };
    const submissions = await this.dataSource.getRepository(Submission).find({
      where: { assignmentId: link.assignmentId, status: SubmissionStatus.SUBMITTED },
      relations: { evaluations: true },
    });
    const grades = selectGradesToSync(submissions);
    if (grades.length === 0) return result;

    const studentIds = grades.map((grade) => grade.studentId);
    const [identities, previousSyncs] = await Promise.all([
      this.dataSource.getRepository(LtiUserIdentity).find({
        where: { platformId: link.platformId, userId: In(studentIds) },
      }),
      this.dataSource.getRepository(LtiScoreSync).find({
        where: {
          platformId: link.platformId,
          resourceLinkId: link.resourceLinkId,
          studentId: In(studentIds),
        },
      }),
    ]);
    const subjectByStudent = new Map(
      identities.map((identity) => [identity.userId, identity.subject]),
    );
    const previousByStudent = new Map(
      previousSyncs.map((sync) => [sync.studentId, sync]),
    );

    for (const grade of grades) {
      const subject = subjectByStudent.get(grade.studentId);
      const previous = previousByStudent.get(grade.studentId);
      if (!subject || !shouldSendGrade(previous, grade, now)) continue;

      try {
        await withTimeout(
          this.submitScore(
            { issuer: link.platform.issuer, clientId: link.platform.clientId },
            link.lineItemUrl as string,
            {
              userId: subject,
              scoreGiven: grade.scoreGiven,
              scoreMaximum: grade.scoreMaximum,
              activityProgress: "Completed",
              gradingProgress: "FullyGraded",
            },
          ),
          this.timeoutMs,
        );
        await this.record(link, grade, {
          status: LtiScoreSyncStatus.SYNCED,
          attemptCount: 0,
          lastError: null,
          nextAttemptAt: null,
          syncedAt: now,
        });
        result.synced += 1;
      } catch (error) {
        const attemptCount =
          previous && sameGrade(previous, grade) ? previous.attemptCount + 1 : 1;
        await this.record(link, grade, {
          status: LtiScoreSyncStatus.FAILED,
          attemptCount,
          lastError: errorMessage(error),
          nextAttemptAt: new Date(now.getTime() + retryDelayMs(attemptCount)),
          syncedAt: previous?.syncedAt ?? null,
        });
        result.failed += 1;
        console.warn(
          `Grade passback failed for student ${grade.studentId} on resource link ${link.resourceLinkId}:`,
          errorMessage(error),
        );
      }
    }
    return result;
  }

  private async record(
    link: LtiResourceLink,
    grade: GradeToSync,
    state: Pick<
      LtiScoreSync,
      "status" | "attemptCount" | "lastError" | "nextAttemptAt" | "syncedAt"
    >,
  ): Promise<void> {
    await this.dataSource.getRepository(LtiScoreSync).save({
      platformId: link.platformId,
      resourceLinkId: link.resourceLinkId,
      studentId: grade.studentId,
      evaluationId: grade.evaluationId,
      scoreGiven: grade.scoreGiven,
      scoreMaximum: grade.scoreMaximum,
      ...state,
    });
  }
}

export const gradePassbackService = new GradePassbackService();
