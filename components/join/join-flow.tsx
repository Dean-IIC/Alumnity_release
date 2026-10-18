"use client";


import Link from "next/link";
import { firstName } from "../../lib/format";
import { useEffect, useState, type FormEvent } from "react";
import { post } from "../../lib/client/post";
import { useHydrated } from "../../lib/client/hydrated";
import { CodeField, PasswordField } from "./fields";
import { RegisterBook, type BookLine, type BookState } from "./register-book";

/*
 * Joining: say who you are, find your line in the college register (USN and name, or
 * name, branch and the year you joined), then your email: we send a code to it, and once
 * it's typed in you choose a password and you're in. The server checks the register again
 * itself at every step (lib/server/auth.ts); the browser is never trusted with who you are.
 */

type Role = "student" | "alumnus" | "faculty";
type Branch = { code: string; name: string };

type Found = { status: "found"; name: string; usn: string; branch: string; branchName: string; programme: string; joined: number; batchSize: number };
type Answer = Found | { status: "not-found" | "ambiguous" | "slow-down" | "unavailable" | "incomplete" };

const ROLES: { value: Role; label: string; note: string }[] = [
  { value: "student", label: "I study here", note: "Find seniors who've been where you are." },
  { value: "alumnus", label: "I studied here", note: "Find your batch, and help the ones after you." },
  { value: "faculty", label: "I teach here", note: "Bring your department's people together." }
];

/** The book turns three pages while it looks (join.css: 1050 ms each, 340 ms apart); the answer waits for the last. */
const MIN_SEARCH = 1750;

export function JoinFlow({ branches, from, to }: { branches: Branch[]; from: number; to: number }) {
  const [role, setRole] = useState<Role>("alumnus");
  const [byUsn, setByUsn] = useState(true);
  const [book, setBook] = useState<BookState>("idle");
  const [found, setFound] = useState<Found | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  /** What found you, sent again with your email: the server repeats the register check. */
  const [query, setQuery] = useState<Record<string, unknown> | null>(null);
  const [step, setStep] = useState<"email" | "code" | "password">("email");
  const [email, setEmail] = useState("");
  const [ticket, setTicket] = useState("");
  const [busy, setBusy] = useState(false);
  // Disabled until the script has taken over: tapped early, the browser would send the form itself.
  const ready = useHydrated();
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  /** Runs a step: busy while it's out, its error (if any) shown where it can be read. */
  const run = async (work: () => Promise<string | null>) => {
    setBusy(true);
    setProblem(null);
    const error = await work();
    setBusy(false);
    if (error) setProblem(error);
  };

  const sendCode = (to: string) =>
    run(async () => {
      const answer = await post<{ ticket: string }>("/api/auth/join/start", { ...query, email: to });
      if (!answer.ok) return answer.error;
      setEmail(to);
      setTicket(answer.ticket);
      setStep("code");
      setResendIn(60);
      return null;
    });
  const years = Array.from({ length: to - from + 1 }, (_, i) => to - i);

  const search = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = byUsn
      ? { name: form.get("name"), usn: form.get("usn") }
      : { name: form.get("name"), branch: form.get("branch"), year: Number(form.get("year")) };
    setProblem(null);
    setBook("searching");
    const started = Date.now();
    let answer: Answer;
    try {
      answer = await (await fetch("/api/register-check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
    } catch {
      answer = { status: "unavailable" };
    }
    await new Promise((r) => setTimeout(r, Math.max(0, MIN_SEARCH - (Date.now() - started))));
    if (answer.status === "found") {
      setQuery(body);
      setFound(answer);
      setBook("found");
      return;
    }
    setBook("not-found");
    setProblem(
      {
        "not-found": byUsn
          ? "We couldn't find you in the register. Check your USN, and your name as it's written on your marks card."
          : "We couldn't find you in the register. Check the spelling, the branch and the year you joined.",
        ambiguous: "More than one person on the register fits that. Add your USN to tell you apart.",
        "slow-down": "That's a lot of tries in a short time. Wait a few minutes and try again.",
        unavailable: "The register isn't reachable just now. Please try again in a little while.",
        incomplete: "Fill in your name, and your USN (or your branch and the year you joined)."
      }[answer.status]
    );
  };

  const line: BookLine | undefined = found ? { name: found.name, usn: found.usn, branch: found.branch, joined: found.joined } : undefined;
  const first = found ? firstName(found.name) : "";
  const finished = found && found.joined + (found.programme === "B.Tech" ? 4 : 2) <= new Date().getFullYear();

  return (
    <div className="join">
      <div className="join__form">
        {!found ? (
          <form method="post" onSubmit={search} noValidate>
            <fieldset className="join__roles">
              <legend>Who are you at HKBK?</legend>
              {ROLES.map((r) => (
                <label key={r.value} className="join__role">
                  <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} />
                  <span className="join__role-label">{r.label}</span>
                  <span className="join__role-note">{r.note}</span>
                </label>
              ))}
            </fieldset>

            {role === "faculty" ? (
              <p className="join__note">
                Teachers aren’t in the students’ register, so the alumni office adds you. That opens with accounts, soon.
              </p>
            ) : (
              <>
                <label className="field">
                  <span className="field__label">Your name</span>
                  <input name="name" autoComplete="name" required placeholder="As on your marks card" />
                </label>

                {byUsn ? (
                  <label className="field">
                    <span className="field__label">Your USN</span>
                    <input name="usn" required placeholder="1HK12CS042" autoCapitalize="characters" spellCheck={false} className="field__usn" />
                  </label>
                ) : (
                  <div className="field-row">
                    <label className="field">
                      <span className="field__label">Branch</span>
                      <select name="branch" required defaultValue="">
                        <option value="" disabled>
                          Choose
                        </option>
                        {branches.map((b) => (
                          <option key={b.code} value={b.code}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span className="field__label">Year you joined</span>
                      <select name="year" required defaultValue="">
                        <option value="" disabled>
                          Choose
                        </option>
                        {years.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                <button type="button" className="join__switch" onClick={() => setByUsn((v) => !v)}>
                  {byUsn ? "I don’t remember my USN" : "I know my USN"}
                </button>

                {problem && (
                  <p className="join__problem" role="alert">
                    {problem}
                  </p>
                )}

                <button className="button button--primary join__submit" type="submit" disabled={book === "searching"}>
                  {book === "searching" ? "Looking through the register…" : "Find me in the register"}
                  <span aria-hidden="true">→</span>
                </button>
                <p className="join__fine">We only check that you’re on the register. Nobody else sees what you type here.</p>
                <p className="join__fine">
                  A teacher or college staff? <Link href="/join/staff">Join with your invitation</Link>
                </p>
              </>
            )}
          </form>
        ) : (
          <div className="join__found" aria-live="polite">
            <p className="kicker">You’re on the register</p>
            <h2 className="join__welcome">Welcome, {first}.</h2>
            <p className="join__line">
              {found.branchName}, joined {found.joined}
              {finished ? `, class of ${found.joined + (found.programme === "B.Tech" ? 4 : 2)}` : ""}.{" "}
              {found.batchSize > 1 && `${found.batchSize - 1} others from your batch are on it too.`}
            </p>

            {step === "email" && (
              <form
                method="post"
                className="join__email"
                onSubmit={(event) => {
                  event.preventDefault();
                  sendCode(String(new FormData(event.currentTarget).get("email") ?? ""));
                }}
              >
                <label className="field">
                  <span className="field__label">Your email</span>
                  <input name="email" type="email" autoComplete="email" required placeholder="you@example.com" defaultValue={email} />
                  <span className="field__hint">A personal one: your college email stops working after you graduate. We’ll send a code to check it’s yours.</span>
                </label>
                {problem && (
                  <p className="join__problem" role="alert">
                    {problem}
                  </p>
                )}
                <button className="button button--primary" type="submit" disabled={busy || !ready}>
                  {busy ? "Sending…" : "Send me a code"} <span aria-hidden="true">→</span>
                </button>
              </form>
            )}

            {step === "code" && (
              <form
                method="post"
                className="join__email"
                onSubmit={(event) => {
                  event.preventDefault();
                  const code = String(new FormData(event.currentTarget).get("code") ?? "");
                  run(async () => {
                    const answer = await post("/api/auth/join/verify", { ticket, code });
                    if (!answer.ok) return answer.error;
                    setStep("password");
                    return null;
                  });
                }}
              >
                <CodeField email={email} />
                {problem && (
                  <p className="join__problem" role="alert">
                    {problem}
                  </p>
                )}
                <button className="button button--primary" type="submit" disabled={busy || !ready}>
                  {busy ? "Checking…" : "That’s my code"} <span aria-hidden="true">→</span>
                </button>
                <button type="button" className="join__switch" disabled={resendIn > 0 || busy} onClick={() => sendCode(email)}>
                  {resendIn > 0 ? `Send a new code in ${resendIn}s` : "Send a new code"}
                </button>
                <button type="button" className="join__switch" onClick={() => setStep("email")}>
                  Use a different email
                </button>
              </form>
            )}

            {step === "password" && (
              <form
                method="post"
                className="join__email"
                onSubmit={(event) => {
                  event.preventDefault();
                  const password = String(new FormData(event.currentTarget).get("password") ?? "");
                  run(async () => {
                    const answer = await post("/api/auth/join/complete", { ticket, password });
                    if (!answer.ok) return answer.error;
                    window.location.assign("/me");
                    return null;
                  });
                }}
              >
                <p className="join__line">Your email is confirmed. Last thing: a password, for logging in next time.</p>
                <PasswordField />
                <p className="join__fine">
                  By joining, you agree to the <Link href="/terms">terms</Link> and the <Link href="/privacy">privacy policy</Link>, and confirm you’re 18 or over.
                </p>
                {problem && (
                  <p className="join__problem" role="alert">
                    {problem}
                  </p>
                )}
                <button className="button button--primary" type="submit" disabled={busy || !ready}>
                  {busy ? "Making your account…" : "Join Alumnity"} <span aria-hidden="true">→</span>
                </button>
              </form>
            )}

            <button
              type="button"
              className="join__switch"
              onClick={() => {
                setFound(null);
                setBook("idle");
                setStep("email");
                setProblem(null);
              }}
            >
              That isn’t me
            </button>
          </div>
        )}
      </div>
      <RegisterBook state={book} line={line} />
    </div>
  );
}
