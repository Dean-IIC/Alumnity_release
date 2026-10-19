import Link from "next/link";
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "../../../components/site-header";
import { SiteFooter } from "../../../components/site-footer";
import { VisitorOnly } from "../../../components/visitor-only";
import { SoonNotice } from "../../../components/coming-soon";
import { InkBloom } from "../../../components/ink-bloom";
import { AlbumCard } from "../../../components/gallery/album-card";
import { PhotoGrid } from "../../../components/gallery/photo-grid";
import { albumSources, countLabel } from "../../../lib/gallery";
import { galleryAlbum, galleryAlbums } from "../../../lib/server/showcase";
import "../../styles/gallery.css";

type Props = { params: Promise<{ slug: string }> };

// Made per request (not ahead of time): a member gets the app's bar and tabs around it, a
// visitor the site's; and the albums are the college desk's to change.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const album = await galleryAlbum((await params).slug);
  if (!album) return {};
  return { title: `${album.title}, ${album.when} · HKBK memories · Alumnity`, description: album.description };
}

/** Each album's ink splotch has its own shape, the same on every visit. */
const seedFor = (slug: string) => [...slug].reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) >>> 0, 7);

export default async function AlbumPage({ params }: Props) {
  const album = await galleryAlbum((await params).slug);
  if (!album) notFound();
  const others = (await galleryAlbums()).filter((other) => other.slug !== album.slug);
  // Times the event happened (a part just for videos, like a film, isn't one).
  const events = album.parts.filter((part) => part.photos.length).length;

  return (
    <>
      <VisitorOnly>
        <SiteHeader current="gallery" />
      </VisitorOnly>
      <main className="album container">
        {/* The album opens like the landing page: its cover blooms from pencil into colour. */}
        <Link className="back-link album__back" href="/gallery">
          <span aria-hidden="true">←</span> All albums
        </Link>
        <header className="album-hero">
          <div className="album-hero__copy">
            <h1 className="page-title">{album.title}</h1>
            <p className="album__meta">
              {album.when} · {countLabel(album.photos.length, album.videos.length)}
              {events > 1 && ` · ${events} events`}
            </p>
            <p className="page-head__text">{album.description}</p>
            {albumSources(album).map((source) => (
              <p className="page-head__source" key={source}>
                {source}
              </p>
            ))}
          </div>
          <div className="album-hero__ink" style={{ aspectRatio: `${album.cover.width} / ${album.cover.height}` } as CSSProperties}>
            <InkBloom src={album.cover.src} sketch={album.cover.sketch} seed={seedFor(album.slug)} alt={album.cover.alt} active />
          </div>
        </header>

        <PhotoGrid parts={album.parts} title={album.title} />

        <section className="album__others" aria-labelledby="more-albums">
          <h2 id="more-albums">More albums</h2>
          <ul className="album-grid album-grid--compact">
            {others.map((other) => (
              <li key={other.slug}>
                <AlbumCard album={other} compact />
              </li>
            ))}
          </ul>
        </section>
      </main>
      <VisitorOnly>
        <SiteFooter />
      </VisitorOnly>
      <SoonNotice />
    </>
  );
}
