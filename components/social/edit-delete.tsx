"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { ActionState } from "../../lib/action-state";
import { editCommentNow, editPostNow, removeCommentNow, removePostNow } from "../../lib/actions/content";
import { MentionInput } from "./mention-input";
import { Sheet } from "./sheet";
import "../../app/styles/posts-plus.css";

/*
 * Editing and deleting a post or a comment, as LinkedIn does: from the post's ⋯ menu, or
 * beside a comment. Deleting always asks first, in a small dialog (never the browser's own
 * box); editing opens the words in one, with their @mentions kept.
 */

const FAILED = "That didn't work. Check your internet connection and try again.";

/** A dialog put at the end of the page: one inside a post's ⋯ menu (a <details>) would vanish as it closes. */
function Floating({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready ? createPortal(children, document.body) : null;
}

/** "Delete this? It can't be brought back." with Cancel and the red button. */
export function ConfirmSheet({
  open,
  onClose,
  title,
  children,
  confirm,
  run
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** The button that does it ("Delete"). */
  confirm: string;
  run: () => Promise<ActionState>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    if (open) setError(null);
  }, [open]);
  const go = () =>
    start(async () => {
      try {
        const result = await run();
        // Nothing back: it went on to another page (the post's own page is gone with it).
        if (!result || result.ok) onClose();
        else setError(result.error ?? FAILED);
      } catch (e) {
        if (String((e as { digest?: unknown })?.digest ?? "").startsWith("NEXT_REDIRECT")) throw e;
        setError(FAILED);
      }
    });
  return (
    <Sheet open={open} onClose={onClose} title={title} className="sheet--confirm" focusField={false}>
      <div className="sheet__note">{children}</div>
      {error && (
        <p className="wf-note wf-note--error" role="alert">
          {error}
        </p>
      )}
      <div className="sheet__foot">
        <button type="button" className="button button--secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="button button--primary sheet__danger" disabled={pending} onClick={go}>
          {pending ? "Deleting…" : confirm}
        </button>
      </div>
    </Sheet>
  );
}

/** The words of a post or a comment, open to change (mentions stay mentions). */
function EditSheet({
  open,
  onClose,
  title,
  initial,
  limit,
  note,
  run
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  initial: string;
  limit: number;
  note?: string;
  run: (body: string) => Promise<ActionState>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!open) return;
    setError(null);
    // The dialog has put focus in the box: the caret goes to the end of the words.
    const frame = requestAnimationFrame(() => {
      const box = form.current?.querySelector("textarea");
      box?.setSelectionRange(box.value.length, box.value.length);
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);
  return (
    <Sheet open={open} onClose={onClose} title={title} className="sheet--edit">
      <form
        ref={form}
        className="edit-form"
        onSubmit={(e) => {
          e.preventDefault();
          const body = String(new FormData(e.currentTarget).get("body") ?? "");
          start(async () => {
            try {
              const result = await run(body);
              if (result?.ok) onClose();
              else setError(result?.error ?? FAILED);
            } catch {
              setError(FAILED);
            }
          });
        }}
      >
        <MentionInput name="body" label="Text" initial={initial} maxLength={limit} rows={5} className="edit-form__text" placeholder="Write something. Type @ to mention someone." />
        {note && <p className="sheet__note">{note}</p>}
        {error && (
          <p className="wf-note wf-note--error" role="alert">
            {error}
          </p>
        )}
        <div className="sheet__foot">
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button button--primary" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

/**
 * Edit and Delete in a post's ⋯ menu. The writer may do both; a group's owner and admins
 * may delete any post in their group (`mine` false).
 */
export function PostEditDelete({
  id,
  body,
  mine,
  verified,
  limit,
  after
}: {
  id: number;
  body: string;
  mine: boolean;
  verified: boolean;
  limit: number;
  /** Where to go once it's deleted, if the page is the post's own. */
  after?: string;
}) {
  const [open, setOpen] = useState<"edit" | "delete" | null>(null);
  const close = () => setOpen(null);
  return (
    <>
      {mine && (
        <button type="button" aria-haspopup="dialog" onClick={() => setOpen("edit")}>
          Edit post
        </button>
      )}
      <button type="button" aria-haspopup="dialog" onClick={() => setOpen("delete")}>
        {mine ? "Delete post" : "Delete from the group"}
      </button>
      <Floating>
        {mine && (
          <EditSheet
            open={open === "edit"}
            onClose={close}
            title="Edit post"
            initial={body}
            limit={limit}
            note={
              verified
                ? "You can change the words, but not the photos or who can see it. It leaves the HKBK board until the college checks it again."
                : "You can change the words, but not the photos or who can see it. The post will show as edited."
            }
            run={(text) => editPostNow(id, text)}
          />
        )}
        <ConfirmSheet open={open === "delete"} onClose={close} title={mine ? "Delete post?" : "Delete this post from the group?"} confirm="Delete" run={() => removePostNow(id, after)}>
          {mine ? "This deletes the post for everyone, with its reactions and comments. You can't undo this." : "This deletes the post for everyone in the group, with its comments. You can't undo this."}
        </ConfirmSheet>
      </Floating>
    </>
  );
}

/** Edit and Delete beside your own comment. */
export function CommentEditDelete({ id, body, limit }: { id: number; body: string; limit: number }) {
  const [open, setOpen] = useState<"edit" | "delete" | null>(null);
  const close = () => setOpen(null);
  return (
    <>
      <button type="button" className="wf-link-button" aria-haspopup="dialog" onClick={() => setOpen("edit")}>
        Edit
      </button>
      <button type="button" className="wf-link-button" aria-haspopup="dialog" onClick={() => setOpen("delete")}>
        Delete
      </button>
      <Floating>
        <EditSheet open={open === "edit"} onClose={close} title="Edit comment" initial={body} limit={limit} run={(text) => editCommentNow(id, text)} />
        <ConfirmSheet open={open === "delete"} onClose={close} title="Delete comment?" confirm="Delete" run={() => removeCommentNow(id)}>
          This deletes the comment for everyone. You can&rsquo;t undo this.
        </ConfirmSheet>
      </Floating>
    </>
  );
}
