import type { Album } from "../../lib/gallery";

/* The intro's hand-drawn leaf, and where it sits along the band's vine: x, y, angle. */
const LEAF = "M0 0c18 -22 52 -24 70 -6c-20 20 -52 22 -70 6zM0 0l58 -8";
const LEAVES: [number, number, number][] = [
  [70, 36, -28],
  [150, 52, 24],
  [236, 30, -18],
  [318, 46, 30]
];

/** A vine of leaves across the band the album's name sits on, faint, like the page margins. */
function LeafVine() {
  return (
    <svg className="album-card__vine" viewBox="0 0 400 80" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
      <path className="album-card__vine-stem" d="M-10 54C50 22 96 70 160 46S270 14 330 40S390 58 410 36" />
      {LEAVES.map(([x, y, angle]) => (
        <path className="album-card__vine-leaf" d={LEAF} key={x} transform={`translate(${x} ${y}) rotate(${angle}) scale(0.62)`} />
      ))}
      <circle className="album-card__vine-dot" cx="112" cy="24" r="2.5" />
      <circle className="album-card__vine-dot" cx="282" cy="62" r="2" />
    </svg>
  );
}

/** An album: up to three of its photos (the cover large), with its name, date and size on them. */
export function AlbumCard({ album, compact = false }: { album: Album; compact?: boolean }) {
  const Title = compact ? "h3" : "h2";
  return (
    <a className={`album-card ${compact ? "album-card--compact" : ""}`} href={`/gallery/${album.slug}`}>
      <span className="album-card__mosaic">
        {album.mosaic.map((photo, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={photo.src} src={photo.thumb} alt="" width={photo.width} height={photo.height} loading={i === 0 ? "eager" : "lazy"} />
        ))}
      </span>
      <span className="album-card__band">
        <LeafVine />
        <span className="album-card__words">
          <Title className="album-card__title">{album.title}</Title>
          <span className="album-card__meta">
            {album.when} · {album.photos.length} {album.photos.length === 1 ? "photo" : "photos"}
          </span>
        </span>
        <span className="album-card__open" aria-hidden="true">
          →
        </span>
      </span>
    </a>
  );
}
