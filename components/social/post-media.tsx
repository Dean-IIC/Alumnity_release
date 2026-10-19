"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { mediaUrl } from "../../lib/media-url";
import type { PostMedia as Media } from "../../lib/server/posts";

type Props = {
  media: Media[];
  /** Who posted them, for each photo's description. */
  author: string;
  /** On the post's own page: a little sharper. */
  full?: boolean;
  /** Inside a repost's card: smaller. */
  compact?: boolean;
};

/** Tiles shown at most: one big and three small; the last says how many more there are. */
const SHOWN = 4;

/**
 * A post's photos and videos, laid out as WhatsApp and Facebook do: one fills the width;
 * two side by side; three as one big and two small; four or more as one big and three
 * small, the last darkened with "+N" when there are more than fit. Each opens a viewer
 * over the page: ← → or a swipe step through them, Esc closes and focus returns to the
 * tile. Each tile is a link to the full photo, so without JavaScript it still opens.
 */
export function PostMedia({ media, author, full = false, compact = false }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const [index, setIndex] = useState(0);
  // Only while open is anything drawn in the viewer, so closing it stops a playing video.
  const [isOpen, setIsOpen] = useState(false);
  const count = media.length;
  const tiles = media.slice(0, SHOWN);
  const hidden = count - tiles.length;
  const describe = (i: number) => `${media[i].kind === "video" ? "Video" : "Photo"} ${i + 1} of ${count} posted by ${author}`;

  const open = (event: MouseEvent<HTMLAnchorElement>, i: number) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey) return; // let new-tab clicks through
    event.preventDefault();
    opener.current = event.currentTarget;
    setIndex(i);
    setIsOpen(true);
    dialog.current?.showModal();
  };

  const step = useCallback((by: number) => setIndex((i) => (i + by + count) % count), [count]);

  useEffect(() => {
    const box = dialog.current;
    if (!box) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    const onClose = () => {
      setIsOpen(false);
      document.documentElement.classList.remove("viewer-open");
      opener.current?.focus();
    };
    box.addEventListener("keydown", onKey);
    box.addEventListener("close", onClose);
    return () => {
      box.removeEventListener("keydown", onKey);
      box.removeEventListener("close", onClose);
    };
  }, [step]);

  // While open, the page behind doesn't scroll; and the photos either side are fetched, so stepping is instant.
  useEffect(() => {
    if (!isOpen) return;
    document.documentElement.classList.add("viewer-open");
    for (const by of [1, -1]) {
      const next = media[(index + by + count) % count];
      if (next.kind === "image") new Image().src = mediaUrl(next.id, 1280);
    }
  }, [index, isOpen, media, count]);

  if (!count) return null;
  const item = media[index];
  const single = count === 1;
  // One photo shows whole (not cropped), so ask for a larger copy than for a tile.
  const tileWidth = (i: number) => (single || i === 0 ? (full ? 1280 : 640) : 320);

  return (
    <>
      <div className={`post-media post-media--${Math.min(count, SHOWN)} ${compact ? "post-media--compact" : ""}`}>
        {tiles.map((m, i) => {
          const more = i === tiles.length - 1 && hidden > 0;
          return (
            <a
              key={m.id}
              className={`post-media__tile ${m.kind === "video" ? "post-media__tile--video" : ""}`}
              href={mediaUrl(m.id)}
              onClick={(e) => open(e, i)}
              aria-label={more ? `${describe(i)}, and ${hidden} more. Open to see all` : `${describe(i)}. Open full size`}
            >
              {m.kind === "video" ? (
                <video src={`${mediaUrl(m.id)}#t=0.1`} muted playsInline preload="metadata" tabIndex={-1} aria-hidden="true" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl(m.id, compact ? Math.min(320, tileWidth(i)) : tileWidth(i))} alt="" loading="lazy" decoding="async" />
              )}
              {m.kind === "video" && !more && (
                <span className="post-media__play" aria-hidden="true">
                  ▶
                </span>
              )}
              {more && (
                <span className="post-media__more" aria-hidden="true">
                  +{hidden}
                </span>
              )}
            </a>
          );
        })}
      </div>

      <dialog
        ref={dialog}
        className="viewer"
        aria-label={`${author}'s photos: ${index + 1} of ${count}`}
        // A tap on the dark ground around the photo closes it.
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          const start = touch.current;
          touch.current = null;
          if (!start || count < 2) return;
          const dx = e.changedTouches[0].clientX - start.x;
          const dy = e.changedTouches[0].clientY - start.y;
          // A sideways swipe steps; a mostly downward one closes, as in a phone's photo viewer.
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
          else if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.5) dialog.current?.close();
        }}
      >
        {isOpen && item && (
          <figure className="viewer__figure">
            {item.kind === "video" ? (
              <video key={item.id} src={mediaUrl(item.id)} controls autoPlay playsInline className="viewer__media" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={item.id} src={mediaUrl(item.id, 1280)} alt={describe(index)} className="viewer__media" />
            )}
            {count > 1 && (
              <figcaption className="viewer__count" aria-live="polite">
                {index + 1} / {count}
              </figcaption>
            )}
          </figure>
        )}
        <button type="button" className="viewer__button viewer__close" onClick={() => dialog.current?.close()} aria-label="Close" autoFocus>
          <span aria-hidden="true">×</span>
        </button>
        {count > 1 && (
          <>
            <button type="button" className="viewer__button viewer__prev" onClick={() => step(-1)} aria-label="Previous photo">
              <span aria-hidden="true">‹</span>
            </button>
            <button type="button" className="viewer__button viewer__next" onClick={() => step(1)} aria-label="Next photo">
              <span aria-hidden="true">›</span>
            </button>
          </>
        )}
      </dialog>
    </>
  );
}
