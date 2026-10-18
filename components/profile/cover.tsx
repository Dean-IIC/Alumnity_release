"use client";

import { useEffect, useRef } from "react";
import { mediaUrl } from "../../lib/media-url";
import type { MediaRef } from "../../lib/server/profile";
import { InkBloom } from "../ink-bloom";

/*
 * The top of a member's page: their own cover (an image, a video or an HTML file), or
 * without one, the campus as it was the year they joined, blooming from pencil into
 * colour. An HTML cover runs in a sealed frame: its own scripts, nothing of the site's
 * (the server adds the same sandbox, so it holds even if the file is opened on its own).
 */

export type DefaultCover = { src: string; sketch: string; year: number; title: string; kicker?: string };

function CoverVideo({ id }: { id: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  // Plays quietly on a loop, unless the visitor prefers less motion.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) ref.current?.pause();
  }, []);
  return <video ref={ref} className="cover__media" src={mediaUrl(id)} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" />;
}

export function Cover({ cover, fallback, name, seed }: { cover: MediaRef | null; fallback: DefaultCover; name: string; seed: number }) {
  return (
    <div className={`cover ${cover ? `cover--${cover.kind}` : "cover--campus"}`}>
      {cover?.kind === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="cover__media" src={mediaUrl(cover.id, 640)} alt={`${name}’s cover`} />
      )}
      {cover?.kind === "video" && <CoverVideo id={cover.id} />}
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
          <div className="cover__campus">
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
