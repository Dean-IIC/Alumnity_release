import { NextResponse } from "next/server";
import { markPaid } from "../../../../lib/server/causes";
import { webhookIsGenuine } from "../../../../lib/server/razorpay";

/*
 * Razorpay calls this when a payment is captured (set up in Razorpay → Settings →
 * Webhooks, events "payment.captured" and "order.paid", with RAZORPAY_WEBHOOK_SECRET).
 * Only calls signed with that secret count, and only for the order's exact amount, in
 * rupees, so a donation is recorded even if the donor's browser closed before it could tell us.
 */
type Payment = { id?: string; order_id?: string; amount?: number; currency?: string; status?: string };

export async function POST(request: Request) {
  const raw = await request.text();
  if (!webhookIsGenuine(raw, request.headers.get("x-razorpay-signature"))) return new NextResponse("Not allowed", { status: 401 });
  let event: { event?: string; payload?: { payment?: { entity?: Payment } } };
  try {
    event = JSON.parse(raw);
  } catch {
    return new NextResponse("Not JSON", { status: 400 });
  }
  const payment = event.payload?.payment?.entity;
  if (
    (event.event === "payment.captured" || event.event === "order.paid") &&
    payment?.id &&
    payment.order_id &&
    payment.status === "captured" &&
    // Every order is made in rupees (lib/server/razorpay.ts); a payment in anything else isn't one of ours.
    (payment.currency === undefined || payment.currency === "INR") &&
    typeof payment.amount === "number"
  ) {
    await markPaid(String(payment.order_id), String(payment.id), payment.amount);
  }
  // Anything else is acknowledged, so Razorpay doesn't keep retrying it.
  return NextResponse.json({ ok: true });
}
