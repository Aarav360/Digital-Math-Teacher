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
  options: RequestInit = {}
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
  const res = await fetch(url, { ...options, headers });
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
