import { AppDataSource } from "../database/data-source.js";
import {
  gradePassbackService,
  type GradePassbackService,
} from "../services/grade-passback.service.js";

export class GradePassbackWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly service: GradePassbackService = gradePassbackService) {}

  start(): void {
    if (this.timer || process.env.GRADE_PASSBACK_ENABLED === "false") return;
    const interval = Math.max(
      15_000,
      Number(process.env.GRADE_PASSBACK_POLL_INTERVAL_MS) || 60_000,
    );
    this.timer = setInterval(() => void this.tick(), interval);
    this.timer.unref?.();
    void this.tick();
    console.log("Grade passback worker started");
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick(): Promise<void> {
    if (this.running || !AppDataSource.isInitialized) return;
    this.running = true;
    try {
      const { synced, failed } = await this.service.syncPendingGrades();
      if (synced || failed) {
        console.log(`Grade passback: ${synced} synced, ${failed} failed`);
      }
    } catch (error) {
      console.error("Grade passback worker failed:", error);
    } finally {
      this.running = false;
    }
  }
}

export const gradePassbackWorker = new GradePassbackWorker();
