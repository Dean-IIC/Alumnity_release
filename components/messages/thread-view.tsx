"use client";

import Link from "next/link";
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type ReactNode,
  type TouchEvent
} from "react";
import { sendMessageNow } from "../../lib/actions/messages";
import { mediaUrl } from "../../lib/media-url";
import type { StoryRef } from "../../lib/server/social";
import { PulseNow } from "../app/pulse";
import { ReportButton } from "../app/report-button";
import { Avatar } from "../social/avatar";
import { Icon } from "../social/icons";
import { MessageActions, type Acting } from "./message-actions";

/*
 * One conversation, as a chat app draws it: their messages on the left in grey, yours on
 * the right in navy; a run of messages from one person in a few minutes kept together;
 * a line between days; "Seen" under your last message once they've read it; the newest
 * always in view; and the box to write in fixed at the bottom (Enter sends on a keyboard,
 * Shift+Enter starts a new line). A long press on a message (or its ⋯ button) offers
 * copy, edit, and delete for everyone or for you; the header's ⋯ deletes the chat.
 */

/** How long a finger rests on a message before its menu opens (as WhatsApp's long press). */
const LONG_PRESS = 450;

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
  /** Its sender changed it after sending ("edited", for both). */
  edited?: boolean;
  /** Deleted for everyone: "This message was deleted", for both. */
  deleted?: boolean;
  /** Yours: until when it can still be edited (null: it can't be). */
  editableUntil?: number | null;
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
        <span className="dm-story__gone">This story is gone</span>
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
  const [acting, setActing] = useState<Acting | null>(null);
  const press = useRef<{ timer: number; x: number; y: number } | null>(null);

  // A message's choices: from its ⋯ button, or a long press on it (a phone has no hover).
  const optionsFor = (m: ChatMessage) =>
    setActing({ kind: "message", message: { id: m.id, mine: m.mine, body: m.body, deleted: Boolean(m.deleted), editableUntil: m.editableUntil ?? null } });
  const pressEnd = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };
  const pressStart = (m: ChatMessage, e: TouchEvent) => {
    pressEnd();
    const t = e.touches[0];
    if (m.id <= 0 || e.touches.length !== 1 || !t) return;
    const timer = window.setTimeout(() => {
      press.current = null;
      navigator.vibrate?.(8);
      optionsFor(m);
    }, LONG_PRESS);
    press.current = { timer, x: t.clientX, y: t.clientY };
  };
  // Scrolling isn't pressing: a finger that moves lets go.
  const pressMove = (e: TouchEvent) => {
    const p = press.current;
    const t = e.touches[0];
    if (p && t && Math.hypot(t.clientX - p.x, t.clientY - p.y) > 10) pressEnd();
  };
  useEffect(() => pressEnd, []);

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
          setError(result?.error ?? "Your message wasn't sent. Try again.");
          setText((now) => now || body);
        }
      } catch {
        setError("Your message wasn't sent. Check your internet connection and try again.");
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
    const big = !m.deleted && (Boolean(m.story?.reaction) || onlyEmoji(m.body));
    rows.push(
      <li
        key={m.id}
        className={`dm-msg ${m.mine ? "dm-msg--mine" : "dm-msg--theirs"} ${joinsPrev ? "" : "dm-msg--first"} ${joinsNext ? "" : "dm-msg--last"} ${m.sending ? "dm-msg--sending" : ""}`}
      >
        {!m.mine && <span className="dm-msg__face">{!joinsNext && <Avatar name={other.name} photoId={other.photoId} size={28} />}</span>}
        <div className="dm-msg__body">
          {m.story && <StoryCard m={m} />}
          <div
            className={`dm-bubble ${big ? "dm-bubble--emoji" : ""} ${m.deleted ? "dm-bubble--deleted" : ""}`}
            tabIndex={m.mine ? undefined : 0}
            title={`${m.day}, ${m.time}`}
            onTouchStart={(e) => pressStart(m, e)}
            onTouchMove={pressMove}
            onTouchEnd={pressEnd}
            onTouchCancel={pressEnd}
            // The long press opens our menu; the phone's own (select, copy) would cover it.
            onContextMenu={(e) => window.matchMedia("(hover: none)").matches && m.id > 0 && e.preventDefault()}
          >
            <span className="sr-only">{m.mine ? "You: " : `${other.first}: `}</span>
            {m.deleted ? "This message was deleted" : <Linked text={m.body} />}
            {m.edited && !m.deleted && <span className="dm-bubble__edited">edited</span>}
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
        {m.id > 0 && (
          <button
            type="button"
            className="dm-msg__more"
            aria-label={m.mine ? "Options for your message" : `Options for ${other.first}'s message`}
            aria-haspopup="dialog"
            onClick={() => optionsFor(m)}
          >
            <Icon name="more" size={18} />
          </button>
        )}
      </li>
    );
  });

  return (
    <section className="dm-pane dm-thread" aria-label={`Conversation with ${other.name}`}>
      <header className="dm-thread__head">
        <Link href="/messages" className="dm-thread__back dm-icon-button" aria-label="Back to all messages">
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
          See their page
        </Link>
        {shown.some((m) => m.id > 0) && (
          <button type="button" className="dm-icon-button dm-thread__more" aria-label="Chat options" aria-haspopup="dialog" title="Chat options" onClick={() => setActing({ kind: "chat" })}>
            <Icon name="more" size={22} />
          </button>
        )}
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
            See their page
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
      <MessageActions acting={acting} other={other} onClose={() => setActing(null)} />
    </section>
  );
}
