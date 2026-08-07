import { DataSource, Repository } from "typeorm";
import { AppDataSource } from "../database/data-source.js";
import { Appeal } from "../entities/appeal.js";
import { Assignment } from "../entities/assignment.js";
import { Course } from "../entities/course.js";
import { Enrollment } from "../entities/enrollment.js";
import {
  AppealStatus,
  AssignmentStatus,
  EvaluationStatus,
  MembershipStatus,
  SubmissionStatus,
} from "../entities/enums.js";
import { Evaluation } from "../entities/evaluation.js";
import { Lecturer } from "../entities/lecturer.js";
import { Submission } from "../entities/submission.js";

export class LecturerNotFoundError extends Error {
  constructor(lecturerId: string) {
    super(`Lecturer with ID ${lecturerId} not found`);
    this.name = "LecturerNotFoundError";
  }
}

export interface LecturerDashboardKpis {
  activeCourses: number;
  pendingAppeals: number;
  readyToPublish: number;
  averageScore: number;
}

export interface RequiresAttentionItem {
  id: string;
  type: "appeal" | "ai-grading" | "deadline";
  title: string;
  subtitle: string;
  actionText: string;
  actionHref: string;
  accentColor: "rose" | "teal" | "amber" | string;
}

export interface GradeDistributionRange {
  rangeKey: string;
  label: string;
  count: number;
  color: string;
  darkColor: string;
}

export interface GradeDistributionCourseData {
  courseId: string;
  code?: string;
  courseName: string;
  average: number;
  median: number;
  passRate: number;
  totalStudents: number;
  data: GradeDistributionRange[];
}

export interface GradeDistributionData {
  all: GradeDistributionCourseData;
  byCourse: GradeDistributionCourseData[];
}

export interface AssignmentCompletionItem {
  assignmentId: string;
  name: string;
  code: string;
  graded: number;
  aiChecking: number;
  submitted: number;
  missing: number;
  total: number;
}

export interface DashboardCourseItem {
  id: string;
  name: string;
  code: string;
  studentsCount: number;
  activeAssignments: number;
  academicYear: number;
  semester: string;
}

export interface LecturerDashboardResponse {
  kpis: LecturerDashboardKpis;
  requiresAttention: RequiresAttentionItem[];
  gradeDistribution: GradeDistributionData;
  assignmentCompletion: AssignmentCompletionItem[];
  recentCourses: DashboardCourseItem[];
}

export class DashboardRepository {
  private dataSource: DataSource;
  private lecturerRepo: Repository<Lecturer>;
  private courseRepo: Repository<Course>;
  private assignmentRepo: Repository<Assignment>;
  private submissionRepo: Repository<Submission>;
  private evalRepo: Repository<Evaluation>;
  private appealRepo: Repository<Appeal>;

  constructor(dataSource: DataSource = AppDataSource) {
    this.dataSource = dataSource;
    this.lecturerRepo = this.dataSource.getRepository(Lecturer);
    this.courseRepo = this.dataSource.getRepository(Course);
    this.assignmentRepo = this.dataSource.getRepository(Assignment);
    this.submissionRepo = this.dataSource.getRepository(Submission);
    this.evalRepo = this.dataSource.getRepository(Evaluation);
    this.appealRepo = this.dataSource.getRepository(Appeal);
  }

  private extractCourseCode(courseName: string): string {
    const match = courseName.match(/^([A-Za-z0-9]+)\s*:/);
    if (match) return match[1];
    const parts = courseName.trim().split(/\s+/);
    return parts[0] || "COURSE";
  }

  private extractCourseDisplayName(courseName: string): string {
    if (courseName.includes(":")) {
      return courseName.split(":").slice(1).join(":").trim();
    }
    return courseName;
  }

  private buildGradeRanges(scores: number[]): {
    ranges: GradeDistributionRange[];
    average: number;
    median: number;
    passRate: number;
  } {
    let below60 = 0;
    let range60_69 = 0;
    let range70_79 = 0;
    let range80_89 = 0;
    let range90_100 = 0;

    for (const score of scores) {
      if (score < 60) {
        below60++;
      } else if (score < 70) {
        range60_69++;
      } else if (score < 80) {
        range70_79++;
      } else if (score < 90) {
        range80_89++;
      } else {
        range90_100++;
      }
    }

    const ranges: GradeDistributionRange[] = [
      {
        rangeKey: "rangeBelow60",
        label: "<60",
        count: below60,
        color: "#f43f5e",
        darkColor: "#fb7185",
      },
      {
        rangeKey: "range60_69",
        label: "60-69",
        count: range60_69,
        color: "#f59e0b",
        darkColor: "#fbbf24",
      },
      {
        rangeKey: "range70_79",
        label: "70-79",
        count: range70_79,
        color: "#3b82f6",
        darkColor: "#60a5fa",
      },
      {
        rangeKey: "range80_89",
        label: "80-89",
        count: range80_89,
        color: "#0d9488",
        darkColor: "#2dd4bf",
      },
      {
        rangeKey: "range90_100",
        label: "90-100",
        count: range90_100,
        color: "#10b981",
        darkColor: "#34d399",
      },
    ];

    if (scores.length === 0) {
      return { ranges, average: 0, median: 0, passRate: 0 };
    }

    const sum = scores.reduce((a, b) => a + b, 0);
    const average = Math.round((sum / scores.length) * 10) / 10;

    const sorted = [...scores].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 !== 0
        ? Math.round(sorted[mid] * 10) / 10
        : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;

    const passingCount = scores.filter((s) => s >= 60).length;
    const passRate = Math.round((passingCount / scores.length) * 1000) / 10;

    return { ranges, average, median, passRate };
  }

  async getLecturerDashboard(
    lecturerId: string,
  ): Promise<LecturerDashboardResponse> {
    // 1. Verify lecturer
    const lecturer = await this.lecturerRepo.findOne({
      where: { userId: lecturerId },
      relations: { user: true },
    });

    if (!lecturer) {
      throw new LecturerNotFoundError(lecturerId);
    }

    // 2. Fetch courses taught by lecturer with active student count
    const coursesQb = this.courseRepo
      .createQueryBuilder("course")
      .innerJoin(
        "course.lecturers",
        "courseLecturer",
        "courseLecturer.lecturerId = :lecturerId",
        { lecturerId },
      )
      .leftJoinAndSelect("course.assignments", "assignment")
      .addSelect((subQuery) => {
        return subQuery
          .select("COUNT(enrollment.studentId)", "studentsCount")
          .from(Enrollment, "enrollment")
          .where("enrollment.courseId = course.id")
          .andWhere("enrollment.status = :activeEnrollmentStatus", {
            activeEnrollmentStatus: MembershipStatus.ACTIVE,
          });
      }, "course_students_count")
      .orderBy("course.createdAt", "DESC");

    const rawAndEntities = await coursesQb.getRawAndEntities();
    const courses = rawAndEntities.entities.map((course, idx) => {
      const raw = rawAndEntities.raw[idx];
      course.studentsCount = Number(
        raw?.course_students_count ?? raw?.studentsCount ?? 0,
      );
      return course;
    });

    const courseIds = courses.map((c) => c.id);

    if (courseIds.length === 0) {
      return {
        kpis: {
          activeCourses: 0,
          pendingAppeals: 0,
          readyToPublish: 0,
          averageScore: 0,
        },
        requiresAttention: [],
        gradeDistribution: {
          all: {
            courseId: "all",
            courseName: "כל הקורסים",
            average: 0,
            median: 0,
            passRate: 0,
            totalStudents: 0,
            data: this.buildGradeRanges([]).ranges,
          },
          byCourse: [],
        },
        assignmentCompletion: [],
        recentCourses: [],
      };
    }

    // 3. Pending appeals grouped by course
    const rawPendingAppeals = await this.appealRepo
      .createQueryBuilder("appeal")
      .innerJoin("appeal.submission", "submission")
      .innerJoin("submission.assignment", "assignment")
      .innerJoin("assignment.course", "course")
      .innerJoin(
        "course.lecturers",
        "courseLecturer",
        "courseLecturer.lecturerId = :lecturerId",
        { lecturerId },
      )
      .where("appeal.status IN (:...pendingStatuses)", {
        pendingStatuses: [AppealStatus.SUBMITTED, AppealStatus.UNDER_REVIEW],
      })
      .select("course.id", "courseId")
      .addSelect("course.name", "courseName")
      .addSelect("COUNT(appeal.id)", "count")
      .groupBy("course.id")
      .addGroupBy("course.name")
      .getRawMany();

    let totalPendingAppeals = 0;
    for (const row of rawPendingAppeals) {
      totalPendingAppeals += parseInt(row.count, 10) || 0;
    }

    // 4. Ready to publish evaluations (completed evaluations with isFinal = false)
    const rawReadyToPublish = await this.evalRepo
      .createQueryBuilder("eval")
      .innerJoin("eval.submission", "submission")
      .innerJoin("submission.assignment", "assignment")
      .innerJoin("assignment.course", "course")
      .innerJoin(
        "course.lecturers",
        "courseLecturer",
        "courseLecturer.lecturerId = :lecturerId",
        { lecturerId },
      )
      .where("eval.status = :status", { status: EvaluationStatus.COMPLETED })
      .andWhere("eval.isFinal = false")
      .select("course.id", "courseId")
      .addSelect("course.name", "courseName")
      .addSelect("assignment.id", "assignmentId")
      .addSelect("assignment.name", "assignmentName")
      .addSelect("COUNT(eval.id)", "count")
      .groupBy("course.id")
      .addGroupBy("course.name")
      .addGroupBy("assignment.id")
      .addGroupBy("assignment.name")
      .getRawMany();

    let totalReadyToPublish = 0;
    for (const row of rawReadyToPublish) {
      totalReadyToPublish += parseInt(row.count, 10) || 0;
    }

    // 5. Final completed evaluations for grade distribution
    const rawEvaluations = await this.evalRepo
      .createQueryBuilder("eval")
      .innerJoin("eval.submission", "submission")
      .innerJoin("submission.assignment", "assignment")
      .innerJoin("assignment.course", "course")
      .innerJoin(
        "course.lecturers",
        "courseLecturer",
        "courseLecturer.lecturerId = :lecturerId",
        { lecturerId },
      )
      .where("eval.status = :status", { status: EvaluationStatus.COMPLETED })
      .andWhere("eval.isFinal = true")
      .andWhere("eval.score IS NOT NULL")
      .select("course.id", "courseId")
      .addSelect("course.name", "courseName")
      .addSelect("submission.studentId", "studentId")
      .addSelect("eval.score", "score")
      .addSelect("eval.maxScore", "maxScore")
      .getRawMany();

    const allPercentageScores: number[] = [];
    const courseScoresMap = new Map<
      string,
      {
        courseName: string;
        scores: number[];
        studentIds: Set<string>;
      }
    >();

    for (const c of courses) {
      courseScoresMap.set(c.id, {
        courseName: c.name,
        scores: [],
        studentIds: new Set(),
      });
    }

    for (const row of rawEvaluations) {
      const score = parseFloat(row.score);
      const maxScore = parseFloat(row.maxScore) || 100;
      if (!isNaN(score) && maxScore > 0) {
        const percentScore = (score / maxScore) * 100;
        allPercentageScores.push(percentScore);

        const courseData = courseScoresMap.get(row.courseId);
        if (courseData) {
          courseData.scores.push(percentScore);
          if (row.studentId) {
            courseData.studentIds.add(row.studentId);
          }
        }
      }
    }

    const overallDistribution = this.buildGradeRanges(allPercentageScores);

    const byCourseDistribution: GradeDistributionCourseData[] = [];
    for (const [cId, data] of courseScoresMap.entries()) {
      const course = courses.find((c) => c.id === cId);
      const dist = this.buildGradeRanges(data.scores);
      const totalStudents = course?.studentsCount ?? data.studentIds.size;

      byCourseDistribution.push({
        courseId: cId,
        code: this.extractCourseCode(data.courseName),
        courseName: this.extractCourseDisplayName(data.courseName),
        average: dist.average,
        median: dist.median,
        passRate: dist.passRate,
        totalStudents: Number(totalStudents) || 0,
        data: dist.ranges,
      });
    }

    // 6. KPIs
    const kpis: LecturerDashboardKpis = {
      activeCourses: courses.length,
      pendingAppeals: totalPendingAppeals,
      readyToPublish: totalReadyToPublish,
      averageScore: overallDistribution.average,
    };

    // 7. Requires Attention Items
    const requiresAttention: RequiresAttentionItem[] = [];

    // Triage Item 1: Appeals
    if (totalPendingAppeals > 0) {
      const topAppealCourse = rawPendingAppeals.sort(
        (a, b) =>
          (parseInt(b.count, 10) || 0) - (parseInt(a.count, 10) || 0),
      )[0];

      const topCourse = courses.find((c) => c.id === topAppealCourse?.courseId);
      const courseCode = this.extractCourseCode(
        topCourse?.name || topAppealCourse?.courseName || "COURSES",
      );
      const courseDisplayName = this.extractCourseDisplayName(
        topCourse?.name || topAppealCourse?.courseName || "",
      );

      requiresAttention.push({
        id: `appeal-${courseCode}`,
        type: "appeal",
        title: `${totalPendingAppeals} ערעורים ממתינים לבדיקה דחופה`,
        subtitle: `${courseCode} · ${courseDisplayName}`,
        actionText: "לבדיקת ערעורים",
        actionHref: `/lecturer/appeals?status=PENDING&courseId=${topAppealCourse.courseId}`,
        accentColor: "rose",
      });
    }

    // Triage Item 2: Ready to publish AI grading
    if (totalReadyToPublish > 0) {
      const topReady = rawReadyToPublish[0];
      const topCourse = courses.find((c) => c.id === topReady?.courseId);
      const courseCode = this.extractCourseCode(
        topCourse?.name || topReady?.courseName || "COURSES",
      );

      requiresAttention.push({
        id: `ai-${courseCode}`,
        type: "ai-grading",
        title: `${totalReadyToPublish} הגשות נבדקו ע״י AI וממתינות לאישור`,
        subtitle: `${courseCode} · ${topReady?.assignmentName || this.extractCourseDisplayName(topCourse?.name || "")}`,
        actionText: "פרסום ציונים",
        actionHref: `/lecturer/courses/${topReady?.courseId}`,
        accentColor: "teal",
      });
    }

    // Triage Item 3: Upcoming Deadlines
    const allAssignments = courses.flatMap((c) =>
      (c.assignments || []).map((a) => ({
        ...a,
        course: c,
      })),
    );

    const publishedAssignments = allAssignments.filter(
      (a) => a.status === AssignmentStatus.PUBLISHED && a.dueAt,
    );

    publishedAssignments.sort((a, b) => {
      const tA = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
      const tB = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
      return tA - tB;
    });

    if (publishedAssignments.length > 0) {
      const upcoming = publishedAssignments[0];
      const courseCode = this.extractCourseCode(upcoming.course.name);
      const totalStudents = Number(upcoming.course.studentsCount) || 0;

      // Count submissions for this assignment
      const submittedCount = await this.submissionRepo.count({
        where: {
          assignmentId: upcoming.id,
          status: SubmissionStatus.SUBMITTED,
        },
      });

      const missingCount = Math.max(0, totalStudents - submittedCount);

      const dueFormatted = upcoming.dueAt
        ? new Intl.DateTimeFormat("he-IL", {
            day: "numeric",
            month: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(upcoming.dueAt))
        : "";

      requiresAttention.push({
        id: `deadline-${courseCode}`,
        type: "deadline",
        title:
          missingCount > 0
            ? `מועד הגשה קרוב - ${missingCount} סטודנטים טרם הגישו`
            : `מועד הגשה קרוב`,
        subtitle: `${courseCode} · ${upcoming.name}${dueFormatted ? ` · מועד הגשה: ${dueFormatted}` : ""}`,
        actionText: "שליחת תזכורת",
        actionHref: "/lecturer/messages",
        accentColor: "amber",
      });
    }

    // 8. Assignment Completion Funnel (Top 3-5 active assignments)
    const assignmentCompletion: AssignmentCompletionItem[] = [];
    const activeAssignments = allAssignments.slice(0, 4);

    for (const assignment of activeAssignments) {
      const totalStudents = Number(assignment.course.studentsCount) || 0;

      const submissions = await this.submissionRepo.find({
        where: { assignmentId: assignment.id },
        relations: { evaluations: true },
      });

      let graded = 0;
      let aiChecking = 0;
      let submitted = 0;

      for (const sub of submissions) {
        const finalEval = sub.evaluations?.find((e) => e.isFinal);
        const latestEval =
          finalEval ||
          sub.evaluations?.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() -
              new Date(a.createdAt).getTime(),
          )[0];

        if (latestEval) {
          if (
            latestEval.status === EvaluationStatus.COMPLETED &&
            latestEval.isFinal
          ) {
            graded++;
          } else if (
            latestEval.status === EvaluationStatus.PENDING ||
            latestEval.status === EvaluationStatus.PROCESSING ||
            (latestEval.status === EvaluationStatus.COMPLETED &&
              !latestEval.isFinal)
          ) {
            aiChecking++;
          }
        } else if (sub.status === SubmissionStatus.SUBMITTED) {
          submitted++;
        }
      }

      const accounted = graded + aiChecking + submitted;
      const missing = Math.max(0, totalStudents - accounted);

      assignmentCompletion.push({
        assignmentId: assignment.id,
        name: assignment.name,
        code: this.extractCourseCode(assignment.course.name),
        graded,
        aiChecking,
        submitted,
        missing,
        total: totalStudents || accounted,
      });
    }

    // 9. Recent Courses Overview
    const recentCourses: DashboardCourseItem[] = courses.map((course) => {
      const activeAssignmentsCount = (course.assignments || []).filter(
        (a) => a.status === AssignmentStatus.PUBLISHED,
      ).length;

      return {
        id: course.id,
        name: this.extractCourseDisplayName(course.name),
        code: this.extractCourseCode(course.name),
        studentsCount: Number(course.studentsCount) || 0,
        activeAssignments: activeAssignmentsCount,
        academicYear: course.academicYear,
        semester: course.semester,
      };
    });

    return {
      kpis,
      requiresAttention,
      gradeDistribution: {
        all: {
          courseId: "all",
          courseName: "כל הקורסים",
          average: overallDistribution.average,
          median: overallDistribution.median,
          passRate: overallDistribution.passRate,
          totalStudents: courses.reduce(
            (acc, c) => acc + (Number(c.studentsCount) || 0),
            0,
          ),
          data: overallDistribution.ranges,
        },
        byCourse: byCourseDistribution,
      },
      assignmentCompletion,
      recentCourses,
    };
  }
}
