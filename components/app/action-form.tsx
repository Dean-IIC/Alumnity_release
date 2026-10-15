"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import type { ActionState } from "../../lib/action-state";

type ActionFormProps = {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  /** Clear the form once it worked (a message box, a comment). */
  resetOnSuccess?: boolean;
  /** Ask first ("Block Asha? …"): for actions that are hard to undo. */
  confirm?: string;
  /** Show the action's "done" message (on by default). */
  showDone?: boolean;
};

/**
 * A form posting to a server action, with its answer under it: what went wrong, or that
 * it worked. Works before the page's scripts load too (it's a plain form then).
 */
export function ActionForm({ action, children, className = "", resetOnSuccess = false, confirm, showDone = true }: ActionFormProps) {
  const [state, run, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      action={run}
      className={`wf-form ${className}`}
      aria-busy={pending}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      <fieldset className="wf-form__body" disabled={pending}>
        {children}
      </fieldset>
      {state?.error && (
        <p className="wf-note wf-note--error" role="alert">
          {state.error}
        </p>
      )}
      {state?.ok && showDone && state.message && (
        <p className="wf-note wf-note--ok" role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}
