"use client";

import { useState } from "react";

/* The fields the account pages share: a six-digit code, and a password you can reveal. */

export function CodeField({ email }: { email: string }) {
  return (
    <label className="field">
      <span className="field__label">The code we emailed you</span>
      <input
        name="code"
        required
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]{6,7}"
        maxLength={7}
        placeholder="123456"
        className="field__code"
      />
      <span className="field__hint">Sent to {email}. It works for 15 minutes. Not there? Check spam, or ask for a new one below.</span>
    </label>
  );
}

export function PasswordField({ label = "Choose a password", autoComplete = "new-password" }: { label?: string; autoComplete?: string }) {
  const [shown, setShown] = useState(false);
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <span className="field__with-action">
        <input name="password" type={shown ? "text" : "password"} required minLength={autoComplete === "new-password" ? 10 : undefined} autoComplete={autoComplete} />
        <button type="button" className="field__action" onClick={() => setShown((s) => !s)} aria-pressed={shown}>
          {shown ? "Hide" : "Show"}
        </button>
      </span>
      {autoComplete === "new-password" && <span className="field__hint">At least 10 characters. A few words you’ll remember works well.</span>}
    </label>
  );
}
