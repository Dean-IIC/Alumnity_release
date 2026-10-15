import { headers } from "next/headers";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

const hostOnly = (value: string) => value.replace(/:\d+$/, "").toLowerCase();

/**
 * Development tools (the sample members) answer only on
 * this computer: never in production, and never through a tunnel or the network, even
 * while `next dev` is running. Next adds forwarding headers of its own, so those are read
 * for what they say: a request from elsewhere names a non-local host or address.
 */
export async function isLocalDev(): Promise<boolean> {
  if (process.env.NODE_ENV === "production") return false;
  const list = await headers();
  if (list.get("cf-connecting-ip") || list.get("x-real-ip")) return false; // through a tunnel or proxy
  if (!LOCAL_HOSTS.has(hostOnly(list.get("host") ?? ""))) return false;
  const forwardedHost = list.get("x-forwarded-host");
  if (forwardedHost && !forwardedHost.split(",").every((h) => LOCAL_HOSTS.has(hostOnly(h.trim())))) return false;
  const forwardedFor = list.get("x-forwarded-for");
  if (forwardedFor && !forwardedFor.split(",").every((ip) => LOOPBACK.has(ip.trim()))) return false;
  return true;
}
