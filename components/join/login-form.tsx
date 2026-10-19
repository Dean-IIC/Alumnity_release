"use client";


import Link from "next/link";
import { useEffect, useState } from "react";
import { post } from "../../lib/client/post";
import { useHydrated } from "../../lib/client/hydrated";
import { PasswordField } from "./fields";
import { RegisterBook, type BookState } from "./register-book";
import { safeNext } from "../../lib/safe-next";
import { WELCOME_BACK_KEY } from "../app/welcome-back";

/*
 * Logging in: email and password. The register sits beside it, its scan line drifting
 * slowly; signing in runs a quick "checking" scan, and once in, it shows "Welcome back"
 * while the next page loads (where the welcome-back greeting takes over).
 */
export function LoginForm() {
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState<BookState>("idle");
  // Disabled until the script has taken over: tapped early, the browser would send the form itself.
  const ready = useHydrated();

  // Coming back to this page with the browser's Back button can restore it exactly as it was
  // left: mid-login, button disabled. Start it fresh instead.
  useEffect(() => {
    const fresh = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      setBusy(false);
      setScan("idle");
    };
    window.addEventListener("pageshow", fresh);
    return () => window.removeEventListener("pageshow", fresh);
  }, []);

  return (
    <div className="join join--form-first">
      <div className="join__form">
        <form
          method="post"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setBusy(true);
            setScan("searching");
            setProblem(null);
            const answer = await post("/api/auth/login", { email: form.get("email"), password: form.get("password") });
            if (answer.ok) {
              setScan("found");
              // Tells the first signed-in page to say "Welcome back" once (components/app/welcome-back.tsx).
              // Only a flag: the name it shows comes from the server, not from here.
              try {
                sessionStorage.setItem(WELCOME_BACK_KEY, "1");
              } catch {
                // Storage turned off: no greeting, nothing else changes.
              }
              window.location.assign(safeNext(new URLSearchParams(window.location.search).get("next")));
              return;
            }
            setBusy(false);
            setScan("idle");
            setProblem(answer.error);
          }}
        >
          <label className="field">
            <span className="field__label">Your email</span>
            <input name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
          </label>
          <PasswordField label="Your password" autoComplete="current-password" />
          <Link className="join__switch join__forgot" href="/forgot">
            Forgot your password?
          </Link>
          {problem && (
            <p className="join__problem" role="alert">
              {problem}
            </p>
          )}
          <button className="button button--primary join__submit" type="submit" disabled={busy || !ready}>
            {busy ? "Logging in…" : "Log in"} <span aria-hidden="true">→</span>
          </button>
          <p className="join__fine">
            New here? <Link href="/join">Find your name in the register</Link> · Staff: <Link href="/join/staff">join with your invitation</Link>
          </p>
        </form>
      </div>
      <RegisterBook state={scan} tone="login" />
    </div>
  );
}
