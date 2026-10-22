import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "../../../components/back-link";
import { PhotoGrid } from "../../../components/gallery/photo-grid";
import { SiteFooter } from "../../../components/site-footer";
import { SiteHeader } from "../../../components/site-header";
import { VisitorOnly } from "../../../components/visitor-only";
import { STORY_KIND_LABEL, storyBySlug, storyDate } from "../../../lib/server/news";
import { parseVideoLink } from "../../../lib/video";
import "../../styles/gallery.css";
import "../../styles/news.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const story = await storyBySlug((await params).slug);
  return story ? { title: `${story.title} · Alumnity`, description: story.summary } : { title: "News · Alumnity" };
}

/** One story: its picture, its words, and its video if it has one. */
export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const story = await storyBySlug((await params).slug);
  if (!story) notFound();
  let video = null;
  try {
    video = story.videoUrl ? { ...parseVideoLink(story.videoUrl), title: story.title } : null;
  } catch {
    video = null;
  }
  return (
    <>
      <VisitorOnly>
        <SiteHeader current="news" />
      </VisitorOnly>
      <main className="gallery news container">
        <BackLink fallback="/news" label="News & videos" />
        <article className="news-story">
          <p className="news-card__meta">
            <span className={`news-card__kind news-card__kind--${story.kind}`}>{STORY_KIND_LABEL[story.kind]}</span>
            {story.date && <span>{storyDate(story.date)}</span>}
          </p>
          <h1 className="page-title news-story__title">{story.title}</h1>
          {story.summary && <p className="news-story__lead">{story.summary}</p>}
          {story.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="news-story__cover" src={story.cover} alt="" />
          )}
          <div className="news-story__body">
            {story.body
              .split(/\n\s*\n/)
              .map((p) => p.trim())
              .filter(Boolean)
              .map((p, i) => (
                <p key={i}>{p}</p>
              ))}
          </div>
          {video && <PhotoGrid title={story.title} parts={[{ when: "", source: null, photos: [], videos: [video] }]} />}
        </article>
      </main>
      <VisitorOnly>
        <SiteFooter />
      </VisitorOnly>
    </>
  );
}
