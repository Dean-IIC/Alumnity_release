import Link from "next/link";
import type { Metadata } from "next";
import { BackLink } from "../../components/back-link";
import { PhotoGrid } from "../../components/gallery/photo-grid";
import { SiteFooter } from "../../components/site-footer";
import { SiteHeader } from "../../components/site-header";
import { VisitorOnly } from "../../components/visitor-only";
import { STORY_KIND_LABEL, stories, storyDate, videos } from "../../lib/server/news";
import "../styles/gallery.css";
import "../styles/news.css";

export const metadata: Metadata = {
  title: "News & videos · Alumnity",
  description: "News from HKBK College of Engineering, alumni stories, notices, and the college's videos."
};

// The college desk adds to these: read on each visit.
export const dynamic = "force-dynamic";

/** The college's news, alumni stories and notices, and its videos, in the gallery's setting. */
export default async function NewsPage() {
  const [list, films] = await Promise.all([stories(), videos()]);
  return (
    <>
      <VisitorOnly>
        <SiteHeader current="news" />
      </VisitorOnly>
      <main className="gallery news container">
        <BackLink fallback="/" label="Home" />
        <header className="page-head">
          <p className="kicker">News &amp; videos</p>
          <h1 className="page-title">
            What’s new at <span className="page-title__gold">HKBK</span>
          </h1>
          <p className="page-head__text">News from the college, stories of its alumni, notices, and the college’s own videos.</p>
        </header>

        <section className="news__section" aria-labelledby="news-videos" id="videos">
          <h2 id="news-videos" className="news__h2">
            Videos
          </h2>
          {films.length ? (
            <PhotoGrid title="Videos" parts={[{ when: "", source: null, photos: [], videos: films }]} />
          ) : (
            <p className="news__empty">No videos yet.</p>
          )}
        </section>

        <section className="news__section" aria-labelledby="news-stories" id="stories">
          <h2 id="news-stories" className="news__h2">
            News and stories
          </h2>
          {list.length ? (
            <ul className="news-list">
              {list.map((s) => (
                <li key={s.slug}>
                  <Link href={`/news/${s.slug}`} className={`news-card ${s.cover ? "" : "news-card--plain"}`}>
                    {s.cover && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="news-card__cover" src={s.cover} alt="" loading="lazy" />
                    )}
                    <span className="news-card__body">
                      <span className="news-card__meta">
                        <span className={`news-card__kind news-card__kind--${s.kind}`}>{STORY_KIND_LABEL[s.kind]}</span>
                        {s.date && <span>{storyDate(s.date)}</span>}
                        {s.pinned && <span className="news-card__pin">Pinned</span>}
                      </span>
                      <strong className="news-card__title">{s.title}</strong>
                      {s.summary && <span className="news-card__summary">{s.summary}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="news__empty">No news yet.</p>
          )}
        </section>
      </main>
      <VisitorOnly>
        <SiteFooter />
      </VisitorOnly>
    </>
  );
}
