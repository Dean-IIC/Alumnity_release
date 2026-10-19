import Link from "next/link";
import { ActionForm } from "../app/action-form";
import { ConfirmDelete } from "./confirm-delete";
import { PageEditor } from "./page-editor";
import { PhotoUpload } from "./photo-upload";
import { coverAction, createAlbumAction, deleteAlbumAction, deletePhotoAction, movePhotoAction, updateAlbumAction, updatePhotoAction } from "../../lib/actions/showcase";
import { timeAgo } from "../../lib/format";
import type { User } from "../../lib/server/auth";
import { ALBUM_LIMITS, deskAlbum, deskAlbums, type DeskAlbum } from "../../lib/server/showcase";
import { deskPages } from "../../lib/server/site-pages";
import { pageDef } from "../../lib/site-pages";

/*
 * The college desk's Showcase tab: what the public pages show. The gallery's albums and
 * photos, and the college's own words on the About, Community and Committee pages. Kept in
 * the database's `site` schema, apart from members' things. Every change is in the audit log.
 */

const tagOf = (a: DeskAlbum) =>
  a.showing ? { text: "On the gallery", red: false } : !a.published ? { text: "Hidden", red: true } : { text: "No photos yet", red: true };

/** The album's details, for making one or changing it. */
function AlbumFields({ album }: { album?: DeskAlbum }) {
  return (
    <>
      <label className="field">
        <span className="field__label">Name</span>
        <input name="title" required maxLength={ALBUM_LIMITS.title} defaultValue={album?.title} placeholder="e.g. Alumni meet 2026" />
      </label>
      <div className="field-row">
        <label className="field">
          <span className="field__label">Date</span>
          <input name="date" maxLength={10} defaultValue={album?.date} placeholder="2026-12-14" pattern="\d{4}(-\d{2}(-\d{2})?)?" />
          <span className="wf-muted">Year-month-day, or just the year. Albums go newest first.</span>
        </label>
        <label className="field">
          <span className="field__label">When, in words</span>
          <input name="when" maxLength={ALBUM_LIMITS.when} defaultValue={album?.when} placeholder="14 December 2026" />
          <span className="wf-muted">Leave empty to use the date.</span>
        </label>
      </div>
      <label className="field">
        <span className="field__label">About the album</span>
        <textarea name="about" rows={3} maxLength={ALBUM_LIMITS.about} defaultValue={album?.about} />
      </label>
      <label className="wf-check">
        <input type="checkbox" name="published" defaultChecked={album ? album.published : false} />
        <span>Show on the gallery (once it has a photo)</span>
      </label>
    </>
  );
}

function Overview({ albums, pages }: { albums: DeskAlbum[]; pages: Awaited<ReturnType<typeof deskPages>> }) {
  return (
    <>
      <section className="wf-card" aria-labelledby="showcase-albums">
        <h2 id="showcase-albums">Gallery albums</h2>
        <p className="wf-muted">
          The albums on the public <Link href="/gallery">gallery</Link>. Open one to change its details or its photos.
        </p>
        {albums.length === 0 && <p className="wf-empty">No albums yet.</p>}
        <ul className="wf-list showcase-albums">
          {albums.map((a) => {
            const tag = tagOf(a);
            return (
              <li key={a.id} className="showcase-albums__item">
                {a.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.thumb} alt="" width={96} height={64} loading="lazy" />
                ) : (
                  <span className="showcase-albums__empty" aria-hidden="true" />
                )}
                <span className="showcase-albums__words">
                  <strong>{a.title}</strong>
                  <span className="wf-muted">
                    {a.when || "No date"} · {a.photos === 1 ? "1 photo" : `${a.photos} photos`}
                  </span>
                </span>
                <span className={`wf-tag ${tag.red ? "wf-tag--red" : ""}`}>{tag.text}</span>
                <Link className="button button--secondary wf-small" href={`/desk?tab=showcase&album=${a.id}`}>
                  Edit
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="wf-card" aria-labelledby="showcase-new">
        <h2 id="showcase-new">New album</h2>
        <ActionForm action={createAlbumAction} className="wf-stack">
          <AlbumFields />
          <div className="wf-actions">
            <button className="button button--primary" type="submit">
              Make album
            </button>
          </div>
        </ActionForm>
      </section>

      <section className="wf-card" aria-labelledby="showcase-pages">
        <h2 id="showcase-pages">Pages</h2>
        <p className="wf-muted">The college&apos;s own words on the public pages.</p>
        <ul className="wf-list showcase-albums">
          {pages.map((p) => (
            <li key={p.slug} className="showcase-albums__item">
              <span className="showcase-albums__words">
                <strong>{p.title}</strong>
                <span className="wf-muted">
                  {p.where}
                  {p.updatedAt ? ` · changed ${timeAgo(p.updatedAt)}${p.editedBy ? ` by ${p.editedBy}` : ""}` : " · the original words"}
                </span>
              </span>
              <Link className="button button--secondary wf-small" href={`/desk?tab=showcase&page=${p.slug}`}>
                Edit
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="wf-card" aria-labelledby="showcase-notices">
        <h2 id="showcase-notices">Notices</h2>
        <p className="wf-muted">
          Notices at the top of members&apos; Home are in the <Link href="/desk?tab=announcements">Announcements</Link> tab.
        </p>
      </section>
    </>
  );
}

async function AlbumEditor({ me, id }: { me: User; id: number }) {
  const album = await deskAlbum(me, id);
  if (!album) {
    return (
      <section className="wf-card">
        <p className="wf-empty">That album is gone.</p>
        <Link href="/desk?tab=showcase">← All albums</Link>
      </section>
    );
  }
  const tag = tagOf(album);
  return (
    <>
      <p>
        <Link className="wf-inline-link" href="/desk?tab=showcase">
          ← All albums
        </Link>
      </p>
      <section className="wf-card" aria-labelledby="album-details">
        <div className="wf-card__meta">
          <span className={`wf-tag ${tag.red ? "wf-tag--red" : ""}`}>{tag.text}</span>
          {album.showing && <Link href={`/gallery/${album.slug}`}>See it on the gallery</Link>}
        </div>
        <h2 id="album-details">Album details</h2>
        <ActionForm action={updateAlbumAction} className="wf-stack">
          <input type="hidden" name="id" value={album.id} />
          <AlbumFields album={album} />
          <div className="wf-actions">
            <button className="button button--primary" type="submit">
              Save
            </button>
          </div>
        </ActionForm>
      </section>

      <section className="wf-card" aria-labelledby="album-add">
        <h2 id="album-add">Add photos</h2>
        <PhotoUpload album={album.id} parts={album.parts} />
      </section>

      <section className="wf-card" aria-labelledby="album-photos">
        <h2 id="album-photos">Photos · {album.list.length}</h2>
        {album.list.length === 0 && <p className="wf-empty">No photos yet. Add some above.</p>}
        <ol className="wf-list showcase-photos">
          {album.list.map((p, i) => (
            <li key={p.id} className="showcase-photo">
              <a className="showcase-photo__image" href={p.src} target="_blank" rel="noopener noreferrer" aria-label={`Open photo ${i + 1} larger`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumb} alt={p.alt} width={p.width} height={p.height} loading="lazy" />
              </a>
              <div className="showcase-photo__body">
                <div className="wf-card__meta">
                  <span>Photo {i + 1}</span>
                  {p.part && <span>{p.part}</span>}
                  {p.cover && <span className="wf-tag">Cover</span>}
                </div>
                <ActionForm action={updatePhotoAction} className="wf-stack">
                  <input type="hidden" name="id" value={p.id} />
                  <label className="field">
                    <span className="field__label">What it shows (for people who can&apos;t see it)</span>
                    <input name="alt" required minLength={3} maxLength={ALBUM_LIMITS.alt} defaultValue={p.alt} />
                  </label>
                  <label className="field">
                    <span className="field__label">Caption on the photo (optional)</span>
                    <input name="caption" maxLength={ALBUM_LIMITS.caption} defaultValue={p.caption} />
                  </label>
                  <div className="wf-actions">
                    <button className="button button--primary wf-small" type="submit">
                      Save words
                    </button>
                  </div>
                </ActionForm>
                <div className="wf-actions showcase-photo__tools">
                  <ActionForm action={movePhotoAction} showDone={false}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="by" value="-1" />
                    <button className="button button--secondary wf-small" type="submit" disabled={i === 0}>
                      Move up
                    </button>
                  </ActionForm>
                  <ActionForm action={movePhotoAction} showDone={false}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="by" value="1" />
                    <button className="button button--secondary wf-small" type="submit" disabled={i === album.list.length - 1}>
                      Move down
                    </button>
                  </ActionForm>
                  {!p.cover && (
                    <ActionForm action={coverAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="button button--secondary wf-small" type="submit">
                        Make cover
                      </button>
                    </ActionForm>
                  )}
                  <ConfirmDelete action={deletePhotoAction} id={p.id} label="Delete photo" title="Delete this photo?" confirm="Delete">
                    It comes off the gallery at once, and can&apos;t be brought back.
                  </ConfirmDelete>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="wf-card" aria-labelledby="album-delete">
        <h2 id="album-delete">Delete the album</h2>
        <p className="wf-muted">To take it off the gallery for now, untick &ldquo;Show on the gallery&rdquo; above instead.</p>
        <ConfirmDelete action={deleteAlbumAction} id={album.id} label="Delete album" title={`Delete “${album.title}”?`} confirm="Delete album">
          The album and its {album.list.length === 1 ? "photo" : `${album.list.length} photos`} come off the gallery and can&apos;t be brought back.
        </ConfirmDelete>
      </section>
    </>
  );
}

async function PageEdit({ me, slug }: { me: User; slug: string }) {
  const def = pageDef(slug);
  const page = def ? (await deskPages(me)).find((p) => p.slug === def.slug) : undefined;
  return (
    <>
      <p>
        <Link className="wf-inline-link" href="/desk?tab=showcase">
          ← Gallery and pages
        </Link>
      </p>
      {!page ? (
        <section className="wf-card">
          <p className="wf-empty">There&apos;s no such page.</p>
        </section>
      ) : (
        <>
          <section className="wf-card">
            <h2>{page.title}</h2>
            <p className="wf-muted">On the {page.where}.</p>
          </section>
          <PageEditor key={page.slug} slug={page.slug} kind={page.kind} body={page.body} signerName={page.signerName} signerRole={page.signerRole} />
        </>
      )}
    </>
  );
}

export async function Showcase({ me, album, page }: { me: User; album?: number; page?: string }) {
  if (album) return <AlbumEditor me={me} id={album} />;
  if (page) return <PageEdit me={me} slug={page} />;
  const [albums, pages] = await Promise.all([deskAlbums(me), deskPages(me)]);
  return <Overview albums={albums} pages={pages} />;
}
