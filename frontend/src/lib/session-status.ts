export type SessionStatusKey =
  | "not_started"
  | "in_progress"
  | "completed"
  | "needs_review";

export const SESSION_STATUS_LABELS: Record<SessionStatusKey, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  needs_review: "Needs review",
};

export const SESSION_STATUS_COLORS: Record<SessionStatusKey, string> = {
  not_started: "bg-slate-500",
  in_progress: "bg-amber-400",
  completed: "bg-green-500",
  needs_review: "bg-rose-500",
};

export function normalizeSessionStatus(status?: string | null): SessionStatusKey {
  switch (status) {
    case "completed":
    case "needs_review":
    case "in_progress":
    case "not_started":
      return status;
    case "evaluating":
    case "feedback_ready":
      return "in_progress";
    default:
      return "not_started";
  }
}
