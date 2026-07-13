import { Express } from "express";
import path from "node:path";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { openApiComponents } from "./openapi-components.js";

const toGlobPath = (value: string): string => value.replaceAll("\\", "/");

const openApiDocument = swaggerJsdoc({
  definition: {
    openapi: "3.1.0",
    info: {
      title: "CheckHit API",
      version: "1.0.0",
      description:
        "API for students, lecturers, courses, assignments, and Moodle LTI deep linking.",
    },
    servers: [{ url: "/api" }],
    security: [{ ltiToken: [] }],
    tags: [
      { name: "Students" },
      { name: "Lecturers" },
      { name: "Courses" },
      { name: "Assignments" },
      { name: "LTI" },
    ],
    components: openApiComponents,
  },
  apis: [
    toGlobPath(path.join(process.cwd(), "src/routes/**/*.ts")),
    toGlobPath(path.join(process.cwd(), "src/lti-boostrap.ts")),
    toGlobPath(path.join(process.cwd(), "dist/routes/**/*.js")),
    toGlobPath(path.join(process.cwd(), "dist/lti-boostrap.js")),
  ],
});

export const setupSwagger = (app: Express): void => {
  app.get("/api-docs.json", (_req, res) => {
    res.json(openApiDocument);
  });

  app.use(
    "/api-docs",
    ...swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: "CheckHit API Documentation",
      swaggerOptions: {
        deepLinking: true,
        displayRequestDuration: true,
        persistAuthorization: true,
      },
    }),
  );
};
