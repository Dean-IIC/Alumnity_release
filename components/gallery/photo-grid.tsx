"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { countLabel, isVideo, type AlbumPart, type GalleryPhoto, type GalleryVideo } from "../../lib/gallery";
import { SHAPE_RATIO } from "../../lib/video";
import { LeafVine } from "./leaf-vine";

/*
 * An album's photos and videos in justified rows (each as wide as its shape asks, so
 * nothing is cropped), part by part when the event happened more than once, opening into
 * one lightbox that steps through them all. Each item is a plain link (a photo to its
 * full-size file, a video to its page on YouTube, Instagram, Facebook or LinkedIn), so
 * without JavaScript it still opens; with it, the native <dialog> takes over: Esc closes,
 * ← → step through, and focus returns to the item you opened. A video's player is only
 * loaded once it's opened, and is removed again when you step away or close.
 */

type Item = GalleryPhoto | GalleryVideo;

type PhotoGridProps = {
  parts: AlbumPart[];
  title: string;
};

/** A tile is the shape of its picture: a photo's, a video's still (between phone-tall and wide), or the video's shape. */
const ratioOf = (item: Item) => {
  if (!isVideo(item)) return item.width / item.height;
  if (!item.poster) return SHAPE_RATIO[item.shape];
  return Math.min(16 / 9, Math.max(9 / 16, item.poster.width / item.poster.height));
};

/** What a photo or video shows, on a slip of paper with the cards' leaf vine. */
function Caption({ text }: { text: string }) {
  return (
    <span className="photo-grid__caption" aria-hidden="true">
      <LeafVine className="photo-grid__vine" />
      <span className="photo-grid__caption-text">{text}</span>
    </span>
  );
}

function PhotoTile({ photo, eager }: { photo: GalleryPhoto; eager: boolean }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.thumb}
        srcSet={`${photo.thumb} ${photo.thumbWidth}w, ${photo.src} ${photo.width}w`}
        sizes="(max-width: 700px) 50vw, 480px"
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        loading={eager ? "eager" : "lazy"}
      />
      {photo.caption && <Caption text={photo.caption} />}
    </>
  );
}

/** A video waiting to be played: its still if it has one, otherwise a sheet of paper with its name. */
function VideoTile({ video }: { video: GalleryVideo }) {
  return (
    <>
      {video.poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={video.poster.src} alt="" width={video.poster.width} height={video.poster.height} loading="lazy" />
      ) : (
        <span className="video-tile__paper" aria-hidden="true">
          <span className="video-tile__source">{video.providerName}</span>
          <span className="video-tile__title">{video.title}</span>
        </span>
      )}
      <span className="video-tile__play" aria-hidden="true">
        ▶
      </span>
      {/* The name on a wide still only: on a tall one it would cover the picture (it's in the lightbox). */}
      {video.poster && video.poster.width >= video.poster.height && <Caption text={video.title} />}
    </>
  );
}

/** A video in the lightbox: the provider's own player, sized to the video's shape. */
function VideoPlayer({ video }: { video: GalleryVideo }) {
  return (
    <div className={`lightbox__video lightbox__video--${video.shape}`}>
      <iframe
        src={video.embed}
        title={`${video.title} (${video.providerName} video)`}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}

export function PhotoGrid({ parts, title }: PhotoGridProps) {
  const items: Item[] = parts.flatMap((part) => [...part.photos, ...part.videos]);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [index, setIndex] = useState(0);
  // Only while open is anything drawn in the lightbox, so closing it stops a playing video.
  const [isOpen, setIsOpen] = useState(false);
  const item = items[index];
  const named = parts.length > 1;

  const open = (event: MouseEvent<HTMLAnchorElement>, i: number) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey) return; // let new-tab clicks through
    event.preventDefault();
    opener.current = event.currentTarget;
    setIndex(i);
    setIsOpen(true);
    dialogRef.current?.showModal();
  };

  const step = useCallback((by: number) => setIndex((i) => (i + by + items.length) % items.length), [items.length]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") step(1);
      else if (event.key === "ArrowLeft") step(-1);
    };
    const onClose = () => {
      setIsOpen(false);
      opener.current?.focus();
    };
    dialog.addEventListener("keydown", onKey);
    dialog.addEventListener("close", onClose);
    return () => {
      dialog.removeEventListener("keydown", onKey);
      dialog.removeEventListener("close", onClose);
    };
  }, [step]);

  // Fetch the neighbouring photos while this one is looked at, so stepping is instant.
  useEffect(() => {
    if (!isOpen) return;
    for (const by of [1, -1]) {
      const next = items[(index + by + items.length) % items.length];
      if (!isVideo(next)) new Image().src = next.src;
    }
  }, [index, items, isOpen]);

  let at = 0;
  return (
    <>
      {parts.map((part) => {
        const first = at;
        const partItems: Item[] = [...part.photos, ...part.videos];
        at += partItems.length;
        const grid = (
          <ul className={`photo-grid ${part.photos.length ? "" : "photo-grid--videos"}`}>
            {partItems.map((it, j) => (
              <li key={isVideo(it) ? it.url : it.src} style={{ "--ratio": ratioOf(it) } as CSSProperties}>
                {isVideo(it) ? (
                  <a
                    className="video-tile"
                    href={it.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => open(event, first + j)}
                    aria-label={`Play video: ${it.title} (${it.providerName})`}
                  >
                    <VideoTile video={it} />
                  </a>
                ) : (
                  <a href={it.src} onClick={(event) => open(event, first + j)} aria-label={`${it.alt} (open larger)`}>
                    <PhotoTile photo={it} eager={first + j < 6} />
                  </a>
                )}
              </li>
            ))}
          </ul>
        );
        if (!named) return <div key="all">{grid}</div>;
        return (
          <section className="album-part" key={part.title ?? title} aria-label={`${part.title ?? title}, ${part.when}`}>
            <header className="album-part__head">
              <h2>{part.title ?? title}</h2>
              <p>
                {part.when} · {countLabel(part.photos.length, part.videos.length)}
              </p>
            </header>
            {grid}
          </section>
        );
      })}

      <dialog
        className="lightbox"
        ref={dialogRef}
        aria-label={`${title}: ${index + 1} of ${items.length}`}
        // A click on the dark background (the dialog itself, not its contents) closes it.
        onClick={(event) => event.target === event.currentTarget && dialogRef.current?.close()}
      >
        {isOpen && (
          <figure className="lightbox__figure">
            {isVideo(item) ? (
              <VideoPlayer key={item.embed} video={item} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={item.src} src={item.src} alt={item.alt} width={item.width} height={item.height} />
            )}
            <figcaption>
              {isVideo(item) ? (
                <span>
                  {item.title} ·{" "}
                  <a className="lightbox__source" href={item.url} target="_blank" rel="noopener noreferrer">
                    Watch on {item.providerName} <span aria-hidden="true">↗</span>
                  </a>
                </span>
              ) : (
                <span>{item.alt}</span>
              )}
              <span className="lightbox__count">
                {index + 1} / {items.length}
              </span>
            </figcaption>
          </figure>
        )}
        <button type="button" className="lightbox__button lightbox__close" onClick={() => dialogRef.current?.close()} aria-label="Close" autoFocus>
          <span aria-hidden="true">×</span>
        </button>
        {items.length > 1 && (
          <>
            <button type="button" className="lightbox__button lightbox__prev" onClick={() => step(-1)} aria-label="Previous">
              <span aria-hidden="true">←</span>
            </button>
            <button type="button" className="lightbox__button lightbox__next" onClick={() => step(1)} aria-label="Next">
              <span aria-hidden="true">→</span>
            </button>
          </>
        )}
      </dialog>
    </>
  );
}
