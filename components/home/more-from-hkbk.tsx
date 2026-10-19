import Link from "next/link";
import type { Album, GalleryPhoto } from "../../lib/gallery";
import { batchLabel } from "../../lib/format";
import type { User } from "../../lib/server/auth";
import type { Ask } from "../../lib/server/asks";
import type { Group } from "../../lib/server/groups";
import { connectAction } from "../../lib/actions/social";
import { ActionForm } from "../app/action-form";
import { Avatar } from "../social/avatar";
import { Icon } from "../social/icons";
import { KnowEveryone } from "./know-everyone";

/*
 * What Home carries on with once the posts run out, so it never just stops (as LinkedIn's
 * doesn't): photos from the college's albums, a few at a time, and (on a phone, where
 * there's no right-hand column to hold them) people, groups and questions waiting.
 */

/** Every album's photos in threes, the albums taking turns, so one card follows another from a different day. */
export function memoriesOf(albums: Album[]): { album: Album; photos: GalleryPhoto[] }[] {
  const runs = albums.map((album) => {
    const threes: GalleryPhoto[][] = [];
    for (let i = 0; i + 2 < album.photos.length; i += 3) threes.push(album.photos.slice(i, i + 3));
    return threes.map((photos) => ({ album, photos }));
  });
  const out: { album: Album; photos: GalleryPhoto[] }[] = [];
  for (let k = 0; runs.some((r) => k < r.length); k++) for (const r of runs) if (k < r.length) out.push(r[k]);
  return out;
}

export function MemoryCard({ album, photos }: { album: Album; photos: GalleryPhoto[] }) {
  return (
    <article className="sheet more-card more-card--memory">
      <header className="more-card__head">
        <Icon name="photo" size={18} />
        <span>
          From the HKBK album · <Link href={`/gallery/${album.slug}`}>{album.title}</Link>
          <small>{album.when}</small>
        </span>
      </header>
      <Link className="more-card__photos" href={`/gallery/${album.slug}`} aria-label={`Open the album: ${album.title}`}>
        {photos.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.thumb} src={p.thumb} alt={p.alt} width={p.thumbWidth} height={Math.round((p.thumbWidth * p.height) / p.width)} loading="lazy" decoding="async" />
        ))}
      </Link>
    </article>
  );
}

/** People to meet: on a phone only (the right-hand column has them on a wide screen). */
export function PeopleCard({ people, photos }: { people: User[]; photos: Map<number, string> }) {
  if (!people.length) return <KnowEveryone />;
  return (
    <section className="sheet more-card more-card--narrow" aria-label="People you may know">
      <h2 className="more-card__title">People you may know</h2>
      <ul className="more-card__people">
        {people.map((u) => (
          <li key={u.id}>
            <Link href={`/people/${u.id}`} className="more-card__person">
              <Avatar name={u.name} photoId={photos.get(u.id)} size={56} />
              <strong>{u.name}</strong>
              <small>{batchLabel(u)}</small>
            </Link>
            <ActionForm action={connectAction} showDone={false}>
              <input type="hidden" name="id" value={u.id} />
              <button className="pill-button" type="submit">
                <Icon name="plus" size={14} /> Connect
              </button>
            </ActionForm>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function GroupsCard({ groups }: { groups: Group[] }) {
  if (!groups.length) return null;
  return (
    <section className="sheet more-card more-card--narrow" aria-label="Groups to join">
      <h2 className="more-card__title">Groups to join</h2>
      <ul className="more-card__list">
        {groups.map((g) => (
          <li key={g.id}>
            <Link href={`/groups/${g.id}`}>{g.name}</Link>
            <small>
              {g.members} {g.members === 1 ? "member" : "members"} · {g.kind}
            </small>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** For alumni and teachers: students' questions that fit them, still waiting. */
export function AsksCard({ asks }: { asks: Ask[] }) {
  if (!asks.length) return null;
  return (
    <section className="sheet more-card" aria-label="Questions waiting for a senior">
      <h2 className="more-card__title">Students are asking</h2>
      <ul className="more-card__list">
        {asks.map((a) => (
          <li key={a.id}>
            <Link href={`/ask/${a.id}`}>{a.title}</Link>
            <small>{a.author.name} · waiting for a senior</small>
          </li>
        ))}
      </ul>
    </section>
  );
}
