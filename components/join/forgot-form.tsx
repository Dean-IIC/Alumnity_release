"use client";

import { useState } from "react";
import { post } from "../../lib/client/post";
import { CodeField, PasswordField } from "./fields";
import { RegisterBook } from "./register-book";

/*
 * Forgot password: your email → we send a code (if it has an account; the answer is the
 * same either way) → the code and a new password. Every other signed-in browser is signed out.
 */
export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [ticket, setTicket] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="join join--form-first">
      <div className="join__form">
        {!ticket ? (
          <form
            method="post"
            onSubmit={async (event) => {
              event.preventDefault();
              const to = String(new FormData(event.currentTarget).get("email") ?? "");
              setBusy(true);
              setProblem(null);
              const answer = await post<{ ticket: string }>("/api/auth/reset/start", { email: to });
              setBusy(false);
              if (!answer.ok) return setProblem(answer.error);
              setEmail(to);
              setTicket(answer.ticket);
            }}
          >
            <label className="field">
              <span className="field__label">Your email</span>
              <input name="email" type="email" autoComplete="email" required placeholder="you@example.com" defaultValue={email} />
              <span className="field__hint">The one you joined with.</span>
            </label>
            {problem && (
              <p className="join__problem" role="alert">
                {problem}
              </p>
            )}
            <button className="button button--primary join__submit" type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send me a code"} <span aria-hidden="true">→</span>
            </button>
            <p className="join__fine">
              Remembered it? <a href="/login">Log in</a>
            </p>
          </form>
        ) : (
          <form
            method="post"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              setBusy(true);
              setProblem(null);
              const answer = await post("/api/auth/reset/complete", { ticket, code: form.get("code"), password: form.get("password") });
              if (answer.ok) return window.location.assign("/me");
              setBusy(false);
              setProblem(answer.error);
            }}
          >
            <p className="join__line">If {email} has an account, a code is on its way to it.</p>
            <CodeField email={email} />
            <PasswordField label="Choose a new password" />
            {problem && (
              <p className="join__problem" role="alert">
                {problem}
              </p>
            )}
            <button className="button button--primary join__submit" type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save my new password"} <span aria-hidden="true">→</span>
            </button>
            <button type="button" className="join__switch" onClick={() => setTicket("")}>
              Send a new code, or change the email
            </button>
          </form>
        )}
      </div>
      <RegisterBook state={busy ? "searching" : "idle"} />
    </div>
  );
}
