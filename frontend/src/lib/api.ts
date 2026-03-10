import { getToken, getApiBase, clearToken } from "./auth";

export type ApiResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

async function handleResponse<T>(res: Response): Promise<ApiResponse<T>> {
  if (res.status === 401) {
    clearToken();
    return { ok: false, status: 401, error: "Not authenticated" };
  }
  const text = await res.text();
  let data: T | undefined;
  try {
    data = text ? (JSON.parse(text) as T) : undefined;
  } catch {
    data = undefined;
  }
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "detail" in data
        ? String((data as { detail?: unknown }).detail)
        : res.statusText || "Request failed";
    return { ok: false, status: res.status, error: message };
  }
  return { ok: true, data: data as T };
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
  signal?: AbortSignal
): Promise<ApiResponse<T>> {
  const base = getApiBase();
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const token = getToken();
  const headers: HeadersInit = {
    ...options.headers,
    ...(options.body && typeof options.body === "string"
      ? { "Content-Type": "application/json" }
      : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(url, { ...options, headers, signal });
  return handleResponse<T>(res);
}

/** POST /api/v1/auth/guest — no auth header. Returns token response or error. */
export async function createGuestToken(): Promise<
  ApiResponse<{ access_token: string; token_type: string; user_id: string }>
> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/v1/auth/guest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  return handleResponse(res);
}

/** POST /api/v1/auth/google/start — returns Google auth URL. */
export async function startGoogleAuth(): Promise<ApiResponse<{ auth_url: string }>> {
  return apiFetch("/api/v1/auth/google/start", {
    method: "POST",
  });
}

/** POST /api/v1/auth/google/finish — exchange login code for JWT. */
export async function finishGoogleAuth(
  code: string
): Promise<ApiResponse<{ access_token: string; token_type: string; user_id: string }>> {
  return apiFetch("/api/v1/auth/google/finish", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export type UserSettings = {
  user_id: string;
  name: string | null;
  email: string | null;
  persona: string | null;
  help_level: number | null;
  theme: string | null;
  pen_thickness: string | null;
  smooth_strokes: boolean | null;
  show_grid: boolean | null;
  zoom_speed: number | null;
  constant_grid_size: boolean | null;
  save_history: boolean | null;
  grade_level: string | null;
};

export async function getSettings(): Promise<ApiResponse<UserSettings>> {
  return apiFetch("/api/v1/auth/settings");
}

export async function updateSettings(
  payload: Partial<Omit<UserSettings, "user_id" | "email">>
): Promise<ApiResponse<UserSettings>> {
  return apiFetch("/api/v1/auth/settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/** GET /api/v1/auth/me — validates token, returns user or 401. */
export async function getMe(): Promise<
  ApiResponse<{ id: string; email: string | null; name: string | null; is_guest: boolean }>
> {
  return apiFetch("/api/v1/auth/me");
}

/** PUT /api/v1/sessions/{sessionId}/snapshot — save snapshot */
export async function saveSnapshot(
  sessionId: string,
  payload: { strokes_json: { strokes: unknown[]; shapes: unknown[]; textItems: unknown[]; imageItems?: unknown[] }; width: number; height: number }
): Promise<ApiResponse<{ id: string; strokes_json: unknown; width: number; height: number; created_at: string }>> {
  return apiFetch(`/api/v1/sessions/${sessionId}/snapshot`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/** GET /api/v1/sessions/{sessionId}/snapshot — load latest snapshot */
export async function loadSnapshot(
  sessionId: string
): Promise<ApiResponse<{ id: string; strokes_json: { strokes: unknown[]; shapes: unknown[]; textItems: unknown[]; imageItems?: unknown[] }; width: number; height: number; created_at: string }>> {
  return apiFetch(`/api/v1/sessions/${sessionId}/snapshot`);
}

/** API problem list entry — matches GET /api/v1/problems item (id, estimatedTime, topic, difficulty, type). */
export type ProblemListEntry = {
  id: string;
  title: string;
  topic: string;
  difficulty: number;
  type: string;
  estimatedTime?: string | null;
};

/** API problem detail — matches GET /api/v1/problems/{id} (adds statement, created_at). */
export type ProblemRead = ProblemListEntry & {
  statement: string;
  created_at?: string;
  solution_canonical?: string;
};

/** Backend session — matches SessionRead schema. */
export type SessionRead = {
  id: string;
  user_id: string;
  problem_id: string | null;
  title: string | null;
  status: string;
  problem_override?: string | null;
  created_at: string;
  updated_at: string;
};

/** Backend session with embedded problem — matches SessionWithProblem schema. */
export type SessionWithProblem = SessionRead & {
  problem?: ProblemRead | null;
  notebook_problem?: {
    id: string;
    notebook_id: string;
    title: string;
    prompt: string | null;
  } | null;
};

/** POST /api/v1/sessions — create a new session for a problem. */
export async function createSession(
  problemId: string
): Promise<ApiResponse<SessionRead>> {
  return apiFetch("/api/v1/sessions", {
    method: "POST",
    body: JSON.stringify({ problem_id: problemId }),
  });
}

/** POST /api/v1/sessions — create a blank whiteboard session (no problem). */
export async function createBlankSession(): Promise<ApiResponse<SessionRead>> {
  return apiFetch("/api/v1/sessions", {
    method: "POST",
    body: JSON.stringify({ problem_id: null }),
  });
}

/** PATCH /api/v1/sessions/{sessionId} — update the session's display title. */
export async function updateSessionTitle(
  sessionId: string,
  title: string
): Promise<ApiResponse<SessionRead>> {
  return apiFetch(`/api/v1/sessions/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

/** PATCH /api/v1/sessions/{sessionId} — update the session's status. */
export async function updateSessionStatus(
  sessionId: string,
  status: string
): Promise<ApiResponse<SessionRead>> {
  return apiFetch(`/api/v1/sessions/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

/** PATCH /api/v1/sessions/{sessionId} — update problem overlay text. */
export async function updateSessionProblemOverride(
  sessionId: string,
  problem_override: string | null
): Promise<ApiResponse<SessionRead>> {
  return apiFetch(`/api/v1/sessions/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify({ problem_override }),
  });
}

/** GET /api/v1/sessions/{sessionId} — fetch session (validates ownership). */
export async function getSession(
  sessionId: string
): Promise<ApiResponse<SessionWithProblem>> {
  return apiFetch(`/api/v1/sessions/${sessionId}`);
}

/** Backend session list entry — matches SessionListEntry schema from GET /api/v1/sessions. */
export type SessionListEntry = {
  id: string;
  problem_id: string | null;
  title: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  problem_title: string | null;
  topic: string | null;
  notebook_title?: string | null;
  steps_correct: number | null;
  steps_total: number | null;
};

/** GET /api/v1/sessions — list current user's sessions. */
export async function listSessions(
  sort: string = "recent",
  limit: number = 50,
  includeNotebook: boolean = false
): Promise<ApiResponse<SessionListEntry[]>> {
  const includeNotebookParam = includeNotebook ? "true" : "false";
  return apiFetch(`/api/v1/sessions?sort=${encodeURIComponent(sort)}&limit=${limit}&include_notebook=${includeNotebookParam}`);
}

export type NotebookListEntry = {
  id: string;
  title: string;
  updated_at: string;
  problem_count: number;
};

export type NotebookProblem = {
  id: string;
  notebook_id: string;
  session_id: string | null;
  title: string;
  prompt: string | null;
  order_index: number;
  source_metadata: Record<string, unknown> | null;
  session_status: string | null;
  created_at: string;
  updated_at: string;
};

export type NotebookRead = {
  id: string;
  title: string;
  overall_prompt: string | null;
  created_at: string;
  updated_at: string;
  problems: NotebookProblem[];
};

export async function listNotebooks(): Promise<ApiResponse<NotebookListEntry[]>> {
  return apiFetch("/api/v1/notebooks");
}

export async function getNotebook(id: string): Promise<ApiResponse<NotebookRead>> {
  return apiFetch(`/api/v1/notebooks/${id}`);
}

export async function createNotebook(payload: {
  title: string;
  overall_prompt?: string | null;
  problems?: Array<{
    title: string;
    prompt?: string | null;
    order_index?: number | null;
    source_metadata?: Record<string, unknown> | null;
  }>;
}): Promise<ApiResponse<NotebookRead>> {
  return apiFetch("/api/v1/notebooks", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateNotebook(
  id: string,
  payload: { title?: string | null; overall_prompt?: string | null }
): Promise<ApiResponse<NotebookRead>> {
  return apiFetch(`/api/v1/notebooks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function addNotebookProblems(
  notebookId: string,
  problems: Array<{
    title: string;
    prompt?: string | null;
    order_index?: number | null;
    source_metadata?: Record<string, unknown> | null;
  }>
): Promise<ApiResponse<NotebookProblem[]>> {
  return apiFetch(`/api/v1/notebooks/${notebookId}/problems`, {
    method: "POST",
    body: JSON.stringify(problems),
  });
}

export async function updateNotebookProblem(
  problemId: string,
  payload: { title?: string; prompt?: string | null; order_index?: number; source_metadata?: Record<string, unknown> | null }
): Promise<ApiResponse<NotebookProblem>> {
  return apiFetch(`/api/v1/notebooks/problems/${problemId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteNotebookProblem(problemId: string): Promise<ApiResponse<void>> {
  return apiFetch(`/api/v1/notebooks/problems/${problemId}`, { method: "DELETE" });
}

export async function reorderNotebookProblems(
  notebookId: string,
  items: Array<{ id: string; order_index: number }>
): Promise<ApiResponse<void>> {
  return apiFetch(`/api/v1/notebooks/${notebookId}/problems/reorder`, {
    method: "PATCH",
    body: JSON.stringify({ items }),
  });
}

/** GET /api/v1/problems — list with optional filters. Returns shape 1:1 with frontend (id, estimatedTime, etc.). */
export async function getProblems(
  params?: {
    topic?: string;
    difficulty?: number;
    type?: string;
    search?: string;
  },
  signal?: AbortSignal
): Promise<ApiResponse<ProblemListEntry[]>> {
  const sp = new URLSearchParams();
  if (params?.topic) sp.set("topic", params.topic);
  if (params?.difficulty != null) sp.set("difficulty", String(params.difficulty));
  if (params?.type) sp.set("type", params.type);
  if (params?.search) sp.set("search", params.search);
  const q = sp.toString();
  return apiFetch(`/api/v1/problems${q ? `?${q}` : ""}`, {}, signal);
}

/** GET /api/v1/problems/{id} — single problem. Returns shape 1:1 with frontend (id, estimatedTime, statement, etc.). */
export async function getProblem(id: string): Promise<ApiResponse<ProblemRead>> {
  return apiFetch(`/api/v1/problems/${id}`);
}
