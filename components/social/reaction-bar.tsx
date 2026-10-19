"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { reactNow } from "../../lib/actions/content";
import type { Reaction } from "../../lib/server/posts";
import { Icon } from "./icons";
import { REACTION_LABEL, Stamp } from "./stamps";

const KINDS: Reaction[] = ["cheer", "proud", "congrats", "insightful", "support"];

type Props = { postId: number; mine: Reaction | null; counts: Partial<Record<Reaction, number>>; commentCount: number; commentsHref: string; shareUrl: string };

/**
 * Under a post: who reacted (the stamps used most, and how many), then React · Comment ·
 * Share. A tap is a quick Cheer; holding it (or hovering, or the small arrow) offers all
 * five stamps. The bar changes at once and asks the server to agree; if it doesn't, it
 * goes back and says why.
 */
export function ReactionBar({ postId, mine: initialMine, counts: initialCounts, commentCount, commentsHref, shareUrl }: Props) {
  const [mine, setMine] = useState<Reaction | null>(initialMine);
  const [counts, setCounts] = useState(initialCounts);
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [, startTransition] = useTransition();
  const hold = useRef<number>(0);
  const held = useRef(false);
  const wrap = useRef<HTMLDivElement>(null);
  const arrow = useRef<HTMLButtonElement>(null);
  const picker = useRef<HTMLDivElement>(null);
  /** Opened from the keyboard: then the first stamp takes focus, and Escape gives it back. */
  const byKeyboard = useRef(false);

  // Close the picker on a tap elsewhere or Escape.
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => wrap.current && !wrap.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      if (byKeyboard.current) arrow.current?.focus();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  // From the keyboard, the picker's first stamp (or yours) takes focus.
  useEffect(() => {
    if (!open || !byKeyboard.current) return;
    const items = [...(picker.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    (items.find((b) => b.getAttribute("aria-checked") === "true") ?? items[0])?.focus();
  }, [open]);

  const choose = (kind: Reaction) => {
    setOpen(false);
    if (byKeyboard.current) arrow.current?.focus();
    const before = { mine, counts };
    const next = { ...counts };
    if (mine) next[mine] = Math.max(0, (next[mine] ?? 1) - 1);
    const nextMine = mine === kind ? null : kind;
    if (nextMine) next[nextMine] = (next[nextMine] ?? 0) + 1;
    setMine(nextMine);
    setCounts(next);
    setProblem(null);
    startTransition(async () => {
      const answer = await reactNow(postId, kind);
      if (!answer?.ok) {
        setMine(before.mine);
        setCounts(before.counts);
        setProblem(answer?.error ?? "That didn't work. Try again.");
      }
    });
  };

  const total = Object.values(counts).reduce((a, n) => a + (n ?? 0), 0);
  const top = KINDS.filter((k) => (counts[k] ?? 0) > 0)
    .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0))
    .slice(0, 3);

  const share = async () => {
    const url = new URL(shareUrl, window.location.origin).toString();
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(url).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="post__social" ref={wrap}>
      {(total > 0 || commentCount > 0) && (
        <div className="post__tally">
          {total > 0 && (
            <span className="post__stamps" title={top.map((k) => `${REACTION_LABEL[k]} ${counts[k]}`).join(" · ")}>
              {top.map((k) => (
                <Stamp key={k} kind={k} size={24} className="post__stamp" />
              ))}
              <span>{total}</span>
            </span>
          )}
          {commentCount > 0 && (
            <a className="post__tally-link" href={commentsHref}>
              {commentCount} comment{commentCount === 1 ? "" : "s"}
            </a>
          )}
        </div>
      )}
      <div className="post__actions">
        <div className="post__react">
          <button
            type="button"
            className={`post__action ${mine ? `post__action--on post__action--${mine}` : ""}`}
            aria-pressed={Boolean(mine)}
            onPointerDown={(e) => {
              held.current = false;
              if (e.pointerType === "mouse") return;
              hold.current = window.setTimeout(() => {
                held.current = true;
                setOpen(true);
              }, 420);
            }}
            onPointerUp={() => window.clearTimeout(hold.current)}
            onPointerLeave={() => window.clearTimeout(hold.current)}
            onMouseEnter={() => {
              hold.current = window.setTimeout(() => {
                byKeyboard.current = false;
                setOpen(true);
              }, 550);
            }}
            onContextMenu={(e) => e.preventDefault()}
            onClick={() => {
              window.clearTimeout(hold.current);
              if (held.current) return;
              choose(mine ?? "cheer");
            }}
          >
            {mine ? <Stamp kind={mine} size={26} /> : <Stamp kind="cheer" size={26} className="stamp--blank" />}
            <span>{mine ? REACTION_LABEL[mine] : "Cheer"}</span>
          </button>
          <button
            ref={arrow}
            type="button"
            className="post__more-reactions"
            aria-label="All reactions"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={(e) => {
              // A click with no pointer position came from the keyboard (Enter or Space).
              byKeyboard.current = e.detail === 0;
              setOpen((o) => !o);
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {open && (
            <div
              className="reaction-picker"
              role="menu"
              aria-label="React with"
              ref={picker}
              onKeyDown={(e) => {
                if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
                e.preventDefault();
                const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
                const at = items.indexOf(document.activeElement as HTMLButtonElement);
                const next = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (at + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
                items[next]?.focus();
              }}
            >
              {KINDS.map((k, i) => (
                <button key={k} type="button" role="menuitemradio" aria-checked={mine === k} className="reaction-picker__item" style={{ animationDelay: `${i * 35}ms` }} onClick={() => choose(k)}>
                  <Stamp kind={k} size={40} />
                  <span>{REACTION_LABEL[k]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <a className="post__action" href={commentsHref}>
          <Icon name="comment" size={21} />
          <span>Comment</span>
        </a>
        <button type="button" className="post__action" onClick={share}>
          <Icon name="share" size={21} />
          <span>{copied ? "Link copied" : "Share"}</span>
        </button>
      </div>
      {problem && (
        <p className="wf-note wf-note--error" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}
