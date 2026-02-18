const STORAGE_KEY = "dmt_access_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  window.location.href = "/auth";
}

export function getApiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  return base.replace(/\/$/, "");
}
