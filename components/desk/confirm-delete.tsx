"use client";

import { useState, type ReactNode } from "react";
import type { ActionState } from "../../lib/action-state";
import { ConfirmSheet } from "../social/edit-delete";

/**
 * A desk button that deletes something, asking first in a small dialog (a native <dialog>,
 * never the browser's own box): Cancel, or the red button that does it.
 */
export function ConfirmDelete({
  action,
  id,
  label,
  title,
  confirm,
  children
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  id: number;
  /** The button on the page ("Delete photo"). */
  label: string;
  /** The dialog's heading ("Delete this photo?"). */
  title: string;
  /** The dialog's red button ("Delete"). */
  confirm: string;
  /** What happens, in a sentence or two. */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="button button--secondary wf-small showcase__delete" onClick={() => setOpen(true)}>
        {label}
      </button>
      <ConfirmSheet
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        confirm={confirm}
        run={() => {
          const form = new FormData();
          form.set("id", String(id));
          return action(null, form);
        }}
      >
        {children}
      </ConfirmSheet>
    </>
  );
}
