import { getGradingConfig } from "../config/grading.config.js";
import { EvaluationRepository } from "../repositories/evaluation.repository.js";
import { QuestionImportRepository } from "../repositories/question-import.repository.js";
import { GradingService } from "../services/grading.service.js";

export class GradingWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private processing = false;
  private stopping = false;

  constructor(
    private readonly gradingService = new GradingService(),
    private readonly evaluationRepository = new EvaluationRepository(),
    private readonly questionImportRepository = new QuestionImportRepository(),
  ) {}

  start(): void {
    const config = getGradingConfig();
    if (!config.workerEnabled || this.timer) {
      return;
    }

    this.running = true;
    this.stopping = false;
    this.timer = setInterval(() => {
      void this.tick();
    }, config.workerPollIntervalMs);
    this.timer.unref?.();
    void this.initialize();
    console.log("Grading worker started");
  }

  async stop(): Promise<void> {
    this.stopping = true;
    this.running = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    const startedAt = Date.now();
    while (this.processing && Date.now() - startedAt < 30_000) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log("Grading worker stopped");
  }

  private async initialize(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;
    try {
      await Promise.all([
        this.questionImportRepository.recoverInterruptedJobs(),
        this.evaluationRepository.recoverInterruptedJobs(),
      ]);
    } finally {
      this.processing = false;
    }

    await this.tick();
  }

  private async tick(): Promise<void> {
    if (!this.running || this.stopping || this.processing) {
      return;
    }

    this.processing = true;
    try {
      const questionImport =
        await this.questionImportRepository.takeNextPending();
      if (questionImport) {
        await this.gradingService.processQuestionImport(questionImport);
        return;
      }

      const evaluation = await this.evaluationRepository.takeNextPending();
      if (evaluation) {
        await this.gradingService.processEvaluation(evaluation);
      }
    } catch (error) {
      console.error("Grading worker job failed:", error);
    } finally {
      this.processing = false;
    }
  }
}

export const gradingWorker = new GradingWorker();
