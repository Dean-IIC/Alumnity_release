"use client";


import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { aiPostHelpAction } from "../../lib/actions/ai";
import type { ActionState } from "../../lib/action-state";
import { postAction } from "../../lib/actions/content";
import { uploadFile } from "../../lib/client/upload";
import type { PickPerson } from "../../lib/people-pick";
import { MEDIA_LIMIT } from "../../lib/post-limits";
import { Icon } from "./icons";
import { MentionInput } from "./mention-input";
import { PeoplePicker } from "./people-picker";
import { Sheet } from "./sheet";
import { SUGGESTED_TAGS } from "../../lib/tags";
import "../../app/styles/posts-plus.css";

/** People tagged in one go (each is told; the server allows twenty mentions a post). */
const TAG_LIMIT = 20;

type Upload = { key: string; id?: string; kind: "image" | "video"; preview: string; error?: string };

const AUDIENCE = [
  { value: "everyone", label: "Everyone", icon: "everyone" },
  { value: "batch", label: "Your batch", icon: "batch" },
  { value: "connections", label: "Connections", icon: "connections" }
] as const;

/**
 * Writing a post: a few words, up to ten photos or videos (uploaded as they're chosen),
 * @mentions, and who it's for. Folded to one line until it's tapped. People can be tagged
 * by typing @ or with "Tag people", which picks from your connections; either way each
 * tagged person who can see the post is told.
 */
export function Composer({
  firstName,
  avatar,
  hasBatch,
  startOpen = false,
  group,
  ai = false
}: {
  /** The AI helper ("Help me write") is on for this site. */
  ai?: boolean;
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
  const [tagging, setTagging] = useState(false);
  const [tagged, setTagged] = useState<PickPerson[]>([]);
  const [insert, setInsert] = useState<{ key: number; people: PickPerson[] } | undefined>(undefined);
  const [replace, setReplace] = useState<{ key: number; text: string } | undefined>(undefined);
  const [polish, setPolish] = useState<{ text: string; hashtags: string[] } | null>(null);
  const [polishError, setPolishError] = useState<string | null>(null);
  const [polishing, startPolish] = useTransition();
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
    const room = MEDIA_LIMIT - uploads.length;
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
          <div className="composer__audience" role="radiogroup" aria-label="Who can see this post">
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
        insert={insert}
        replace={replace}
        autoFocus
        className="composer__text"
      />
      {ai && (
        <div className="ai-help ai-help--post">
          <button
            type="button"
            className="button button--secondary wf-small"
            disabled={polishing || text.trim().length < 10}
            title={text.trim().length < 10 ? "Write a little first, then ask for help" : undefined}
            onClick={() => {
              setPolishError(null);
              startPolish(async () => {
                const answer = await aiPostHelpAction(text);
                if (!answer.ok) return setPolishError(answer.error);
                setPolish({ text: answer.text, hashtags: answer.hashtags });
              });
            }}
          >
            {polishing ? "Thinking…" : "✦ Help me write"}
          </button>
          {polishError && (
            <p className="ai-note ai-note--error" role="alert">
              {polishError}
            </p>
          )}
          {polish && (
            <section className="ai-suggestion" aria-label="Suggested post">
              <p className="ai-suggestion__label">A polished version</p>
              <p className="ai-suggestion__text">{polish.text}</p>
              {polish.hashtags.length > 0 && <p className="ai-suggestion__topics">{polish.hashtags.map((h) => `#${h}`).join(" ")}</p>}
              <div className="ai-suggestion__actions">
                <button
                  type="button"
                  className="button button--primary wf-small"
                  onClick={() => {
                    const tags = polish.hashtags.map((h) => `#${h}`).join(" ");
                    setReplace((r) => ({ key: (r?.key ?? 0) + 1, text: tags ? `${polish.text}\n\n${tags}` : polish.text }));
                    setPolish(null);
                  }}
                >
                  Use this
                </button>
                <button type="button" className="button button--secondary wf-small" onClick={() => setPolish(null)}>
                  Keep mine
                </button>
              </div>
              <p className="ai-note">Written by AI from your words. Check it before you post.</p>
            </section>
          )}
        </div>
      )}
      <fieldset className="composer__tags">
        <legend>Add a tag (optional)</legend>
        {SUGGESTED_TAGS.map(([tag, label]) => (
          <label key={tag} className="composer__tag">
            <input type="checkbox" name="tag" value={tag} />#{label.toLowerCase()}
          </label>
        ))}
      </fieldset>
      {uploads.length > 0 && (
        <ul className={`composer__media composer__media--${Math.min(uploads.length, 4)} ${uploads.length > 4 ? "composer__media--many" : ""}`}>
          {uploads.map((u) => (
            <li key={u.key} className={u.error ? "composer__media--failed" : u.id ? "" : "composer__media--loading"}>
              {u.kind === "video" ? <video src={u.preview} muted playsInline /> : <img src={u.preview} alt="" />}
              {u.error && <span className="composer__media-error">{u.error}</span>}
              {u.id && <input type="hidden" name="media" value={u.id} />}
              <button
                type="button"
                className="composer__remove"
                aria-label="Remove photo or video"
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
        <button type="button" className="composer__tool" onClick={() => files.current?.click()} disabled={uploads.length >= MEDIA_LIMIT} aria-label="Add photos or videos">
          <Icon name="photo" size={22} className="icon--gold" />
        </button>
        <input ref={files} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" multiple hidden onChange={(e) => add(e.target.files)} />
        <button type="button" className="composer__tool composer__tag-people" onClick={() => setTagging(true)} aria-haspopup="dialog" aria-label="Tag people">
          <Icon name="tag-people" size={22} className="icon--blue" />
          <span>Tag people</span>
        </button>
        <span className={`composer__hint ${uploads.length ? "" : "composer__hint--long"}`}>{uploads.length ? `${uploads.length} of ${MEDIA_LIMIT}` : `Up to ${MEDIA_LIMIT} photos or videos`}</span>
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
      <Sheet open={tagging} onClose={() => setTagging(false)} title="Tag people" className="sheet--tag">
        <p className="sheet__note">We add their names to your post. Each person gets a notification if they can see the post.</p>
        <PeoplePicker chosen={tagged.map((p) => p.id)} onChange={setTagged} max={TAG_LIMIT} label="Tag" />
        <div className="sheet__foot">
          <button type="button" className="composer__cancel" onClick={() => setTagging(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="button button--primary"
            disabled={tagged.length === 0}
            onClick={() => {
              setInsert((i) => ({ key: (i?.key ?? 0) + 1, people: tagged }));
              setTagged([]);
              setTagging(false);
            }}
          >
            {tagged.length > 1 ? `Tag ${tagged.length} people` : "Tag"}
          </button>
        </div>
      </Sheet>
    </form>
  );
}
