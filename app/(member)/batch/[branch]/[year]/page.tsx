import Link from "next/link";
import type { Metadata } from "next";
import { photoIdsOf } from "../../../../../lib/server/profile";
import { notFound } from "next/navigation";
import { ActionForm } from "../../../../../components/app/action-form";
import { Invite } from "../../../../../components/app/invite";
import { AppPage } from "../../../../../components/app/app-page";
import { MemberLine } from "../../../../../components/app/member-line";
import { PostCard } from "../../../../../components/app/post-card";
import { connectAction } from "../../../../../lib/actions/social";
import { BRANCHES, isBranch } from "../../../../../lib/branches";
import { batchMembers, blockIds, relationsOf } from "../../../../../lib/server/people";
import { feedFor } from "../../../../../lib/server/posts";
import { batchCount } from "../../../../../lib/server/register";
import { requireUser } from "../../../../../lib/server/session";

export const metadata: Metadata = { title: "A batch · Alumnity", robots: { index: false } };
export const dynamic = "force-dynamic";

const RELATION_LABEL: Record<string, string> = { connected: "Connected", sent: "Request sent", received: "Wants to connect", self: "You" };

/** One batch: how many joined HKBK that year (a count from the register, never names), who's here, and their notes. */
const PAGE = 50;

export default async function BatchPage({ params, searchParams }: { params: Promise<{ branch: string; year: string }>; searchParams: Promise<{ page?: string }> }) {
  const { branch: rawBranch, year: rawYear } = await params;
  const page = Math.max(1, Math.min(1000, Math.floor(Number((await searchParams).page)) || 1));
  const branch = decodeURIComponent(rawBranch);
  const year = Number(rawYear);
  const me = await requireUser(`/batch/${rawBranch}/${rawYear}`);
  if (!isBranch(branch) || !Number.isInteger(year) || year < 1997 || year > new Date().getFullYear()) notFound();
  const name = BRANCHES.find(([c]) => c === branch)![1];
  const course = me.branch === branch && me.joined === year && me.programme ? me.programme : branch === "GEN" ? "MBA" : "B.Tech";
  const [onRegister, everyone, blocked, relationTo] = await Promise.all([batchCount(branch, year, course), batchMembers(branch, year), blockIds(me.id), relationsOf(me.id)]);
  const members = everyone.filter((u) => u.id === me.id || !blocked.has(u.id));
  const photos = await photoIdsOf(members.map((u) => u.id));
  const ids = new Set(members.map((u) => u.id));
  const notes = await feedFor(me, { authorIds: [...ids], limit: 10 });
  const mine = me.branch === branch && me.joined === year;

  return (
    <AppPage
      user={me}
      current="batch"
      back={{ href: "/batch", label: "Batches" }}
      title={`${name}, ${year}`}
      intro={`${onRegister ? `${onRegister} joined HKBK in this batch` : "This batch"} · ${members.length} ${members.length === 1 ? "is" : "are"} on Alumnity`}
    >
      {mine && (onRegister > members.length || members.length <= 1) && (
        <div className="wf-card">
          <p>
            {onRegister > members.length ? `${onRegister - members.length} from your batch aren't here yet.` : "Nobody else from your batch is here yet."} Tell them they can{" "}
            <Link className="wf-inline-link" href="/join">
              join with their name and USN
            </Link>
            .{onRegister > 0 ? " Their names are already in the register." : ""}
          </p>
          <Invite text="I'm on Alumnity, HKBK College of Engineering's alumni network. Find your name in the register and join:" />
        </div>
      )}
      <h2>On Alumnity</h2>
      {members.length === 0 ? (
        <p className="wf-empty">Nobody from this batch has joined yet.</p>
      ) : (
        <ul className="wf-list">
          {members.slice((page - 1) * PAGE, page * PAGE).map((u) => {
            const rel = relationTo(u.id);
            return (
              <MemberLine key={u.id} member={u} photoId={photos.get(u.id)}>
                {RELATION_LABEL[rel] ? (
                  <span className="wf-tag">{RELATION_LABEL[rel]}</span>
                ) : (
                  <ActionForm action={connectAction}>
                    <input type="hidden" name="id" value={u.id} />
                    <button className="button button--secondary wf-small" type="submit">
                      Connect
                    </button>
                  </ActionForm>
                )}
              </MemberLine>
            );
          })}
        </ul>
      )}
      {members.length > PAGE && (
        <div className="wf-actions" style={{ justifyContent: "space-between" }}>
          {page > 1 ? <a href={`?page=${page - 1}`}>← Previous</a> : <span />}
          <span className="wf-muted">
            {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, members.length)} of {members.length}
          </span>
          {page * PAGE < members.length ? <a href={`?page=${page + 1}`}>Next →</a> : <span />}
        </div>
      )}
      {notes.length > 0 && (
        <>
          <h2>Posts from this batch</h2>
          {notes.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </>
      )}
    </AppPage>
  );
}
