"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { post } from "../../lib/client/post";
import { PasswordField } from "../join/fields";
import { AlertsPanel } from "./alerts-panel";

/* Settings: alerts, your password, the browsers you're signed in on, and deleting your account. */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="settings__section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function useAction() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async (work: () => Promise<{ ok: boolean; text: string } | null>) => {
    setBusy(true);
    setMessage(null);
    const result = await work();
    setBusy(false);
    if (result) setMessage(result);
  };
  const note = message && (
    <p className={message.ok ? "join__note" : "join__problem"} role={message.ok ? "status" : "alert"}>
      {message.text}
    </p>
  );
  return { busy, run, note };
}

export function SettingsPanel({ email }: { email: string }) {
  const password = useAction();
  const sessions = useAction();
  const remove = useAction();

  return (
    <div className="settings">
      <Section title="Your email">
        <p className="settings__value">{email}</p>
        <p className="join__fine">Only you see it. You log in with it, and your codes go to it.</p>
      </Section>

      <Section title="Alerts">
        <AlertsPanel />
      </Section>

      <Section title="Password">
        <form
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            password.run(async () => {
              const answer = await post("/api/auth/password", { current: data.get("current"), password: data.get("password") });
              if (!answer.ok) return { ok: false, text: answer.error };
              form.reset();
              return { ok: true, text: "Your password is changed. Anywhere else you were logged in, you’ve been logged out." };
            });
          }}
        >
          <label className="field">
            <span className="field__label">Your current password</span>
            <input name="current" type="password" autoComplete="current-password" required />
          </label>
          <PasswordField label="A new password" />
          {password.note}
          <button className="button button--primary join__submit" type="submit" disabled={password.busy}>
            {password.busy ? "Saving…" : "Change my password"}
          </button>
        </form>
      </Section>

      <Section title="Where you’re logged in">
        <p className="join__fine">Lost a phone, or logged in on a shared computer? Log out everywhere except here.</p>
        {sessions.note}
        <button
          type="button"
          className="button button--secondary join__submit"
          disabled={sessions.busy}
          onClick={() =>
            sessions.run(async () => {
              const answer = await post<{ ended: number }>("/api/auth/sessions", {});
              if (!answer.ok) return { ok: false, text: answer.error };
              return { ok: true, text: answer.ended ? `Logged out of ${answer.ended} other ${answer.ended === 1 ? "place" : "places"}.` : "You weren’t logged in anywhere else." };
            })
          }
        >
          Log out everywhere else
        </button>
      </Section>

      <Section title="Delete your account">
        <p className="join__fine">
          This deletes your account and your page from Alumnity for good. Your name stays in the college register, so you can join again later if you want.
        </p>
        <form
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            if (data.get("confirm") !== "DELETE") return remove.run(async () => ({ ok: false, text: "Type DELETE (in capitals) to confirm." }));
            remove.run(async () => {
              const answer = await post("/api/auth/delete", { password: data.get("password") });
              if (!answer.ok) return { ok: false, text: answer.error };
              window.location.assign("/");
              return null;
            });
          }}
        >
          <label className="field">
            <span className="field__label">Your password</span>
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <label className="field">
            <span className="field__label">Type DELETE to confirm</span>
            <input name="confirm" autoComplete="off" required spellCheck={false} />
          </label>
          {remove.note}
          <button className="button settings__danger join__submit" type="submit" disabled={remove.busy}>
            {remove.busy ? "Deleting…" : "Delete my account"}
          </button>
        </form>
      </Section>
    </div>
  );
}
