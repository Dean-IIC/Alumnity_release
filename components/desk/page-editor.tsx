"use client";

import { useState } from "react";
import { savePageAction } from "../../lib/actions/showcase";
import { PAGE_LIMITS, paragraphsOf, rosterOf, type PageKind } from "../../lib/site-pages";
import { ActionForm } from "../app/action-form";
import { Letter } from "../site/letter";
import "../../app/styles/info.css";

/** A page's words in a box, with how they will look beside it. */
export function PageEditor({
  slug,
  kind,
  body,
  signerName,
  signerRole
}: {
  slug: string;
  kind: PageKind;
  body: string;
  signerName: string | null;
  signerRole: string | null;
}) {
  const [text, setText] = useState(body);
  const [name, setName] = useState(signerName ?? "");
  const [role, setRole] = useState(signerRole ?? "");
  const help =
    kind === "list"
      ? 'One person on each line. Write the role, a colon, then the name, like "President: Asha Rao". Leave out the name to show "To be announced".'
      : kind === "letter"
        ? "Leave an empty line between paragraphs. The first paragraph is the greeting."
        : "Leave an empty line between paragraphs.";

  return (
    <div className="showcase-editor">
      <section className="wf-card" aria-labelledby="page-words">
        <h2 id="page-words">Words</h2>
        <ActionForm action={savePageAction} className="wf-stack">
          <input type="hidden" name="slug" value={slug} />
          <label className="field">
            <span className="field__label">Text</span>
            <textarea name="body" rows={kind === "text" ? 6 : 16} required maxLength={PAGE_LIMITS.body} value={text} onChange={(e) => setText(e.target.value)} />
            <span className="wf-muted">{help}</span>
          </label>
          {kind === "letter" && (
            <div className="field-row">
              <label className="field">
                <span className="field__label">Signed by</span>
                <input name="signerName" required maxLength={PAGE_LIMITS.signer} value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="field">
                <span className="field__label">Their role</span>
                <input name="signerRole" maxLength={PAGE_LIMITS.signer} value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Director" />
              </label>
            </div>
          )}
          <div className="wf-actions">
            <button className="button button--primary" type="submit">
              Save
            </button>
          </div>
        </ActionForm>
      </section>

      <section className="wf-card showcase-preview" aria-labelledby="page-preview">
        <h2 id="page-preview">Preview</h2>
        <p className="wf-muted">How it will look on the page. Nothing changes there until you save.</p>
        <div className="showcase-preview__page">
          {kind === "letter" && <Letter body={text} signerName={name.trim() || null} signerRole={role.trim() || null} fold={false} />}
          {kind === "text" && paragraphsOf(text).map((t, i) => <p key={i}>{t}</p>)}
          {kind === "list" && (
            <ul className="showcase-preview__roster">
              {rosterOf(text).map((p, i) => (
                <li key={i}>
                  <span className="wf-muted">{p.role}</span> <strong>{p.name}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
