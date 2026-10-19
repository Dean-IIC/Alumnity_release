"use client";

import Link from "next/link";
import { Fragment, useEffect, useLayoutEffect, useOptimistic, useRef, useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import { sendMessageNow } from "../../lib/actions/messages";
import { mediaUrl } from "../../lib/media-url";
import type { StoryRef } from "../../lib/server/social";
import { PulseNow } from "../app/pulse";
import { ReportButton } from "../app/report-button";
import { Avatar } from "../social/avatar";

/*
 * One conversation, as a chat app draws it: their messages on the left in grey, yours on
 * the right in navy; a run of messages from one person in a few minutes kept together;
 * a line between days; "Seen" under your last message once they've read it; the newest
 * always in view; and the box to write in fixed at the bottom (Enter sends on a keyboard,
 * Shift+Enter starts a new line).
 */

export type ChatPerson = { id: number; name: string; first: string; photoId: string | null; detail: string };
export type ChatMessage = {
  id: number;
  mine: boolean;
  body: string;
  at: number;
  /** "Today", "Yesterday", "12 Oct 2026": worked out on the server, in India time. */
  day: string;
  /** "4:05 pm". */
  time: string;
  readAt: number | null;
  story: StoryRef | null;
  /** Shown at once while it's on its way. */
  sending?: boolean;
};

/** Messages from one person this close together share a group (one face, one time). */
const GROUP_GAP = 10 * 60_000;

/** A message of just an emoji or three is drawn large, without a bubble (as chat apps do). */
const onlyEmoji = (body: string) => {
  const s = body.replace(/\s/g, "");
  return s.length > 0 && s.length <= 16 && /\p{Extended_Pictographic}/u.test(s) && /^[\p{Extended_Pictographic}\p{Emoji_Component}]+$/u.test(s);
};

/** Links in a message: Alumnity's own pages (a referral request ends with its post's address), and web addresses. */
const LINKS = /(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]]|\/(?:notes|ask|events|groups|people|causes|board)\/\d+)/g;

function Linked({ text }: { text: string }) {
  const parts = text.split(LINKS);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 0 ? (
          <Fragment key={i}>{p}</Fragment>
        ) : p.startsWith("/notes/") ? (
          <Link key={i} className="message-post-link" href={p}>
            Open the post <span aria-hidden="true">→</span>
          </Link>
        ) : p.startsWith("/") ? (
          <Link key={i} href={p}>
            {p}
          </Link>
        ) : (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow">
            {p}
          </a>
        )
      )}
    </>
  );
}

/** A story reply's picture of the story, or a note that it's gone. */
function StoryCard({ m }: { m: ChatMessage }) {
  const s = m.story!;
  const label = s.reaction ? (m.mine ? "You reacted to their story" : "Reacted to your story") : m.mine ? "You replied to their story" : "Replied to your story";
  return (
    <div className="dm-story">
      <span className="dm-story__label">{label}</span>
      {s.mediaId ? (
        s.kind === "video" ? (
          <video className="dm-story__thumb" src={mediaUrl(s.mediaId)} muted playsInline preload="metadata" aria-label="Their story" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="dm-story__thumb" src={mediaUrl(s.mediaId, 120)} alt="The story" loading="lazy" />
        )
      ) : (
        <span className="dm-story__gone">Story no longer available</span>
      )}
    </div>
  );
}

export function ThreadView({
  other,
  messages,
  canWrite,
  closed
}: {
  other: ChatPerson;
  messages: ChatMessage[];
  /** Connected, and messages aren't paused. */
  canWrite: boolean;
  /** Why not, when they can't write (paused, or not connected). */
  closed?: ReactNode;
}) {
  const [shown, addSending] = useOptimistic(messages, (list: ChatMessage[], m: ChatMessage) => [...list, m]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const scroller = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const nearBottom = useRef(true);
  const latest = messages.at(-1)?.id ?? 0;

  // The newest in view: at once when the conversation opens, and as messages arrive (if
  // you were already at the bottom, or it's yours), without yanking you from older ones.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [other.id]);
  useEffect(() => {
    const el = scroller.current;
    if (el && (nearBottom.current || shown.at(-1)?.mine)) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [shown.length, shown]);

  // The box grows with what's written, up to a few lines.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  const send = () => {
    const body = text.trim();
    if (!body || !canWrite) return;
    setError(null);
    setText("");
    start(async () => {
      addSending({ id: -Date.now(), mine: true, body, at: Date.now(), day: "Today", time: "Sending…", readAt: null, story: null, sending: true });
      try {
        const result = await sendMessageNow(other.id, body);
        if (!result?.ok) {
          // Not sent: say why, and put the words back to try again.
          setError(result?.error ?? "That didn't send. Try again.");
          setText((now) => now || body);
        }
      } catch {
        setError("That didn't send: check your connection and try again.");
        setText((now) => now || body);
      }
    });
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    // On a phone's keyboard Enter is a new line (there's no Shift to hand); the button sends.
    if (window.matchMedia("(pointer: coarse)").matches) return;
    e.preventDefault();
    send();
  };

  // Which of yours was read last, for "Seen" under the newest message, if it's yours.
  const last = shown.at(-1);
  const rows: ReactNode[] = [];
  shown.forEach((m, i) => {
    const prev = shown[i - 1];
    const next = shown[i + 1];
    const newDay = !prev || prev.day !== m.day;
    const joinsPrev = !newDay && prev && prev.mine === m.mine && m.at - prev.at < GROUP_GAP && !m.story;
    const joinsNext = next && next.day === m.day && next.mine === m.mine && next.at - m.at < GROUP_GAP && !next.story;
    if (newDay) {
      rows.push(
        <li key={`day-${m.day}-${m.id}`} className="dm-day" role="separator">
          <span>{m.day}</span>
        </li>
      );
    }
    const big = Boolean(m.story?.reaction) || onlyEmoji(m.body);
    rows.push(
      <li
        key={m.id}
        className={`dm-msg ${m.mine ? "dm-msg--mine" : "dm-msg--theirs"} ${joinsPrev ? "" : "dm-msg--first"} ${joinsNext ? "" : "dm-msg--last"} ${m.sending ? "dm-msg--sending" : ""}`}
      >
        {!m.mine && <span className="dm-msg__face">{!joinsNext && <Avatar name={other.name} photoId={other.photoId} size={28} />}</span>}
        <div className="dm-msg__body">
          {m.story && <StoryCard m={m} />}
          <div className={`dm-bubble ${big ? "dm-bubble--emoji" : ""}`} tabIndex={m.mine ? undefined : 0} title={`${m.day}, ${m.time}`}>
            <span className="sr-only">{m.mine ? "You: " : `${other.first}: `}</span>
            <Linked text={m.body} />
          </div>
          {!joinsNext && (
            <span className="dm-msg__meta">
              {m === last && m.mine && !m.sending ? (m.readAt ? "Seen" : `Sent · ${m.time}`) : m.time}
              {!m.mine && m.id > 0 && (
                <span className="dm-msg__tools">
                  {" · "}
                  <ReportButton kind="message" id={m.id} back={`/messages/${other.id}`} />
                </span>
              )}
            </span>
          )}
          {!m.mine && joinsNext && m.id > 0 && (
            <span className="dm-msg__meta dm-msg__meta--tools">
              <span className="dm-msg__tools">
                <ReportButton kind="message" id={m.id} back={`/messages/${other.id}`} />
              </span>
            </span>
          )}
        </div>
      </li>
    );
  });

  return (
    <section className="dm-pane dm-thread" aria-label={`Conversation with ${other.name}`}>
      <header className="dm-thread__head">
        <Link href="/messages" className="dm-thread__back dm-icon-button" aria-label="All messages">
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <Link href={`/people/${other.id}`} className="dm-thread__who">
          <Avatar name={other.name} photoId={other.photoId} size={44} />
          <span>
            <h2 className="dm-thread__name">{other.name}</h2>
            {other.detail && <span className="dm-thread__detail">{other.detail}</span>}
          </span>
        </Link>
        <Link href={`/people/${other.id}`} className="pill-button dm-thread__profile">
          View profile
        </Link>
      </header>

      <div
        className="dm-thread__scroll"
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
      >
        <div className="dm-thread__intro">
          <Avatar name={other.name} photoId={other.photoId} size={72} />
          <strong>{other.name}</strong>
          {other.detail && <span>{other.detail}</span>}
          <Link href={`/people/${other.id}`} className="pill-button">
            View profile
          </Link>
        </div>
        {shown.length === 0 ? (
          <p className="dm-thread__hello">No messages yet. Say hello to {other.first}.</p>
        ) : (
          <ol className="dm-thread__list" aria-live="polite" aria-relevant="additions">
            {rows}
          </ol>
        )}
      </div>

      {canWrite ? (
        <form
          className="dm-composer"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          {error && (
            <p className="dm-composer__error" role="alert">
              {error}
            </p>
          )}
          <div className="dm-composer__row">
            <label className="sr-only" htmlFor="message-body">
              Message to {other.first}
            </label>
            <textarea
              id="message-body"
              ref={box}
              name="body"
              rows={1}
              maxLength={2000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKey}
              placeholder="Message…"
              enterKeyHint="send"
              autoComplete="off"
            />
            <button className="dm-composer__send" type="submit" disabled={!text.trim()} aria-label={`Send to ${other.first}`}>
              Send
            </button>
          </div>
        </form>
      ) : (
        <div className="dm-composer dm-composer--closed">{closed}</div>
      )}
      <PulseNow on={latest} />
    </section>
  );
}
