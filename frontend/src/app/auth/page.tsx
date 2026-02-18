"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { setToken } from "@/lib/auth";
import { createGuestToken } from "@/lib/api";

export default function AuthPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGuestLogin() {
    setError(null);
    setLoading(true);
    const res = await createGuestToken();
    setLoading(false);
    if (res.ok) {
      setToken(res.data.access_token);
      router.push("/app");
      return;
    }
    setError(res.error || "Couldn't sign in as guest. Try again.");
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-6">
      <div className="bg-white/60 backdrop-blur-xl border border-white/20 shadow-xl rounded-3xl p-8 w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-sm">M</span>
          </div>
        </div>
        <h1 className="text-xl font-bold text-foreground text-center mb-2">
          Sign in to Digital Math Teacher
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-8">
          Continue with your Google account, or jump in as a guest.
        </p>
        <div className="space-y-3">
          <Link href="/app" className="block">
            <Button className="w-full rounded-full gap-2" size="lg">
              <svg className="size-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Sign in with Google
            </Button>
          </Link>
          <Button
            variant="outline"
            className="w-full rounded-full"
            size="lg"
            onClick={handleGuestLogin}
            disabled={loading}
          >
            {loading ? "Signing in…" : "Try without signing in"}
          </Button>
        </div>
        {error && (
          <p className="text-sm text-destructive text-center mt-3">{error}</p>
        )}
        <p className="text-xs text-muted-foreground text-center mt-6">
          Guest sessions are temporary and may not keep your history.
        </p>
      </div>
    </div>
  );
}
