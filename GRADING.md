# Gemini grading workflow

The grading workflow runs inside `checkhit-server` and uses database rows as
the asynchronous queue.

## Configuration

Copy the grading variables from `.env.example` into `.env`.

- `GEMINI_API_KEY` is required when `GRADING_WORKER_ENABLED=true`.
- `GEMINI_MODEL` selects the Gemini model.
- `FILE_STORAGE_ROOT` stores assignment and submission files locally.
- Worker polling and retry behavior are configurable.

The worker assumes a single server instance. It processes one job at a time,
preferring question imports before submission evaluations. Jobs interrupted by
a server restart are recovered automatically on startup.

The server currently uses TypeORM `synchronize: true`, so the new grading
tables are created from entities at startup. Do not use schema synchronization
as a substitute for reviewed migrations in a production deployment.

## Lecturer workflow

Questions can be authored explicitly:

1. `PUT /api/assignments/:assignmentId/questions`
2. The sum of all question `maxScore` values must be at least the assignment
   score.

For exams with optional questions, the sum of all available question scores
may exceed the assignment score. Describe the selection rule in
`evaluationInstructions`, for example:

- "Question 1 is mandatory. Answer 2 of questions 2-4."
- "If more optional questions are answered, count the two highest scores."
- "If more optional questions are answered, count the first two answers."

Or imported from a PDF, DOCX, or text document:

1. `POST /api/assignments/:assignmentId/question-imports` as multipart field
   `file`.
2. Poll `GET /api/question-imports/:importId`.
3. On completion, the extracted normalized questions replace the assignment's
   previous question set transactionally.

The import also extracts mandatory/optional selection instructions from the
document. During grading, those document rules are combined with the
assignment's `evaluationInstructions`.

## Student workflow

1. Create a draft or submitted attempt with
   `POST /api/assignments/:assignmentId/submissions`.
2. Supply `answerText`, up to five `files`, and optionally `submit=true`.
3. Submit a draft with `POST /api/submissions/:submissionId/submit`.
4. Poll `GET /api/evaluations/:evaluationId`.

Completed evaluations contain the server-computed total score, overall
feedback, a selection summary, and one detailed result for each authoritative
question. Each result records whether it was answered and whether it counted
toward the total. Raw Gemini
requests and responses are retained in the audit table and are never returned
by the public API.

All workflow routes require a valid LTI session. Lecturer and student
ownership is derived from the synchronized LTI launch rather than request body
identifiers.
