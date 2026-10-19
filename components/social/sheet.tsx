"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "./icons";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  /** Put focus in its first text box when it opens (otherwise on its first button). */
  focusField?: boolean;
};

/**
 * A small panel over the page (the share sheet, Send, Tag people, Repost with your
 * thoughts): a native <dialog>, so focus stays inside it, Escape closes it and focus goes
 * back to the button that opened it. On a phone it rises from the bottom, as apps' do.
 */
export function Sheet({ open, onClose, title, children, className = "", focusField = true }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // Kept in a ref so a new onClose each render doesn't re-run the effect below.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // React's autoFocus ran before the dialog opened (and so did nothing): the first
      // text box (a search, a note) takes focus now, where there is one to type in.
      if (focusField) dialog.querySelector<HTMLElement>("textarea, input[type=search], input[type=text]")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open, focusField]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const closed = () => closeRef.current();
    dialog.addEventListener("close", closed);
    return () => dialog.removeEventListener("close", closed);
  }, []);

  return (
    <dialog
      ref={ref}
      className={`sheet ${className}`}
      aria-labelledby={titleId}
      // A tap on the dimmed page around the panel (the dialog itself, not its contents) closes it.
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
    >
      {open && (
        <div className="sheet__panel">
          <header className="sheet__head">
            <h2 id={titleId} className="sheet__title">
              {title}
            </h2>
            <button type="button" className="sheet__close" aria-label="Close" onClick={() => ref.current?.close()}>
              <Icon name="close" size={20} />
            </button>
          </header>
          {children}
        </div>
      )}
    </dialog>
  );
}
