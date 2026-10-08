import assert from "node:assert/strict";
import test from "node:test";
import {
  AssignmentStatus,
  EvaluationStatus,
  SubmissionStatus,
} from "../entities/enums.js";
import {
  assertNewAttemptAllowed,
  assertSubmissionWindowOpen,
  SubmissionRejectedError,
  type SubmissionRejectionCode,
} from "./submission.repository.js";

const now = new Date("2026-10-08T12:00:00.000Z");
const hoursFromNow = (hours: number) =>
  new Date(now.getTime() + hours * 60 * 60 * 1000);

const rejectsWith = (run: () => void, code: SubmissionRejectionCode) =>
  assert.throws(
    run,
    (error: unknown) =>
      error instanceof SubmissionRejectedError && error.code === code,
  );

test("submissions are accepted only while the assignment window is open", () => {
  const open = {
    status: AssignmentStatus.PUBLISHED,
    startAt: hoursFromNow(-24),
    dueAt: hoursFromNow(24),
  };
  assert.doesNotThrow(() => assertSubmissionWindowOpen(open, now));
  assert.doesNotThrow(() =>
    assertSubmissionWindowOpen(
      { status: AssignmentStatus.PUBLISHED, startAt: null, dueAt: null },
      now,
    ),
  );

  rejectsWith(
    () => assertSubmissionWindowOpen({ ...open, dueAt: hoursFromNow(-1) }, now),
    "DEADLINE_PASSED",
  );
  rejectsWith(
    () => assertSubmissionWindowOpen({ ...open, dueAt: now }, now),
    "DEADLINE_PASSED",
  );
  rejectsWith(
    () => assertSubmissionWindowOpen({ ...open, startAt: hoursFromNow(1) }, now),
    "ASSIGNMENT_NOT_OPEN",
  );
  rejectsWith(
    () =>
      assertSubmissionWindowOpen({ ...open, status: AssignmentStatus.CLOSED }, now),
    "ASSIGNMENT_CLOSED",
  );
  rejectsWith(
    () =>
      assertSubmissionWindowOpen(
        { ...open, status: AssignmentStatus.ARCHIVED },
        now,
      ),
    "ASSIGNMENT_CLOSED",
  );
});

test("a new attempt requires the previous attempt to be submitted and graded", () => {
  assert.doesNotThrow(() => assertNewAttemptAllowed(null));
  assert.doesNotThrow(() =>
    assertNewAttemptAllowed({
      status: SubmissionStatus.SUBMITTED,
      evaluations: [{ status: EvaluationStatus.COMPLETED }],
    }),
  );
  assert.doesNotThrow(() =>
    assertNewAttemptAllowed({
      status: SubmissionStatus.SUBMITTED,
      evaluations: [{ status: EvaluationStatus.FAILED }],
    }),
  );

  rejectsWith(
    () => assertNewAttemptAllowed({ status: SubmissionStatus.DRAFT }),
    "DRAFT_EXISTS",
  );
  rejectsWith(
    () =>
      assertNewAttemptAllowed({ status: SubmissionStatus.SUBMITTED, evaluations: [] }),
    "GRADING_IN_PROGRESS",
  );
  rejectsWith(
    () =>
      assertNewAttemptAllowed({
        status: SubmissionStatus.SUBMITTED,
        evaluations: [{ status: EvaluationStatus.PROCESSING }],
      }),
    "GRADING_IN_PROGRESS",
  );
});
