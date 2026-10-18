"use client";


import Link from "next/link";
import { HERO_PHOTO } from "../lib/campus";
import { InkBloom } from "./ink-bloom";

/*
 * The hero photo: one photograph of the campus in an ink splotch (see InkBloom), blooming
 * in once the site is up, with the way into the gallery beside it.
 */

type HeroInkProps = {
  /** True once the site is showing; the bloom waits for it. */
  active: boolean;
};

export function HeroInk({ active }: HeroInkProps) {
  return (
    <figure className="photo-reveal photo-reveal--ink">
      <div className="hero-ink">
        <InkBloom
          className="hero-ink__canvas"
          src={HERO_PHOTO.src}
          sketch={HERO_PHOTO.sketch}
          origin={HERO_PHOTO.inkOrigin}
          seed={7}
          alt={`${HERO_PHOTO.title}, HKBK College of Engineering`}
          active={active}
        />
      </div>
      <figcaption className="hero-ink__caption">
        <span>{HERO_PHOTO.label}</span>
        <strong>{HERO_PHOTO.title}</strong>
        <Link className="hero-ink__explore" href="/gallery">
          Explore the gallery <span aria-hidden="true">→</span>
        </Link>
      </figcaption>
    </figure>
  );
}
