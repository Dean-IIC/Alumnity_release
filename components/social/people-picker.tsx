"use client";

import { useEffect, useId, useState } from "react";
import { myConnectionsAction } from "../../lib/actions/social";
import { matchesSearch, type PickPerson } from "../../lib/people-pick";
import { Avatar } from "./avatar";
import { Icon } from "./icons";

/** Fetched once per page, the first time any picker opens, and shared after that. */
let connections: Promise<PickPerson[]> | null = null;
const loadConnections = () => (connections ??= myConnectionsAction().catch(() => ((connections = null), [])));

type Props = {
  /** Ids ticked so far. */
  chosen: number[];
  onChange: (chosen: PickPerson[]) => void;
  /** At most this many may be ticked. */
  max: number;
  /** What the list is for, for screen readers ("Send to", "Tag"). */
  label: string;
};

/**
 * The viewer's connections with a search box, each with a tick box: for sending a post
 * privately and for tagging people in one. Only connections are offered, because only
 * they can be messaged (and they're the people one usually tags).
 */
export function PeoplePicker({ chosen, onChange, max, label }: Props) {
  const [people, setPeople] = useState<PickPerson[] | null>(null);
  const [typed, setTyped] = useState("");
  const searchId = useId();

  useEffect(() => {
    let live = true;
    loadConnections().then((list) => live && setPeople(list));
    return () => {
      live = false;
    };
  }, []);

  const shown = (people ?? []).filter((p) => matchesSearch(p, typed));
  const full = chosen.length >= max;

  const toggle = (p: PickPerson) => {
    const all = people ?? [];
    const next = chosen.includes(p.id) ? chosen.filter((id) => id !== p.id) : full ? chosen : [...chosen, p.id];
    onChange(next.flatMap((id) => all.filter((x) => x.id === id)));
  };

  return (
    <div className="picker">
      <label className="picker__search" htmlFor={searchId}>
        <Icon name="search" size={18} />
        <span className="sr-only">Search your connections</span>
        <input id={searchId} type="search" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Search your connections"
          autoComplete="off"
          autoFocus
          // The picker can sit inside a form (the composer's): Enter here mustn't post it.
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
        />
      </label>
      {people === null ? (
        <p className="picker__note" role="status">
          Loading your connections…
        </p>
      ) : people.length === 0 ? (
        <p className="picker__note">You haven&apos;t connected with anyone yet. Connect with people to send them posts and tag them.</p>
      ) : shown.length === 0 ? (
        <p className="picker__note" role="status">
          No connection matches &ldquo;{typed}&rdquo;.
        </p>
      ) : (
        <fieldset className="picker__list">
          <legend className="sr-only">{label}</legend>
          {shown.map((p) => {
            const on = chosen.includes(p.id);
            return (
              <label key={p.id} className={`picker__person ${on ? "picker__person--on" : ""}`}>
                <input type="checkbox" checked={on} disabled={!on && full} onChange={() => toggle(p)} />
                <Avatar name={p.name} photoId={p.photo} size={36} />
                <span className="picker__who">
                  <strong>{p.name}</strong>
                  {p.batch && <span>{p.batch}</span>}
                </span>
              </label>
            );
          })}
        </fieldset>
      )}
      {full && (
        <p className="picker__note" role="status">
          You can choose up to {max} people.
        </p>
      )}
    </div>
  );
}
