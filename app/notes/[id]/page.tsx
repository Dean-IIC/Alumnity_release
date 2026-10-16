import type { Metadata } from "next";
import { BackLink } from "../../../components/back-link";
import { notFound } from "next/navigation";
import { AppPage } from "../../../components/app/app-page";
import { Post } from "../../../components/social/post";
import { postFor } from "../../../lib/server/posts";
import { photoIdsOf } from "../../../lib/server/profile";
import { requireUser } from "../../../lib/server/session";

export const metadata: Metadata = { title: "A note · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

/** One note with all its comments (the board shows only the newest few). */
export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const me = await requireUser(`/notes/${raw}`);
  const id = Number(raw);
  const post = Number.isSafeInteger(id) && id > 0 ? await postFor(me, id) : null;
  if (!post) notFound();
  return (
    <AppPage user={me} current="home" bare>
      <div className="feed-layout feed-layout--single">
        <div className="feed-layout__main">
          <BackLink fallback="/home" label="Back" />
          <h1 className="sr-only">A post by {post.author.name}</h1>
          <Post post={post} full me={me} photos={await photoIdsOf([me.id, post.author.id, ...post.comments.map((c) => c.author.id)])} />
        </div>
      </div>
    </AppPage>
  );
}
