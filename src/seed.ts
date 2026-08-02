import "dotenv/config";
import { AppDataSource } from "./database/data-source.js";
import {
  User,
  Student,
  Lecturer,
  Course,
  CourseLecturer,
  Enrollment,
  Assignment,
  Resource,
  Submission,
  Evaluation,
  Appeal,
  UserRole,
  LecturerPermission,
  MembershipStatus,
  AssignmentStatus,
  SubmissionStatus,
  EvaluationStatus,
  AppealStatus,
} from "./entities/index.js";

interface LecturerSeedData {
  name: string;
  email: string;
}

interface StudentSeedData {
  name: string;
  email: string;
}

interface CourseSeedData {
  name: string;
  semester: string;
  academicYear: number;
  ownerEmail: string;
  editorEmails: string[];
  resources: {
    title: string;
    type: string;
    externalUrl: string;
  }[];
  assignments: {
    name: string;
    description: string;
    type: string;
    evaluationInstructions: string;
    maxScore: number;
    status: AssignmentStatus;
    startDaysOffset: number;
    dueDaysOffset: number;
  }[];
}

const LECTURERS_DATA: LecturerSeedData[] = [
  { name: "Dr. Alan Turing", email: "alan.turing@university.edu" },
  { name: "Dr. Ada Lovelace", email: "ada.lovelace@university.edu" },
  { name: "Prof. Grace Hopper", email: "grace.hopper@university.edu" },
  { name: "Dr. Donald Knuth", email: "donald.knuth@university.edu" },
  { name: "Dr. Margaret Hamilton", email: "margaret.hamilton@university.edu" },
];

const STUDENTS_DATA: StudentSeedData[] = [
  { name: "Alice Johnson", email: "alice.johnson@student.university.edu" },
  { name: "Bob Smith", email: "bob.smith@student.university.edu" },
  { name: "Charlie Brown", email: "charlie.brown@student.university.edu" },
  { name: "Diana Prince", email: "diana.prince@student.university.edu" },
  { name: "Ethan Hunt", email: "ethan.hunt@student.university.edu" },
  { name: "Fiona Gallagher", email: "fiona.gallagher@student.university.edu" },
  { name: "George Clark", email: "george.clark@student.university.edu" },
  { name: "Hannah Abbott", email: "hannah.abbott@student.university.edu" },
  { name: "Ian Malcolm", email: "ian.malcolm@student.university.edu" },
  { name: "Julia Roberts", email: "julia.roberts@student.university.edu" },
  { name: "Kevin Mitnick", email: "kevin.mitnick@student.university.edu" },
  { name: "Laura Croft", email: "laura.croft@student.university.edu" },
];

const COURSES_DATA: CourseSeedData[] = [
  {
    name: "CS101: Introduction to Computer Science",
    semester: "Fall",
    academicYear: 2026,
    ownerEmail: "alan.turing@university.edu",
    editorEmails: ["grace.hopper@university.edu"],
    resources: [
      {
        title: "Course Syllabus & Policies",
        type: "Syllabus",
        externalUrl: "https://canvas.university.edu/courses/cs101/syllabus",
      },
      {
        title: "Development Environment Setup Guide",
        type: "Guide",
        externalUrl: "https://docs.university.edu/guides/dev-setup",
      },
      {
        title: "Lecture Notes: Computational Thinking & Basics",
        type: "Lecture Notes",
        externalUrl: "https://slides.university.edu/cs101/week1",
      },
    ],
    assignments: [
      {
        name: "Homework 1: Hello World & Variables",
        description: "Write a program that prints Hello World and performs basic arithmetic operations.",
        type: "Coding",
        evaluationInstructions: "Verify syntax correctness, descriptive variable naming, and matching output format.",
        maxScore: 100,
        status: AssignmentStatus.PUBLISHED,
        startDaysOffset: -14,
        dueDaysOffset: 7,
      },
      {
        name: "Homework 2: Control Flow & Recursion",
        description: "Implement recursive algorithms for calculating Fibonacci numbers and factorial sequences with memoization.",
        type: "Coding",
        evaluationInstructions: "Ensure base case handling, proper recursion termination, and time complexity bounds.",
        maxScore: 100,
        status: AssignmentStatus.PUBLISHED,
        startDaysOffset: -7,
        dueDaysOffset: 14,
      },
      {
        name: "Quiz 1: Fundamentals of Computation",
        description: "Multiple choice and short answer quiz covering primitive types, conditionals, and loops.",
        type: "Quiz",
        evaluationInstructions: "Automated multiple choice grading with keyword extraction on short answer responses.",
        maxScore: 50,
        status: AssignmentStatus.CLOSED,
        startDaysOffset: -21,
        dueDaysOffset: -7,
      },
    ],
  },
  {
    name: "CS201: Data Structures and Algorithms",
    semester: "Fall",
    academicYear: 2026,
    ownerEmail: "donald.knuth@university.edu",
    editorEmails: ["alan.turing@university.edu"],
    resources: [
      {
        title: "Asymptotic Complexity Reference Card",
        type: "Reference",
        externalUrl: "https://algorithms.university.edu/cheatsheet",
      },
      {
        title: "Data Structure Visualizations",
        type: "Interactive Tool",
        externalUrl: "https://visualgo.net",
      },
    ],
    assignments: [
      {
        name: "Lab 1: Linked Lists & Stack Implementations",
        description: "Implement singly and doubly linked lists and build a LIFO Stack on top with O(1) push, pop, and peek.",
        type: "Coding",
        evaluationInstructions: "Check pointer manipulation safety, empty stack edge cases, and memory leak absence.",
        maxScore: 100,
        status: AssignmentStatus.PUBLISHED,
        startDaysOffset: -10,
        dueDaysOffset: 5,
      },
      {
        name: "Assignment 2: Balanced Binary Search Trees",
        description: "Construct an AVL Tree with auto-balancing rotations (LL, RR, LR, RL) upon insertions and deletions.",
        type: "Coding",
        evaluationInstructions: "Verify tree height bounds of O(log N), balance factor preservation, and inorder traversal ordering.",
        maxScore: 100,
        status: AssignmentStatus.DRAFT,
        startDaysOffset: 1,
        dueDaysOffset: 20,
      },
      {
        name: "Midterm Exam: Sorting & Complexity Analysis",
        description: "Comprehensive exam covering Quicksort, Mergesort, Heapsort, and recurrence relations.",
        type: "Exam",
        evaluationInstructions: "Check proof rigor for Master Theorem applications and sorting stability arguments.",
        maxScore: 100,
        status: AssignmentStatus.CLOSED,
        startDaysOffset: -30,
        dueDaysOffset: -10,
      },
    ],
  },
  {
    name: "CS301: Database Systems and Architecture",
    semester: "Spring",
    academicYear: 2026,
    ownerEmail: "ada.lovelace@university.edu",
    editorEmails: ["donald.knuth@university.edu"],
    resources: [
      {
        title: "PostgreSQL Query Optimization & Indexing",
        type: "Reference",
        externalUrl: "https://postgresguide.com",
      },
      {
        title: "Entity-Relationship Modeling Standards",
        type: "Guide",
        externalUrl: "https://db.university.edu/er-guide",
      },
    ],
    assignments: [
      {
        name: "Project 1: Relational Schema & Normalization",
        description: "Design a complete E-Commerce database schema and normalize all tables to 3NF and BCNF.",
        type: "Project",
        evaluationInstructions: "Evaluate functional dependency analysis, foreign key integrity, and normalization soundness.",
        maxScore: 100,
        status: AssignmentStatus.PUBLISHED,
        startDaysOffset: -12,
        dueDaysOffset: 10,
      },
      {
        name: "Homework 1: Complex SQL Queries & Aggregations",
        description: "Write SQL queries using window functions, Common Table Expressions (CTEs), and subqueries.",
        type: "Coding",
        evaluationInstructions: "Validate query output accuracy against gold standard test datasets and check query plan efficiency.",
        maxScore: 50,
        status: AssignmentStatus.CLOSED,
        startDaysOffset: -25,
        dueDaysOffset: -8,
      },
    ],
  },
  {
    name: "CS401: Artificial Intelligence & Autonomous Systems",
    semester: "Spring",
    academicYear: 2026,
    ownerEmail: "alan.turing@university.edu",
    editorEmails: ["margaret.hamilton@university.edu"],
    resources: [
      {
        title: "Deep Learning & Neural Network Foundations",
        type: "Lecture Notes",
        externalUrl: "https://ai.university.edu/notes/nn",
      },
      {
        title: "Search Algorithms & Heuristic Design",
        type: "Reference",
        externalUrl: "https://ai.university.edu/notes/search",
      },
    ],
    assignments: [
      {
        name: "Assignment 1: A* Search and Heuristic Pathfinding",
        description: "Implement the A* search algorithm for maze solving and evaluate Euclidean vs. Manhattan distance heuristics.",
        type: "Coding",
        evaluationInstructions: "Verify admissibility and consistency of heuristics, expanded node count, and path optimality.",
        maxScore: 100,
        status: AssignmentStatus.PUBLISHED,
        startDaysOffset: -8,
        dueDaysOffset: 8,
      },
      {
        name: "Midterm Paper: Transformer Models & Attention Mechanisms",
        description: "Write a 5-page critical analysis of transformer architectures, multi-head attention, and positional encoding.",
        type: "Essay",
        evaluationInstructions: "Grade depth of technical understanding, mathematical clarity, literature citations, and synthesis.",
        maxScore: 50,
        status: AssignmentStatus.CLOSED,
        startDaysOffset: -20,
        dueDaysOffset: -3,
      },
    ],
  },
  {
    name: "CS501: Modern Software Engineering & Cloud Platforms",
    semester: "Fall",
    academicYear: 2026,
    ownerEmail: "margaret.hamilton@university.edu",
    editorEmails: ["ada.lovelace@university.edu"],
    resources: [
      {
        title: "The Twelve-Factor App Methodology",
        type: "Reference",
        externalUrl: "https://12factor.net",
      },
      {
        title: "Docker & Container Orchestration Patterns",
        type: "Guide",
        externalUrl: "https://cloud.university.edu/k8s-guide",
      },
    ],
    assignments: [
      {
        name: "Sprint 1: Microservices Architecture & REST APIs",
        description: "Build modular Node.js/Express microservices with clear OpenAPI documentation and PostgreSQL storage.",
        type: "Project",
        evaluationInstructions: "Assess architectural modularity, OpenAPI conformance, REST status codes, and error middleware.",
        maxScore: 100,
        status: AssignmentStatus.PUBLISHED,
        startDaysOffset: -15,
        dueDaysOffset: 12,
      },
      {
        name: "Sprint 2: CI/CD Pipeline & Automated Integration Tests",
        description: "Configure GitHub Actions workflows with automated linting, unit testing, and Docker container publishing.",
        type: "Project",
        evaluationInstructions: "Check workflow YAML structure, test coverage thresholds (>80%), and build caching.",
        maxScore: 100,
        status: AssignmentStatus.DRAFT,
        startDaysOffset: 5,
        dueDaysOffset: 25,
      },
    ],
  },
];

async function seed() {
  try {
    await AppDataSource.initialize();
    console.log("Database connected successfully.");
    console.log("Starting comprehensive dummy data seeding...\n");

    const userRepo = AppDataSource.getRepository(User);
    const lecturerRepo = AppDataSource.getRepository(Lecturer);
    const studentRepo = AppDataSource.getRepository(Student);
    const courseRepo = AppDataSource.getRepository(Course);
    const courseLecturerRepo = AppDataSource.getRepository(CourseLecturer);
    const enrollmentRepo = AppDataSource.getRepository(Enrollment);
    const resourceRepo = AppDataSource.getRepository(Resource);
    const assignmentRepo = AppDataSource.getRepository(Assignment);
    const submissionRepo = AppDataSource.getRepository(Submission);
    const evaluationRepo = AppDataSource.getRepository(Evaluation);
    const appealRepo = AppDataSource.getRepository(Appeal);

    // 1. Seed Lecturers
    const lecturerMap = new Map<string, { user: User; lecturer: Lecturer }>();
    console.log("Seeding Lecturers...");
    for (const data of LECTURERS_DATA) {
      let user = await userRepo.findOne({ where: { email: data.email } });
      if (!user) {
        user = userRepo.create({
          name: data.name,
          email: data.email,
          role: UserRole.LECTURER,
        });
        await userRepo.save(user);
      }

      let lecturer = await lecturerRepo.findOne({ where: { userId: user.id } });
      if (!lecturer) {
        lecturer = lecturerRepo.create({ userId: user.id });
        await lecturerRepo.save(lecturer);
      }
      lecturerMap.set(data.email, { user, lecturer });
    }
    console.log(`✓ ${lecturerMap.size} Lecturers seeded.`);

    // 2. Seed Students
    const studentMap = new Map<string, { user: User; student: Student }>();
    console.log("Seeding Students...");
    for (const data of STUDENTS_DATA) {
      let user = await userRepo.findOne({ where: { email: data.email } });
      if (!user) {
        user = userRepo.create({
          name: data.name,
          email: data.email,
          role: UserRole.STUDENT,
        });
        await userRepo.save(user);
      }

      let student = await studentRepo.findOne({ where: { userId: user.id } });
      if (!student) {
        student = studentRepo.create({ userId: user.id });
        await studentRepo.save(student);
      }
      studentMap.set(data.email, { user, student });
    }
    console.log(`✓ ${studentMap.size} Students seeded.`);

    // 3. Seed Courses, CourseLecturers, Resources, and Assignments
    const courseMap = new Map<string, Course>();
    const assignmentMap = new Map<string, Assignment>();
    const now = new Date();

    console.log("Seeding Courses, Resources & Assignments...");
    for (const cData of COURSES_DATA) {
      let course = await courseRepo.findOne({ where: { name: cData.name } });
      if (!course) {
        course = courseRepo.create({
          name: cData.name,
          semester: cData.semester,
          academicYear: cData.academicYear,
        });
        await courseRepo.save(course);
      }
      courseMap.set(cData.name, course);

      // Assign Owner Lecturer
      const owner = lecturerMap.get(cData.ownerEmail);
      if (owner) {
        const existingAssignment = await courseLecturerRepo.findOne({
          where: { courseId: course.id, lecturerId: owner.lecturer.userId },
        });
        if (!existingAssignment) {
          const courseLecturer = courseLecturerRepo.create({
            courseId: course.id,
            lecturerId: owner.lecturer.userId,
            permissionLevel: LecturerPermission.OWNER,
          });
          await courseLecturerRepo.save(courseLecturer);
        }
      }

      // Assign Editor Lecturers
      for (const editorEmail of cData.editorEmails) {
        const editor = lecturerMap.get(editorEmail);
        if (editor) {
          const existingAssignment = await courseLecturerRepo.findOne({
            where: { courseId: course.id, lecturerId: editor.lecturer.userId },
          });
          if (!existingAssignment) {
            const courseLecturer = courseLecturerRepo.create({
              courseId: course.id,
              lecturerId: editor.lecturer.userId,
              permissionLevel: LecturerPermission.EDITOR,
            });
            await courseLecturerRepo.save(courseLecturer);
          }
        }
      }

      // Seed Course Resources
      for (const rData of cData.resources) {
        const existingResource = await resourceRepo.findOne({
          where: { courseId: course.id, title: rData.title },
        });
        if (!existingResource) {
          const resource = resourceRepo.create({
            courseId: course.id,
            title: rData.title,
            type: rData.type,
            externalUrl: rData.externalUrl,
          });
          await resourceRepo.save(resource);
        }
      }

      // Seed Assignments
      for (const aData of cData.assignments) {
        let assignment = await assignmentRepo.findOne({
          where: { courseId: course.id, name: aData.name },
        });

        const startAt = new Date(now);
        startAt.setDate(startAt.getDate() + aData.startDaysOffset);

        const dueAt = new Date(now);
        dueAt.setDate(dueAt.getDate() + aData.dueDaysOffset);

        if (!assignment) {
          assignment = assignmentRepo.create({
            courseId: course.id,
            name: aData.name,
            description: aData.description,
            type: aData.type,
            evaluationInstructions: aData.evaluationInstructions,
            maxScore: aData.maxScore,
            status: aData.status,
            startAt,
            dueAt,
          });
          await assignmentRepo.save(assignment);
        }
        assignmentMap.set(aData.name, assignment);
      }
    }
    console.log(`✓ ${courseMap.size} Courses and ${assignmentMap.size} Assignments seeded.`);

    // 4. Seed Course Enrollments
    console.log("Seeding Enrollments...");
    const studentList = Array.from(studentMap.values());
    const courseList = Array.from(courseMap.values());

    const enrollmentDistribution: [number, number[]][] = [
      // CS101 (index 0): students 0..5
      [0, [0, 1, 2, 3, 4, 5]],
      // CS201 (index 1): students 1, 2, 3, 6, 7, 8
      [1, [1, 2, 3, 6, 7, 8]],
      // CS301 (index 2): students 0, 4, 5, 9, 10, 11
      [2, [0, 4, 5, 9, 10, 11]],
      // CS401 (index 3): students 2, 3, 6, 8, 10, 11
      [3, [2, 3, 6, 8, 10, 11]],
      // CS501 (index 4): students 0, 1, 4, 7, 9, 10
      [4, [0, 1, 4, 7, 9, 10]],
    ];

    let enrollmentCount = 0;
    for (const [courseIdx, studentIndices] of enrollmentDistribution) {
      const course = courseList[courseIdx];
      if (!course) continue;

      for (const sIdx of studentIndices) {
        const studentObj = studentList[sIdx];
        if (!studentObj) continue;

        const existingEnrollment = await enrollmentRepo.findOne({
          where: { courseId: course.id, studentId: studentObj.student.userId },
        });

        if (!existingEnrollment) {
          const enrollment = enrollmentRepo.create({
            courseId: course.id,
            studentId: studentObj.student.userId,
            status: MembershipStatus.ACTIVE,
          });
          await enrollmentRepo.save(enrollment);
          enrollmentCount++;
        }
      }
    }
    console.log(`✓ ${enrollmentCount} Student Enrollments seeded.`);

    // 5. Seed Submissions, Evaluations, and Appeals
    console.log("Seeding Submissions, AI Evaluations & Appeals...");

    const hw1 = assignmentMap.get("Homework 1: Hello World & Variables");
    const lab1 = assignmentMap.get("Lab 1: Linked Lists & Stack Implementations");
    const sqlHw = assignmentMap.get("Homework 1: Complex SQL Queries & Aggregations");
    const paper = assignmentMap.get("Midterm Paper: Transformer Models & Attention Mechanisms");

    const alice = studentMap.get("alice.johnson@student.university.edu")!;
    const bob = studentMap.get("bob.smith@student.university.edu")!;
    const charlie = studentMap.get("charlie.brown@student.university.edu")!;
    const diana = studentMap.get("diana.prince@student.university.edu")!;
    const ethan = studentMap.get("ethan.hunt@student.university.edu")!;
    const fiona = studentMap.get("fiona.gallagher@student.university.edu")!;

    const turing = lecturerMap.get("alan.turing@university.edu")!;
    const knuth = lecturerMap.get("donald.knuth@university.edu")!;

    // Case 1: Alice on CS101 HW1 (Completed High Score)
    if (hw1 && alice) {
      let sub = await submissionRepo.findOne({
        where: { assignmentId: hw1.id, studentId: alice.student.userId, attemptNumber: 1 },
      });
      if (!sub) {
        sub = submissionRepo.create({
          assignmentId: hw1.id,
          studentId: alice.student.userId,
          attemptNumber: 1,
          answerText: `// Alice Johnson - Solution\nconst greeting: string = "Hello World";\nconsole.log(greeting);\n\nconst a = 10, b = 25;\nconsole.log(\`Sum: \${a + b}, Product: \${a * b}\`);`,
          status: SubmissionStatus.SUBMITTED,
          submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        });
        await submissionRepo.save(sub);

        const evalRecord = evaluationRepo.create({
          submissionId: sub.id,
          score: 98.5,
          maxScore: 100,
          feedback: "Outstanding code clarity, explicit TypeScript typing, and accurate arithmetic computation.",
          model: "gemini-2.5-pro",
          promptVersion: "v1.4",
          confidence: 0.98,
          status: EvaluationStatus.COMPLETED,
          isFinal: true,
        });
        await evaluationRepo.save(evalRecord);
      }
    }

    // Case 2: Bob on CS101 HW1 (Completed with Appeal Rejected)
    if (hw1 && bob) {
      let sub = await submissionRepo.findOne({
        where: { assignmentId: hw1.id, studentId: bob.student.userId, attemptNumber: 1 },
      });
      if (!sub) {
        sub = submissionRepo.create({
          assignmentId: hw1.id,
          studentId: bob.student.userId,
          attemptNumber: 1,
          answerText: `console.log("Hello World");\nlet x = 10; let y = 20;\nconsole.log(x+y);`,
          status: SubmissionStatus.SUBMITTED,
          submittedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        });
        await submissionRepo.save(sub);

        const evalRecord = evaluationRepo.create({
          submissionId: sub.id,
          score: 84.0,
          maxScore: 100,
          feedback: "Good concise solution. Deducted points for missing required product calculation and lack of descriptive comments.",
          model: "gemini-2.5-pro",
          promptVersion: "v1.4",
          confidence: 0.92,
          status: EvaluationStatus.COMPLETED,
          isFinal: true,
        });
        await evaluationRepo.save(evalRecord);

        // Bob submits appeal
        const appeal = appealRepo.create({
          submissionId: sub.id,
          evaluationId: evalRecord.id,
          studentId: bob.student.userId,
          reviewerId: turing.lecturer.userId,
          reason: "I believed the product calculation was optional based on paragraph 2 in the prompt.",
          status: AppealStatus.REJECTED,
          resolution: "Product computation is explicitly listed as a required deliverable in section 1.2 of the specification.",
          resolvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        });
        await appealRepo.save(appeal);
      }
    }

    // Case 3: Charlie on CS101 HW1 (Draft Submission)
    if (hw1 && charlie) {
      let sub = await submissionRepo.findOne({
        where: { assignmentId: hw1.id, studentId: charlie.student.userId, attemptNumber: 1 },
      });
      if (!sub) {
        sub = submissionRepo.create({
          assignmentId: hw1.id,
          studentId: charlie.student.userId,
          attemptNumber: 1,
          answerText: `// Work in progress draft\nfunction main() {\n  // TODO: finish implementation\n}`,
          status: SubmissionStatus.DRAFT,
          submittedAt: null,
        });
        await submissionRepo.save(sub);
      }
    }

    // Case 4: Diana on CS201 Lab 1 (High Score)
    if (lab1 && diana) {
      let sub = await submissionRepo.findOne({
        where: { assignmentId: lab1.id, studentId: diana.student.userId, attemptNumber: 1 },
      });
      if (!sub) {
        sub = submissionRepo.create({
          assignmentId: lab1.id,
          studentId: diana.student.userId,
          attemptNumber: 1,
          answerText: `class Node<T> { value: T; next: Node<T> | null = null; prev: Node<T> | null = null; constructor(v: T) { this.value = v; } }\nclass DoublyLinkedList<T> { head: Node<T> | null = null; tail: Node<T> | null = null; push(v: T) { ... } }`,
          status: SubmissionStatus.SUBMITTED,
          submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        });
        await submissionRepo.save(sub);

        const evalRecord = evaluationRepo.create({
          submissionId: sub.id,
          score: 96.0,
          maxScore: 100,
          feedback: "Excellent doubly linked list implementation with O(1) head/tail operations and comprehensive null checks.",
          model: "gemini-2.5-pro",
          promptVersion: "v1.4",
          confidence: 0.97,
          status: EvaluationStatus.COMPLETED,
          isFinal: true,
        });
        await evaluationRepo.save(evalRecord);
      }
    }

    // Case 5: Ethan on CS201 Lab 1 (Evaluated + Accepted Appeal)
    if (lab1 && ethan) {
      let sub = await submissionRepo.findOne({
        where: { assignmentId: lab1.id, studentId: ethan.student.userId, attemptNumber: 1 },
      });
      if (!sub) {
        sub = submissionRepo.create({
          assignmentId: lab1.id,
          studentId: ethan.student.userId,
          attemptNumber: 1,
          answerText: `class Stack<T> { private list = new CustomLinkedList<T>(); push(val: T) { this.list.addTail(val); } pop(): T | null { return this.list.removeTail(); } peek(): T | null { return this.list.getTail(); } }`,
          status: SubmissionStatus.SUBMITTED,
          submittedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        });
        await submissionRepo.save(sub);

        const evalRecord = evaluationRepo.create({
          submissionId: sub.id,
          score: 78.0,
          maxScore: 100,
          feedback: "Good modular structure. Point deduction applied assuming getTail() had O(N) complexity.",
          model: "gemini-2.5-pro",
          promptVersion: "v1.4",
          confidence: 0.88,
          status: EvaluationStatus.COMPLETED,
          isFinal: true,
        });
        await evaluationRepo.save(evalRecord);

        // Ethan's Appeal
        const appeal = appealRepo.create({
          submissionId: sub.id,
          evaluationId: evalRecord.id,
          studentId: ethan.student.userId,
          reviewerId: knuth.lecturer.userId,
          reason: "My CustomLinkedList explicitly maintains a direct tail pointer, so getTail() executes in O(1) time.",
          status: AppealStatus.ACCEPTED,
          resolution: "Verified: CustomLinkedList maintains an active tail pointer. Penalty removed and grade updated.",
          resolvedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        });
        await appealRepo.save(appeal);
      }
    }

    // Case 6: Fiona on CS301 SQL Homework (Closed Course - Completed)
    if (sqlHw && fiona) {
      let sub = await submissionRepo.findOne({
        where: { assignmentId: sqlHw.id, studentId: fiona.student.userId, attemptNumber: 1 },
      });
      if (!sub) {
        sub = submissionRepo.create({
          assignmentId: sqlHw.id,
          studentId: fiona.student.userId,
          attemptNumber: 1,
          answerText: `WITH RankedOrders AS (\n  SELECT customer_id, order_id, total_amount,\n         ROW_NUMBER() OVER(PARTITION BY customer_id ORDER BY total_amount DESC) as rn\n  FROM orders\n)\nSELECT * FROM RankedOrders WHERE rn <= 3;`,
          status: SubmissionStatus.SUBMITTED,
          submittedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        });
        await submissionRepo.save(sub);

        const evalRecord = evaluationRepo.create({
          submissionId: sub.id,
          score: 48.0,
          maxScore: 50,
          feedback: "Great usage of Common Table Expressions and window functions for partition ranking.",
          model: "gemini-2.5-pro",
          promptVersion: "v1.4",
          confidence: 0.96,
          status: EvaluationStatus.COMPLETED,
          isFinal: true,
        });
        await evaluationRepo.save(evalRecord);
      }
    }

    // Case 7: Charlie on CS401 Paper Review (Closed Essay - Appeal Under Review)
    if (paper && charlie) {
      let sub = await submissionRepo.findOne({
        where: { assignmentId: paper.id, studentId: charlie.student.userId, attemptNumber: 1 },
      });
      if (!sub) {
        sub = submissionRepo.create({
          assignmentId: paper.id,
          studentId: charlie.student.userId,
          attemptNumber: 1,
          answerText: `Title: Analyzing Self-Attention in Transformer Architectures\nAbstract: This paper explores the computational mechanics of Scaled Dot-Product Attention and Multi-Head Attention layers...`,
          status: SubmissionStatus.SUBMITTED,
          submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        });
        await submissionRepo.save(sub);

        const evalRecord = evaluationRepo.create({
          submissionId: sub.id,
          score: 41.5,
          maxScore: 50,
          feedback: "Strong conceptual analysis. Missing thorough comparison with recurrent sequence models (RNN/LSTM).",
          model: "gpt-4o-mini",
          promptVersion: "v2.0",
          confidence: 0.91,
          status: EvaluationStatus.COMPLETED,
          isFinal: true,
        });
        await evaluationRepo.save(evalRecord);

        const appeal = appealRepo.create({
          submissionId: sub.id,
          evaluationId: evalRecord.id,
          studentId: charlie.student.userId,
          reviewerId: turing.lecturer.userId,
          reason: "Section 3.4 of my submission covers recurrence bottleneck comparison in detail. Please reconsider.",
          status: AppealStatus.UNDER_REVIEW,
          resolution: null,
          resolvedAt: null,
        });
        await appealRepo.save(appeal);
      }
    }

    console.log("✓ Submissions, Evaluations, and Appeals seeded successfully.\n");
    console.log("==========================================");
    console.log("  DATABASE DUMMY DATA SEEDING COMPLETE!   ");
    console.log("==========================================");
  } catch (error) {
    console.error("Error seeding dummy data:", error);
  } finally {
    await AppDataSource.destroy();
  }
}

seed();
