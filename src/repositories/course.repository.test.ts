import assert from "node:assert/strict";
import test from "node:test";
import { Course } from "../entities/course.js";
import { CourseRepository } from "./course.repository.js";

const fakeDataSource = (result: {
  entities: Course[];
  raw: Record<string, unknown>[];
}) => {
  const queryBuilder: Record<string, unknown> = new Proxy(
    {},
    {
      get: (_target, property) =>
        property === "getRawAndEntities"
          ? async () => result
          : () => queryBuilder,
    },
  );
  return {
    getRepository: () => ({ createQueryBuilder: () => queryBuilder }),
  };
};

test("student counts follow their course when joined lecturer rows repeat", async () => {
  const course = (id: string) => Object.assign(new Course(), { id });
  const repository = new CourseRepository(
    fakeDataSource({
      entities: [course("cs101"), course("cs201"), course("cs401")],
      raw: [
        { course_course_id: "cs101", course_students_count: "6" },
        { course_course_id: "cs201", course_students_count: "7" },
        { course_course_id: "cs201", course_students_count: "7" },
        { course_course_id: "cs401", course_students_count: "6" },
      ],
    }) as never,
  );

  const courses = await repository.findCoursesByLecturerId("lecturer-1");

  assert.deepEqual(
    courses.map((item) => [item.id, item.studentsCount]),
    [
      ["cs101", 6],
      ["cs201", 7],
      ["cs401", 6],
    ],
  );
});
