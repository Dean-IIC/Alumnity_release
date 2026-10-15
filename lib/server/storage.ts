import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/*
 * Where uploaded files are kept: Supabase Storage (the private bucket "media") when
 * Supabase is configured, otherwise a folder on this computer (data/uploads, for the tests
 * and for working offline). Either way the browser never reads the bucket itself: every
 * file goes through /media/<id>, which checks who's asking first.
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

function supabaseStorage(): Storage {
  const bucket = () => supabaseAdmin().storage.from(BUCKET);
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

const root = () => process.env.ALUMNITY_UPLOADS || join(process.cwd(), "data", "uploads");

function folderStorage(): Storage {
  const file = (path: string) => join(root(), safe(path));
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

let current: Storage | undefined;
export const storage = (): Storage => (current ??= usingSupabaseStorage() ? supabaseStorage() : folderStorage());
