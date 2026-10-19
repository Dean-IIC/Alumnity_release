import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/*
 * Where uploaded files are kept: Supabase Storage when Supabase is configured, otherwise a
 * folder on this computer (for the tests and for working offline). Two stores, never mixed:
 *
 *   "media": members' uploads. A private bucket (data/uploads offline). The browser never
 *            reads it itself: every file goes through /media/<id>, which checks who's asking.
 *   "site":  the college's showcase (gallery photos added from the desk). A public bucket
 *            (data/site-files offline, served by /site-files/...): the gallery is public.
 */

export type Storage = {
  /** Where the browser sends a new file's bytes (a PUT), straight to the store. */
  uploadUrl(path: string): Promise<string>;
  read(path: string): Promise<Uint8Array | null>;
  write(path: string, bytes: Uint8Array, mime: string): Promise<void>;
  remove(paths: string[]): Promise<void>;
  /** A short-lived link for the browser to fetch a file directly (null: serve the bytes ourselves). */
  link(path: string, seconds: number): Promise<string | null>;
};

export const BUCKET = "media";
export const SITE_BUCKET = "site";
export type Bucket = typeof BUCKET | typeof SITE_BUCKET;

const safe = (path: string) => {
  const clean = normalize(path).replace(/\\/g, "/");
  if (clean.startsWith("..") || clean.startsWith("/") || clean.includes("/../")) throw new Error("Bad storage path");
  return clean;
};

// ---------- Supabase ----------

let admin: SupabaseClient | undefined;

/** Supabase with the service role: server only, never sent to a browser. */
export function supabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase isn't configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see docs/deploy.md).");
  return (admin ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
}

function supabaseStorage(name: Bucket): Storage {
  const bucket = () => supabaseAdmin().storage.from(name);
  return {
    async uploadUrl(path) {
      const { data, error } = await bucket().createSignedUploadUrl(safe(path));
      if (error || !data) throw new Error(`Storage: ${error?.message ?? "no upload link"}`);
      return data.signedUrl;
    },
    async read(path) {
      const { data, error } = await bucket().download(safe(path));
      if (error || !data) return null;
      return new Uint8Array(await data.arrayBuffer());
    },
    async write(path, bytes, mime) {
      const { error } = await bucket().upload(safe(path), bytes, { contentType: mime, upsert: true, cacheControl: "86400" });
      if (error) throw new Error(`Storage: ${error.message}`);
    },
    async remove(paths) {
      if (paths.length) await bucket().remove(paths.map(safe));
    },
    async link(path, seconds) {
      const { data } = await bucket().createSignedUrl(safe(path), seconds);
      return data?.signedUrl ?? null;
    }
  };
}

// ---------- A folder (tests, offline) ----------

/** Each store's own folder: members' uploads and the showcase's files are never in the same one. */
const ROOTS: Record<Bucket, () => string> = {
  media: () => process.env.ALUMNITY_UPLOADS || join(process.cwd(), "data", "uploads"),
  site: () => process.env.ALUMNITY_SITE_FILES || join(process.cwd(), "data", "site-files")
};

/** Where a file of the showcase is kept on this computer (for /site-files/...). */
export const siteFolderFile = (path: string) => join(ROOTS.site(), safe(path));

function folderStorage(name: Bucket): Storage {
  const file = (path: string) => join(ROOTS[name](), safe(path));
  return {
    // Sent to our own endpoint, which writes it into the folder (see app/api/media/put).
    uploadUrl: async (path) => `/api/media/put?path=${encodeURIComponent(safe(path))}`,
    async read(path) {
      try {
        return new Uint8Array(readFileSync(file(path)));
      } catch {
        return null;
      }
    },
    async write(path, bytes) {
      mkdirSync(dirname(file(path)), { recursive: true });
      writeFileSync(file(path), bytes);
    },
    async remove(paths) {
      for (const p of paths) rmSync(file(p), { force: true });
    },
    link: async () => null
  };
}

export const usingSupabaseStorage = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) && process.env.ALUMNITY_STORAGE !== "folder";

const stores = new Map<Bucket, Storage>();
/** A store: members' uploads ("media", the default) or the showcase's files ("site"). */
export const storage = (name: Bucket = BUCKET): Storage => {
  let store = stores.get(name);
  if (!store) stores.set(name, (store = usingSupabaseStorage() ? supabaseStorage(name) : folderStorage(name)));
  return store;
};

/** The public address of a showcase file: Supabase's public bucket, or /site-files/... offline. */
export function siteFileUrl(path: string): string {
  const key = safe(path).split("/").map(encodeURIComponent).join("/");
  if (!usingSupabaseStorage()) return `/site-files/${key}`;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/+$/, "")}/storage/v1/object/public/${SITE_BUCKET}/${key}`;
}
