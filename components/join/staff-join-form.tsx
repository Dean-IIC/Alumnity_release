"use client";

import { firstName } from "../../lib/format";
import { useState } from "react";
import { post } from "../../lib/client/post";
import { CodeField, PasswordField } from "./fields";
import { RegisterBook } from "./register-book";

/*
 * Staff joining (an invitation from the college desk): the invited email → a code → the
 * code and a password. Then they're in, with the role they were invited to.
 */
export function StaffJoinForm({ invitedEmail = "" }: { invitedEmail?: string }) {
  const [email, setEmail] = useState(invitedEmail);
  const [ticket, setTicket] = useState("");
  const [name, setName] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="join">
      <div className="join__form">
        {!ticket ? (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const to = String(new FormData(event.currentTarget).get("email") ?? "");
              setBusy(true);
              setProblem(null);
              const answer = await post<{ ticket: string; name: string }>("/api/auth/staff/start", { email: to });
              setBusy(false);
              if (!answer.ok) return setProblem(answer.error);
              setEmail(to);
              setName(answer.name);
              setTicket(answer.ticket);
            }}
          >
            <label className="field">
              <span className="field__label">The email you were invited at</span>
              <input name="email" type="email" autoComplete="email" required placeholder="you@hkbk.edu.in" defaultValue={invitedEmail} />
              <span className="field__hint">The college desk invites teachers, coordinators and administrators by email.</span>
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
              A student or alumnus? <a href="/join">Find your name in the register</a> · Already joined? <a href="/login">Log in</a>
            </p>
          </form>
        ) : (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              setBusy(true);
              setProblem(null);
              const checked = await post("/api/auth/staff/verify", { ticket, code: form.get("code") });
              if (!checked.ok && !/expired|Too many/.test(checked.error)) {
                // A wrong code: say so, and let them type it again.
                setBusy(false);
                return setProblem(checked.error);
              }
              const answer = await post("/api/auth/staff/complete", { ticket, password: form.get("password") });
              if (answer.ok) return window.location.assign("/me/edit");
              setBusy(false);
              setProblem(answer.error);
            }}
          >
            <p className="join__line">Welcome, {firstName(name)}. A code is on its way to {email}.</p>
            <CodeField email={email} />
            <PasswordField />
            <p className="join__fine">
              By joining, you agree to the <a href="/terms">terms</a> and the <a href="/privacy">privacy policy</a>.
            </p>
            {problem && (
              <p className="join__problem" role="alert">
                {problem}
              </p>
            )}
            <button className="button button--primary join__submit" type="submit" disabled={busy}>
              {busy ? "Making your account…" : "Join Alumnity"} <span aria-hidden="true">→</span>
            </button>
            <button type="button" className="join__switch" onClick={() => setTicket("")}>
              Use a different email
            </button>
          </form>
        )}
      </div>
      <RegisterBook state={busy ? "searching" : "idle"} />
    </div>
  );
}
