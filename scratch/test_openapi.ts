import path from "node:path";
import swaggerJsdoc from "swagger-jsdoc";
import { openApiComponents } from "../src/docs/openapi-components.js";

const toGlobPath = (value: string): string => value.replaceAll("\\", "/");

const openApiDocument = swaggerJsdoc({
  definition: {
    openapi: "3.1.0",
    info: {
      title: "CheckHit API",
      version: "1.0.0",
    },
    components: openApiComponents,
  },
  apis: [
    toGlobPath(path.join(process.cwd(), "src/routes/**/*.ts")),
    toGlobPath(path.join(process.cwd(), "src/lti-boostrap.ts")),
  ],
}) as any;

function validateRefs(obj: any, path: string = "", errors: string[] = []) {
  if (!obj || typeof obj !== "object") return errors;

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    if (key === "$ref" && typeof value === "string") {
      if (value.startsWith("#/components/schemas/")) {
        const schemaName = value.replace("#/components/schemas/", "");
        if (!openApiDocument.components?.schemas?.[schemaName]) {
          errors.push(`Missing schema ref: "${value}" at ${currentPath}`);
        }
      }
    } else if (typeof value === "object") {
      validateRefs(value, currentPath, errors);
    }
  }
  return errors;
}

const errors = validateRefs(openApiDocument);
if (errors.length > 0) {
  console.error("OpenAPI Ref Validation Errors:", errors);
  process.exit(1);
} else {
  console.log("OpenAPI Schema Validation Passed! All $ref components resolve correctly.");
}

