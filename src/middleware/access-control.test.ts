import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import type { NextFunction, Response } from "express";
import { UserRole } from "../entities/enums.js";
import { rejectForeignMessageUser } from "../controllers/message.controller.js";
import {
  CourseAccessService,
  createAccessControl,
} from "./access-control.js";
import type { AuthenticatedRequest } from "./lti-auth.js";

const STUDENT = "11111111-1111-4111-8111-111111111111";
const OTHER_STUDENT = "22222222-2222-4222-8222-222222222222";
const LECTURER = "33333333-3333-4333-8333-333333333333";
const COURSE = "44444444-4444-4444-8444-444444444444";
const OTHER_COURSE = "55555555-5555-4555-8555-555555555555";
const ASSIGNMENT = "66666666-6666-4666-8666-666666666666";

type Outcome = { status?: number; body?: unknown; nextCalled: boolean };

const run = async (
  middleware: (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => void | Promise<void>,
  req: Partial<AuthenticatedRequest>,
  locals: Record<string, unknown> = {},
): Promise<Outcome> => {
  const outcome: Outcome = { nextCalled: false };
  const res = {
    locals,
    status(code: number) {
      outcome.status = code;
      return this;
    },
    json(body: unknown) {
      outcome.body = body;
      return this;
    },
  } as unknown as Response;
  await middleware(
    { params: {}, query: {}, headers: {}, ...req } as AuthenticatedRequest,
    res,
    () => {
      outcome.nextCalled = true;
    },
  );
  return outcome;
};

const studentAuth = {
  userId: STUDENT,
  courseId: COURSE,
  assignmentId: null,
  role: UserRole.STUDENT,
};
const lecturerAuth = {
  userId: LECTURER,
  courseId: COURSE,
  assignmentId: null,
  role: UserRole.LECTURER,
};

class FakeAccess extends CourseAccessService {
  constructor() {
    super({} as never);
  }
  override async isCourseLecturer(lecturerId: string, courseId: string) {
    return lecturerId === LECTURER && courseId === COURSE;
  }
  override async isEnrolled(studentId: string, courseId: string) {
    return studentId === STUDENT && courseId === COURSE;
  }
  override async findAssignmentCourseId(assignmentId: string) {
    return assignmentId === ASSIGNMENT ? OTHER_COURSE : null;
  }
}

const guards = createAccessControl(new FakeAccess());
const originalDevFlag = process.env.ALLOW_INSECURE_DEV_AUTH;

afterEach(() => {
  if (originalDevFlag === undefined) {
    delete process.env.ALLOW_INSECURE_DEV_AUTH;
  } else {
    process.env.ALLOW_INSECURE_DEV_AUTH = originalDevFlag;
  }
});

test("requests without an LTI session are rejected by default", async () => {
  delete process.env.ALLOW_INSECURE_DEV_AUTH;
  const outcome = await run(guards.requireIdentity, {});
  assert.equal(outcome.status, 401);
  assert.equal(outcome.nextCalled, false);
});

test("the insecure local-development fallback must be enabled explicitly", async () => {
  process.env.ALLOW_INSECURE_DEV_AUTH = "true";
  const outcome = await run(guards.requireIdentity, {});
  assert.equal(outcome.nextCalled, true);
});

test("user-provisioning endpoints are unavailable outside local development", async () => {
  delete process.env.ALLOW_INSECURE_DEV_AUTH;
  const outcome = await run(guards.requireInsecureDevAuth, {});
  assert.equal(outcome.status, 403);
});

test("a user can only address their own ID in the path", async () => {
  const self = await run(guards.requireSelf("studentId"), {
    auth: studentAuth,
    params: { studentId: STUDENT },
  });
  const other = await run(guards.requireSelf("studentId"), {
    auth: studentAuth,
    params: { studentId: OTHER_STUDENT },
  });
  assert.equal(self.nextCalled, true);
  assert.equal(other.status, 403);
});

test("course lecturer guard rejects students and lecturers of other courses", async () => {
  const guard = guards.requireCourseLecturer();
  const student = await run(guard, { auth: studentAuth, params: { courseId: COURSE } });
  const foreign = await run(guard, {
    auth: lecturerAuth,
    params: { courseId: OTHER_COURSE },
  });
  const owner = await run(guard, { auth: lecturerAuth, params: { courseId: COURSE } });
  assert.equal(student.status, 403);
  assert.equal(foreign.status, 403);
  assert.equal(owner.nextCalled, true);
});

test("course member guard admits enrolled students only", async () => {
  const guard = guards.requireCourseMember();
  const enrolled = await run(guard, { auth: studentAuth, params: { courseId: COURSE } });
  const outsider = await run(guard, {
    auth: studentAuth,
    params: { courseId: OTHER_COURSE },
  });
  assert.equal(enrolled.nextCalled, true);
  assert.equal(outsider.status, 403);
});

test("assignment guards authorize against the assignment's course", async () => {
  const outcome = await run(guards.requireAssignmentMember(), {
    auth: studentAuth,
    params: { assignmentId: ASSIGNMENT },
  });
  assert.equal(outcome.status, 403);
});

test("message requests cannot claim another user's identity", async () => {
  const spoofed = await run(rejectForeignMessageUser, {
    auth: studentAuth,
    headers: { "x-user-id": OTHER_STUDENT },
    body: {},
  });
  const own = await run(rejectForeignMessageUser, {
    auth: studentAuth,
    query: { userId: STUDENT },
    body: { senderId: STUDENT },
  });
  assert.equal(spoofed.status, 403);
  assert.equal(own.nextCalled, true);
});
