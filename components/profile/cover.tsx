"use client";

import { useEffect, useRef } from "react";
import { mediaUrl } from "../../lib/media-url";
import { campusStyle, cropStyle, sharper, type Crop } from "../../lib/photo-crop";
import type { MediaRef } from "../../lib/server/profile";
import { InkBloom } from "../ink-bloom";

/*
 * The top of a member's page: their own cover (an image, a video or an HTML file), or
 * without one, the campus as it was the year they joined, blooming from pencil into
 * colour. An HTML cover runs in a sealed frame: its own scripts, nothing of the site's
 * (the server adds the same sandbox, so it holds even if the file is opened on its own).
 *
 * An image or a video shows as its owner framed it (cover.crop), and the campus drawing
 * where they moved it (campusCrop): lib/photo-crop.ts. An HTML cover lays itself out.
 */

export type DefaultCover = { src: string; sketch: string; year: number; title: string; kicker?: string };

function CoverVideo({ id, crop }: { id: string; crop?: Crop }) {
  const ref = useRef<HTMLVideoElement>(null);
  // Plays quietly on a loop, unless the visitor prefers less motion.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) ref.current?.pause();
  }, []);
  return <video ref={ref} className="cover__media" src={mediaUrl(id)} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" style={cropStyle(crop)} />;
}

export function Cover({ cover, fallback, name, seed, campusCrop = null }: { cover: MediaRef | null; fallback: DefaultCover; name: string; seed: number; campusCrop?: Crop | null }) {
  return (
    <div className={`cover ${cover ? `cover--${cover.kind}` : "cover--campus"}`}>
      {cover?.kind === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="cover__media" src={mediaUrl(cover.id, 640 * sharper(cover.crop))} alt={`${name}’s cover`} style={cropStyle(cover.crop)} />
      )}
      {cover?.kind === "video" && <CoverVideo id={cover.id} crop={cover.crop} />}
      {cover?.kind === "html" && (
        <iframe
          className="cover__media"
          src={mediaUrl(cover.id)}
          title={`${name}’s cover`}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          loading="lazy"
          scrolling="no"
        />
      )}
      {!cover && (
        <>
          <div className="cover__campus" style={campusStyle(campusCrop)}>
            <InkBloom src={fallback.src} sketch={fallback.sketch} seed={seed + 3} alt={fallback.kicker ? "HKBK College of Engineering's campus" : `HKBK College of Engineering around ${fallback.year}`} active spread={{ sketch: 0.6, colour: 0.5 }} />
          </div>
          <p className="cover__caption">
            {fallback.kicker ?? `HKBK, around ${fallback.year}`}
            <span>{fallback.title}</span>
          </p>
        </>
      )}
    </div>
  );
}
