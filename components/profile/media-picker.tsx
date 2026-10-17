"use client";

import { useRef, useState } from "react";
import { uploadFile } from "../../lib/client/upload";
import { mediaUrl } from "../../lib/media-url";
import type { MediaRef } from "../../lib/server/profile";

/*
 * Choosing a photo or a cover: pick a file, it uploads at once (checked on the server:
 * lib/server/media.ts), and a preview shows it; it's on your page when you save.
 */

async function upload(file: File, use: "photo" | "cover"): Promise<{ ok: true; ref: MediaRef } | { ok: false; error: string }> {
  const answer = await uploadFile(file, use);
  return answer.ok ? { ok: true, ref: { id: answer.id, kind: answer.kind } } : answer;
}

function Preview({ value, use }: { value: MediaRef | null; use: "photo" | "cover" }) {
  if (!value) return <span className="picker__empty">{use === "photo" ? "Your ink seal, until you add a photo" : "The campus of your year, until you add a cover"}</span>;
  if (value.kind === "video") return <video src={mediaUrl(value.id)} muted loop autoPlay playsInline />;
  if (value.kind === "html") return <iframe src={mediaUrl(value.id)} title="Your cover" sandbox="allow-scripts" referrerPolicy="no-referrer" scrolling="no" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={mediaUrl(value.id)} alt="" />;
}

export function MediaPicker({ use, value, onChange }: { use: "photo" | "cover"; value: MediaRef | null; onChange: (ref: MediaRef | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const label = use === "photo" ? "Your photo" : "Your cover";

  return (
    <div className={`picker picker--${use}`}>
      <span className="field__label">{label}</span>
      <div className="picker__preview">
        <Preview value={value} use={use} />
      </div>
      <div className="picker__actions">
        <input
          ref={input}
          type="file"
          className="sr-only"
          // The button below opens it: one control to reach, not two.
          tabIndex={-1}
          aria-hidden="true"
          accept={use === "photo" ? "image/jpeg,image/png,image/webp,image/gif" : "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,.html,.htm,text/html"}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            setBusy(true);
            setProblem(null);
            const result = await upload(file, use);
            setBusy(false);
            if (result.ok) onChange(result.ref);
            else setProblem(result.error);
          }}
        />
        <button type="button" className="button button--secondary" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? "Uploading…" : value ? "Change" : use === "photo" ? "Upload a photo" : "Upload a cover"}
        </button>
        {value && (
          <button type="button" className="join__switch" onClick={() => onChange(null)}>
            Remove
          </button>
        )}
      </div>
      <span className="field__hint">
        {use === "photo"
          ? "JPEG, PNG, WebP or GIF, up to 5 MB. Location details hidden in photos are removed."
          : "An image (up to 5 MB), a short MP4 or WebM video (up to 25 MB, plays muted on a loop), or an HTML file (up to 1 MB) for something of your own: it runs its own scripts and animations in a sealed frame, but can’t load anything from the internet, so put any images or fonts inside the file."}
      </span>
      {problem && (
        <p className="join__problem" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}
