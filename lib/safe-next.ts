/**
 * Where to go after logging in: only a path on this site. "//evil.example" and
 * "/\evil.example" start with "/" too, but browsers treat them as other sites, so a
 * link could otherwise send someone to a look-alike page straight after they log in.
 */
export function safeNext(next: string | null | undefined, fallback = "/home"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  try {
    const url = new URL(next, "https://alumnity.invalid");
    return url.origin === "https://alumnity.invalid" ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}
