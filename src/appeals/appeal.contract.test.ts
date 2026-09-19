import assert from "node:assert/strict";
import test from "node:test";
import { getMetadataArgsStorage } from "typeorm";
import { Appeal } from "../entities/appeal.js";
import {
  AppealStatus,
  EvaluationStatus,
  SubmissionStatus,
} from "../entities/enums.js";
import type { Evaluation } from "../entities/evaluation.js";
import {
  APPEAL_CATEGORIES,
  AppealConflictError,
  AppealForbiddenError,
  AppealValidationError,
  assertAppealCanBeResolved,
  getAppealClaimAction,
  selectAppealableEvaluation,
  validateRevisedScore,
} from "../repositories/appeal.repository.js";
import {
  assertFileContentMatchesMime,
  PDF_MIME,
  UploadValidationError,
} from "../storage/upload-mime.js";

test("appeal categories expose only the supported API values", () => {
  assert.deepEqual(APPEAL_CATEGORIES, [
    "grading_error",
    "misunderstanding",
    "technical",
    "other",
  ]);
});

test("Appeal has a unique database index for one appeal per submission", () => {
  const index = getMetadataArgsStorage().indices.find(
    (candidate) =>
      candidate.target === Appeal && candidate.name === "UQ_appeal_submission",
  );

  assert.ok(index);
  assert.equal(index.unique, true);
  assert.deepEqual(index.columns, ["submissionId"]);
});

test("appeal evidence accepts a PDF signature", () => {
  assert.doesNotThrow(() =>
    assertFileContentMatchesMime(Buffer.from("%PDF-1.7\n"), PDF_MIME),
  );
});

test("appeal evidence rejects a renamed non-PDF", () => {
  assert.throws(
    () => assertFileContentMatchesMime(Buffer.from("not a pdf"), PDF_MIME),
    UploadValidationError,
  );
});

test("appeal domain errors retain distinct validation, access, and conflict types", () => {
  assert.equal(new AppealValidationError("invalid").name, "AppealValidationError");
  assert.equal(new AppealForbiddenError().name, "AppealForbiddenError");
  assert.equal(new AppealConflictError("duplicate").name, "AppealConflictError");
});

const completedFinalEvaluation = {
  id: "evaluation-1",
  score: 80,
  maxScore: 100,
  status: EvaluationStatus.COMPLETED,
  isFinal: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  completedAt: new Date("2026-01-01T00:01:00Z"),
} as Evaluation;

test("submission policy enforces ownership, grading, and one lifetime appeal", () => {
  const valid = {
    submissionStatus: SubmissionStatus.SUBMITTED,
    submissionStudentId: "student-a",
    actorStudentId: "student-a",
    hasExistingAppeal: false,
    evaluations: [completedFinalEvaluation],
  };

  assert.equal(selectAppealableEvaluation(valid), completedFinalEvaluation);
  assert.throws(
    () => selectAppealableEvaluation({ ...valid, actorStudentId: "student-b" }),
    AppealForbiddenError,
  );
  assert.throws(
    () =>
      selectAppealableEvaluation({
        ...valid,
        submissionStatus: SubmissionStatus.DRAFT,
      }),
    AppealValidationError,
  );
  assert.throws(
    () => selectAppealableEvaluation({ ...valid, hasExistingAppeal: true }),
    AppealConflictError,
  );
  assert.throws(
    () => selectAppealableEvaluation({ ...valid, evaluations: [] }),
    AppealValidationError,
  );
});

test("claim policy is idempotent for one lecturer and conflicts for competitors", () => {
  assert.equal(
    getAppealClaimAction(
      { status: AppealStatus.SUBMITTED, reviewerId: null },
      "lecturer-a",
    ),
    "CLAIM",
  );
  assert.equal(
    getAppealClaimAction(
      { status: AppealStatus.UNDER_REVIEW, reviewerId: "lecturer-a" },
      "lecturer-a",
    ),
    "ALREADY_CLAIMED",
  );
  assert.throws(
    () =>
      getAppealClaimAction(
        { status: AppealStatus.UNDER_REVIEW, reviewerId: "lecturer-a" },
        "lecturer-b",
      ),
    AppealConflictError,
  );
  assert.throws(
    () =>
      getAppealClaimAction(
        { status: AppealStatus.ACCEPTED, reviewerId: "lecturer-a" },
        "lecturer-a",
      ),
    AppealConflictError,
  );
});

test("resolution policy requires the assigned lecturer and prevents repeats", () => {
  assert.doesNotThrow(() =>
    assertAppealCanBeResolved(
      { status: AppealStatus.UNDER_REVIEW, reviewerId: "lecturer-a" },
      "lecturer-a",
    ),
  );
  assert.throws(
    () =>
      assertAppealCanBeResolved(
        { status: AppealStatus.UNDER_REVIEW, reviewerId: "lecturer-a" },
        "lecturer-b",
      ),
    AppealConflictError,
  );
  assert.throws(
    () =>
      assertAppealCanBeResolved(
        { status: AppealStatus.REJECTED, reviewerId: "lecturer-a" },
        "lecturer-a",
      ),
    AppealConflictError,
  );
});

test("accepted score policy permits decreases and equality within bounds", () => {
  assert.doesNotThrow(() =>
    validateRevisedScore(AppealStatus.ACCEPTED, 0, 100),
  );
  assert.doesNotThrow(() =>
    validateRevisedScore(AppealStatus.ACCEPTED, 80, 100),
  );
  assert.throws(
    () => validateRevisedScore(AppealStatus.ACCEPTED, -1, 100),
    AppealValidationError,
  );
  assert.throws(
    () => validateRevisedScore(AppealStatus.ACCEPTED, 101, 100),
    AppealValidationError,
  );
  assert.throws(
    () => validateRevisedScore(AppealStatus.ACCEPTED, undefined, 100),
    AppealValidationError,
  );
  assert.doesNotThrow(() =>
    validateRevisedScore(AppealStatus.REJECTED, undefined, 100),
  );
});
