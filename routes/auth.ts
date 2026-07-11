import callMoodleAPI from "../api/index.js";
import { LECTURER_ROLE } from "../common/consts/roles.js";
import { Request, Response } from "express";
import { LtiToken } from "../common/types/lti.js";

type ResponseLike = {
  locals: { context?: unknown };
  status: (code: number) => { send: (payload: unknown) => unknown };
  send: (payload: unknown) => unknown;
  redirect: (url: string) => unknown;
};

export const login = async (
  token: LtiToken,
  req: Request,
  res: Response,
): Promise<unknown> => {
  try {
    // The 'token' object is the fully decrypted, cryptographically verified Moodle JWT payload
    const userContext = res.locals.context;

    console.log(token);

    // Extract the identity information
    const moodleUserId = token.user; // The unique structural identifier ('sub')
    const userEmail = token.userInfo?.email;
    const userName = token.userInfo?.name;
    const isTeacher = token.platformContext.roles.includes(LECTURER_ROLE);
    const courseId = token.platformContext.context.id;

    const resourceId = token.platformContext.resource.id;

    const coursesData = (await callMoodleAPI("core_course_get_courses", {
      "options[ids][0]": courseId,
    })) as Array<{ summary?: string }>;

    const courseSummary = coursesData[0]?.summary; // This is the course description (HTML format)

    // 3. Fetch all other activities and modules in the course
    const courseContents = await callMoodleAPI("core_course_get_contents", {
      courseid: courseId,
    });

    const customParams = res.locals.context?.custom;

    // אם יש taskId, נפנה לעמוד הספציפי. אם אין, נפנה לדאשבורד הכללי
    const targetPath = customParams?.taskId
      ? `tasks/${customParams.taskId}`
      : "dashboard";

    /* 
      courseContents returns an array of course "Sections" (Weeks or Topics).
      Each section contains a "modules" array which lists every activity 
      (Quizzes, Forums, other LTI tools, PDFs, etc.).
    */
    console.log(`Course Description: ${courseSummary}`);
    console.log(
      `Course Sections & Activities:`,
      JSON.stringify(courseContents, null, 2),
    );

    /* 
       BUSINESS LOGIC / DATABASE INTEGRATION:
       This is where you look up or upsert the user in your own database.
       
       const user = await db.users.upsert({
         where: { moodleId: moodleUserId },
         update: { name: userName, email: userEmail },
         create: { moodleId: moodleUserId, email: userEmail, name: userName }
       });
    */

    // 3. Generate your application's own internal Auth Token
    // In a production Next.js flow, you can encrypt a session payload or sign a JWT

    const endpoint = token.platformContext?.endpoint;
    if (!endpoint || !endpoint.lineitem) {
      console.warn(
        "Cannot submit grade: Grading is not enabled for this LTI link in Moodle.",
      );
      return res.status(400).send({
        success: false,
        message:
          'עמודת הציון לא קיימת. אנא ודא שהאפשרות "קבלת ציונים מהכלי" מסומנת בהגדרות המטלה במוודל.',
      });
    }

    // await lti.Grade.scorePublish(token, {
    //   userId: moodleUserId,
    //   scoreGiven: 94, // Example score (out of 1.0)
    //   scoreMaximum: 100,
    //   activityProgress: "Completed",
    //   gradingProgress: "FullyGraded",
    //   comment: "Great job on the quiz! Keep up the good work.",
    // });

    const frontendUrl = `${process.env.FRONTEND_URL}/${targetPath}?token=${res.locals.ltik}&resourceId=${resourceId}`;

    return res.redirect(frontendUrl);
  } catch (err) {
    const error = err as {
      message: string;
      response?: { body?: unknown };
    };
    console.error("שגיאה בעדכון הציון:", error.message);

    // התוספת הקריטית לדיבאגינג:
    if (error.response && error.response.body) {
      console.error("תוכן השגיאה המלא שהתקבל מהשרת:", error.response.body);
    }

    return res.status(500).send({ success: false, error: error.message });
  }
};
