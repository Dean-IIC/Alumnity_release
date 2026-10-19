"use client";

import { useEffect, useRef } from "react";
import type { Profile, Visibility } from "../../lib/server/profile";
import { emptyEntry, SECTION_KINDS, SECTION_LIMITS, SECTIONS, type SectionEntry, type SectionKind } from "../../lib/profile-sections";

const WHO: { value: Visibility; label: string }[] = [
  { value: "everyone", label: "Everyone" },
  { value: "connections", label: "My connections" },
  { value: "batch", label: "My batch" },
  { value: "me", label: "Only me" }
];

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: THIS_YEAR + 7 - 1950 }, (_, k) => THIS_YEAR + 6 - k);

function YearSelect({ label, value, onChange }: { label: string; value: number | null; onChange: (y: number) => void }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <select value={value ?? THIS_YEAR} onChange={(e) => onChange(Number(e.target.value))}>
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </label>
  );
}

function EntryFields({ kind, entry, index, onChange, onRemove }: { kind: SectionKind; entry: SectionEntry; index: number; onChange: (e: SectionEntry) => void; onRemove: () => void }) {
  const info = SECTIONS[kind];
  const set = <K extends keyof SectionEntry>(key: K, value: SectionEntry[K]) => onChange({ ...entry, [key]: value });
  return (
    <li className="section-entry">
      <div className="field-row">
        <label className="field">
          <span className="field__label">{info.title.label}</span>
          <input value={entry.title} maxLength={SECTION_LIMITS.title} placeholder={info.title.placeholder} onChange={(e) => set("title", e.target.value)} />
        </label>
        {info.org &&
          (info.levels ? (
            <label className="field">
              <span className="field__label">{info.org.label}</span>
              <select value={entry.org} onChange={(e) => set("org", e.target.value)}>
                {info.levels.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
          ) : (
            <label className="field">
              <span className="field__label">{info.org.label}</span>
              <input value={entry.org} maxLength={SECTION_LIMITS.org} placeholder={info.org.placeholder} onChange={(e) => set("org", e.target.value)} />
            </label>
          ))}
      </div>
      {info.years && (
        <div className="field-row section-entry__years">
          <YearSelect label={info.years === "range" ? "From" : "Year"} value={entry.from} onChange={(y) => set("from", y)} />
          {info.years === "range" && !entry.current && <YearSelect label="To" value={entry.to ?? entry.from} onChange={(y) => set("to", y)} />}
          {info.years === "range" && (
            <label className="editor__check section-entry__current">
              <input type="checkbox" checked={entry.current} onChange={(e) => set("current", e.target.checked)} />
              <span>
                <b>Still here</b>
              </span>
            </label>
          )}
        </div>
      )}
      {info.link && (
        <label className="field">
          <span className="field__label">Link (optional)</span>
          <input value={entry.link} inputMode="url" maxLength={SECTION_LIMITS.link} placeholder="github.com/you/project" onChange={(e) => set("link", e.target.value)} />
        </label>
      )}
      {info.detail && (
        <label className="field">
          <span className="field__label">A few words (optional)</span>
          <textarea value={entry.detail} rows={2} maxLength={SECTION_LIMITS.detail} onChange={(e) => set("detail", e.target.value)} />
        </label>
      )}
      <button type="button" className="join__switch" onClick={onRemove} aria-label={`Remove ${entry.title || `entry ${index + 1}`} from ${info.label}`}>
        Remove
      </button>
    </li>
  );
}

/** The sections a member has added, and the menu to add more (as on LinkedIn), each with its own "who can see this". */
export function SectionsEditor({ profile, onChange }: { profile: Profile; onChange: (next: Pick<Profile, "sections" | "sectionsVisibility">) => void }) {
  const added = SECTION_KINDS.filter((k) => profile.sections[k]);
  const left = SECTION_KINDS.filter((k) => !profile.sections[k]);
  // Arriving from profile strength's "Add your experience" (/me/edit#edit-sections): the menu is open.
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (window.location.hash === "#edit-sections" && menu.current) menu.current.open = true;
  }, []);
  const setList = (kind: SectionKind, list: SectionEntry[] | undefined) => {
    const sections = { ...profile.sections };
    if (list) sections[kind] = list;
    else delete sections[kind];
    onChange({ sections, sectionsVisibility: profile.sectionsVisibility });
  };
  return (
    <>
      {added.map((kind) => {
        const info = SECTIONS[kind];
        const list = profile.sections[kind]!;
        return (
          <fieldset key={kind} className="editor__part editor__part--section">
            <legend>{info.label}</legend>
            <div className="editor__who" role="radiogroup" aria-label={`Who can see ${info.label}`}>
              <span>Who can see this:</span>
              {WHO.map((w) => (
                <label key={w.value}>
                  <input
                    type="radio"
                    name={`who-section-${kind}`}
                    value={w.value}
                    checked={profile.sectionsVisibility[kind] === w.value}
                    onChange={() => onChange({ sections: profile.sections, sectionsVisibility: { ...profile.sectionsVisibility, [kind]: w.value } })}
                  />
                  <span>{w.label}</span>
                </label>
              ))}
            </div>
            <ol className="section-entries">
              {list.map((entry, i) => (
                <EntryFields
                  key={i}
                  kind={kind}
                  entry={entry}
                  index={i}
                  onChange={(e) => setList(kind, list.map((x, j) => (j === i ? e : x)))}
                  onRemove={() => setList(kind, list.length > 1 ? list.filter((_, j) => j !== i) : undefined)}
                />
              ))}
            </ol>
            <div className="section-actions">
              {list.length < SECTION_LIMITS.entries && (
                <button type="button" className="button button--secondary editor__add" onClick={() => setList(kind, [...list, emptyEntry(kind)])}>
                  + Add another
                </button>
              )}
              <button type="button" className="join__switch" onClick={() => setList(kind, undefined)}>
                Remove this section
              </button>
            </div>
          </fieldset>
        );
      })}

      {left.length > 0 && (
        <details className="add-section" id="edit-sections" ref={menu}>
          <summary className="button button--secondary">+ Add a section</summary>
          <ul className="add-section__menu">
            {left.map((kind) => (
              <li key={kind}>
                <button
                  type="button"
                  onClick={(e) => {
                    setList(kind, [emptyEntry(kind)]);
                    e.currentTarget.closest("details")?.removeAttribute("open");
                  }}
                >
                  <strong>{SECTIONS[kind].label}</strong>
                  <span>{SECTIONS[kind].hint}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
