"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from "react";
import type { ActionState } from "../../lib/action-state";
import { deleteChatNow, deleteMessageNow, editMessageNow } from "../../lib/actions/messages";
import { Sheet } from "../social/sheet";
import "../../app/styles/posts-plus.css";

/*
 * What can be done with a message, as WhatsApp offers it: copy its words; on your own,
 * edit it (for 15 minutes after sending) or delete it for everyone; on any, delete it for
 * yourself. And for the whole conversation, delete the chat (for yourself only). One small
 * dialog for all of it (the share sheet's look; a panel rising from the bottom on a phone),
 * opened by a long press on a message, or its ⋯ button with a mouse or a keyboard.
 * Deleting always asks first.
 */

export type MessageTarget = { id: number; mine: boolean; body: string; deleted: boolean; editableUntil: number | null };

/** What the dialog is about: one message, or the whole chat. */
export type Acting = { kind: "message"; message: MessageTarget } | { kind: "chat" };

type Step = "menu" | "edit" | "everyone" | "me" | "chat-menu" | "chat";

const FAILED = "That didn't work. Check your internet connection and try again.";

const TITLES: Record<Step, string> = {
  menu: "Message",
  edit: "Edit message",
  everyone: "Delete for everyone?",
  me: "Delete for you?",
  "chat-menu": "This chat",
  chat: "Delete this chat?"
};

export function MessageActions({ acting, other, onClose }: { acting: Acting | null; other: { id: number; first: string; name: string }; onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("menu");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const [opened, setOpened] = useState<Acting | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const m = acting?.kind === "message" ? acting.message : null;

  // Each time it opens: its first step, nothing typed or wrong from the last time.
  if (acting !== opened) {
    setOpened(acting);
    setStep(acting?.kind === "chat" ? "chat-menu" : "menu");
    setText(acting?.kind === "message" ? acting.message.body : "");
    setError(null);
    setCopied(false);
  }

  // Once the dialog is open (its own effect opens it, before this one runs), and at each
  // step after, focus goes to the step's first choice (or the box to write in), not Close.
  useEffect(() => {
    if (acting) body.current?.querySelector<HTMLElement>("[data-first]")?.focus();
  }, [acting, step]);

  const go = (next: Step) => {
    setError(null);
    setStep(next);
  };

  const editable = Boolean(m && m.mine && !m.deleted && m.editableUntil && m.editableUntil > Date.now());
  const minutesLeft = m?.editableUntil ? Math.max(1, Math.ceil((m.editableUntil - Date.now()) / 60_000)) : 0;

  const run = (work: () => Promise<ActionState>, then?: () => void) =>
    start(async () => {
      setError(null);
      try {
        const result = await work();
        if (result?.ok) {
          onClose();
          then?.();
        } else setError(result?.error ?? FAILED);
      } catch {
        setError(FAILED);
      }
    });

  const copy = async () => {
    if (!m) return;
    try {
      await navigator.clipboard.writeText(m.body);
      setCopied(true);
      window.setTimeout(onClose, 700);
    } catch {
      setError("Couldn't copy the text. Select it and copy it yourself.");
    }
  };

  const save = () => {
    if (m && text.trim()) run(() => editMessageNow(m.id, text));
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // As in the composer: Enter saves on a keyboard, Shift+Enter starts a new line.
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing || window.matchMedia("(pointer: coarse)").matches) return;
    e.preventDefault();
    save();
  };

  const confirming = step === "everyone" || step === "me" || step === "chat";
  const problem = error && (
    <p className="wf-note wf-note--error" role="alert">
      {error}
    </p>
  );

  return (
    <Sheet open={acting !== null} onClose={onClose} title={TITLES[step]} className="sheet--message" focusField={false}>
      <div ref={body} className="msg-sheet">
        {step === "menu" && m && (
          <div className="msg-actions" role="group" aria-label="Message options">
            {!m.deleted && m.body && (
              <button type="button" className="msg-actions__item" onClick={copy} data-first>
                {copied ? "Copied" : "Copy text"}
              </button>
            )}
            {editable && (
              <button type="button" className="msg-actions__item" onClick={() => go("edit")} data-first>
                Edit
                <span className="msg-actions__hint">{minutesLeft === 1 ? "1 minute left" : `${minutesLeft} minutes left`}</span>
              </button>
            )}
            {m.mine && !m.deleted && (
              <button type="button" className="msg-actions__item msg-actions__item--danger" onClick={() => go("everyone")} data-first>
                Delete for everyone
              </button>
            )}
            <button type="button" className="msg-actions__item msg-actions__item--danger" onClick={() => go("me")} data-first>
              Delete for me
            </button>
          </div>
        )}

        {step === "chat-menu" && (
          <div className="msg-actions" role="group" aria-label={`Options for your chat with ${other.name}`}>
            <Link className="msg-actions__item" href={`/people/${other.id}`} onClick={onClose} data-first>
              View {other.first}&rsquo;s profile
            </Link>
            <button type="button" className="msg-actions__item msg-actions__item--danger" onClick={() => go("chat")}>
              Delete chat
            </button>
          </div>
        )}

        {step === "edit" && m && (
          <form
            className="edit-form"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <label className="sr-only" htmlFor="message-edit">
              Your message
            </label>
            <textarea
              id="message-edit"
              className="sheet__note-box"
              rows={3}
              maxLength={2000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKey}
              onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
              enterKeyHint="done"
              data-first
            />
            <p className="sheet__note">{other.first} will see that it was edited.</p>
            {problem}
            <div className="sheet__foot">
              <button type="button" className="button button--secondary" onClick={() => go("menu")}>
                Cancel
              </button>
              <button type="submit" className="button button--primary" disabled={pending || !text.trim()}>
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}

        {confirming && (
          <>
            <p className="sheet__note">
              {step === "everyone"
                ? `The message is removed for you and ${other.first}. You will both see "This message was deleted".`
                : step === "me"
                  ? `The message is removed only for you. ${other.first} will still see it.`
                  : `All messages in this chat are removed only for you. ${other.first} will still see them. If either of you sends a new message, it will show here.`}
            </p>
            {problem}
            <div className="sheet__foot">
              <button type="button" className="button button--secondary" onClick={() => go(step === "chat" ? "chat-menu" : "menu")} data-first>
                Cancel
              </button>
              <button
                type="button"
                className="button button--primary sheet__danger"
                disabled={pending}
                onClick={() =>
                  step === "chat"
                    ? run(() => deleteChatNow(other.id), () => router.push("/messages"))
                    : m && run(() => deleteMessageNow(m.id, step === "everyone"))
                }
              >
                {pending ? "Deleting…" : step === "chat" ? "Delete chat" : "Delete"}
              </button>
            </div>
          </>
        )}

        {(step === "menu" || step === "chat-menu") && problem}
      </div>
    </Sheet>
  );
}
