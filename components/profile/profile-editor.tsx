"use client";

import { useState, type ReactNode } from "react";
import { post } from "../../lib/client/post";
import type { Field, Profile, Visibility } from "../../lib/server/profile";
import { MediaPicker } from "./media-picker";

/*
 * Editing your page: each part of it with its own "who can see this". Saved on the
 * server, which keeps only what's allowed (lib/server/profile.ts) and never trusts the
 * form about whose page it is.
 */

const WHO: { value: Visibility; label: string }[] = [
  { value: "everyone", label: "Everyone" },
  { value: "connections", label: "My connections" },
  { value: "batch", label: "My batch" },
  { value: "me", label: "Only me" }
];

function Part({ title, field, visibility, onVisibility, children }: { title: string; field: Field; visibility: Visibility; onVisibility: (v: Visibility) => void; children: ReactNode }) {
  return (
    <fieldset className="editor__part">
      <legend>{title}</legend>
      <div className="editor__who" role="radiogroup" aria-label={`Who can see “${title}”`}>
        <span>Who can see this:</span>
        {WHO.map((w) => (
          <label key={w.value}>
            <input type="radio" name={`who-${field}`} value={w.value} checked={visibility === w.value} onChange={() => onVisibility(w.value)} />
            <span>{w.label}</span>
          </label>
        ))}
      </div>
      {children}
    </fieldset>
  );
}

export function ProfileEditor({ initial }: { initial: Profile }) {
  const [profile, setProfile] = useState(initial);
  const [skillsText, setSkillsText] = useState(initial.skills.join(", "));
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => setProfile((p) => ({ ...p, [key]: value }));
  const who = (field: Field) => ({ visibility: profile.visibility[field], onVisibility: (v: Visibility) => set("visibility", { ...profile.visibility, [field]: v }) });

  return (
    <form
      className="editor"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setProblem(null);
        const answer = await post("/api/profile", { ...profile, skills: skillsText.split(",") });
        if (answer.ok) return window.location.assign("/me");
        setBusy(false);
        setProblem(answer.error);
      }}
    >
      <fieldset className="editor__part editor__part--media">
        <legend>Photo and cover</legend>
        <p className="join__fine">Everyone on Alumnity sees these.</p>
        <div className="editor__media">
          <MediaPicker use="photo" value={profile.photo} onChange={(ref) => set("photo", ref)} />
          <MediaPicker use="cover" value={profile.cover} onChange={(ref) => set("cover", ref)} />
        </div>
      </fieldset>

      <Part title="Now" field="now" {...who("now")}>
        <div className="field-row">
          <label className="field">
            <span className="field__label">What you do</span>
            <input value={profile.title} maxLength={80} onChange={(e) => set("title", e.target.value)} placeholder="Backend engineer" />
          </label>
          <label className="field">
            <span className="field__label">Where</span>
            <input value={profile.company} maxLength={80} onChange={(e) => set("company", e.target.value)} placeholder="Company, college or startup" />
          </label>
        </div>
        <label className="field">
          <span className="field__label">City</span>
          <input value={profile.city} maxLength={60} onChange={(e) => set("city", e.target.value)} placeholder="Bengaluru" autoComplete="address-level2" />
          <span className="field__hint">Just the city: never your address.</span>
        </label>
      </Part>

      <Part title="Your journey since HKBK (optional)" field="journey" {...who("journey")}>
        <p className="join__fine">
          Only if you'd like: the stops between leaving college and now (a first job, a new city, a start-up). Add one and your page
          shows your road, drawn in the red pen, oldest first.
        </p>
        <ol className="editor__stops">
          {profile.journey.map((stop, i) => (
            <li key={i} className="editor__stop">
              <label className="field">
                <span className="field__label">Year</span>
                <select
                  value={stop.year}
                  onChange={(e) => set("journey", profile.journey.map((s, j) => (j === i ? { ...s, year: Number(e.target.value) } : s)))}
                >
                  {Array.from({ length: new Date().getFullYear() - 1997 }, (_, k) => new Date().getFullYear() - k).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">What happened</span>
                <input
                  value={stop.text}
                  maxLength={90}
                  placeholder="Moved to Pune for my first job"
                  onChange={(e) => set("journey", profile.journey.map((s, j) => (j === i ? { ...s, text: e.target.value } : s)))}
                />
              </label>
              <button type="button" className="join__switch" onClick={() => set("journey", profile.journey.filter((_, j) => j !== i))} aria-label={`Remove the stop in ${stop.year}`}>
                Remove
              </button>
            </li>
          ))}
        </ol>
        {profile.journey.length < 8 && (
          <button
            type="button"
            className="button button--secondary editor__add"
            onClick={() => set("journey", [...profile.journey, { year: new Date().getFullYear(), text: "" }])}
          >
            + Add a stop
          </button>
        )}
      </Part>

      <Part title="About" field="about" {...who("about")}>
        <label className="field">
          <span className="field__label">A few lines about you</span>
          <textarea value={profile.about} maxLength={600} rows={4} onChange={(e) => set("about", e.target.value)} placeholder="What you work on, what you loved at HKBK, what juniors could ask you." />
          <span className="field__hint">{600 - profile.about.length} characters left.</span>
        </label>
      </Part>

      <Part title="Good at" field="skills" {...who("skills")}>
        <label className="field">
          <span className="field__label">Things you know well, with commas between them</span>
          <input value={skillsText} onChange={(e) => setSkillsText(e.target.value)} placeholder="Java, system design, GATE prep, placements" />
          <span className="field__hint">Up to 12. These are what juniors search for.</span>
        </label>
      </Part>

      <Part title="Happy to" field="happyTo" {...who("happyTo")}>
        {(
          [
            ["mentor", "Mentor juniors", "Answer questions, and see a student through a decision."],
            ["refer", "Refer people at my company", "When a junior’s a good fit, put them forward."],
            ["talk", "Give a talk at the college", "A guest lecture or a session for a department."]
          ] as const
        ).map(([key, label, note]) => (
          <label key={key} className="editor__check">
            <input type="checkbox" checked={profile.happyTo[key]} onChange={(e) => set("happyTo", { ...profile.happyTo, [key]: e.target.checked })} />
            <span>
              <b>{label}</b>
              <span>{note}</span>
            </span>
          </label>
        ))}
      </Part>

      <Part title="Find me" field="links" {...who("links")}>
        <label className="field">
          <span className="field__label">LinkedIn</span>
          <input value={profile.links.linkedin} onChange={(e) => set("links", { ...profile.links, linkedin: e.target.value })} placeholder="linkedin.com/in/your-name" inputMode="url" />
        </label>
        <label className="field">
          <span className="field__label">Website</span>
          <input value={profile.links.website} onChange={(e) => set("links", { ...profile.links, website: e.target.value })} placeholder="yourname.dev" inputMode="url" />
        </label>
      </Part>

      {problem && (
        <p className="join__problem" role="alert">
          {problem}
        </p>
      )}
      <div className="editor__actions">
        <button className="button button--primary" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save my page"} <span aria-hidden="true">→</span>
        </button>
        <a className="button button--secondary" href="/me">
          Cancel
        </a>
      </div>
    </form>
  );
}
