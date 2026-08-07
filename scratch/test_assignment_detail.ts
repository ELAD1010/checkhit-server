import { AppDataSource } from "../src/database/data-source.js";
import { AssignmentRepository } from "../src/repositories/assignment.repository.js";

async function main() {
  await AppDataSource.initialize();
  console.log("Database connected.");

  const repo = new AssignmentRepository();
  const studentId = "3a12e3cb-3b43-4461-b514-5404d55e3479";

  // 1. Get all assignments for the student to find IDs
  const studentAssignments = await repo.findAllStudentAssignmentsWithStatus(
    studentId,
    { limit: 5 },
  );
  console.log(`Found ${studentAssignments.length} student assignments.`);

  if (studentAssignments.length > 0) {
    for (const testAssignment of studentAssignments) {
      console.log(`\n==============================================`);
      console.log(`Assignment: ${testAssignment.name} (${testAssignment.id})`);
      const studentDetail = await repo.findStudentAssignmentDetail(
        testAssignment.id,
        studentId,
      );
      console.log("Status:", studentDetail?.studentStatus);
      console.log("Submission attempt:", studentDetail?.submission?.attemptNumber, "Status:", studentDetail?.submission?.status);
      console.log("Evaluation score:", studentDetail?.submission?.evaluation?.score, "/", studentDetail?.submission?.evaluation?.maxScore);
      console.log("Appeal status:", studentDetail?.appeal?.status || "None");
    }
  }

  await AppDataSource.destroy();
  console.log("\nDone.");
}

main().catch(console.error);
