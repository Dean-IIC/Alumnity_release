"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { mediaUrl } from "../../lib/media-url";
import { CAMPUS_TRAVEL, cleanCrop, cropStyle, isPlain, NO_CROP, photoKey, ZOOM, type Crop } from "../../lib/photo-crop";
import type { MediaRef } from "../../lib/server/profile";
import { Avatar } from "../social/avatar";
import { Sheet } from "../social/sheet";
import { Cover, type DefaultCover } from "./cover";
import "../../app/styles/posts-plus.css";

/*
 * Framing a photo or a cover: the picture under a fixed frame (a circle for the photo,
 * the cover's own shape for the cover), moved by dragging (a mouse, a finger or a pen),
 * grown with the slider, a pinch or the wheel, and with the keyboard (arrows move it, +
 * and − zoom). Beside it, how it will look elsewhere. Nothing is cut: Save hands back three
 * numbers (lib/photo-crop.ts), drawn with CSS wherever the picture shows.
 */

/** What's being framed: their photo, their own cover (an image or a video), or the campus drawing. */
export type CropSubject =
  | { kind: "photo"; id: string }
  | { kind: "cover"; cover: MediaRef }
  | { kind: "campus"; fallback: DefaultCover; seed: number };

/*
 * The cover's shape as it shows on a member's page: a computer's (the page's full width,
 * 1120 by 320) and a phone's (350 wide by 200 tall at 390 pixels across).
 */
const WIDE = 1120 / 320;
const PHONE = 350 / 200;

const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));
const zoomed = (c: Crop, zoom: number): Crop => ({ ...c, zoom: Math.round(clamp(zoom, ZOOM.min, ZOOM.max) * 100) / 100 });

/**
 * The framing moved by (dx, dy) screen pixels, the picture following the pointer. Measured
 * on the frame as it is now, so a move is the same distance on screen at any zoom.
 */
function shifted(frame: HTMLElement | null, campus: boolean, c: Crop, dx: number, dy: number): Crop {
  if (!frame) return c;
  if (campus) {
    // The drawing's box moves by its own size (lib/photo-crop.ts campusStyle).
    const box = frame.querySelector<HTMLElement>(".cover__campus");
    if (!box?.offsetWidth || !box.offsetHeight) return c;
    return { ...c, x: clamp(c.x + dx / (CAMPUS_TRAVEL.x * box.offsetWidth), 0, 1), y: clamp(c.y + dy / (CAMPUS_TRAVEL.y * box.offsetHeight), 0, 1) };
  }
  const media = frame.querySelector<HTMLImageElement | HTMLVideoElement>("img, video");
  const box = media?.parentElement;
  if (!media || !box) return c;
  const [w, h] = media instanceof HTMLImageElement ? [media.naturalWidth, media.naturalHeight] : [media.videoWidth, media.videoHeight];
  if (!w || !h) return c;
  // How far the picture, grown to cover the frame and then by the zoom, reaches past it.
  const scale = Math.max(box.clientWidth / w, box.clientHeight / h) * c.zoom;
  const overX = w * scale - box.clientWidth;
  const overY = h * scale - box.clientHeight;
  return {
    ...c,
    x: overX > 0.5 ? clamp(c.x - dx / overX, 0, 1) : c.x,
    y: overY > 0.5 ? clamp(c.y - dy / overY, 0, 1) : c.y
  };
}

/** Whether the screen is a phone's (the frame takes the phone's shape there). */
function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 600px)");
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return narrow;
}

type Props = {
  open: boolean;
  subject: CropSubject;
  /** The framing it has now (absent: none yet). */
  initial?: Crop | null;
  name: string;
  /** The new framing (undefined: none, as it comes). */
  onSave: (crop: Crop | undefined) => void;
  onClose: () => void;
};

export function CropTool({ open, subject, initial, name, onSave, onClose }: Props) {
  const [crop, setCrop] = useState<Crop>(initial ?? NO_CROP);
  const frame = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const narrow = useNarrow();
  const campus = subject.kind === "campus";

  // Each time it opens, it starts from the framing saved so far.
  useEffect(() => {
    if (open) setCrop(initial ?? NO_CROP);
    pointers.current.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const move = (dx: number, dy: number) => setCrop((c) => shifted(frame.current, campus, c, dx, dy));

  // The wheel zooms (a listener of our own: React's can't stop the page scrolling).
  useEffect(() => {
    const el = frame.current;
    if (!open || !el) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      setCrop((c) => zoomed(c, c.zoom * Math.exp(-event.deltaY * 0.0015)));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [open, narrow]);

  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };

  const drag = (event: PointerEvent<HTMLDivElement>) => {
    const all = pointers.current;
    const was = all.get(event.pointerId);
    if (!was) return;
    const now = { x: event.clientX, y: event.clientY };
    if (all.size === 1) {
      move(now.x - was.x, now.y - was.y);
    } else if (all.size === 2) {
      // Two fingers: their spread zooms, their middle moves it.
      const other = [...all.entries()].find(([id]) => id !== event.pointerId)![1];
      const before = Math.hypot(was.x - other.x, was.y - other.y);
      const after = Math.hypot(now.x - other.x, now.y - other.y);
      setCrop((c) => shifted(frame.current, campus, before > 0 ? zoomed(c, (c.zoom * after) / before) : c, (now.x - was.x) / 2, (now.y - was.y) / 2));
    }
    all.set(event.pointerId, now);
  };

  const up = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
  };

  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 40 : 8;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[event.key]) move(...moves[event.key]);
    else if (event.key === "+" || event.key === "=") setCrop((c) => zoomed(c, c.zoom + 0.1));
    else if (event.key === "-" || event.key === "_") setCrop((c) => zoomed(c, c.zoom - 0.1));
    else return;
    event.preventDefault();
  };

  const whatIsIt = subject.kind === "photo" ? "your photo" : campus ? "the campus drawing" : "your cover";
  const frameProps = {
    ref: frame,
    className: "crop__frame",
    tabIndex: 0,
    role: "group",
    "aria-roledescription": "framing",
    "aria-label": `Drag to move ${whatIsIt}. You can also move it with the arrow keys, and zoom with the plus and minus keys.`,
    onPointerDown: down,
    onPointerMove: drag,
    onPointerUp: up,
    onPointerCancel: up,
    onKeyDown: keys
  };

  // The cover as it shows, at one shape (the frame) or the other (the preview beside it).
  const cover = (shape: number) => (
    <div className="crop__cover" style={{ aspectRatio: String(shape) }}>
      <Cover
        cover={subject.kind === "cover" ? { ...subject.cover, crop } : null}
        fallback={subject.kind === "campus" ? subject.fallback : { src: "", sketch: "", year: 0, title: "" }}
        name={name}
        seed={subject.kind === "campus" ? subject.seed : 0}
        campusCrop={crop}
      />
    </div>
  );

  if (!open) return null;
  return createPortal(
    <Sheet open={open} onClose={onClose} title={subject.kind === "photo" ? "Adjust your photo" : campus ? "Adjust the campus drawing" : "Adjust your cover"} className="crop-sheet" focusField={false}>
      <p className="sheet__note">
        {subject.kind === "photo"
          ? "Drag the photo to move it inside the circle. Zoom in to make it bigger. Your alumni card shows the full square, including the corners."
          : campus
            ? "Until you add your own cover, your page shows a picture of the campus from your year. Drag it to move it, and zoom in to make it bigger."
            : "Drag to choose which part of your cover shows. Zoom in to make it bigger. The cover is wider on a computer than on a phone, so check how it looks on both."}
      </p>

      <div className={`crop crop--${subject.kind === "photo" ? "photo" : "cover"}`}>
        {subject.kind === "photo" ? (
          <div {...frameProps}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaUrl(subject.id, 640)} alt="" draggable={false} style={cropStyle(crop)} />
            <span className="crop__ring" aria-hidden="true" />
          </div>
        ) : (
          <div {...frameProps} data-shape={narrow ? "phone" : "wide"}>
            {cover(narrow ? PHONE : WIDE)}
          </div>
        )}

        <div className="crop__zoom">
          <button type="button" className="crop__step" aria-label="Zoom out" disabled={crop.zoom <= ZOOM.min} onClick={() => setCrop((c) => zoomed(c, c.zoom - 0.25))}>
            −
          </button>
          <label className="crop__slider">
            <span className="sr-only">Zoom</span>
            <input
              type="range"
              min={ZOOM.min}
              max={ZOOM.max}
              step={0.01}
              value={crop.zoom}
              aria-valuetext={`${Math.round(crop.zoom * 100)}%`}
              onChange={(e) => setCrop((c) => zoomed(c, Number(e.target.value)))}
            />
          </label>
          <button type="button" className="crop__step" aria-label="Zoom in" disabled={crop.zoom >= ZOOM.max} onClick={() => setCrop((c) => zoomed(c, c.zoom + 0.25))}>
            +
          </button>
        </div>

        <div className="crop__previews" aria-label="How it will look">
          {subject.kind === "photo" ? (
            <>
              <figure>
                <Avatar name={name} photoId={photoKey(subject.id, crop)} size={96} />
                <figcaption>Your page</figcaption>
              </figure>
              <figure>
                <Avatar name={name} photoId={photoKey(subject.id, crop)} size={44} />
                <figcaption>Lists and posts</figcaption>
              </figure>
              <figure>
                <Avatar name={name} photoId={photoKey(subject.id, crop)} size={28} />
                <figcaption>The top bar</figcaption>
              </figure>
            </>
          ) : (
            <figure className="crop__other" data-shape={narrow ? "wide" : "phone"}>
              {cover(narrow ? WIDE : PHONE)}
              <figcaption>{narrow ? "On a computer" : "On a phone"}</figcaption>
            </figure>
          )}
        </div>
      </div>

      <div className="sheet__foot crop__foot">
        <button type="button" className="join__switch crop__reset" onClick={() => setCrop(NO_CROP)} disabled={isPlain(crop)}>
          Reset
        </button>
        <button type="button" className="button button--secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="button button--primary" onClick={() => onSave(cleanCrop(crop))}>
          Save
        </button>
      </div>
    </Sheet>,
    document.body
  );
}

