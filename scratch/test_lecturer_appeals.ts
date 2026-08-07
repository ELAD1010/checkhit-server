import { AppDataSource } from "../src/database/data-source.js";
import { AppealStatus } from "../src/entities/enums.js";
import { AppealRepository } from "../src/repositories/appeal.repository.js";
import { Lecturer } from "../src/entities/lecturer.js";

async function main() {
  await AppDataSource.initialize();
  console.log("Database connected.");

  const lecturerRepo = AppDataSource.getRepository(Lecturer);
  const appealRepo = new AppealRepository();

  const lecturers = await lecturerRepo.find({ relations: { user: true } });
  console.log(`Found ${lecturers.length} lecturers.`);

  for (const testLecturer of lecturers) {
    const stats = await appealRepo.getLecturerAppealsStats(testLecturer.userId);
    console.log(`\n========================================`);
    console.log(`Lecturer: ${testLecturer.user?.name} (${testLecturer.userId}) - Stats:`, stats);

    if (stats.totalCount > 0) {
      const allAppeals = await appealRepo.findAppealsByLecturerId(testLecturer.userId);
      console.log(`Found ${allAppeals.length} appeals for lecturer.`);

      const sample = allAppeals[0];
      console.log("Sample appeal summary:", {
        id: sample.id,
        studentName: sample.student?.user?.name,
        studentId: sample.student?.userId,
        courseName: sample.submission?.assignment?.course?.name,
        assignmentName: sample.submission?.assignment?.name,
        status: sample.status,
        originalScore: sample.evaluation?.score,
        maxScore: sample.evaluation?.maxScore,
        reason: sample.reason,
      });

      // Test filter by PENDING
      const pendingAppeals = await appealRepo.findAppealsByLecturerId(testLecturer.userId, {
        status: "PENDING",
      });
      console.log(`Pending appeals count: ${pendingAppeals.length}`);

      // Test filter by RESOLVED
      const resolvedAppeals = await appealRepo.findAppealsByLecturerId(testLecturer.userId, {
        status: "RESOLVED",
      });
      console.log(`Resolved appeals count: ${resolvedAppeals.length}`);

      // Test search filter
      if (sample.student?.user?.name) {
        const searchName = sample.student.user.name.slice(0, 3);
        const searchResults = await appealRepo.findAppealsByLecturerId(testLecturer.userId, {
          search: searchName,
        });
        console.log(`Search for "${searchName}" returned ${searchResults.length} results.`);
      }

      // Test find single appeal by ID
      const singleAppeal = await appealRepo.findAppealById(sample.id);
      console.log("Single appeal fetched by ID:", {
        id: singleAppeal?.id,
        student: singleAppeal?.student?.user?.name,
        assignment: singleAppeal?.submission?.assignment?.name,
        evaluationScore: singleAppeal?.evaluation?.score,
      });

      // Test resolve appeal on a pending appeal if available
      if (pendingAppeals.length > 0) {
        const toResolve = pendingAppeals[0];
        console.log(`\nTesting resolveAppeal on appeal ${toResolve.id}...`);
        const resolved = await appealRepo.resolveAppeal(toResolve.id, {
          status: AppealStatus.ACCEPTED,
          resolution: "Reviewed Table 2 in Section 4. Full credit awarded for speedup discussion.",
          reviewerId: testLecturer.userId,
          newScore: 92,
        });
        console.log("Appeal successfully resolved:", {
          id: resolved.id,
          status: resolved.status,
          resolution: resolved.resolution,
          reviewer: resolved.reviewer?.user?.name,
          newEvaluationScore: resolved.evaluation?.score,
          resolvedAt: resolved.resolvedAt,
        });
      }
      break;
    }
  }

  await AppDataSource.destroy();
  console.log("\nDone.");
}

main().catch(console.error);
