"use client";

import { useEffect, useState } from "react";
import { post } from "../../lib/client/post";

/*
 * Alerts, in Settings: notifications on this phone or computer (Web Push), and the daily
 * email. Notifications are per browser: turning them on here asks the browser's
 * permission and remembers this browser; turning them off forgets it.
 */

type State = { emailDigest: boolean; push: boolean; browsers: number; pushKey: string | null };

const keyBytes = (base64: string) => {
  const raw = atob((base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

const supported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const isIos = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
const installed = () => typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;

export function AlertsPanel() {
  const [state, setState] = useState<State | null>(null);
  const [here, setHere] = useState<PushSubscription | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/alerts", { cache: "no-store" })
      .then((r) => r.json())
      .then((s) => s.ok && setState(s))
      .catch(() => undefined);
    if (supported()) navigator.serviceWorker.getRegistration("/sw.js").then((reg) => reg?.pushManager.getSubscription().then(setHere));
  }, []);

  if (!state) return <p className="join__fine">Loading…</p>;

  const save = async (change: Partial<Pick<State, "emailDigest" | "push">>) => {
    setState({ ...state, ...change });
    const answer = await post("/api/alerts", change);
    if (!answer.ok) setNote({ ok: false, text: answer.error });
  };

  const turnOn = async () => {
    setBusy(true);
    setNote(null);
    try {
      if ((await Notification.requestPermission()) !== "granted") {
        setNote({ ok: false, text: "Notifications are blocked for Alumnity in this browser. Allow them in the browser's site settings, then try again." });
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(state.pushKey!) }));
      const answer = await post("/api/alerts", { subscribe: sub.toJSON() });
      if (!answer.ok) throw new Error(answer.error);
      setHere(sub);
      setState({ ...state, push: true, browsers: state.browsers + 1 });
      if (!state.push) await post("/api/alerts", { push: true });
      setNote({ ok: true, text: "Notifications are on for this browser." });
    } catch {
      setNote({ ok: false, text: "Notifications couldn't be turned on here. Try again, or in another browser." });
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    if (!here) return;
    setBusy(true);
    await post("/api/alerts", { unsubscribe: here.endpoint });
    await here.unsubscribe().catch(() => undefined);
    setHere(null);
    setState({ ...state, browsers: Math.max(0, state.browsers - 1) });
    setBusy(false);
    setNote({ ok: true, text: "Notifications are off for this browser." });
  };

  return (
    <div className="wf-stack">
      <div>
        <strong>Notifications on this {isIos() ? "phone" : "device"}</strong>
        {!state.pushKey ? (
          <p className="join__fine">Not available yet: the college is setting them up.</p>
        ) : !supported() ? (
          <p className="join__fine">
            {isIos() && !installed()
              ? "On an iPhone, first add Alumnity to your home screen (Share → Add to Home Screen), open it from there, and turn them on in its Settings."
              : "This browser can't show notifications."}
          </p>
        ) : here ? (
          <p className="join__fine">
            On: new messages, requests, mentions and replies show here.{" "}
            <button type="button" className="join__switch" onClick={turnOff} disabled={busy}>
              Turn off for this browser
            </button>
          </p>
        ) : (
          <p className="join__fine">
            <button type="button" className="button button--secondary wf-small" onClick={turnOn} disabled={busy}>
              {busy ? "Turning on…" : "Turn on notifications"}
            </button>
          </p>
        )}
        {state.pushKey && state.browsers > 0 && (
          <label className="wf-check">
            <input type="checkbox" checked={state.push} onChange={(e) => save({ push: e.target.checked })} /> Send notifications to my devices ({state.browsers}{" "}
            {state.browsers === 1 ? "browser" : "browsers"})
          </label>
        )}
      </div>
      <label className="wf-check">
        <input type="checkbox" checked={state.emailDigest} onChange={(e) => save({ emailDigest: e.target.checked })} /> A daily email when something's waiting for me (at most one a day)
      </label>
      {note && (
        <p className={note.ok ? "join__note" : "join__problem"} role={note.ok ? "status" : "alert"}>
          {note.text}
        </p>
      )}
    </div>
  );
}
