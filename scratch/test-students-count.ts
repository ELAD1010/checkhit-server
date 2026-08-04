import dotenv from "dotenv";
import { AppDataSource } from "../src/database/data-source.js";
import { CourseRepository } from "../src/repositories/course.repository.js";

dotenv.config();

async function main() {
  await AppDataSource.initialize();
  console.log("Database connected.");

  const courseRepo = new CourseRepository(AppDataSource);
  const lecturerId = "5a205d7f-7084-4f91-ba7c-aeb0b6078256";
  const studentId = "3a12e3cb-3b43-4461-b514-5404d55e3479";

  const lecturerCourses = await courseRepo.findCoursesByLecturerId(lecturerId);
  console.log(`findCoursesByLecturerId -> ${lecturerCourses.length} courses:`);
  for (const c of lecturerCourses) {
    console.log(`- Course: "${c.name}" -> studentsCount: ${c.studentsCount}`);
    
    const single = await courseRepo.findCourseById(c.id);
    console.log(`  -> findCourseById("${c.id}") -> studentsCount: ${single?.studentsCount}`);
  }

  const studentCourses = await courseRepo.findCoursesByStudentId(studentId);
  console.log(`findCoursesByStudentId -> ${studentCourses.length} courses:`);
  for (const c of studentCourses) {
    console.log(`- Student Course: "${c.name}" -> studentsCount: ${c.studentsCount}`);
  }

  await AppDataSource.destroy();
}

main().catch(console.error);

