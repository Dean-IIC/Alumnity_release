"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { confirmDonationNow, startDonationNow } from "../../lib/actions/causes";

/*
 * Giving to a cause: choose an amount, then Razorpay Checkout takes the payment (card,
 * UPI, net banking, wallets; we never see those details). When Checkout says it's paid,
 * the server checks Razorpay's signature before the gift counts.
 */

type Razorpay = new (options: Record<string, unknown>) => { open: () => void; on: (event: string, handler: (r: unknown) => void) => void };

const AMOUNTS = [500, 1000, 2500, 5000];

function loadCheckout(): Promise<Razorpay> {
  const w = window as unknown as { Razorpay?: Razorpay };
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error("no Razorpay")));
    script.onerror = () => reject(new Error("Checkout didn't load"));
    document.head.appendChild(script);
  });
}

export function Give({ causeId, name, email }: { causeId: number; name: string; email: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState("1000");
  const [anonymous, setAnonymous] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const finish = async (orderId: string, paymentId: string, signature: string) => {
    const done = await confirmDonationNow(orderId, paymentId, signature);
    setBusy(false);
    setNote(done?.ok ? { ok: true, text: done.message ?? "Thank you." } : { ok: false, text: (done?.ok === false && done.error) || "Something went wrong." });
    if (done?.ok) {
      setMessage("");
      router.refresh();
    }
  };

  const give = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNote(null);
    const order = await startDonationNow(causeId, amount, anonymous, message);
    if (!order.ok) {
      setBusy(false);
      setNote({ ok: false, text: order.error });
      return;
    }
    // Working on this computer without Razorpay keys: a pretend payment, clearly marked.
    if (order.standIn) {
      if (window.confirm(`Test payment (no real money is paid): give ₹${order.amount / 100} to “${order.title}”?`)) await finish(order.orderId, `pay_standin_${Date.now()}`, "stand-in");
      else setBusy(false);
      return;
    }
    try {
      const Checkout = await loadCheckout();
      const checkout = new Checkout({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: "INR",
        name: "HKBK College of Engineering",
        description: order.title.slice(0, 80),
        prefill: { name, email },
        theme: { color: getComputedStyle(document.documentElement).getPropertyValue("--color-blue").trim() || undefined },
        handler: (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
          finish(r.razorpay_order_id, r.razorpay_payment_id, r.razorpay_signature),
        modal: { ondismiss: () => setBusy(false) }
      });
      checkout.on("payment.failed", () => {
        setBusy(false);
        setNote({ ok: false, text: "The payment did not go through. No money was taken. You can try again." });
      });
      checkout.open();
    } catch {
      setBusy(false);
      setNote({ ok: false, text: "Razorpay's checkout didn't load. Check your internet connection and try again." });
    }
  };

  return (
    <form className="wf-card wf-stack give" onSubmit={give} aria-busy={busy}>
      <fieldset className="field">
        <legend className="field__label">How much</legend>
        <div className="wf-actions">
          {AMOUNTS.map((a) => (
            <button
              key={a}
              type="button"
              className={`button wf-small ${amount === String(a) ? "button--primary" : "button--secondary"}`}
              aria-pressed={amount === String(a)}
              onClick={() => setAmount(String(a))}
            >
              ₹{a.toLocaleString("en-IN")}
            </button>
          ))}
        </div>
        <label className="field">
          <span className="field__label">Or another amount (₹)</span>
          <input inputMode="numeric" pattern="[0-9,]*" maxLength={9} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} required />
        </label>
      </fieldset>
      <label className="field">
        <span className="field__label">Message (optional, shown with your donation)</span>
        <input maxLength={200} value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>
      <label className="wf-check">
        <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} /> Don't show my name
      </label>
      <div>
        <button className="button button--primary" type="submit" disabled={busy || !Number(amount)}>
          {busy ? "Opening…" : `Give ₹${Number(amount || 0).toLocaleString("en-IN")}`}
        </button>
      </div>
      <p className="wf-muted">Paid securely through Razorpay to HKBK College of Engineering. Only you and the college see how much you gave.</p>
      {note && (
        <p className={`wf-note ${note.ok ? "wf-note--ok" : "wf-note--error"}`} role={note.ok ? "status" : "alert"}>
          {note.text}
        </p>
      )}
    </form>
  );
}
