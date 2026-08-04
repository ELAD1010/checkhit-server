import { AppDataSource } from "../src/database/data-source.js";
import { Assignment } from "../src/entities/assignment.js";
import { AssignmentRepository } from "../src/repositories/assignment.repository.js";

async function main() {
  await AppDataSource.initialize();
  console.log("Database initialized.");

  const assignmentRepo = new AssignmentRepository(AppDataSource);

  let targetAssignment = await AppDataSource.getRepository(Assignment)
    .createQueryBuilder("assignment")
    .innerJoin("assignment.submissions", "submission")
    .innerJoinAndSelect("assignment.course", "course")
    .getOne();

  if (!targetAssignment) {
    targetAssignment = await AppDataSource.getRepository(Assignment)
      .createQueryBuilder("assignment")
      .innerJoinAndSelect("assignment.course", "course")
      .getOne();
  }

  if (!targetAssignment) {
    console.log("No assignments found in database.");
    await AppDataSource.destroy();
    return;
  }

  console.log(`Testing overview for assignment: "${targetAssignment.name}" (${targetAssignment.id})`);

  const overview = await assignmentRepo.findLecturerAssignmentOverview(targetAssignment.id);

  console.log("\n=== Assignment Info ===");
  console.log({
    id: overview.id,
    name: overview.name,
    course: overview.course,
    maxScore: overview.maxScore,
    status: overview.status,
  });

  console.log("\n=== Stats Summary ===");
  console.log(overview.stats);

  console.log(`\n=== Student Roster (Total: ${overview.students.length}) ===`);
  for (const item of overview.students.slice(0, 5)) {
    console.log({
      studentName: item.student.name,
      status: item.status,
      submissionAttempt: item.submission?.attemptNumber,
      score: item.evaluation?.score,
      appealStatus: item.appeal?.status,
    });
  }

  // Test search filter
  if (overview.students.length > 0) {
    const firstStudentName = overview.students[0].student.name.split(" ")[0];
    const filteredSearch = await assignmentRepo.findLecturerAssignmentOverview(targetAssignment.id, {
      search: firstStudentName,
    });
    console.log(`\n=== Filtered Search ('${firstStudentName}') Result Count: ${filteredSearch.students.length} ===`);
  }

  // Test status filter
  const filteredStatus = await assignmentRepo.findLecturerAssignmentOverview(targetAssignment.id, {
    status: "GRADED",
  });
  console.log(`=== Filtered Status ('GRADED') Result Count: ${filteredStatus.students.length} ===`);

  await AppDataSource.destroy();
  console.log("\nTest completed successfully!");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
