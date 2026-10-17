import type { Metadata } from "next";
import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";
import { VisitorOnly } from "../../components/visitor-only";
import { SoonNotice } from "../../components/coming-soon";
import { AlbumCard } from "../../components/gallery/album-card";
import { ALBUMS, PHOTO_COUNT } from "../../lib/gallery";
import "../styles/gallery.css";

export const metadata: Metadata = {
  title: "HKBK memories · Gallery · Alumnity",
  description: "Photos from HKBK College of Engineering events over the years: alumni meets, job drives, sports and festivals."
};

export default function GalleryPage() {
  return (
    <>
      <VisitorOnly>
        <SiteHeader current="gallery" />
      </VisitorOnly>
      <main className="gallery container">
        <header className="page-head">
          <p className="kicker">Gallery</p>
          <h1 className="page-title">
            HKBK <span className="page-title__gold">memories</span>
          </h1>
          <p className="page-head__text">
            Photos from college events over the years: alumni meets, job drives, sports and festivals. {ALBUMS.length} albums,{" "}
            {PHOTO_COUNT} photos.
          </p>
        </header>

        <ul className="album-grid">
          {ALBUMS.map((album) => (
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
