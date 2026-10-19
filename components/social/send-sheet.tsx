"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { sendPostAction } from "../../lib/actions/content";
import { SEND_LIMIT } from "../../lib/post-limits";
import type { PickPerson } from "../../lib/people-pick";
import { PeoplePicker } from "./people-picker";
import { Sheet } from "./sheet";

type Props = { open: boolean; onClose: () => void; postId: number };

/**
 * Send: a post passed privately to some of your connections, as a message with its link
 * and a line of your own if you like. The server checks each is a connection and can see
 * the post; if one isn't, nothing is sent and they're named.
 */
export function SendSheet({ open, onClose, postId }: Props) {
  const [chosen, setChosen] = useState<PickPerson[]>([]);
  const [note, setNote] = useState("");
  const [answer, setAnswer] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const noteId = useId();

  // Each time it opens, it starts afresh.
  useEffect(() => {
    if (!open) return;
    setChosen([]);
    setNote("");
    setAnswer(null);
  }, [open]);

  const send = () =>
    startTransition(async () => {
      const result = await sendPostAction(
        postId,
        chosen.map((p) => p.id),
        note
      );
      setAnswer({ ok: Boolean(result?.ok), text: (result?.ok ? result.message : result?.error) ?? "That didn't work. Try again." });
      if (result?.ok) window.setTimeout(onClose, 1400);
    });

  return (
    <Sheet open={open} onClose={onClose} title="Send to your connections" className="sheet--send">
      <PeoplePicker chosen={chosen.map((p) => p.id)} onChange={setChosen} max={SEND_LIMIT} label="Send to" />
      {chosen.length > 0 && (
        <p className="sheet__chosen" aria-live="polite">
          To: {chosen.map((p) => p.name).join(", ")}
        </p>
      )}
      <label className="sr-only" htmlFor={noteId}>
        Add a note (optional)
      </label>
      <textarea id={noteId} className="sheet__note-box" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note (optional)" />
      {answer && (
        <p className={`wf-note ${answer.ok ? "" : "wf-note--error"}`} role={answer.ok ? "status" : "alert"}>
          {answer.text}
        </p>
      )}
      <div className="sheet__foot">
        <button type="button" className="button button--primary" disabled={pending || chosen.length === 0 || answer?.ok === true} onClick={send}>
          {pending ? "Sending…" : chosen.length > 1 ? `Send to ${chosen.length} people` : "Send"}
        </button>
      </div>
    </Sheet>
  );
}
