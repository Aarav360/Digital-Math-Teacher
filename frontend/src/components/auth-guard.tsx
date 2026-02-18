"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import { getMe } from "@/lib/api";
import { useUser } from "@/contexts/user-context";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const { setCurrentUser } = useUser();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/auth");
      return;
    }
    async function loadUser() {
      const res = await getMe();
      if (!res.ok && res.status === 401) {
        // clearToken() in api.ts already cleared storage and redirected to /auth
        return;
      }
      if (res.ok) {
        setCurrentUser(res.data);
        setReady(true);
      }
    }
    loadUser();
  }, [router, setCurrentUser]);

  if (!ready) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return <>{children}</>;
}
