"use client";

import { Fragment, useRef, useState } from "react";
import { uploadFile } from "../../lib/client/upload";
import { mediaUrl } from "../../lib/media-url";
import { cropStyle, sharper, type Crop } from "../../lib/photo-crop";
import type { MediaRef } from "../../lib/server/profile";
import { Cover, type DefaultCover } from "./cover";
import { CropTool, type CropSubject } from "./crop-tool";

/*
 * Choosing a photo or a cover: pick a file, it uploads at once (checked on the server:
 * lib/server/media.ts), and a preview shows it; it's on your page when you save. A new
 * photo, image or video opens the framing tool straight away (crop-tool.tsx); Adjust opens
 * it again later. An HTML cover lays itself out, so it has nothing to frame.
 */

async function upload(file: File, use: "photo" | "cover"): Promise<{ ok: true; ref: MediaRef } | { ok: false; error: string }> {
  const answer = await uploadFile(file, use);
  return answer.ok ? { ok: true, ref: { id: answer.id, kind: answer.kind } } : answer;
}

/** The campus drawing a cover shows until they add one of their own, and where they've put it. */
export type CampusCover = { fallback: DefaultCover; seed: number; crop: Crop | null; onChange: (crop: Crop | null) => void };

function Preview({ value, use, name, campus }: { value: MediaRef | null; use: "photo" | "cover"; name: string; campus?: CampusCover }) {
  if (use === "cover" && (value || campus)) {
    return <Cover cover={value} fallback={campus?.fallback ?? { src: "", sketch: "", year: 0, title: "" }} name={name} seed={campus?.seed ?? 0} campusCrop={campus?.crop} />;
  }
  if (!value) return <span className="picker__empty">{use === "photo" ? "Your initials show here until you add a photo" : "A campus photo from your year shows here for now"}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={mediaUrl(value.id, 140 * sharper(value.crop))} alt="" style={cropStyle(value.crop)} />;
}

/** `campus`: for the cover, the campus drawing shown without one (it can be moved too). */
export function MediaPicker({ use, value, onChange, name, campus }: { use: "photo" | "cover"; value: MediaRef | null; onChange: (ref: MediaRef | null) => void; name: string; campus?: CampusCover }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [framing, setFraming] = useState(false);
  const [framed, setFramed] = useState(false);
  const label = use === "photo" ? "Your photo" : "Your cover";

  // What the framing tool works on: the upload (not an HTML one), or the campus drawing.
  const subject: CropSubject | null =
    value && use === "photo"
      ? { kind: "photo", id: value.id }
      : value && value.kind !== "html"
        ? { kind: "cover", cover: value }
        : !value && campus
          ? { kind: "campus", fallback: campus.fallback, seed: campus.seed }
          : null;

  return (
    <div className={`picker picker--${use}`}>
      <span className="field__label">{label}</span>
      <div className="picker__preview">
        <Preview value={value} use={use} name={name} campus={campus} />
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
            if (!result.ok) return setProblem(result.error);
            onChange(result.ref);
            setFramed(false);
            // Straight to framing it, as it comes: centred, just covering the frame.
            if (result.ref.kind !== "html") setFraming(true);
          }}
        />
        <button type="button" className="button button--secondary" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? "Uploading…" : value ? "Change" : use === "photo" ? "Upload a photo" : "Upload a cover"}
        </button>
        {subject && (
          <button
            type="button"
            className="button button--secondary"
            aria-label={subject.kind === "photo" ? "Move and zoom your photo" : subject.kind === "campus" ? "Move and zoom the campus" : "Move and zoom your cover"}
            onClick={() => setFraming(true)}
          >
            Move and zoom
          </button>
        )}
        {value && (
          <button
            type="button"
            className="join__switch"
            onClick={() => {
              onChange(null);
              setFramed(false);
            }}
          >
            Remove
          </button>
        )}
      </div>
      {framed && (
        <p className="picker__framed" role="status">
          Done. Save your changes below to show it on your page.
        </p>
      )}
      <span className="field__hint">
        {(use === "photo"
          ? ["JPEG, PNG, WebP or GIF, up to 5 MB.", "We remove any hidden details of where the photo was taken.", "Then drag and zoom to fit it."]
          : value?.kind === "html"
            ? ["An HTML cover fits itself. You don't need to move or zoom it.", "It runs in a safe, closed box. It can't load anything from the internet.", "So put any pictures or fonts inside the file."]
            : [
                "Photo: up to 5 MB.",
                "Short video: up to 25 MB. It plays with no sound.",
                "HTML file: up to 1 MB.",
                "You can move and zoom a photo or a video.",
                "An HTML file runs in a safe, closed box. It can't load anything from the internet.",
                "So put any pictures or fonts inside the file."
              ]
        ).map((line, i) => (
          <Fragment key={line}>
            {i > 0 && <br />}
            {line}
          </Fragment>
        ))}
      </span>
      {problem && (
        <p className="join__problem" role="alert">
          {problem}
        </p>
      )}
      {subject && (
        <CropTool
          open={framing}
          subject={subject}
          initial={subject.kind === "campus" ? campus?.crop : value?.crop}
          name={name}
          onClose={() => setFraming(false)}
          onSave={(crop) => {
            setFraming(false);
            setFramed(true);
            if (subject.kind === "campus") campus?.onChange(crop ?? null);
            else if (value) onChange(crop ? { ...value, crop } : { id: value.id, kind: value.kind });
          }}
        />
      )}
    </div>
  );
}
