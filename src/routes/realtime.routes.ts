import { Response, Router } from "express";
import {
  type AuthenticatedRequest,
  requireLtiAuth,
} from "../middleware/lti-auth.js";
import { evaluationRealtime } from "../realtime/evaluation-realtime.js";

export const realtimeRouter = Router();

const issueRealtimeTicket = (req: AuthenticatedRequest, res: Response): void => {
  if (!req.auth) {
    res.status(401).json({ message: "Missing LTI session" });
    return;
  }

  res.json(evaluationRealtime.issueTicket(req.auth.userId));
};

realtimeRouter.post("/realtime/ticket", requireLtiAuth, issueRealtimeTicket);
