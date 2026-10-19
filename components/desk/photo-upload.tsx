"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

/*
 * Adding photos to a gallery album from the college desk: choose several at once; each is
 * sent straight to Storage, then the server checks it and makes its gallery sizes
 * (app/api/site/photos). One at a time, so a slow connection shows steady progress, and one
 * bad file doesn't stop the rest.
 */

const OFFLINE = "This photo did not upload. Check your internet connection and try again.";

const call = (body: object) =>
  fetch("/api/site/photos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

async function sendOne(album: number, part: string, file: File): Promise<string | null> {
  try {
    const started = await call({ step: "start", album, size: file.size });
    if (!started.ok) return started.error ?? OFFLINE;
    const sent = await fetch(started.url, { method: "PUT", headers: { "content-type": file.type || "application/octet-stream" }, body: file });
    if (!sent.ok) return OFFLINE;
    const finished = await call({ step: "finish", album, token: started.token, part });
    return finished.ok ? null : (finished.error ?? OFFLINE);
  } catch {
    return OFFLINE;
  }
}

export function PhotoUpload({ album, parts }: { album: number; parts: { key: string; title: string }[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [part, setPart] = useState(parts[0]?.key ?? "");
  const [busy, setBusy] = useState<{ done: number; of: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [added, setAdded] = useState(0);

  const upload = async () => {
    const files = [...(input.current?.files ?? [])];
    if (!files.length) return;
    setErrors([]);
    setAdded(0);
    const problems: string[] = [];
    let ok = 0;
    for (const [i, file] of files.entries()) {
      setBusy({ done: i, of: files.length });
      const error = await sendOne(album, part, file);
      if (error) problems.push(`${file.name}: ${error}`);
      else ok += 1;
    }
    setBusy(null);
    setErrors(problems);
    setAdded(ok);
    if (input.current) input.current.value = "";
    router.refresh();
  };

  return (
    <div className="wf-stack">
      {parts.length > 1 && (
        <label className="field">
          <span className="field__label">Add to</span>
          <select value={part} onChange={(e) => setPart(e.target.value)} disabled={busy !== null}>
            {parts.map((p) => (
              <option key={p.key} value={p.key}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="field">
        <span className="field__label">Photos</span>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy !== null} />
        <span className="wf-muted">JPEG, PNG or WebP, up to 20 MB each. You can pick more than one. New photos go at the end.</span>
      </label>
      <div className="wf-actions">
        <button type="button" className="button button--primary" onClick={upload} disabled={busy !== null}>
          {busy ? `Adding photo ${busy.done + 1} of ${busy.of}…` : "Add photos"}
        </button>
      </div>
      {added > 0 && (
        <p className="wf-note wf-note--ok" role="status">
          {added === 1 ? "1 photo added." : `${added} photos added.`}
        </p>
      )}
      {errors.length > 0 && (
        <div className="wf-note wf-note--error" role="alert">
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}
    </div>
  );
}
