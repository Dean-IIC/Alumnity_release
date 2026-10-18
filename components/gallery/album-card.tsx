import Link from "next/link";
import { countLabel, type Album } from "../../lib/gallery";
import { LeafVine } from "./leaf-vine";

/** An album: up to three of its photos (the cover large), with its name, date and size on them. */
export function AlbumCard({ album, compact = false }: { album: Album; compact?: boolean }) {
  const Title = compact ? "h3" : "h2";
  return (
    <Link className={`album-card ${compact ? "album-card--compact" : ""}`} href={`/gallery/${album.slug}`}>
      <span className="album-card__mosaic">
        {album.mosaic.map((photo, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={photo.src} src={photo.thumb} alt="" width={photo.width} height={photo.height} loading={i === 0 ? "eager" : "lazy"} />
        ))}
      </span>
      <span className="album-card__band">
        <LeafVine className="album-card__vine" />
        <span className="album-card__words">
          <Title className="album-card__title">{album.title}</Title>
          <span className="album-card__meta">
            {album.when} · {countLabel(album.photos.length, album.videos.length)}
          </span>
        </span>
        <span className="album-card__open" aria-hidden="true">
          →
        </span>
      </span>
    </Link>
  );
}
