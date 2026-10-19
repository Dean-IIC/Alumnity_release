"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Sheet } from "./sheet";

type Props = {
  open: boolean;
  onClose: () => void;
  /** The post's own page (/notes/12); made absolute here. */
  path: string;
  /** Who wrote it, for the line that goes with the link. Never the post's words: they stay on Alumnity. */
  author: string;
  /** Whether the post is for everyone: only then is it offered to other apps. */
  forEveryone: boolean;
};

/** Each app's mark: a round badge in its colour, as on a phone's share sheet. */
const MARK: Record<string, ReactNode> = {
  whatsapp: (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#25d366" />
      <path fill="#fff" d="M16 7.2a8.7 8.7 0 0 0-7.5 13.2L7.3 24.8l4.5-1.2A8.7 8.7 0 1 0 16 7.2zm0 15.9a7.2 7.2 0 0 1-3.7-1l-.3-.2-2.6.7.7-2.6-.2-.3A7.2 7.2 0 1 1 16 23.1z" />
      <path fill="#fff" d="M19.9 17.7c-.2-.1-1.3-.6-1.5-.7-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a5.9 5.9 0 0 1-2.9-2.6c-.2-.4.2-.4.6-1.2.1-.1 0-.3 0-.4l-.7-1.6c-.2-.4-.4-.4-.5-.4h-.4a.8.8 0 0 0-.6.3 2.5 2.5 0 0 0-.8 1.9 4.4 4.4 0 0 0 .9 2.3 10 10 0 0 0 3.8 3.4c1.4.6 2 .7 2.7.6a2.3 2.3 0 0 0 1.5-1.1 1.9 1.9 0 0 0 .1-1.1c0-.2-.2-.2-.4-.3z" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#0a66c2" />
      <path fill="#fff" d="M10.2 13.2h2.6v8.6h-2.6zM11.5 9.1a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM14.5 13.2H17v1.2a2.8 2.8 0 0 1 2.5-1.4c2.6 0 3.1 1.7 3.1 4v4.8H20v-4.2c0-1 0-2.3-1.4-2.3s-1.6 1.1-1.6 2.2v4.3h-2.5z" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#0f1419" />
      <path fill="#fff" d="M17.3 15 22.4 9h-1.2l-4.4 5.2L13.3 9H9.2l5.4 7.8L9.2 23h1.2l4.7-5.4 3.8 5.4H23zm-1.7 1.9-.5-.8-4.4-6.2h1.9l3.5 5 .5.8 4.6 6.5h-1.9z" />
    </svg>
  ),
  telegram: (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#229ed9" />
      <path fill="#fff" d="m8.1 15.6 13.6-5.3c.6-.2 1.2.2 1 1.1l-2.3 10.9c-.2.8-.6 1-1.3.6l-3.5-2.6-1.7 1.6c-.2.2-.3.3-.7.3l.2-3.6 6.5-5.9c.3-.3-.1-.4-.4-.2l-8 5-3.5-1.1c-.7-.2-.8-.7.1-1z" />
    </svg>
  ),
  email: (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#5b6576" />
      <rect x="8.5" y="10.5" width="15" height="11" rx="1.6" fill="none" stroke="#fff" strokeWidth="1.7" />
      <path d="m9 11.5 7 5.4 7-5.4" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  ),
  copy: (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#123e7c" />
      <path d="M14.6 17.4a3.2 3.2 0 0 0 4.5 0l2.6-2.6a3.2 3.2 0 0 0-4.5-4.5l-.9.9M17.4 14.6a3.2 3.2 0 0 0-4.5 0l-2.6 2.6a3.2 3.2 0 0 0 4.5 4.5l.9-.9" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  more: (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#e1e6ee" />
      <circle cx="10.5" cy="16" r="1.7" fill="#172033" />
      <circle cx="16" cy="16" r="1.7" fill="#172033" />
      <circle cx="21.5" cy="16" r="1.7" fill="#172033" />
    </svg>
  )
};

/**
 * Share: a post to WhatsApp, LinkedIn, X, Telegram or email, its link copied, or the
 * phone's own share menu where there is one. Only a post for everyone goes to other apps;
 * one for a batch, connections or a group offers its link alone (it opens only for those
 * who can already see it), and Send for passing it on privately.
 */
export function ShareSheet({ open, onClose, path, author, forEveryone }: Props) {
  const [url, setUrl] = useState(path);
  const [copied, setCopied] = useState(false);
  const [native, setNative] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const fieldId = useId();

  useEffect(() => {
    if (!open) return;
    setUrl(new URL(path, window.location.origin).toString());
    setNative(typeof navigator.share === "function");
    setCopied(false);
  }, [open, path]);

  const line = `${author}'s post on Alumnity, HKBK's alumni network`;
  const e = encodeURIComponent;
  const apps = [
    { key: "whatsapp", name: "WhatsApp", href: `https://wa.me/?text=${e(`${line}: ${url}`)}` },
    { key: "linkedin", name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${e(url)}` },
    { key: "x", name: "X", href: `https://x.com/intent/tweet?text=${e(line)}&url=${e(url)}` },
    { key: "telegram", name: "Telegram", href: `https://t.me/share/url?url=${e(url)}&text=${e(line)}` },
    { key: "email", name: "Email", href: `mailto:?subject=${e(line)}&body=${e(`${line}:\n${url}`)}` }
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // No clipboard (an older browser, or not allowed): select the link for copying by hand.
      field.current?.select();
    }
  };

  const more = async () => {
    try {
      await navigator.share({ title: line, url });
      onClose();
    } catch {
      // Cancelled: the sheet stays open.
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Share this post" className="sheet--share" focusField={false}>
      {forEveryone ? (
        <ul className="share-apps">
          {apps.map((a) => (
            <li key={a.key}>
              <a className="share-app" href={a.href} target={a.key === "email" ? undefined : "_blank"} rel="noopener noreferrer" onClick={() => onClose()}>
                <span className="share-app__mark">{MARK[a.key]}</span>
                <span>{a.name}</span>
              </a>
            </li>
          ))}
          <li>
            <button type="button" className="share-app" onClick={copy}>
              <span className="share-app__mark">{MARK.copy}</span>
              <span>{copied ? "Copied" : "Copy link"}</span>
            </button>
          </li>
          {native && (
            <li>
              <button type="button" className="share-app" onClick={more}>
                <span className="share-app__mark">{MARK.more}</span>
                <span>More…</span>
              </button>
            </li>
          )}
        </ul>
      ) : (
        <>
          <p className="sheet__note">Only some people can see this post. You can&apos;t share it to other apps.</p>
          <p className="sheet__note">The link works only for them. To send it to a connection, use Send.</p>
        </>
      )}
      <div className="share-link">
        <label className="sr-only" htmlFor={fieldId}>
          Link to this post
        </label>
        <input ref={field} id={fieldId} value={url} readOnly onFocus={(ev) => ev.currentTarget.select()} />
        <button type="button" className="button button--secondary wf-small" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="sr-only" role="status">
        {copied ? "Link copied" : ""}
      </p>
    </Sheet>
  );
}
