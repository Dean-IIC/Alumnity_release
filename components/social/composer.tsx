"use client";


import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import type { ActionState } from "../../lib/action-state";
import { postAction } from "../../lib/actions/content";
import { uploadFile } from "../../lib/client/upload";
import { Icon } from "./icons";
import { MentionInput } from "./mention-input";
import { SUGGESTED_TAGS } from "../../lib/tags";

type Upload = { key: string; id?: string; kind: "image" | "video"; preview: string; error?: string };

const AUDIENCE = [
  { value: "everyone", label: "Everyone", icon: "everyone" },
  { value: "batch", label: "Your batch", icon: "batch" },
  { value: "connections", label: "Connections", icon: "connections" }
] as const;

/**
 * Writing a post: a few words, up to four photos or videos (uploaded as they're chosen),
 * @mentions, and who it's for. Folded to one line until it's tapped.
 */
export function Composer({
  firstName,
  avatar,
  hasBatch,
  startOpen = false,
  group
}: {
  firstName: string;
  avatar: React.ReactNode;
  hasBatch: boolean;
  startOpen?: boolean;
  /** Posting in a group: it's for the group, so there's no "who can see it" to choose. */
  group?: { id: number; name: string };
}) {
  const [open, setOpen] = useState(startOpen);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [audience, setAudience] = useState<string>("everyone");
  const [text, setText] = useState("");
  const [sentCount, setSentCount] = useState(0);
  const [state, run, pending] = useActionState(async (prev: ActionState, form: FormData) => {
    const answer = await postAction(prev, form);
    if (answer?.ok) {
      uploads.forEach((u) => URL.revokeObjectURL(u.preview));
      setUploads([]);
      setText("");
      setSentCount((n) => n + 1);
      setOpen(false);
    }
    return answer;
  }, null);
  const files = useRef<HTMLInputElement>(null);

  // "+" in the phone's tab bar opens the composer here.
  useEffect(() => {
    const openFromHash = () => window.location.hash === "#compose" && setOpen(true);
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  const add = async (list: FileList | null) => {
    if (!list) return;
    const room = 4 - uploads.length;
    for (const file of [...list].slice(0, room)) {
      const key = `${file.name}-${file.size}-${Math.random()}`;
      const kind = file.type.startsWith("video/") ? "video" : "image";
      const preview = URL.createObjectURL(file);
      setUploads((u) => [...u, { key, kind, preview }]);
      const answer = await uploadFile(file, "post");
      setUploads((u) => u.map((x) => (x.key === key ? (answer.ok ? { ...x, id: answer.id } : { ...x, error: answer.error }) : x)));
    }
    if (files.current) files.current.value = "";
  };

  const uploading = uploads.some((u) => !u.id && !u.error);
  const ready = uploads.filter((u) => u.id);

  if (!open) {
    return (
      <div className="composer composer--folded">
        {avatar}
        <button type="button" className="composer__prompt" onClick={() => setOpen(true)}>
          {group ? `Write something to ${group.name}…` : `Share something with HKBK, ${firstName}…`}
        </button>
        <div className="composer__quick">
          <button
            type="button"
            className="composer__chip"
            onClick={() => {
              setOpen(true);
              requestAnimationFrame(() => files.current?.click());
            }}
          >
            <Icon name="photo" size={20} className="icon--gold" /> Photo
          </button>
          <Link className="composer__chip" href="/ask">
            <Icon name="ask" size={20} className="icon--blue" /> Ask
          </Link>
          <Link className="composer__chip" href="/events">
            <Icon name="event" size={20} className="icon--blue" /> Events
          </Link>
        </div>
        <input ref={files} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" multiple hidden onChange={(e) => add(e.target.files)} />
      </div>
    );
  }

  return (
    <form action={run} className="composer composer--open" id="compose" aria-busy={pending}>
      <div className="composer__head">
        {avatar}
        {group ? (
          <div className="composer__audience">
            <input type="hidden" name="group" value={group.id} />
            <span className="composer__who composer__who--on">
              <Icon name="people" size={16} />
              {group.name}
            </span>
          </div>
        ) : (
          <div className="composer__audience" role="radiogroup" aria-label="Who can see it">
            {AUDIENCE.filter((a) => a.value !== "batch" || hasBatch).map((a) => (
              <label key={a.value} className={`composer__who ${audience === a.value ? "composer__who--on" : ""}`}>
                <input type="radio" name="audience" value={a.value} checked={audience === a.value} onChange={() => setAudience(a.value)} />
                <Icon name={a.icon} size={16} />
                {a.label}
              </label>
            ))}
          </div>
        )}
      </div>
      <MentionInput
        id="compose-text"
        name="body"
        label="Your post"
        rows={3}
        maxLength={2000}
        placeholder="What's new? Type @ to mention someone."
        resetKey={sentCount}
        onTextChange={setText}
        autoFocus
        className="composer__text"
      />
      <fieldset className="composer__tags">
        <legend>Tag it (optional)</legend>
        {SUGGESTED_TAGS.map(([tag, label]) => (
          <label key={tag} className="composer__tag">
            <input type="checkbox" name="tag" value={tag} />#{label.toLowerCase()}
          </label>
        ))}
      </fieldset>
      {uploads.length > 0 && (
        <ul className={`composer__media composer__media--${Math.min(uploads.length, 4)}`}>
          {uploads.map((u) => (
            <li key={u.key} className={u.error ? "composer__media--failed" : u.id ? "" : "composer__media--loading"}>
              {u.kind === "video" ? <video src={u.preview} muted playsInline /> : <img src={u.preview} alt="" />}
              {u.error && <span className="composer__media-error">{u.error}</span>}
              {u.id && <input type="hidden" name="media" value={u.id} />}
              <button
                type="button"
                className="composer__remove"
                aria-label="Remove"
                onClick={() => {
                  URL.revokeObjectURL(u.preview);
                  setUploads((all) => all.filter((x) => x.key !== u.key));
                }}
              >
                <Icon name="close" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="composer__foot">
        <button type="button" className="composer__tool" onClick={() => files.current?.click()} disabled={uploads.length >= 4} aria-label="Add photos or videos">
          <Icon name="photo" size={22} className="icon--gold" />
        </button>
        <input ref={files} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" multiple hidden onChange={(e) => add(e.target.files)} />
        <span className={`composer__hint ${uploads.length ? "" : "composer__hint--long"}`}>{uploads.length ? `${uploads.length} of 4` : "Up to 4 photos or videos"}</span>
        <button type="button" className="composer__cancel" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button className="button button--primary composer__post" type="submit" disabled={pending || uploading || (!text.trim() && ready.length === 0)}>
          {uploading ? "Uploading…" : pending ? "Posting…" : "Post"}
        </button>
      </div>
      {state?.error && (
        <p className="wf-note wf-note--error" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
