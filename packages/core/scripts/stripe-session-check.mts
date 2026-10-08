// Verifica el estado de la última Checkout Session creada en Stripe test mode.
import { fileURLToPath } from "node:url";
import path from "node:path";
import Stripe from "stripe";

process.loadEnvFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../apps/web/.env.local"));
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const sessions = await stripe.checkout.sessions.list({ limit: 5 });
for (const s of sessions.data) {
  console.log({
    id: s.id,
    status: s.status,
    payment_status: s.payment_status,
    amount_total: s.amount_total,
    payment_intent: s.payment_intent,
    created: new Date(s.created * 1000).toISOString(),
    expires_at: new Date(s.expires_at * 1000).toISOString(),
    url: s.url,
  });
}
const pis = await stripe.paymentIntents.list({ limit: 5 });
console.log("PaymentIntents:", pis.data.map((p) => ({ id: p.id, status: p.status, amount: p.amount })));
