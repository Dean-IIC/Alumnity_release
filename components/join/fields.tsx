"use client";

import { useId, useState } from "react";

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
      <span className="field__hint">We sent it to {email}. It works for 15 minutes. Can’t find it? Check your spam folder, or ask for a new code below.</span>
    </label>
  );
}

export function PasswordField({ label = "Choose a password", autoComplete = "new-password" }: { label?: string; autoComplete?: string }) {
  const [shown, setShown] = useState(false);
  // Its own label, tied by id: a Show button inside a <label> muddles the field's name for screen readers.
  const id = useId();
  const isNew = autoComplete === "new-password";
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <span className="field__with-action">
        <input
          id={id}
          name="password"
          type={shown ? "text" : "password"}
          required
          minLength={isNew ? 10 : undefined}
          autoComplete={autoComplete}
          aria-describedby={isNew ? `${id}-hint` : undefined}
        />
        <button type="button" className="field__action" onClick={() => setShown((s) => !s)} aria-pressed={shown} aria-label={shown ? "Hide password" : "Show password"}>
          {shown ? "Hide" : "Show"}
        </button>
      </span>
      {isNew && (
        <span className="field__hint" id={`${id}-hint`}>
          Use at least 10 characters. A few words you can remember work well.
        </span>
      )}
    </div>
  );
}
