"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { cleanQuery, feedHref, filterCount, MAX_FILTER_AUTHORS, MAX_FILTER_TAGS, NO_FILTERS, ROLE_FILTERS, type FeedFilters, type RoleFilter } from "../../lib/feed-filters";
import { Icon } from "../social/icons";
import "../../app/styles/post-filters.css";

/*
 * Home's filter bar: a search box for words and #tags, then chips for topics, for who wrote
 * it (alumni, students, faculty, the college), and for named people (a small typeahead).
 * Every choice is a change of address, so a filtered feed can be shared, and back and
 * forward step through them. Before the page's scripts load the box is a plain GET form,
 * and every chip a plain link.
 *
 * It folds away. Folded, it's one slim bar: the search box, and either a Filters button
 * (nothing chosen) or the chosen filters as a few chips ("#job", "Alumni", "Priya S.", then
 * "+2"); tapping that opens the whole panel, and "Hide filters" folds it again. It starts
 * folded on a phone, and anywhere once a filter is on (so the posts come first); on a wider
 * screen with nothing chosen it starts open. Once the reader opens or closes it, it stays
 * as they left it while they pick.
 */

type Person = { id: number; name: string; batch?: string };

/** Wait this long after the last keystroke before searching. */
const PAUSE = 500;
/** Chosen filters shown on the folded bar before "+N". */
const FOLDED_CHIPS = 3;
/** Where the bar starts folded whatever is chosen (as in post-filters.css). */
const PHONE = "(max-width: 640px)";

/** "Priya Sharma" → "Priya S.": short enough for a chip. */
const shortName = (name: string) => {
  const words = name.trim().split(/\s+/);
  return words.length > 1 ? `${words[0]} ${words[words.length - 1][0]}.` : name;
};

/** The toggle's chevron: down when folded, up when open (turned in CSS). */
const Chevron = () => (
  <svg className="post-filters__chevron" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export function FeedFilterBar({
  filters,
  view,
  topics,
  people
}: {
  filters: FeedFilters;
  view: "all" | "following" | "college" | "members";
  /** The topic chips: the most used #tags lately, then the work ones. */
  topics: string[];
  /** The people in `filters.authors`, with their names (anyone the viewer may not see is left out). */
  people: Person[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(filters.q);
  // Open or folded as the reader left it; null until they choose (then it's the default).
  const [open, setOpen] = useState<boolean | null>(null);
  // Whether this is a phone: unknown until the page's scripts run (CSS decides till then).
  const [phone, setPhone] = useState<boolean | null>(null);
  const typing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const bar = useRef<HTMLElement>(null);
  const panelId = useId();
  const count = filterCount(filters);
  const href = (f: Partial<FeedFilters>) => feedHref({ ...filters, ...f }, { view });
  const here = href({});

  useEffect(() => {
    const narrow = window.matchMedia(PHONE);
    const check = () => setPhone(narrow.matches);
    check();
    narrow.addEventListener("change", check);
    return () => narrow.removeEventListener("change", check);
  }, []);
  // Open by default only on a wider screen with nothing chosen.
  const expanded = open ?? (phone === null ? null : count === 0 && !phone);
  // What the toggle says before the scripts know the screen: what CSS shows on a wide one.
  const shownOpen = expanded ?? count === 0;

  // The chosen filters, as the folded bar shows them (the words are in the box already).
  const chosen = [
    ...filters.tags.map((t) => `#${t}`),
    ...filters.roles.map((r) => ROLE_FILTERS.find(([v]) => v === r)?.[1] ?? r),
    ...people.map((p) => shortName(p.name))
  ];
  const more = chosen.length - FOLDED_CHIPS;

  // When the address changes from elsewhere (a chip, "Clear filters", back), show its words,
  // unless the member is mid-word in the box (then what they're typing wins).
  useEffect(() => {
    if (!typing.current) setText(filters.q);
  }, [filters.q]);
  useEffect(() => () => clearTimeout(timer.current), []);

  /** Searches for `q`: typing replaces the address as it goes; Enter adds a step to go back to. */
  const search = (q: string, how: "push" | "replace") => {
    clearTimeout(timer.current);
    typing.current = false;
    const next = href({ q: cleanQuery(q) });
    if (next === here) return;
    startTransition(() => (how === "push" ? router.push(next, { scroll: false }) : router.replace(next, { scroll: false })));
  };

  const toggleTag = (t: string) => href({ tags: filters.tags.includes(t) ? filters.tags.filter((x) => x !== t) : [...filters.tags, t].slice(-MAX_FILTER_TAGS) });
  const toggleRole = (r: RoleFilter) => href({ roles: filters.roles.includes(r) ? filters.roles.filter((x) => x !== r) : [...filters.roles, r] });
  // Chosen tags that aren't among the usual ones still show, so they can be taken off.
  const chips = [...new Set([...filters.tags, ...topics])];

  return (
    <section
      ref={bar}
      id="feed"
      className="post-filters"
      aria-label="Filter posts"
      data-pending={pending || undefined}
      data-open={expanded === null ? undefined : String(expanded)}
      data-active={count > 0 || undefined}
      data-chosen={chosen.length > 0 || undefined}
    >
      <div className="post-filters__top">
        <form
          className="post-filters__search"
          role="search"
          action="/home"
          onSubmit={(event) => {
            event.preventDefault();
            search(text, "push");
            // On a phone, put the keyboard away so the posts can be seen.
            (document.activeElement as HTMLElement | null)?.blur();
          }}
        >
          <Icon name="search" size={18} className="post-filters__icon" />
          <input
            className="post-filters__input"
            type="search"
            name="q"
            value={text}
            maxLength={100}
            autoComplete="off"
            enterKeyHint="search"
            aria-label="Search posts or #tags"
            placeholder="Search posts or #tags"
            onChange={(event) => {
              const value = event.target.value;
              setText(value);
              typing.current = true;
              clearTimeout(timer.current);
              // One letter would match nearly everything: wait for two (or an empty box).
              if (value.trim().length === 1) return;
              timer.current = setTimeout(() => search(value, "replace"), PAUSE);
            }}
          />
          {text && (
            <button type="button" className="post-filters__clear-q" aria-label="Clear search" onClick={() => (setText(""), search("", "push"))}>
              <Icon name="close" size={14} />
            </button>
          )}
          {/* The other filters, kept when the box is sent without the page's scripts. */}
          {view !== "all" && <input type="hidden" name="view" value={view} />}
          {filters.tags.length > 0 && <input type="hidden" name="tag" value={filters.tags.join(",")} />}
          {filters.roles.length > 0 && <input type="hidden" name="role" value={filters.roles.join(",")} />}
          {filters.authors.length > 0 && <input type="hidden" name="from" value={filters.authors.join(",")} />}
        </form>
        {!shownOpen && chosen.length > 0 ? (
          // Folded, with filters on: those filters, as chips; a tap opens the whole panel.
          <button
            type="button"
            className="post-filters__toggle post-filters__toggle--chosen"
            aria-expanded={false}
            aria-controls={panelId}
            aria-label={`Filters in use: ${chosen.slice(0, FOLDED_CHIPS).join(", ")}${more > 0 ? ` and ${more} more` : ""}. Show all filters`}
            onClick={() => setOpen(true)}
          >
            {chosen.slice(0, FOLDED_CHIPS).map((c) => (
              <span key={c} className="post-chip is-on">
                {c}
              </span>
            ))}
            {more > 0 && <span className="post-chip post-chip--more">+{more}</span>}
            <Chevron />
          </button>
        ) : (
          <button
            type="button"
            className={`post-filters__toggle${count ? " is-on" : ""}`}
            aria-expanded={shownOpen}
            aria-controls={panelId}
            onClick={() => setOpen(!shownOpen)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
              <circle cx="16" cy="7" r="2" />
              <circle cx="10" cy="17" r="2" />
            </svg>
            {shownOpen && count > 0 ? "Hide filters" : "Filters"}
            {!shownOpen && count > 0 && (
              <span className="post-filters__count">
                <span className="sr-only">, in use: </span>
                {count}
              </span>
            )}
            <Chevron />
          </button>
        )}
        {!shownOpen && count > 0 && (
          <Link className="post-filters__reset post-filters__reset--quick" href={feedHref(NO_FILTERS, { view })} scroll={false} aria-label="Clear filters">
            Clear
          </Link>
        )}
      </div>

      <div
        className="post-filters__panel"
        id={panelId}
        onClick={(event) => {
          // Picking in the open panel keeps it open, though a filter being on would fold it by default.
          if ((event.target as Element).closest("a")) setOpen(true);
        }}
      >
        <div className="post-filters__group" role="group" aria-labelledby={`${panelId}-topics`}>
          <span className="post-filters__label" id={`${panelId}-topics`}>
            Topics
          </span>
          <div className="post-filters__chips">
            {chips.map((t) => {
              const on = filters.tags.includes(t);
              return (
                <Link key={t} className={`post-chip${on ? " is-on" : ""}`} href={toggleTag(t)} scroll={false} aria-current={on || undefined} aria-label={on ? `Remove the #${t} filter` : `Show posts with #${t}`}>
                  #{t}
                  {on && <span aria-hidden="true">×</span>}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="post-filters__group" role="group" aria-labelledby={`${panelId}-who`}>
          <span className="post-filters__label" id={`${panelId}-who`}>
            Written by
          </span>
          <div className="post-filters__chips">
            <Link className={`post-chip${filters.roles.length === 0 ? " is-on" : ""}`} href={href({ roles: [] })} scroll={false} aria-current={filters.roles.length === 0 || undefined}>
              Everyone
            </Link>
            {ROLE_FILTERS.map(([r, label]) => {
              const on = filters.roles.includes(r);
              return (
                <Link key={r} className={`post-chip${on ? " is-on" : ""}`} href={toggleRole(r)} scroll={false} aria-current={on || undefined}>
                  {label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="post-filters__group" role="group" aria-labelledby={`${panelId}-people`}>
          <span className="post-filters__label" id={`${panelId}-people`}>
            From
          </span>
          <div className="post-filters__chips">
            {people.map((p) => (
              <Link key={p.id} className="post-chip post-chip--person" href={href({ authors: filters.authors.filter((a) => a !== p.id) })} scroll={false} aria-label={`Remove ${p.name}`}>
                {p.name} <span aria-hidden="true">×</span>
              </Link>
            ))}
            {filters.authors.length < MAX_FILTER_AUTHORS && (
              <PeoplePicker
                id={`${panelId}-picker`}
                chosen={filters.authors}
                onPick={(p) => {
                  setOpen(true);
                  startTransition(() => router.push(href({ authors: [...filters.authors, p.id] }), { scroll: false }));
                }}
              />
            )}
          </div>
        </div>

        <div className="post-filters__end">
          {count > 0 && (
            <Link className="post-filters__reset" href={feedHref(NO_FILTERS, { view })} scroll={false}>
              Clear filters
            </Link>
          )}
          <button
            type="button"
            className="post-filters__done"
            aria-controls={panelId}
            aria-expanded={shownOpen}
            onClick={() => {
              setOpen(false);
              // This button folds away with the panel: keyboard focus goes back to the toggle.
              requestAnimationFrame(() => bar.current?.querySelector<HTMLButtonElement>(".post-filters__toggle")?.focus());
            }}
          >
            Hide filters <Chevron />
          </button>
        </div>
      </div>
    </section>
  );
}

/** "From specific people": type a name, pick from the members it finds. */
function PeoplePicker({ id, chosen, onPick }: { id: string; chosen: number[]; onPick: (p: Person) => void }) {
  const [text, setText] = useState("");
  const [found, setFound] = useState<Person[]>([]);
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(false);

  // Ask for names a moment after typing stops (members only; never a USN).
  useEffect(() => {
    const q = text.trim();
    if (!q) {
      setFound([]);
      return;
    }
    const controller = new AbortController();
    const wait = window.setTimeout(() => {
      fetch(`/api/people/suggest?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((d: { people?: Person[] }) => {
          setFound((d.people ?? []).filter((p) => !chosen.includes(p.id)));
          setActive(0);
        })
        .catch(() => undefined);
    }, 150);
    return () => {
      window.clearTimeout(wait);
      controller.abort();
    };
    // The chosen ones as a string: the same people are the same, whatever array holds them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, chosen.join(",")]);

  const pick = (p: Person) => {
    setText("");
    setFound([]);
    onPick(p);
  };
  const open = shown && found.length > 0;

  return (
    <div className="post-picker">
      <Icon name="you" size={16} className="post-picker__icon" />
      <input
        className="post-picker__input"
        type="text"
        value={text}
        maxLength={40}
        autoComplete="off"
        placeholder="Type a name"
        aria-label="Type a name to see that person's posts"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${found[active]?.id}` : undefined}
        onFocus={() => setShown(true)}
        onBlur={() => setShown(false)}
        onChange={(e) => {
          setText(e.target.value);
          setShown(true);
        }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % found.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a - 1 + found.length) % found.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(found[active]);
          } else if (e.key === "Escape") {
            setShown(false);
          }
        }}
      />
      {open && (
        <ul className="post-picker__list" role="listbox" id={`${id}-list`} aria-label="Members">
          {found.map((p, i) => (
            <li key={p.id} id={`${id}-${p.id}`} role="option" aria-selected={i === active}>
              {/* Down before the box loses focus, so the list is still there to be clicked. */}
              <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p)}>
                <strong>{p.name}</strong>
                {p.batch && <span>{p.batch}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
