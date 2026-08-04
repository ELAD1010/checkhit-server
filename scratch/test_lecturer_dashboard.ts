import { AppDataSource } from "../src/database/data-source.js";
import { DashboardRepository } from "../src/repositories/dashboard.repository.js";

async function main() {
  await AppDataSource.initialize();
  console.log("Database initialized.");

  const repo = new DashboardRepository();
  const lecturerId = "5a205d7f-7084-4f91-ba7c-aeb0b6078256";

  console.log(`Fetching dashboard data for lecturer: ${lecturerId}...`);
  const dashboard = await repo.getLecturerDashboard(lecturerId);

  console.log("\n=== DASHBOARD RESULT ===");
  console.log("KPIs:", JSON.stringify(dashboard.kpis, null, 2));
  console.log("\nRequires Attention:", JSON.stringify(dashboard.requiresAttention, null, 2));
  console.log("\nGrade Distribution (all):", JSON.stringify(dashboard.gradeDistribution.all, null, 2));
  console.log(`\nGrade Distribution (courses count: ${dashboard.gradeDistribution.byCourse.length})`);
  for (const c of dashboard.gradeDistribution.byCourse) {
    console.log(`- ${c.code} (${c.courseName}): avg=${c.average}, median=${c.median}, passRate=${c.passRate}%, totalStudents=${c.totalStudents}`);
  }
  console.log("\nAssignment Completion:", JSON.stringify(dashboard.assignmentCompletion, null, 2));
  console.log("\nRecent Courses:", JSON.stringify(dashboard.recentCourses, null, 2));

  await AppDataSource.destroy();
  console.log("\nTest finished successfully!");
}

main().catch(console.error);
