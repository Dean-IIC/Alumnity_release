"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { post } from "../../lib/client/post";
import { useHydrated } from "../../lib/client/hydrated";
import { PasswordField } from "../join/fields";
import { AlertsPanel } from "./alerts-panel";
import { ThemeChoicePicker } from "./theme-choice";

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
  // Disabled until the script has taken over: tapped early, the browser would send the form itself.
  const ready = useHydrated();
  const sessions = useAction();
  const remove = useAction();

  return (
    <div className="settings">
      <Section title="Your email">
        <p className="settings__value">{email}</p>
        <p className="join__fine">Only you can see this. You use it to log in, and we send your login codes to it.</p>
      </Section>

      <Section title="Light or dark">
        <ThemeChoicePicker />
      </Section>
      <Section title="Notifications">
        <AlertsPanel />
      </Section>

      <Section title="Password">
        <form
          method="post"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            password.run(async () => {
              const answer = await post("/api/auth/password", { current: data.get("current"), password: data.get("password") });
              if (!answer.ok) return { ok: false, text: answer.error };
              form.reset();
              return { ok: true, text: "Your password is changed. We logged you out on all your other devices." };
            });
          }}
        >
          <label className="field">
            <span className="field__label">Your current password</span>
            <input name="current" type="password" autoComplete="current-password" required />
          </label>
          <PasswordField label="A new password" />
          {password.note}
          <button className="button button--primary join__submit" type="submit" disabled={password.busy || !ready}>
            {password.busy ? "Saving…" : "Change my password"}
          </button>
        </form>
      </Section>

      <Section title="Where you’re logged in">
        <p className="join__fine">Lost your phone, or logged in on a shared computer? Log out of all your other devices.</p>
        {sessions.note}
        <button
          type="button"
          className="button button--secondary join__submit"
          disabled={sessions.busy}
          onClick={() =>
            sessions.run(async () => {
              const answer = await post<{ ended: number }>("/api/auth/sessions", {});
              if (!answer.ok) return { ok: false, text: answer.error };
              return { ok: true, text: answer.ended ? `Logged out of ${answer.ended} other ${answer.ended === 1 ? "device" : "devices"}.` : "You were not logged in on any other device." };
            })
          }
        >
          Log out of other devices
        </button>
      </Section>

      <Section title="Delete your account">
        <p className="join__fine">This deletes your account and your page from Alumnity forever. You can’t undo it.</p>
        <p className="join__fine">Your name stays in the college register, so you can join again later.</p>
        <form
          method="post"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            if (data.get("confirm") !== "DELETE") return remove.run(async () => ({ ok: false, text: "Type DELETE in capital letters first." }));
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
            <span className="field__label">Type DELETE to be sure</span>
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
