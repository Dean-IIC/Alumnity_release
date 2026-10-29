"use client";

import { useState, type FormEvent } from "react";
import { post } from "../../lib/client/post";
import { useHydrated } from "../../lib/client/hydrated";
import { PasswordField } from "../join/fields";

/*
 * Shown in place of every page until someone the college added sets their own password.
 * They were given a password that several people know, so the first thing they do is
 * replace it. The server clears the flag, then the page reloads into the app.
 */
export function SetYourPassword({ email }: { email: string }) {
  const ready = useHydrated();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div className="profile-page">
      <header className="page-head">
        <h1 className="page-title">Choose your own password</h1>
      </header>
      <p className="info-lead">
        HKBK College added your account for you, so it started with a password that other people
        also know. Set one only you know before you use the app.
      </p>
      <form
        method="post"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          setBusy(true);
          setMessage(null);
          post("/api/auth/password", {
            current: data.get("current"),
            password: data.get("password")
          }).then((answer) => {
            setBusy(false);
            if (!answer.ok) return setMessage({ ok: false, text: answer.error });
            form.reset();
            setMessage({ ok: true, text: "Saved. Taking you in…" });
            window.location.reload();
          });
        }}
      >
        <p className="join__fine">You are signed in as {email}.</p>
        <label className="field">
          <span className="field__label">The password the college gave you</span>
          <input name="current" type="password" autoComplete="current-password" required />
        </label>
        <PasswordField label="Your new password" />
        {message && (
          <p className={message.ok ? "join__note" : "join__problem"} role={message.ok ? "status" : "alert"}>
            {message.text}
          </p>
        )}
        <button className="button button--primary join__submit" type="submit" disabled={busy || !ready}>
          {busy ? "Saving…" : "Save my password"}
        </button>
      </form>
    </div>
  );
}
