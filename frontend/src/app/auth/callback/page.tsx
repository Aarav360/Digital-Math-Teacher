"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { finishGoogleAuth } from "@/lib/api";
import { setToken } from "@/lib/auth";

const ERROR_MESSAGES: Record<string, string> = {
  OAUTH_STATE_INVALID: "Your sign-in session expired. Please try again.",
  OAUTH_TOKEN_EXCHANGE_FAILED: "Google sign-in failed. Please try again.",
  OAUTH_TOKENINFO_FAILED: "Google sign-in could not be verified. Please try again.",
  OAUTH_EMAIL_UNVERIFIED: "Your Google email is not verified.",
  OAUTH_ACCOUNT_CONFLICT: "This Google account is already linked to another user.",
};

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const error = searchParams.get("error");
  const code = searchParams.get("code");

  const errorMessage = useMemo(() => {
    if (!error) return null;
    return ERROR_MESSAGES[error] || "Sign-in failed. Please try again.";
  }, [error]);

  useEffect(() => {
    if (error) {
      setStatus("error");
      return;
    }
    if (!code) {
      setStatus("error");
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await finishGoogleAuth(code);
      if (cancelled) return;
      if (res.ok) {
        setToken(res.data.access_token);
        router.replace("/app");
        return;
      }
      setStatus("error");
    })();
    return () => {
      cancelled = true;
    };
  }, [code, error, router]);

  if (status === "error") {
    return (
      <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-6">
        <div className="bg-white/60 backdrop-blur-xl border border-white/20 shadow-xl rounded-3xl p-8 w-full max-w-sm text-center">
          <h1 className="text-xl font-bold text-foreground mb-2">Sign-in failed</h1>
          <p className="text-sm text-muted-foreground mb-6">{errorMessage ?? "Sign-in failed. Please try again."}</p>
          <button
            className="w-full rounded-full bg-primary text-primary-foreground py-2"
            onClick={() => router.replace("/auth")}
          >
            Back to sign-in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-6">
      <div className="bg-white/60 backdrop-blur-xl border border-white/20 shadow-xl rounded-3xl p-8 w-full max-w-sm text-center">
        <h1 className="text-xl font-bold text-foreground mb-2">Finishing sign-in…</h1>
        <p className="text-sm text-muted-foreground">Please wait.</p>
      </div>
    </div>
  );
}
