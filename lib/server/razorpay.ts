import { createHmac, timingSafeEqual } from "node:crypto";
import { randomToken } from "./secrets";

/*
 * Razorpay, for donations: every payment goes to the college's one Razorpay account.
 *
 *   1. Our server makes an order for the amount (Orders API, with the secret key).
 *   2. The browser opens Razorpay Checkout with that order; the donor pays there (we never
 *      see card or UPI details).
 *   3. Razorpay hands the browser a payment id and a signature over "order|payment", made
 *      with our secret: our server checks it before counting the donation. Razorpay also
 *      calls our webhook (app/api/razorpay/webhook), signed with the webhook secret, so a
 *      donation counts even if the donor closes the page too soon.
 *
 * Keys: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET (docs/deploy.md).
 * Test-mode keys (rzp_test_…) take test payments only. Without keys, on this computer
 * (next dev), a stand-in takes pretend payments so the pages can be tried; in production
 * donations are simply unavailable until the keys are set.
 */

export type Order = { id: string; amount: number; keyId: string; stand_in: boolean };

const keyId = () => process.env.RAZORPAY_KEY_ID ?? "";
const keySecret = () => process.env.RAZORPAY_KEY_SECRET ?? "";

export const razorpayReady = () => Boolean(keyId() && keySecret());
/** The pretend payments: only without keys, and never in production. */
export const standIn = () => !razorpayReady() && process.env.NODE_ENV !== "production";
export const donationsOpen = () => razorpayReady() || standIn();

const hmac = (secret: string, text: string) => createHmac("sha256", secret).update(text).digest("hex");

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** An order for `amount` paise. */
export async function createOrder(amount: number, receipt: string, notes: Record<string, string>): Promise<Order> {
  if (standIn()) return { id: `order_standin_${randomToken(10)}`, amount, keyId: "", stand_in: true };
  if (!razorpayReady()) throw new Error("Razorpay isn't set up.");
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Basic ${Buffer.from(`${keyId()}:${keySecret()}`).toString("base64")}` },
    body: JSON.stringify({ amount, currency: "INR", receipt: receipt.slice(0, 40), notes }),
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error(`Razorpay order failed (${response.status})`);
  const order = (await response.json()) as { id: string; amount: number };
  return { id: order.id, amount: order.amount, keyId: keyId(), stand_in: false };
}

/** Whether Checkout's signature over "order|payment" is ours. */
export function paymentIsGenuine(orderId: string, paymentId: string, signature: string): boolean {
  if (standIn()) return orderId.startsWith("order_standin_") && signature === "stand-in";
  if (!razorpayReady() || !orderId || !paymentId || !signature) return false;
  return same(hmac(keySecret(), `${orderId}|${paymentId}`), signature);
}

/** Whether a webhook call really came from Razorpay (its signature over the raw body). */
export function webhookIsGenuine(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  return same(hmac(secret, rawBody), signature);
}
