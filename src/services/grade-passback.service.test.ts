import assert from "node:assert/strict";
import test from "node:test";
import {
  EvaluationStatus,
  LtiScoreSyncStatus,
  SubmissionStatus,
} from "../entities/enums.js";
import { Evaluation } from "../entities/evaluation.js";
import { LtiResourceLink } from "../entities/lti-resource-link.js";
import { LtiScoreSync } from "../entities/lti-score-sync.js";
import { LtiUserIdentity } from "../entities/lti-user-identity.js";
import { Submission } from "../entities/submission.js";
import {
  GradePassbackService,
  retryDelayMs,
  type AgsScore,
  type ScoreSubmitter,
} from "./grade-passback.service.js";

const now = new Date("2026-10-08T12:00:00.000Z");

const evaluation = (
  id: string,
  score: number | null,
  overrides: Partial<Evaluation> = {},
) =>
  Object.assign(new Evaluation(), {
    id,
    score,
    maxScore: 100,
    isFinal: true,
    status: EvaluationStatus.COMPLETED,
    createdAt: now,
    completedAt: now,
    ...overrides,
  });

const submission = (
  studentId: string,
  attemptNumber: number,
  evaluations: Evaluation[],
  status = SubmissionStatus.SUBMITTED,
) =>
  Object.assign(new Submission(), {
    id: `${studentId}-${attemptNumber}`,
    assignmentId: "assignment-1",
    studentId,
    attemptNumber,
    status,
    evaluations,
  });

const createHarness = (submissions: Submission[]) => {
  const syncs = new Map<string, LtiScoreSync>();
  const link = Object.assign(new LtiResourceLink(), {
    platformId: "platform-1",
    resourceLinkId: "resource-1",
    assignmentId: "assignment-1",
    lineItemUrl: "https://moodle.example/mod/lti/services.php/2/lineitems/7/lineitem?type_id=1",
    platform: { issuer: "https://moodle.example", clientId: "client-1" },
  });
  const identities = [
    Object.assign(new LtiUserIdentity(), {
      platformId: "platform-1",
      subject: "moodle-41",
      userId: "alice",
    }),
    Object.assign(new LtiUserIdentity(), {
      platformId: "platform-1",
      subject: "moodle-42",
      userId: "bob",
    }),
  ];
  const repositories = new Map<unknown, unknown>([
    [LtiResourceLink, { find: async () => [link] }],
    [
      Submission,
      {
        find: async () =>
          submissions.filter((item) => item.status === SubmissionStatus.SUBMITTED),
      },
    ],
    [LtiUserIdentity, { find: async () => identities }],
    [
      LtiScoreSync,
      {
        find: async () => [...syncs.values()],
        save: async (row: Partial<LtiScoreSync>) => {
          syncs.set(row.studentId as string, Object.assign(new LtiScoreSync(), row));
        },
      },
    ],
  ]);
  const dataSource = { getRepository: (entity: unknown) => repositories.get(entity) };
  return { dataSource: dataSource as never, syncs };
};

const recordingSubmitter = () => {
  const calls: Array<{ lineItemUrl: string; score: AgsScore; issuer: string }> = [];
  const submit: ScoreSubmitter = async (platform, lineItemUrl, score) => {
    calls.push({ lineItemUrl, score, issuer: platform.issuer });
  };
  return { calls, submit };
};

test("sends each student's latest final grade to the AGS line item", async () => {
  const { dataSource, syncs } = createHarness([
    submission("alice", 1, [evaluation("alice-eval-1", 55)]),
    submission("alice", 2, [evaluation("alice-eval-2", 88)]),
    submission("bob", 1, [evaluation("bob-eval-1", null, { status: EvaluationStatus.PENDING, isFinal: false })]),
  ]);
  const { calls, submit } = recordingSubmitter();

  const result = await new GradePassbackService(dataSource, submit, 1_000).syncPendingGrades(now);

  assert.deepEqual(result, { synced: 1, failed: 0 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].issuer, "https://moodle.example");
  assert.deepEqual(calls[0].score, {
    userId: "moodle-41",
    scoreGiven: 88,
    scoreMaximum: 100,
    activityProgress: "Completed",
    gradingProgress: "FullyGraded",
  });
  assert.equal(syncs.get("alice")?.status, LtiScoreSyncStatus.SYNCED);
  assert.equal(syncs.get("alice")?.evaluationId, "alice-eval-2");
});

test("does not resend a grade that is already in the gradebook", async () => {
  const { dataSource } = createHarness([
    submission("alice", 1, [evaluation("alice-eval-1", 70)]),
  ]);
  const { calls, submit } = recordingSubmitter();
  const service = new GradePassbackService(dataSource, submit, 1_000);

  await service.syncPendingGrades(now);
  await service.syncPendingGrades(new Date(now.getTime() + 60_000));

  assert.equal(calls.length, 1);
});

test("a changed grade, for example after an accepted appeal, is sent again", async () => {
  const submissions = [submission("alice", 1, [evaluation("alice-eval-1", 70)])];
  const { dataSource } = createHarness(submissions);
  const { calls, submit } = recordingSubmitter();
  const service = new GradePassbackService(dataSource, submit, 1_000);

  await service.syncPendingGrades(now);
  submissions[0].evaluations = [
    evaluation("alice-eval-1", 70, { isFinal: false }),
    evaluation("alice-eval-appeal", 85),
  ];
  await service.syncPendingGrades(now);

  assert.deepEqual(
    calls.map((call) => call.score.scoreGiven),
    [70, 85],
  );
});

test("failed passback is recorded and retried only after backoff", async () => {
  const { dataSource, syncs } = createHarness([
    submission("alice", 1, [evaluation("alice-eval-1", 70)]),
  ]);
  let attempts = 0;
  const failing: ScoreSubmitter = async () => {
    attempts += 1;
    throw new Error("platform unavailable");
  };
  const service = new GradePassbackService(dataSource, failing, 1_000);

  assert.deepEqual(await service.syncPendingGrades(now), { synced: 0, failed: 1 });
  const failed = syncs.get("alice");
  assert.equal(failed?.status, LtiScoreSyncStatus.FAILED);
  assert.equal(failed?.attemptCount, 1);
  assert.match(failed?.lastError ?? "", /platform unavailable/);
  assert.equal(failed?.nextAttemptAt?.getTime(), now.getTime() + retryDelayMs(1));

  await service.syncPendingGrades(new Date(now.getTime() + 1_000));
  assert.equal(attempts, 1);

  await service.syncPendingGrades(new Date(now.getTime() + retryDelayMs(1)));
  assert.equal(attempts, 2);
  assert.equal(syncs.get("alice")?.attemptCount, 2);
});

test("a platform that never answers is treated as a failed attempt", async () => {
  const { dataSource, syncs } = createHarness([
    submission("alice", 1, [evaluation("alice-eval-1", 70)]),
  ]);
  const hanging: ScoreSubmitter = () => new Promise(() => undefined);

  const result = await new GradePassbackService(dataSource, hanging, 50).syncPendingGrades(now);

  assert.deepEqual(result, { synced: 0, failed: 1 });
  assert.match(syncs.get("alice")?.lastError ?? "", /timed out/);
});

test("retry delay grows exponentially and is capped", () => {
  assert.equal(retryDelayMs(1), 60_000);
  assert.equal(retryDelayMs(2), 120_000);
  assert.equal(retryDelayMs(30), 6 * 60 * 60 * 1000);
});
