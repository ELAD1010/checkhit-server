import { AppDataSource } from "../src/database/data-source.js";
import { CourseLecturer } from "../src/entities/course-lecturer.js";
import { Course } from "../src/entities/course.js";
import { Lecturer } from "../src/entities/lecturer.js";
import { Student } from "../src/entities/student.js";
import { Assignment } from "../src/entities/assignment.js";
import { Submission } from "../src/entities/submission.js";
import { Evaluation } from "../src/entities/evaluation.js";
import { Appeal } from "../src/entities/appeal.js";
import { AppealStatus, EvaluationStatus, LecturerPermission, SubmissionStatus } from "../src/entities/enums.js";

async function seed() {
  await AppDataSource.initialize();
  console.log("Database initialized.");

  const lecturerId = "5a205d7f-7084-4f91-ba7c-aeb0b6078256";

  const courseLecturerRepo = AppDataSource.getRepository(CourseLecturer);
  const assignmentRepo = AppDataSource.getRepository(Assignment);
  const studentRepo = AppDataSource.getRepository(Student);
  const submissionRepo = AppDataSource.getRepository(Submission);
  const evalRepo = AppDataSource.getRepository(Evaluation);
  const appealRepo = AppDataSource.getRepository(Appeal);

  // 1. Assign lecturer to courses if not already assigned
  const targetCourseIds = [
    "ffa88441-f78e-4e44-b110-6ab402f5cc10", // CS101
    "9ac59487-edce-4306-b2d4-6f8c75c65cf6", // CS201
    "3a936078-e09f-415b-935a-663450856f39", // CS401
    "624c8d0a-1e6b-4322-9fb5-6de0b32f1bda", // Introduction to Computer Science
  ];

  for (const courseId of targetCourseIds) {
    const existing = await courseLecturerRepo.findOne({
      where: { courseId, lecturerId },
    });
    if (!existing) {
      await courseLecturerRepo.save(
        courseLecturerRepo.create({
          courseId,
          lecturerId,
          permissionLevel: LecturerPermission.OWNER,
        }),
      );
      console.log(`Assigned lecturer to course ${courseId}`);
    }
  }

  // 2. Fetch available students and assignments
  const students = await studentRepo.find({ relations: { user: true } });
  const assignments = await assignmentRepo.find({
    where: targetCourseIds.map((courseId) => ({ courseId })),
    relations: { course: true },
  });

  console.log(`Found ${students.length} students and ${assignments.length} assignments.`);

  // Dummy appeals definition with percentage scores
  const appealData = [
    {
      studentIndex: 8, // George Clark
      assignmentIndex: 0,
      reason: "In question 3b, my recursive solution handles all boundary conditions correctly. The automated tester timed out due to print debug statements which I removed. Requesting manual re-evaluation.",
      status: AppealStatus.SUBMITTED,
      originalScorePercent: 78,
      resolution: null,
      resolvedAt: null,
      reviewerId: null,
    },
    {
      studentIndex: 2, // Alice Johnson
      assignmentIndex: 1 % assignments.length,
      reason: "The grading deducted points for not handling negative numbers, but the problem specification explicitly stated inputs are non-negative natural numbers (N >= 0).",
      status: AppealStatus.UNDER_REVIEW,
      originalScorePercent: 82,
      resolution: null,
      resolvedAt: null,
      reviewerId: lecturerId,
    },
    {
      studentIndex: 3, // Bob Smith
      assignmentIndex: 2 % assignments.length,
      reason: "Submitted solution on time, but uploaded a .txt file instead of .py by mistake. My commit history shows the complete code was ready before deadline.",
      status: AppealStatus.UNDER_REVIEW,
      originalScorePercent: 65,
      resolution: null,
      resolvedAt: null,
      reviewerId: lecturerId,
    },
    {
      studentIndex: 4, // Charlie Brown
      assignmentIndex: 3 % assignments.length,
      reason: "Regarding part 2: The time complexity is O(N log N) using a min-heap rather than O(N^2) as the automated evaluation noted. I added comments detailing the heap amortized cost.",
      status: AppealStatus.ACCEPTED,
      originalScorePercent: 80,
      newScorePercent: 95,
      resolution: "Verified the min-heap implementation. Complexity is indeed O(N log N). Full credit restored for part 2.",
      resolvedAt: new Date(Date.now() - 86400000 * 2),
      reviewerId: lecturerId,
    },
    {
      studentIndex: 5, // Diana Prince
      assignmentIndex: 4 % assignments.length,
      reason: "Deduction for missing unit tests, but unit tests were provided in the separate tests/ folder as specified in appendix A.",
      status: AppealStatus.ACCEPTED,
      originalScorePercent: 85,
      newScorePercent: 100,
      resolution: "Found tests in tests/ directory. All unit tests passed. Full credit awarded.",
      resolvedAt: new Date(Date.now() - 86400000 * 1),
      reviewerId: lecturerId,
    },
    {
      studentIndex: 6, // Ethan Hunt
      assignmentIndex: 5 % assignments.length,
      reason: "My output formatting had an extra trailing newline on output line 4, which failed the strict string equality check in test case 5.",
      status: AppealStatus.REJECTED,
      originalScorePercent: 70,
      newScorePercent: 70,
      resolution: "Output format instructions strictly required matching whitespace for automated parser integration. Deduction upheld as per course syllabus.",
      resolvedAt: new Date(Date.now() - 86400000 * 3),
      reviewerId: lecturerId,
    },
    {
      studentIndex: 7, // Fiona Gallagher
      assignmentIndex: 6 % assignments.length,
      reason: "I included edge cases for null pointer and empty tree traversal in Section 2. The deduction notes state they were missing.",
      status: AppealStatus.SUBMITTED,
      originalScorePercent: 75,
      resolution: null,
      resolvedAt: null,
      reviewerId: null,
    },
  ];

  for (const item of appealData) {
    const student = students[item.studentIndex % students.length];
    const assignment = assignments[item.assignmentIndex % assignments.length];
    const maxScore = Number(assignment.maxScore) || 100;

    const finalPercent = item.newScorePercent ?? item.originalScorePercent;
    const finalScore = Math.min(maxScore, Math.round((finalPercent / 100) * maxScore));

    // Find or create submission for student and assignment
    let submission = await submissionRepo.findOne({
      where: {
        studentId: student.userId,
        assignmentId: assignment.id,
      },
    });

    if (!submission) {
      submission = await submissionRepo.save(
        submissionRepo.create({
          studentId: student.userId,
          assignmentId: assignment.id,
          attemptNumber: 1,
          status: SubmissionStatus.SUBMITTED,
          submittedAt: new Date(Date.now() - 86400000 * 5),
        }),
      );
    }

    // Unmark any previous final evaluations
    await evalRepo
      .createQueryBuilder()
      .update(Evaluation)
      .set({ isFinal: false })
      .where("submissionId = :submissionId", { submissionId: submission.id })
      .execute();

    // Create Evaluation
    const evaluation = await evalRepo.save(
      evalRepo.create({
        submissionId: submission.id,
        score: finalScore,
        maxScore: maxScore,
        feedback: item.resolution ?? "Initial automated grading evaluation completed.",
        model: "gpt-4o-evaluator",
        promptVersion: "v1.2",
        status: EvaluationStatus.COMPLETED,
        isFinal: true,
      }),
    );

    // Create Appeal
    const appeal = await appealRepo.save(
      appealRepo.create({
        studentId: student.userId,
        submissionId: submission.id,
        evaluationId: evaluation.id,
        reason: item.reason,
        status: item.status,
        resolution: item.resolution,
        resolvedAt: item.resolvedAt,
        reviewerId: item.reviewerId,
      }),
    );

    console.log(
      `Created appeal ${appeal.id} (${appeal.status}) for ${student.user?.name} on ${assignment.name} (Score: ${finalScore}/${maxScore})`,
    );
  }

  // Verify Lecturer Appeals Stats
  const appealRepoService = new (await import("../src/repositories/appeal.repository.js")).AppealRepository();
  const stats = await appealRepoService.getLecturerAppealsStats(lecturerId);
  console.log("\n✅ Verification - New Appeals Stats for Lecturer 5a205d7f-7084-4f91-ba7c-aeb0b6078256:", stats);

  const appeals = await appealRepoService.findAppealsByLecturerId(lecturerId);
  console.log(`✅ Verification - Total appeals found for lecturer: ${appeals.length}`);
  for (const a of appeals) {
    console.log(`- [${a.status}] ${a.student?.user?.name} on "${a.submission?.assignment?.name}" (Course: ${a.submission?.assignment?.course?.name})`);
  }

  await AppDataSource.destroy();
  console.log("Seeding finished successfully!");
}

seed().catch(console.error);
