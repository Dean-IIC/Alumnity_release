"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import type { ActionState } from "../../lib/action-state";
import { repostAction, repostNow } from "../../lib/actions/content";
import { Icon } from "./icons";
import { MentionInput } from "./mention-input";
import { Sheet } from "./sheet";

type Props = {
  postId: number;
  /** The original, in short, shown under "Repost with your thoughts". */
  preview: { author: string; text: string };
  /** Who the original is for: a plain repost goes to the same people. */
  audience: string;
  hasBatch: boolean;
  /** Says how it went, in the bar under the post. */
  onDone: (message: string, ok: boolean) => void;
};

const AUDIENCES = [
  { value: "everyone", label: "Everyone" },
  { value: "batch", label: "Your batch" },
  { value: "connections", label: "Connections" }
] as const;

/**
 * Repost, as on LinkedIn: a small menu with "Repost" (at once, no words: it goes to the
 * same people as the original) and "Repost with your thoughts" (your words above it, for
 * whom you choose). Either way the original keeps its own audience inside the repost.
 */
export function RepostMenu({ postId, preview, audience, hasBatch, onDone }: Props) {
  const [menu, setMenu] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [pending, startTransition] = useTransition();
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [who, setWho] = useState(audience === "batch" && !hasBatch ? "connections" : AUDIENCES.some((a) => a.value === audience) ? audience : "everyone");
  const [state, run, posting] = useActionState(async (prev: ActionState, form: FormData) => {
    const answer = await repostAction(prev, form);
    if (answer?.ok) {
      setQuoting(false);
      onDone("Reposted with your thoughts.", true);
    }
    return answer;
  }, null);

  // The menu closes on a tap elsewhere or Escape (focus back on Repost); its first item takes focus.
  useEffect(() => {
    if (!menu) return;
    list.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const away = (e: Event) => wrap.current && !wrap.current.contains(e.target as Node) && setMenu(false);
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenu(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  const now = () => {
    setMenu(false);
    button.current?.focus();
    startTransition(async () => {
      const answer = await repostNow(postId);
      onDone(answer?.ok ? "Reposted. Everyone who can see the original post will see it in their feed." : (answer?.error ?? "That didn't work. Try again."), Boolean(answer?.ok));
    });
  };

  return (
    <div className="post__repost" ref={wrap}>
      <button ref={button} type="button" className="post__action" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)} disabled={pending}>
        <Icon name="repost" size={21} />
        <span>{pending ? "Reposting…" : "Repost"}</span>
      </button>
      {menu && (
        <div
          className="repost-menu"
          role="menu"
          aria-label="Repost"
          ref={list}
          onKeyDown={(e) => {
            if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
            e.preventDefault();
            const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
            const at = items.indexOf(document.activeElement as HTMLButtonElement);
            items[(at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
          }}
        >
          <button
            type="button"
            role="menuitem"
            className="repost-menu__item"
            onClick={() => {
              setMenu(false);
              setQuoting(true);
            }}
          >
            <Icon name="pen" size={20} />
            <span>
              <strong>Repost with your thoughts</strong>
              <small>Add your own words above it</small>
            </span>
          </button>
          <button type="button" role="menuitem" className="repost-menu__item" onClick={now}>
            <Icon name="repost" size={20} />
            <span>
              <strong>Repost</strong>
              <small>Share it now, without adding your own words</small>
            </span>
          </button>
        </div>
      )}
      <Sheet open={quoting} onClose={() => setQuoting(false)} title="Repost with your thoughts" className="sheet--repost">
        <form action={run} className="repost-form" aria-busy={posting}>
          <input type="hidden" name="id" value={postId} />
          <MentionInput id={`repost-${postId}-text`} name="body" label="Your thoughts" rows={3} maxLength={2000} placeholder="What do you think? Type @ to mention someone." autoFocus className="repost-form__text" />
          <blockquote className="repost-form__preview">
            <strong>{preview.author}</strong>
            {preview.text && <span>{preview.text}</span>}
          </blockquote>
          <fieldset className="repost-form__who">
            <legend>Who can see your repost</legend>
            {AUDIENCES.filter((a) => a.value !== "batch" || hasBatch).map((a) => (
              <label key={a.value} className={`composer__who ${who === a.value ? "composer__who--on" : ""}`}>
                <input type="radio" name="audience" value={a.value} checked={who === a.value} onChange={() => setWho(a.value)} />
                <Icon name={a.value} size={16} />
                {a.label}
              </label>
            ))}
          </fieldset>
          {state?.error && (
            <p className="wf-note wf-note--error" role="alert">
              {state.error}
            </p>
          )}
          <div className="sheet__foot">
            <button type="button" className="composer__cancel" onClick={() => setQuoting(false)}>
              Cancel
            </button>
            <button type="submit" className="button button--primary" disabled={posting}>
              {posting ? "Reposting…" : "Repost"}
            </button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
