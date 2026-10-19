import type { Metadata } from "next";
import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";
import { VisitorOnly } from "../../components/visitor-only";
import { SoonNotice } from "../../components/coming-soon";
import { AlbumCard } from "../../components/gallery/album-card";
import { BackLink } from "../../components/back-link";
import { photoCount } from "../../lib/gallery";
import { galleryAlbums } from "../../lib/server/showcase";
import "../styles/gallery.css";

export const metadata: Metadata = {
  title: "HKBK memories · Gallery · Alumnity",
  description: "Photos from HKBK College of Engineering events: alumni meets, job drives, sports and festivals."
};

// The albums are the college desk's to change (lib/server/showcase.ts): read on each visit.
export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const albums = await galleryAlbums();
  return (
    <>
      <VisitorOnly>
        <SiteHeader current="gallery" />
      </VisitorOnly>
      <main className="gallery container">
        <BackLink fallback="/" label="Home" />
        <header className="page-head">
          <p className="kicker">Gallery</p>
          <h1 className="page-title">
            HKBK <span className="page-title__gold">memories</span>
          </h1>
          <p className="page-head__text">
            Photos from college events over the years: alumni meets, job drives, sports and festivals. {albums.length} albums,{" "}
            {photoCount(albums)} photos.
          </p>
        </header>

        <ul className="album-grid">
          {albums.map((album) => (
            <li key={album.slug}>
              <AlbumCard album={album} />
            </li>
          ))}
        </ul>

        <p className="gallery__more">
          <span aria-hidden="true">◌</span> Have photos from your time at HKBK? Soon you’ll be able to add them here.
        </p>
      </main>
      <VisitorOnly>
        <SiteFooter />
      </VisitorOnly>
      <SoonNotice />
    </>
  );
}
