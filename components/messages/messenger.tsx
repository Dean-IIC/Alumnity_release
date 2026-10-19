"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Contact, InboxItem } from "../../lib/server/inbox";
import { Avatar } from "../social/avatar";
import { Icon } from "../social/icons";
import "../../app/styles/messages-plus.css";

/*
 * Messages, laid out as Instagram's: on a laptop, the conversations down the left and the
 * open one on the right; on a phone, the list, then the conversation full screen. A search
 * over the conversations (and your connections), and "New message" to start one with any
 * connection.
 */

/** For matching: lower case, accents dropped ("José" finds "jose"). */
const norm = (s: string) => s.toLocaleLowerCase("en-IN").normalize("NFKD").replace(/\p{M}/gu, "");

export function Messenger({
  conversations,
  contacts,
  active,
  empty,
  children
}: {
  conversations: InboxItem[];
  contacts: Contact[];
  /** The member whose conversation is open, if one is. */
  active?: number;
  /** Shown in the list when there are no conversations yet (people to write to). */
  empty?: ReactNode;
  /** The open conversation (its pane); none on the list page. */
  children?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState(false);
  const q = norm(query.trim());

  const shown = useMemo(() => (q ? conversations.filter((c) => norm(c.name).includes(q) || norm(c.preview).includes(q)) : conversations), [q, conversations]);
  // Searching also finds connections you haven't written to yet, as Instagram's search does.
  const others = useMemo(() => {
    if (!q) return [];
    const talking = new Set(conversations.map((c) => c.id));
    return contacts.filter((c) => !talking.has(c.id) && norm(c.name).includes(q)).slice(0, 8);
  }, [q, conversations, contacts]);

  return (
    <div className={`dm ${active ? "dm--open" : ""}`}>
      <aside className="dm-list" aria-label="Conversations">
        <header className="dm-list__head">
          <h1 className="dm-list__title">Messages</h1>
          <button type="button" className="dm-icon-button" onClick={() => setPicking(true)} aria-label="New message" title="New message">
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V12" />
              <path d="M17.6 3.9a1.9 1.9 0 0 1 2.7 2.7L12.6 14.3 9 15l.7-3.6z" />
            </svg>
          </button>
        </header>
        <div className="dm-search" role="search">
          <Icon name="search" size={18} />
          <label className="sr-only" htmlFor="dm-search">
            Search conversations
          </label>
          <input id="dm-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" autoComplete="off" maxLength={80} />
        </div>

        {conversations.length === 0 ? (
          <div className="dm-list__empty">
            <p>No messages yet.</p>
            <button type="button" className="button button--primary wf-small" onClick={() => setPicking(true)}>
              New message
            </button>
            {empty}
          </div>
        ) : (
          <ul className="dm-list__items">
            {shown.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/messages/${c.id}`}
                  className={`dm-item ${c.unread ? "dm-item--unread" : ""}`}
                  aria-current={c.id === active ? "page" : undefined}
                  prefetch={false}
                >
                  <Avatar name={c.name} photoId={c.photoId} size={52} className="dm-item__face" />
                  <span className="dm-item__text">
                    <span className="dm-item__name">{c.name}</span>
                    <span className="dm-item__line">
                      <span className="dm-item__preview">{c.preview}</span>
                      <span className="dm-item__ago" aria-hidden="true">
                        · {c.ago}
                      </span>
                    </span>
                  </span>
                  {c.unread > 0 && (
                    <span className="dm-item__dot">
                      <span className="sr-only">{c.unread === 1 ? "1 unread message" : `${c.unread} unread messages`}</span>
                    </span>
                  )}
                </Link>
              </li>
            ))}
            {/* Messages are between connections: someone not found here may not be one yet, so
                the way on is to find them in Network and ask to connect. */}
            {q && shown.length === 0 && others.length === 0 && (
              <li className="dm-list__none">
                No chats or connections match “{query.trim()}”. You can only message connections.{" "}
                <Link href={`/people?q=${encodeURIComponent(query.trim())}`}>Find “{query.trim()}” in Network</Link> and ask to connect.
              </li>
            )}
          </ul>
        )}

        {others.length > 0 && (
          <>
            <h2 className="dm-list__sub">Connections</h2>
            <ul className="dm-list__items">
              {others.map((c) => (
                <li key={c.id}>
                  <Link href={`/messages/${c.id}`} className="dm-item" prefetch={false}>
                    <Avatar name={c.name} photoId={c.photoId} size={44} className="dm-item__face" />
                    <span className="dm-item__text">
                      <span className="dm-item__name">{c.name}</span>
                      <span className="dm-item__line">
                        <span className="dm-item__preview">{c.detail || "Connection"}</span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>

      {children ?? (
        <section className="dm-pane dm-pane--empty" aria-label="No conversation open">
          <div className="dm-welcome">
            <span className="dm-welcome__ring" aria-hidden="true">
              <Icon name="message" size={44} />
            </span>
            <h2>Your messages</h2>
            <p>Send a private message to a connection.</p>
            <p>Someone new? Connect with them first, or use Ask a senior.</p>
            <button type="button" className="button button--primary" onClick={() => setPicking(true)}>
              New message
            </button>
          </div>
        </section>
      )}

      {picking && <NewMessage contacts={contacts} onClose={() => setPicking(false)} />}
    </div>
  );
}

/** "New message": pick one of your connections (only connections can be written to). */
function NewMessage({ contacts, onClose }: { contacts: Contact[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const q = norm(query.trim());
  const shown = useMemo(() => (q ? contacts.filter((c) => norm(c.name).includes(q) || norm(c.detail).includes(q)) : contacts).slice(0, 100), [q, contacts]);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="dm-picker"
      aria-labelledby="dm-picker-title"
      onClose={onClose}
      onClick={(e) => {
        // A click on the dimmed backdrop (the dialog itself, outside its box) closes it.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dm-picker__box">
        <header className="dm-picker__head">
          <h2 id="dm-picker-title">New message</h2>
          <button type="button" className="dm-icon-button" onClick={onClose} aria-label="Close">
            <Icon name="close" size={22} />
          </button>
        </header>
        <div className="dm-search dm-picker__search">
          <span className="dm-picker__to">To:</span>
          <label className="sr-only" htmlFor="dm-picker-search">
            Search your connections
          </label>
          <input id="dm-picker-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your connections" autoComplete="off" autoFocus maxLength={80} />
        </div>
        {contacts.length === 0 ? (
          <>
            <p className="dm-picker__note">You can only message your connections. You don&rsquo;t have any yet.</p>
            <p className="dm-picker__note">
              <Link href="/people">Find people to connect with</Link>, or <Link href="/ask">ask a senior</Link>.
            </p>
          </>
        ) : (
          <ul className="dm-picker__list">
            {shown.map((c) => (
              <li key={c.id}>
                <Link href={`/messages/${c.id}`} className="dm-item" onClick={onClose} prefetch={false}>
                  <Avatar name={c.name} photoId={c.photoId} size={44} className="dm-item__face" />
                  <span className="dm-item__text">
                    <span className="dm-item__name">{c.name}</span>
                    {c.detail && (
                      <span className="dm-item__line">
                        <span className="dm-item__preview">{c.detail}</span>
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
            {shown.length === 0 && <li className="dm-list__none">No connection matches “{query.trim()}”.</li>}
          </ul>
        )}
        <p className="dm-picker__note dm-picker__note--quiet">Only connections can message each other on Alumnity.</p>
      </div>
    </dialog>
  );
}
