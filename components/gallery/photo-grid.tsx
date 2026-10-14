"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import type { AlbumPart } from "../../lib/gallery";

/*
 * An album's photos in justified rows (each as wide as its shape asks, so nothing is
 * cropped), part by part when the event happened more than once, opening into one
 * lightbox that steps through them all. Each photo is a plain link to its full-size file,
 * so without JavaScript it still opens; with it, the native <dialog> takes over: Esc
 * closes, ← → step through, and focus returns to the photo you opened.
 */

type PhotoGridProps = {
  parts: AlbumPart[];
  title: string;
};

export function PhotoGrid({ parts, title }: PhotoGridProps) {
  const photos = parts.flatMap((part) => part.photos);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [index, setIndex] = useState(0);
  const photo = photos[index];
  const named = parts.length > 1;

  const open = (event: MouseEvent<HTMLAnchorElement>, i: number) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey) return; // let new-tab clicks through
    event.preventDefault();
    opener.current = event.currentTarget;
    setIndex(i);
    dialogRef.current?.showModal();
  };

  const step = useCallback((by: number) => setIndex((i) => (i + by + photos.length) % photos.length), [photos.length]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") step(1);
      else if (event.key === "ArrowLeft") step(-1);
    };
    const onClose = () => opener.current?.focus();
    dialog.addEventListener("keydown", onKey);
    dialog.addEventListener("close", onClose);
    return () => {
      dialog.removeEventListener("keydown", onKey);
      dialog.removeEventListener("close", onClose);
    };
  }, [step]);

  // Fetch the neighbours while this one is looked at, so stepping is instant.
  useEffect(() => {
    if (!dialogRef.current?.open) return;
    for (const by of [1, -1]) new Image().src = photos[(index + by + photos.length) % photos.length].src;
  }, [index, photos]);

  let at = 0;
  return (
    <>
      {parts.map((part) => {
        const first = at;
        at += part.photos.length;
        const grid = (
          <ul className="photo-grid">
            {part.photos.map((p, j) => (
              <li key={p.src} style={{ "--ratio": p.width / p.height } as CSSProperties}>
                <a href={p.src} onClick={(event) => open(event, first + j)} aria-label={`${p.alt} (open larger)`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.thumb}
                    srcSet={`${p.thumb} ${p.thumbWidth}w, ${p.src} ${p.width}w`}
                    sizes="(max-width: 700px) 50vw, 480px"
                    alt={p.alt}
                    width={p.width}
                    height={p.height}
                    loading={first + j < 6 ? "eager" : "lazy"}
                  />
                  {p.caption && (
                    <span className="photo-grid__caption" aria-hidden="true">
                      {p.caption}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        );
        if (!named) return <div key="all">{grid}</div>;
        return (
          <section className="album-part" key={part.title} aria-label={`${part.title}, ${part.when}`}>
            <header className="album-part__head">
              <h2>{part.title}</h2>
              <p>
                {part.when} · {part.photos.length} {part.photos.length === 1 ? "photo" : "photos"}
              </p>
            </header>
            {grid}
          </section>
        );
      })}

      <dialog
        className="lightbox"
        ref={dialogRef}
        aria-label={`${title}: photo ${index + 1} of ${photos.length}`}
        // A click on the dark background (the dialog itself, not its contents) closes it.
        onClick={(event) => event.target === event.currentTarget && dialogRef.current?.close()}
      >
        <figure className="lightbox__figure">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={photo.src} src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} />
          <figcaption>
            <span>{photo.alt}</span>
            <span className="lightbox__count">
              {index + 1} / {photos.length}
            </span>
          </figcaption>
        </figure>
        <button type="button" className="lightbox__button lightbox__close" onClick={() => dialogRef.current?.close()} aria-label="Close" autoFocus>
          <span aria-hidden="true">×</span>
        </button>
        {photos.length > 1 && (
          <>
            <button type="button" className="lightbox__button lightbox__prev" onClick={() => step(-1)} aria-label="Previous photo">
              <span aria-hidden="true">←</span>
            </button>
            <button type="button" className="lightbox__button lightbox__next" onClick={() => step(1)} aria-label="Next photo">
              <span aria-hidden="true">→</span>
            </button>
          </>
        )}
      </dialog>
    </>
  );
}

