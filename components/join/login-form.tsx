"use client";


import Link from "next/link";
import { useState } from "react";
import { post } from "../../lib/client/post";
import { useHydrated } from "../../lib/client/hydrated";
import { PasswordField } from "./fields";
import { RegisterBook } from "./register-book";
import { safeNext } from "../../lib/safe-next";

/* Logging in: email and password. The register sits open beside it: your page is in there. */
export function LoginForm() {
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Disabled until the script has taken over: tapped early, the browser would send the form itself.
  const ready = useHydrated();
  return (
    <div className="join join--form-first">
      <div className="join__form">
        <form
          method="post"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setBusy(true);
            setProblem(null);
            const answer = await post("/api/auth/login", { email: form.get("email"), password: form.get("password") });
            if (answer.ok) {
              window.location.assign(safeNext(new URLSearchParams(window.location.search).get("next")));
              return;
            }
            setBusy(false);
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
            {busy ? "Opening your page…" : "Log in"} <span aria-hidden="true">→</span>
          </button>
          <p className="join__fine">
            New here? <Link href="/join">Find your name in the register</Link> · Staff: <Link href="/join/staff">join with your invitation</Link>
          </p>
        </form>
      </div>
      <RegisterBook state={busy ? "searching" : "idle"} />
    </div>
  );
}
