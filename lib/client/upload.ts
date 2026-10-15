/*
 * Uploading a file from the browser (see app/api/media/route.ts): ask for a place to put
 * it, send it there directly, then ask the server to check it and take it in.
 */

export type Uploaded = { ok: true; id: string; kind: "image" | "video" | "html" } | { ok: false; error: string };

const OFFLINE = "The upload didn’t get through. Check your connection and try again.";

const call = (body: object) =>
  fetch("/api/media", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

export async function uploadFile(file: File, use: "photo" | "cover" | "post" | "story"): Promise<Uploaded> {
  try {
    const started = await call({ step: "start", use, size: file.size });
    if (!started.ok) return { ok: false, error: started.error };
    const sent = await fetch(started.url, { method: "PUT", headers: { "content-type": file.type || "application/octet-stream" }, body: file });
    if (!sent.ok) return { ok: false, error: OFFLINE };
    const finished = await call({ step: "finish", id: started.id });
    return finished.ok ? { ok: true, id: finished.id, kind: finished.kind } : { ok: false, error: finished.error };
  } catch {
    return { ok: false, error: OFFLINE };
  }
}
