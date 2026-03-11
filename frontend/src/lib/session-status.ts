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
  not_started: "bg-[var(--status-not-started)]",
  in_progress: "bg-[var(--status-in-progress)]",
  completed: "bg-[var(--status-completed)]",
  needs_review: "bg-[var(--status-needs-review)]",
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
