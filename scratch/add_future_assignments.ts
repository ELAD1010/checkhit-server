import "dotenv/config";
import { AppDataSource } from "../src/database/data-source.js";
import {
  Assignment,
  AssignmentStatus,
  Course,
  Enrollment,
  MembershipStatus,
  Student,
  User,
  UserRole,
} from "../src/entities/index.js";

const STUDENT_ID = "3a12e3cb-3b43-4461-b514-5404d55e3479";

async function main() {
  console.log("Connecting to database...");
  await AppDataSource.initialize();

  const userRepo = AppDataSource.getRepository(User);
  const studentRepo = AppDataSource.getRepository(Student);
  const enrollmentRepo = AppDataSource.getRepository(Enrollment);
  const courseRepo = AppDataSource.getRepository(Course);
  const assignmentRepo = AppDataSource.getRepository(Assignment);

  // 1. Check or find student
  let student = await studentRepo.findOne({
    where: { userId: STUDENT_ID },
    relations: { user: true },
  });

  if (!student) {
    let user = await userRepo.findOne({ where: { id: STUDENT_ID } });
    if (!user) {
      console.log(`User with ID ${STUDENT_ID} not found. Creating user & student record...`);
      user = userRepo.create({
        id: STUDENT_ID,
        name: "Alice Johnson",
        email: "alice.johnson@student.university.edu",
        role: UserRole.STUDENT,
      });
      await userRepo.save(user);
    }
    student = studentRepo.create({
      userId: STUDENT_ID,
      user,
    });
    await studentRepo.save(student);
    console.log(`Created student record for ${STUDENT_ID}`);
  } else {
    console.log(`Found student: ${student.user?.name} (${student.userId})`);
  }

  // 2. Find enrolled courses
  let enrollments = await enrollmentRepo.find({
    where: { studentId: STUDENT_ID, status: MembershipStatus.ACTIVE },
    relations: { course: true },
  });

  if (enrollments.length === 0) {
    console.log("No active enrollments found for student. Enrolling student in existing courses...");
    const allCourses = await courseRepo.find({ take: 3 });
    for (const c of allCourses) {
      const enr = enrollmentRepo.create({
        studentId: STUDENT_ID,
        courseId: c.id,
        status: MembershipStatus.ACTIVE,
      });
      await enrollmentRepo.save(enr);
    }
    enrollments = await enrollmentRepo.find({
      where: { studentId: STUDENT_ID, status: MembershipStatus.ACTIVE },
      relations: { course: true },
    });
  }

  console.log(`Student is actively enrolled in ${enrollments.length} courses:`);
  enrollments.forEach((e) => console.log(` - ${e.course?.name} (${e.courseId})`));

  const now = new Date();

  // Helper to get date with offset in days and hours
  const futureDate = (days: number, hours: number = 23, minutes: number = 59) => {
    const d = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    d.setHours(hours, minutes, 0, 0);
    return d;
  };

  const pastDate = (days: number) => {
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  };

  // 3. New upcoming assignments data distributed across courses
  const upcomingAssignmentsData = [
    {
      courseIndex: 0,
      name: "Assignment 3: Dynamic Programming & Memoization",
      description:
        "Solve classic optimization problems (0/1 Knapsack, Longest Common Subsequence, Matrix Chain Multiplication) using top-down memoization and bottom-up tabulation.",
      type: "Coding",
      evaluationInstructions:
        "Verify correctness on large test matrices, validate asymptotic O(N*W) time complexity, and ensure state transitions are optimal.",
      maxScore: 100,
      status: AssignmentStatus.PUBLISHED,
      startAt: pastDate(3),
      dueAt: futureDate(2), // Due in 2 days (Very Urgent)
    },
    {
      courseIndex: 0,
      name: "Project Milestone 1: Graph Algorithms & Network Flow",
      description:
        "Implement Ford-Fulkerson algorithm with Edmonds-Karp BFS augmentation to compute maximum bipartite matching on server routing networks.",
      type: "Project",
      evaluationInstructions:
        "Test residual graph updates, augmenting path search termination, and capacity constraint adherence.",
      maxScore: 150,
      status: AssignmentStatus.PUBLISHED,
      startAt: pastDate(1),
      dueAt: futureDate(6), // Due in 6 days
    },
    {
      courseIndex: Math.min(1, enrollments.length - 1),
      name: "Lab 4: Database Indexing & B+ Tree Implementation",
      description:
        "Build an in-memory B+ Tree index supporting logarithmic searches, range scans with leaf linked lists, and node split/merge handling.",
      type: "Lab",
      evaluationInstructions:
        "Ensure node degree constraints (order M), correct key promotion on splits, and sequential scan iterator correctness.",
      maxScore: 100,
      status: AssignmentStatus.PUBLISHED,
      startAt: pastDate(2),
      dueAt: futureDate(9), // Due in 9 days
    },
    {
      courseIndex: Math.min(1, enrollments.length - 1),
      name: "Homework 3: SQL Optimization & Query Execution Plans",
      description:
        "Analyze EXPLAIN ANALYZE execution trees for complex multi-table joins, subqueries, and window functions. Propose optimal composite indexes.",
      type: "Homework",
      evaluationInstructions:
        "Assess cost reduction ratio, correct index type selection (B-tree vs Hash vs GIN), and query rewrite efficiency.",
      maxScore: 80,
      status: AssignmentStatus.PUBLISHED,
      startAt: now,
      dueAt: futureDate(14), // Due in 14 days
    },
    {
      courseIndex: Math.min(2, enrollments.length - 1),
      name: "Term Paper: Deep Learning Model Architecture Analysis",
      description:
        "Write an in-depth analytical report comparing Multi-Head Attention mechanisms in Transformers against State-Space Models (Mamba) for long-context sequences.",
      type: "Report",
      evaluationInstructions:
        "Evaluate theoretical depth, mathematical formulation accuracy, empirical benchmark comparison, and citation completeness.",
      maxScore: 100,
      status: AssignmentStatus.PUBLISHED,
      startAt: pastDate(4),
      dueAt: futureDate(21), // Due in 21 days
    },
    {
      courseIndex: 0,
      name: "Final Capstone Submission",
      description:
        "Full production-ready submission of the semester capstone system including unit tests, Docker containerization, CI/CD pipeline configuration, and architectural documentation.",
      type: "Capstone",
      evaluationInstructions:
        "Automated end-to-end test suite execution, code coverage >= 85%, and architectural rubric evaluation.",
      maxScore: 200,
      status: AssignmentStatus.PUBLISHED,
      startAt: now,
      dueAt: futureDate(30), // Due in 30 days
    },
  ];

  console.log("\nInserting upcoming future assignments...");
  const createdAssignments: Assignment[] = [];

  for (const item of upcomingAssignmentsData) {
    const targetEnrollment = enrollments[item.courseIndex];
    if (!targetEnrollment) continue;

    const assignment = assignmentRepo.create({
      courseId: targetEnrollment.courseId,
      name: item.name,
      description: item.description,
      type: item.type,
      evaluationInstructions: item.evaluationInstructions,
      maxScore: item.maxScore,
      status: item.status,
      startAt: item.startAt,
      dueAt: item.dueAt,
    });

    const saved = await assignmentRepo.save(assignment);
    createdAssignments.push(saved);
    console.log(
      `✓ Added: "${saved.name}" in course "${targetEnrollment.course?.name}" (Due: ${saved.dueAt?.toISOString()})`
    );
  }

  console.log(`\nSuccessfully added ${createdAssignments.length} upcoming future assignments!`);
  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error("Error adding future assignments:", err);
  process.exit(1);
});
