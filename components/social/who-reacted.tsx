"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Reaction } from "../../lib/server/posts";
import { Avatar } from "./avatar";
import { Sheet } from "./sheet";
import "../../app/styles/posts-plus.css";
import { REACTION_LABEL, REACTION_ORDER, Stamp } from "./stamps";

type Person = { id: number; name: string; line: string; kind: Reaction; photo: string | null };

/**
 * Who reacted to a post, as LinkedIn shows it: everyone, or one reaction at a time, each
 * person with their face, name, batch and how they reacted. Read when it opens (and only
 * then), from /api/posts/[id]/reactions, which checks the reader may see the post.
 */
export function WhoReacted({ postId, open, onClose }: { postId: number; open: boolean; onClose: () => void }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [only, setOnly] = useState<Reaction | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setFailed(false);
    fetch(`/api/posts/${postId}/reactions`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => live && (d.ok ? setPeople(d.people) : setFailed(true)))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [open, postId]);

  const kinds = REACTION_ORDER.filter((k) => people?.some((p) => p.kind === k));
  const shown = (people ?? []).filter((p) => !only || p.kind === only);

  return (
    <Sheet open={open} onClose={onClose} title="Reactions" className="who-reacted" focusField={false}>
      {people && people.length > 0 && (
        <div className="who-reacted__tabs" role="tablist" aria-label="Which reaction">
          <button type="button" role="tab" aria-selected={only === null} onClick={() => setOnly(null)}>
            All {people.length}
          </button>
          {kinds.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={only === k} onClick={() => setOnly(k)} aria-label={`${REACTION_LABEL[k]}: ${people.filter((p) => p.kind === k).length}`}>
              <Stamp kind={k} size={18} /> {people.filter((p) => p.kind === k).length}
            </button>
          ))}
        </div>
      )}
      {failed ? (
        <p className="sheet__note">Couldn't load who reacted. Close this and try again.</p>
      ) : people === null ? (
        <p className="sheet__note" role="status">
          Loading…
        </p>
      ) : people.length === 0 ? (
        <p className="sheet__note">No reactions yet.</p>
      ) : (
        <ul className="who-reacted__list">
          {shown.map((p) => (
            <li key={p.id}>
              <Link href={`/people/${p.id}`} className="who-reacted__person">
                <span className="who-reacted__face">
                  <Avatar name={p.name} photoId={p.photo} size={44} />
                  <Stamp kind={p.kind} size={18} className="who-reacted__stamp" />
                </span>
                <span>
                  <strong>{p.name}</strong>
                  {p.line && <small>{p.line}</small>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
