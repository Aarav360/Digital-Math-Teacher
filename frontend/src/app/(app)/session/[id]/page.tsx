"use client";

import { useParams } from "next/navigation";
import { SessionPageInner } from "./SessionPage";

/**
 * Thin wrapper that forces a full remount of SessionPageInner whenever the
 * session id changes. Without the `key` prop, Next.js App Router reuses the
 * same component instance when navigating between /session/blank and
 * /session/<uuid> (same route segment), so all React state leaks across
 * sessions.
 */
export default function SessionPage() {
  const params = useParams();
  const sessionId = Array.isArray(params.id) ? params.id[0] : params.id ?? "";
  return <SessionPageInner key={sessionId} sessionId={sessionId} />;
}
