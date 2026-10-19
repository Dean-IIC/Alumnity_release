"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { peopleHref, type PeopleQuery } from "../../lib/people-href";
import { Icon } from "../social/icons";

/*
 * People's search: one big rounded bar that searches as you type (a short pause first, so
 * each keystroke isn't a search), and the filters as small chips and a "Filters" panel
 * instead of a form of labelled dropdowns. Before the page's scripts load (or without
 * them) it's a plain GET form to /people, and every chip is a plain link.
 */

/** Wait this long after the last keystroke before searching. */
const PAUSE = 400;

export function PeopleSearch({
  query,
  branches,
  myBatch
}: {
  query: PeopleQuery;
  branches: readonly (readonly [string, string])[];
  /** The viewer's own branch and joining year, for the "My batch" chip (absent if unknown). */
  myBatch?: { branch: string; year: number };
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const filters = useRef<HTMLDetailsElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(query.q);
  const typing = useRef(false);

  // When the address changes from elsewhere (a chip, "clear", back), show its words, unless
  // the member is mid-word in the box (then what they're typing wins).
  useEffect(() => {
    if (!typing.current) setText(query.q);
  }, [query.q]);
  useEffect(() => () => clearTimeout(timer.current), []);

  /** Search with what's in the form now (`q` given: with those words instead of the box's). */
  const go = (q?: string) => {
    clearTimeout(timer.current);
    if (!form.current) return;
    const data = new FormData(form.current);
    const year = Number(data.get("year"));
    const href = peopleHref({
      q: q ?? String(data.get("q") ?? ""),
      branch: String(data.get("branch") ?? "") || undefined,
      year: Number.isInteger(year) && year >= 1997 && year <= 2100 ? year : undefined,
      help: (String(data.get("help") ?? "") || undefined) as PeopleQuery["help"]
    });
    startTransition(() => router.replace(href, { scroll: false }));
  };

  const later = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      typing.current = false;
      go();
    }, PAUSE);
  };

  const active = [query.branch, query.year, query.help].filter(Boolean).length;
  const branchName = branches.find(([code]) => code === query.branch)?.[1];
  const isMyBatch = Boolean(myBatch && query.branch === myBatch.branch && query.year === myBatch.year);

  return (
    <form
      ref={form}
      className="people-search"
      role="search"
      aria-label="Find people"
      action="/people"
      data-pending={pending || undefined}
      onSubmit={(event) => {
        event.preventDefault();
        typing.current = false;
        if (filters.current) filters.current.open = false;
        go();
      }}
    >
      <div className="people-search__bar">
        <Icon name="search" size={20} className="people-search__icon" />
        <input
          className="people-search__input"
          type="search"
          name="q"
          value={text}
          maxLength={100}
          autoComplete="off"
          enterKeyHint="search"
          aria-label="Search people by name, USN, company, city or skill"
          placeholder="Search by name, USN, company, city or skill"
          onChange={(event) => {
            const value = event.target.value;
            setText(value);
            typing.current = true;
            // One letter finds nothing on the register and too much among members: wait for two.
            if (value.trim().length === 1) return clearTimeout(timer.current);
            later();
          }}
        />
        {text && (
          <button
            type="button"
            className="people-search__clear"
            aria-label="Clear the search"
            onClick={() => {
              setText("");
              typing.current = false;
              // Search with what's left (the filters): the box's old words are still in the DOM until React draws again.
              go("");
            }}
          >
            <Icon name="close" size={16} />
          </button>
        )}
        <button type="submit" className="people-search__go">
          Search
        </button>
      </div>

      <div className="people-chips" aria-label="Filters">
        <details className="people-filters" ref={filters}>
          <summary className={`people-chip people-chip--filters${active ? " is-on" : ""}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
              <circle cx="16" cy="7" r="2" />
              <circle cx="10" cy="17" r="2" />
            </svg>
            Filters{active ? ` · ${active}` : ""}
          </summary>
          <div
            className="people-filters__panel"
            onChange={(event) => {
              // A branch or "happy to" picked: search straight away (the year waits for four digits).
              if ((event.target as HTMLInputElement).type === "radio") go();
            }}
          >
            <fieldset className="people-filters__group">
              <legend>Branch</legend>
              <div className="people-filters__pills">
                <label className="people-pill">
                  <input type="radio" name="branch" value="" defaultChecked={!query.branch} key={`b-any-${query.branch ?? ""}`} />
                  <span>Any</span>
                </label>
                {branches.map(([code, name]) => (
                  <label key={code} className="people-pill">
                    <input type="radio" name="branch" value={code} defaultChecked={query.branch === code} key={`b-${code}-${query.branch ?? ""}`} />
                    <span>{name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="people-filters__group">
              <legend>Joined HKBK in</legend>
              <input
                className="people-filters__year"
                name="year"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                placeholder="Any year, e.g. 2012"
                defaultValue={query.year ?? ""}
                key={`y-${query.year ?? ""}`}
                aria-label="Joining year"
                onChange={(event) => {
                  const v = event.target.value;
                  if (v === "" || /^\d{4}$/.test(v)) later();
                }}
              />
            </fieldset>
            <fieldset className="people-filters__group">
              <legend>Happy to</legend>
              <div className="people-filters__pills">
                {(
                  [
                    ["", "Anything"],
                    ["mentor", "Mentor"],
                    ["refer", "Refer"],
                    ["talk", "Have a chat"]
                  ] as const
                ).map(([value, label]) => (
                  <label key={value || "any"} className="people-pill">
                    <input type="radio" name="help" value={value} defaultChecked={(query.help ?? "") === value} key={`h-${value}-${query.help ?? ""}`} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="people-filters__end">
              <button type="submit" className="people-btn people-btn--primary">
                Show people
              </button>
              {active > 0 && (
                <Link className="people-filters__reset" href={peopleHref({ q: query.q })} scroll={false}>
                  Clear filters
                </Link>
              )}
            </div>
          </div>
        </details>

        {myBatch && (
          <Link
            className={`people-chip${isMyBatch ? " is-on" : ""}`}
            href={peopleHref(isMyBatch ? { q: query.q, help: query.help } : { ...query, branch: myBatch.branch, year: myBatch.year })}
            scroll={false}
            aria-current={isMyBatch || undefined}
          >
            My batch
          </Link>
        )}
        <Link
          className={`people-chip${query.help === "mentor" ? " is-on" : ""}`}
          href={peopleHref({ ...query, help: query.help === "mentor" ? undefined : "mentor" })}
          scroll={false}
          aria-current={query.help === "mentor" || undefined}
        >
          Mentors
        </Link>
        <Link
          className={`people-chip${query.help === "refer" ? " is-on" : ""}`}
          href={peopleHref({ ...query, help: query.help === "refer" ? undefined : "refer" })}
          scroll={false}
          aria-current={query.help === "refer" || undefined}
        >
          Can refer
        </Link>

        {/* What's narrowing the search now, each with a × to take it off. */}
        {query.branch && !isMyBatch && (
          <Link className="people-chip people-chip--set" href={peopleHref({ ...query, branch: undefined })} scroll={false} aria-label={`Remove the branch filter: ${branchName}`}>
            {branchName ?? query.branch} <span aria-hidden="true">×</span>
          </Link>
        )}
        {query.year && !isMyBatch && (
          <Link className="people-chip people-chip--set" href={peopleHref({ ...query, year: undefined })} scroll={false} aria-label={`Remove the year filter: ${query.year}`}>
            Joined {query.year} <span aria-hidden="true">×</span>
          </Link>
        )}
        {query.help === "talk" && (
          <Link className="people-chip people-chip--set" href={peopleHref({ ...query, help: undefined })} scroll={false} aria-label="Remove the filter: up for a chat">
            Up for a chat <span aria-hidden="true">×</span>
          </Link>
        )}
      </div>
    </form>
  );
}
