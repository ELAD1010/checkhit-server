import { Type } from "@google/genai";
import { z } from "zod";

const MAX_FEEDBACK_LENGTH = 4000;
const MAX_EVIDENCE_LENGTH = 2000;
const MAX_PROMPT_LENGTH = 8000;

export const gradingQuestionResultSchema = z.object({
  questionId: z.string().uuid(),
  score: z.number().finite().nonnegative(),
  isAnswered: z.boolean(),
  countsTowardTotal: z.boolean(),
  selectionReason: z.string().trim().min(1).max(MAX_FEEDBACK_LENGTH),
  feedback: z.string().trim().min(1).max(MAX_FEEDBACK_LENGTH),
  evidence: z.string().trim().max(MAX_EVIDENCE_LENGTH).nullable().optional(),
  confidence: z.number().finite().min(0).max(1).nullable().optional(),
});

export const gradingResponseSchema = z.object({
  overallFeedback: z.string().trim().min(1).max(MAX_FEEDBACK_LENGTH),
  selectionSummary: z.string().trim().min(1).max(MAX_FEEDBACK_LENGTH),
  overallConfidence: z.number().finite().min(0).max(1).nullable().optional(),
  questions: z.array(gradingQuestionResultSchema).min(1),
});

export type GradingResponse = z.infer<typeof gradingResponseSchema>;

export const questionExtractionItemSchema = z.object({
  questionKey: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9_\-]+$/),
  orderIndex: z.number().int().nonnegative(),
  prompt: z.string().trim().min(1).max(MAX_PROMPT_LENGTH),
  rubric: z.string().trim().max(MAX_PROMPT_LENGTH).nullable().optional(),
  maxScore: z.number().finite().positive(),
});

export const questionExtractionResponseSchema = z.object({
  questions: z.array(questionExtractionItemSchema).min(1),
  selectionInstructions: z
    .string()
    .trim()
    .min(1)
    .max(MAX_FEEDBACK_LENGTH),
  notes: z.string().trim().max(MAX_FEEDBACK_LENGTH).nullable().optional(),
});

export type QuestionExtractionResponse = z.infer<
  typeof questionExtractionResponseSchema
>;

export const gradingResponseJsonSchema = {
  type: Type.OBJECT,
  properties: {
    overallFeedback: {
      type: Type.STRING,
      description: "Concise overall feedback for the submission.",
    },
    overallConfidence: {
      type: Type.NUMBER,
      description: "Confidence between 0 and 1 for the overall grade.",
      nullable: true,
    },
    selectionSummary: {
      type: Type.STRING,
      description:
        "Explain which mandatory and optional answers count and which lecturer rule was applied.",
    },
    questions: {
      type: Type.ARRAY,
      description: "One graded result for every authoritative question.",
      items: {
        type: Type.OBJECT,
        properties: {
          questionId: {
            type: Type.STRING,
            description: "Exact UUID of the assignment question.",
          },
          score: {
            type: Type.NUMBER,
            description: "Awarded score for this question.",
          },
          isAnswered: {
            type: Type.BOOLEAN,
            description:
              "Whether the student provided a meaningful answer to this question.",
          },
          countsTowardTotal: {
            type: Type.BOOLEAN,
            description:
              "Whether this question must be included in the total according to the lecturer selection rules.",
          },
          selectionReason: {
            type: Type.STRING,
            description:
              "Why this question counts or does not count, citing the applicable lecturer rule.",
          },
          feedback: {
            type: Type.STRING,
            description: "Detailed feedback for this question.",
          },
          evidence: {
            type: Type.STRING,
            description: "Short quote or reference from the student answer.",
            nullable: true,
          },
          confidence: {
            type: Type.NUMBER,
            description: "Confidence between 0 and 1 for this question.",
            nullable: true,
          },
        },
        required: [
          "questionId",
          "score",
          "isAnswered",
          "countsTowardTotal",
          "selectionReason",
          "feedback",
        ],
        propertyOrdering: [
          "questionId",
          "score",
          "isAnswered",
          "countsTowardTotal",
          "selectionReason",
          "feedback",
          "evidence",
          "confidence",
        ],
      },
    },
  },
  required: ["overallFeedback", "selectionSummary", "questions"],
  propertyOrdering: [
    "overallFeedback",
    "selectionSummary",
    "overallConfidence",
    "questions",
  ],
} as const;

export const questionExtractionResponseJsonSchema = {
  type: Type.OBJECT,
  properties: {
    selectionInstructions: {
      type: Type.STRING,
      description:
        "Exact grading-selection rules from the document, including mandatory questions, how many optional questions count, and how extra answers are selected. Use 'All questions are mandatory' when no choice is provided.",
    },
    notes: {
      type: Type.STRING,
      description: "Optional notes about extraction ambiguities.",
      nullable: true,
    },
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          questionKey: {
            type: Type.STRING,
            description: "Stable key such as Q1 or question_1.",
          },
          orderIndex: {
            type: Type.INTEGER,
            description: "Zero-based display order.",
          },
          prompt: {
            type: Type.STRING,
            description: "Question text presented to students.",
          },
          rubric: {
            type: Type.STRING,
            description: "Grading rubric for the question.",
            nullable: true,
          },
          maxScore: {
            type: Type.NUMBER,
            description: "Maximum score for this question.",
          },
        },
        required: ["questionKey", "orderIndex", "prompt", "maxScore"],
        propertyOrdering: [
          "questionKey",
          "orderIndex",
          "prompt",
          "rubric",
          "maxScore",
        ],
      },
    },
  },
  required: ["selectionInstructions", "questions"],
  propertyOrdering: ["selectionInstructions", "notes", "questions"],
} as const;

export class DomainValidationError extends Error {
  constructor(
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "DomainValidationError";
  }
}

const roundScore = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export type AuthoritativeQuestion = {
  id: string;
  maxScore: number;
};

export const validateGradingAgainstQuestions = (
  response: GradingResponse,
  questions: AuthoritativeQuestion[],
  assignmentMaxScore: number,
): {
  score: number;
  maxScore: number;
  confidence: number | null;
  questionResults: Array<{
    questionId: string;
    score: number;
    maxScore: number;
    isAnswered: boolean;
    countsTowardTotal: boolean;
    selectionReason: string;
    feedback: string;
    evidence: string | null;
    confidence: number | null;
  }>;
} => {
  if (questions.length === 0) {
    throw new DomainValidationError("Assignment has no questions to grade");
  }

  const expectedIds = new Set(questions.map((question) => question.id));
  const seenIds = new Set<string>();
  const questionById = new Map(
    questions.map((question) => [question.id, question]),
  );

  if (response.questions.length !== questions.length) {
    throw new DomainValidationError(
      "Model returned an unexpected number of question results",
      {
        expected: questions.length,
        actual: response.questions.length,
      },
    );
  }

  const questionResults = response.questions.map(
    (result: GradingResponse["questions"][number]) => {
    if (!expectedIds.has(result.questionId)) {
      throw new DomainValidationError("Unknown questionId in model response", {
        questionId: result.questionId,
      });
    }

    if (seenIds.has(result.questionId)) {
      throw new DomainValidationError("Duplicate questionId in model response", {
        questionId: result.questionId,
      });
    }

    seenIds.add(result.questionId);
    const question = questionById.get(result.questionId)!;
    const score = roundScore(result.score);

    if (score > question.maxScore) {
      throw new DomainValidationError("Question score exceeds max score", {
        questionId: result.questionId,
        score,
        maxScore: question.maxScore,
      });
    }

    if (!result.isAnswered && score !== 0) {
      throw new DomainValidationError(
        "An unanswered question must receive a zero score",
        {
          questionId: result.questionId,
          score,
        },
      );
    }

    return {
      questionId: result.questionId,
      score,
      maxScore: question.maxScore,
      isAnswered: result.isAnswered,
      countsTowardTotal: result.countsTowardTotal,
      selectionReason: result.selectionReason,
      feedback: result.feedback,
      evidence: result.evidence?.trim() || null,
      confidence:
        result.confidence === undefined || result.confidence === null
          ? null
          : roundScore(result.confidence),
    };
    },
  );

  if (seenIds.size !== expectedIds.size) {
    throw new DomainValidationError(
      "Model response is missing one or more question IDs",
      {
        missing: [...expectedIds].filter((id) => !seenIds.has(id)),
      },
    );
  }

  const countedResults = questionResults.filter(
    (result) => result.countsTowardTotal,
  );
  const maxScore = roundScore(
    countedResults.reduce(
      (sum: number, result: (typeof questionResults)[number]) =>
        sum + result.maxScore,
      0,
    ),
  );
  const expectedMaxScore = roundScore(assignmentMaxScore);

  if (maxScore !== expectedMaxScore) {
    throw new DomainValidationError(
      "Counted questions do not match the assignment max score",
      {
        expectedMaxScore,
        countedMaxScore: maxScore,
        countedQuestionIds: countedResults.map((result) => result.questionId),
      },
    );
  }

  const score = roundScore(
    countedResults.reduce((sum, result) => sum + result.score, 0),
  );

  return {
    score,
    maxScore: expectedMaxScore,
    confidence:
      response.overallConfidence === undefined ||
      response.overallConfidence === null
        ? null
        : roundScore(response.overallConfidence),
    questionResults,
  };
};

export const validateExtractedQuestions = (
  response: QuestionExtractionResponse,
  assignmentMaxScore: number,
): QuestionExtractionResponse => {
  const seenKeys = new Set<string>();
  const seenOrders = new Set<number>();

  for (const question of response.questions) {
    if (seenKeys.has(question.questionKey)) {
      throw new DomainValidationError("Duplicate questionKey in extraction", {
        questionKey: question.questionKey,
      });
    }

    if (seenOrders.has(question.orderIndex)) {
      throw new DomainValidationError("Duplicate orderIndex in extraction", {
        orderIndex: question.orderIndex,
      });
    }

    seenKeys.add(question.questionKey);
    seenOrders.add(question.orderIndex);
  }

  const total = roundScore(
    response.questions.reduce(
      (
        sum: number,
        question: QuestionExtractionResponse["questions"][number],
      ) => sum + question.maxScore,
      0,
    ),
  );
  const expected = roundScore(assignmentMaxScore);

  if (total < expected) {
    throw new DomainValidationError(
      "Extracted question max scores must be at least the assignment max score",
      {
        expected,
        actual: total,
      },
    );
  }

  return response;
};
