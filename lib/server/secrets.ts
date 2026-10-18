import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";

/*
 * Passwords, codes and tokens. Passwords are hashed with scrypt (a fresh salt each), codes
 * and session tokens are kept only as SHA-256 hashes, and every comparison takes the same
 * time whether it matches or not.
 */

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 } as const;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key)
    )
  );
}

/** "scrypt$N$r$p$salt$hash", so the cost can be raised later without breaking old hashes. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, , , , salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const key = await derive(password, Buffer.from(salt, "base64"));
  const expected = Buffer.from(hash, "base64");
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** A stored hash for nobody: checking it costs what a real check costs, so timing can't tell if an email has an account. */
let decoy: Promise<string> | undefined;
export const decoyHash = () => (decoy ??= hashPassword(randomBytes(12).toString("hex")));

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** Six digits, every one equally likely. */
export const sixDigitCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

export function sameHash(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** What a password must be: long enough to resist guessing, and not obviously guessable. */
export function passwordProblem(password: string, context: string[] = []): string | null {
  if (password.length < 10) return "Use at least 10 characters.";
  if (password.length > 200) return "That’s too long: 200 characters at most.";
  if (/^\d+$/.test(password)) return "Not just numbers: add some letters.";
  if (new Set(password).size < 4) return "Use more different characters.";
  const lower = password.toLowerCase();
  // Named, so nobody is left guessing which word it was ("Alumnity" is in every demo address).
  const common = ["password", "qwerty", "123456", "hkbk", "alumnity"].find((w) => lower.includes(w));
  if (common) return `Leave out “${common}”: it’s too easy to guess.`;
  if (context.some((c) => c && c.length >= 4 && lower.includes(c.toLowerCase()))) return "Don’t use your name, USN or email in it.";
  return null;
}
