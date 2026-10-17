"use client";

import { useState } from "react";
import { uploadFile } from "../../lib/client/upload";
import { mediaUrl } from "../../lib/media-url";

/** A photo for a cause: uploaded as soon as it's chosen; its id goes with the form. */
export function PhotoField({ name = "cover" }: { name?: string }) {
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <div className="field">
      <span className="field__label">A photo (optional)</span>
      <input type="hidden" name={name} value={id} />
      {id && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaUrl(id, 320)} alt="" style={{ maxWidth: 320, borderRadius: 8 }} />
      )}
      <label className="button button--secondary wf-small photo-field__choose">
        {id ? "Choose another photo" : "Choose a photo"}
        <input
          type="file"
          className="sr-only"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setProblem(null);
            const answer = await uploadFile(file, "photo");
            setBusy(false);
            if (answer.ok) setId(answer.id);
            else setProblem(answer.error);
          }}
        />
      </label>
      {busy && <span className="field__hint">Uploading…</span>}
      {problem && (
        <span className="wf-note wf-note--error" role="alert">
          {problem}
        </span>
      )}
    </div>
  );
}
