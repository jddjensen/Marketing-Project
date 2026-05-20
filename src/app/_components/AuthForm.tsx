"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Mode = "login" | "register";

// Demo bypass: when pointed at local Supabase, auto-sign-in with the seeded
// admin account so an investor demo can skip the login screen entirely.
const DEMO_BYPASS_EMAIL = "admin@example.com";
const DEMO_BYPASS_PASSWORD = "password123";
function isLocalSupabase(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url);
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmEmailSent, setConfirmEmailSent] = useState<string | null>(null);

  const isRegister = mode === "register";
  const title = isRegister ? "Create your account" : "Sign in";
  const cta = isRegister ? "Create account" : "Sign in";
  const incomingError = searchParams.get("error");
  const demoBypass = !isRegister && isLocalSupabase() && searchParams.get("bypass") !== "0";
  const bypassFiredRef = useRef(false);

  useEffect(() => {
    if (!demoBypass || bypassFiredRef.current) return;
    bypassFiredRef.current = true;
    (async () => {
      setSubmitting(true);
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: DEMO_BYPASS_EMAIL,
        password: DEMO_BYPASS_PASSWORD,
      });
      if (signInError) {
        setError(`demo auto-login failed: ${signInError.message}`);
        setSubmitting(false);
        return;
      }
      const next = searchParams.get("next") ?? "/";
      router.replace(next);
      router.refresh();
    })();
  }, [demoBypass, router, searchParams]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    try {
      if (isRegister) {
        const next = searchParams.get("next") ?? "/";
        const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) throw error;
        // When email confirmation is on, signUp returns a user with no
        // session. Show a dedicated confirmation screen rather than an
        // inline notice.
        if (!data.session) {
          setConfirmEmailSent(email);
          setSubmitting(false);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      const next = searchParams.get("next") ?? "/";
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "authentication failed");
      setSubmitting(false);
    }
  }

  // Once they've signed up, swap the form for a clean confirmation panel.
  if (confirmEmailSent) {
    return <ConfirmEmailSent email={confirmEmailSent} />;
  }

  // Demo bypass: hide the form entirely while the auto-login is running.
  if (demoBypass && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 px-6">
        <div className="text-sm text-zinc-500">Signing you in…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Marketing Platform</h1>
          <p className="text-sm text-zinc-500 mt-1">{title}</p>
        </div>
        <form
          onSubmit={submit}
          className="modal-surface rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4 shadow-[var(--shadow-soft)]"
        >
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">Email</label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-tactile mt-1 w-full"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">Password</label>
            <input
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
              minLength={isRegister ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-tactile mt-1 w-full"
            />
            {isRegister && (
              <p className="text-[11px] text-zinc-500 mt-1">At least 8 characters.</p>
            )}
          </div>
          {(error || incomingError) && (
            <div className="rounded-md border border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200 px-3 py-2 text-sm">
              {error ?? humanizeIncomingError(incomingError)}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full apple-tap rounded-md bg-(--accent) text-white px-4 py-2 text-sm font-medium disabled:opacity-60 hover:opacity-90"
          >
            {submitting ? "…" : cta}
          </button>
        </form>
        <p className="text-sm text-zinc-500 mt-4 text-center">
          {isRegister ? (
            <>
              Already have an account?{" "}
              <Link href="/login" className="text-zinc-900 dark:text-zinc-100 hover:underline">
                Sign in
              </Link>
            </>
          ) : (
            <>
              No account yet?{" "}
              <Link href="/register" className="text-zinc-900 dark:text-zinc-100 hover:underline">
                Create one
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function ConfirmEmailSent({ email }: { email: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 px-6">
      <div className="w-full max-w-md">
        <div
          className="modal-surface rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center shadow-[var(--shadow-soft)]"
        >
          <div
            className="h-12 w-12 mx-auto rounded-2xl flex items-center justify-center bg-(--accent-soft) text-(--accent) mb-4"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16v12H4z" />
              <path d="M4 6l8 7 8-7" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Check your inbox</h1>
          <p className="text-sm text-zinc-500 mt-2">
            We sent a confirmation link to{" "}
            <span className="text-zinc-900 dark:text-zinc-100 font-medium">{email}</span>.
            Click it to finish creating your account.
          </p>
          <ul className="mt-5 space-y-1.5 text-[11px] text-zinc-500 text-left">
            <li>· The link is single-use and expires in 24 hours.</li>
            <li>· Spam folder is the usual culprit if it doesn&apos;t show up.</li>
            <li>· The wrong email? Just sign up again with the right one.</li>
          </ul>
          <Link
            href="/login"
            className="apple-tap mt-6 inline-block w-full rounded-md bg-(--accent) text-white px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

function humanizeIncomingError(code: string | null): string {
  switch (code) {
    case "missing_code":
      return "That confirmation link is missing its code — try signing up again.";
    case "confirmation_failed":
      return "That confirmation link is no longer valid. Sign up again to get a fresh one.";
    default:
      return "Something went wrong. Try again.";
  }
}
