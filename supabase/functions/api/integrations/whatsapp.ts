// WhatsApp through Meta's Cloud API. Live when WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID are set;
// until then mock: nothing leaves, every message is recorded as sent (provider id "mock-..."), and the
// admin panel can play a patient's reply (POST /admin/medicine/messages/:id/reply).
// Webhook: GET /webhooks/whatsapp answers Meta's verification (WHATSAPP_VERIFY_TOKEN); POST is signed
// with the app secret (X-Hub-Signature-256, WHATSAPP_APP_SECRET). docs/backend/medicine-flow.md.
import { env, live } from "../lib/env.ts";
import type { Button } from "../lib/messages.ts";

export const whatsappLive = live.whatsapp;

const GRAPH = "https://graph.facebook.com/v21.0";

type Sent = { providerId: string };

async function post(payload: Record<string, unknown>): Promise<Sent> {
  const res = await fetch(`${GRAPH}/${env.whatsappPhoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.whatsappToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...payload }),
    signal: AbortSignal.timeout(15_000),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${out?.error?.message ?? "no detail"}`);
  const id = out?.messages?.[0]?.id;
  if (!id) throw new Error("WhatsApp: no message id in the answer");
  return { providerId: id };
}

/**
 * Uploads a file to WhatsApp and returns its media id, so the message carries the file itself and no
 * storage link ever leaves the server (lib/storage.ts). Media ids last 30 days on Meta's side.
 */
export async function uploadMedia(file: Blob, filename: string): Promise<string | null> {
  if (!whatsappLive()) return null;
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", file.type || "application/pdf");
  form.append("file", file, filename);
  const res = await fetch(`${GRAPH}/${env.whatsappPhoneNumberId}/media`, {
    method: "POST", headers: { Authorization: `Bearer ${env.whatsappToken}` }, body: form, signal: AbortSignal.timeout(20_000),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out?.id) throw new Error(`WhatsApp media ${res.status}: ${out?.error?.message ?? "no id"}`);
  return String(out.id);
}

const mock = (ref: string | number): Sent => ({ providerId: `mock-${ref}-${crypto.randomUUID().slice(0, 8)}` });

/**
 * A template message. `values` fill the body's {{n}}; quick replies carry `${ref}:${code}` back on a tap;
 * URL buttons are registered in WhatsApp Manager as APP_URL + path, so they need no parameter.
 */
export async function sendTemplate(input: {
  to: string; ref: number; name: string; values: string[]; buttons?: Button[]; documentId?: string | null; documentName?: string;
}): Promise<Sent> {
  if (!whatsappLive()) return mock(input.ref);
  const components: Record<string, unknown>[] = [];
  if (input.documentId)
    components.push({ type: "header", parameters: [{ type: "document", document: { id: input.documentId, filename: input.documentName ?? "prescription.pdf" } }] });
  if (input.values.length)
    components.push({ type: "body", parameters: input.values.map((text) => ({ type: "text", text: text.slice(0, 1000) })) });
  (input.buttons ?? []).forEach((b, index) => {
    if (b.kind === "QUICK")
      components.push({ type: "button", sub_type: "quick_reply", index: String(index), parameters: [{ type: "payload", payload: `${input.ref}:${b.code}` }] });
  });
  return await post({ to: `91${input.to}`, type: "template", template: { name: input.name, language: { code: "en" }, components } });
}

/** A plain message, allowed only inside the 24 hours after the patient wrote or tapped. */
export async function sendText(to: string, ref: number, text: string): Promise<Sent> {
  if (!whatsappLive()) return mock(ref);
  return await post({ to: `91${to}`, type: "text", text: { body: text, preview_url: false } });
}

/** A list to pick from (the skip reasons), also inside the 24-hour window. */
export async function sendList(to: string, ref: number, text: string, rows: { code: string; label: string }[]): Promise<Sent> {
  if (!whatsappLive()) return mock(ref);
  return await post({
    to: `91${to}`, type: "interactive",
    interactive: {
      type: "list", body: { text },
      action: { button: "Choose", sections: [{ title: "Reasons", rows: rows.map((r) => ({ id: `${ref}:${r.code}`, title: r.label.slice(0, 24) })) }] },
    },
  });
}

/** Meta signs the raw body with the app secret: X-Hub-Signature-256: sha256=<hex>. */
export async function webhookSignatureValid(raw: string, header: string): Promise<boolean> {
  if (!env.whatsappAppSecret || !header.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.whatsappAppSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  const given = header.slice(7);
  if (given.length !== hex.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

export type Inbound =
  | { type: "reply"; eventId: string; from: string; ref: number | null; code: string | null; text: string | null }
  | { type: "status"; providerId: string; status: "sent" | "delivered" | "read" | "failed"; error: string | null };

/** What a webhook body says, flattened: replies (taps, list picks, text) and delivery statuses. */
export function parseWebhook(payload: unknown): Inbound[] {
  const out: Inbound[] = [];
  const entries = (payload as { entry?: { changes?: { value?: Record<string, unknown> }[] }[] })?.entry ?? [];
  for (const entry of entries)
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      // deno-lint-ignore no-explicit-any
      for (const m of (value.messages as Record<string, any>[] | undefined) ?? []) {
        // a quick reply on a template arrives as "button" (payload); on a session message as "interactive"
        const payloadId: string | null = m.button?.payload ?? m.interactive?.button_reply?.id ?? m.interactive?.list_reply?.id ?? null;
        const [refRaw, code] = payloadId?.includes(":") ? payloadId.split(":", 2) : [null, null];
        const ref = refRaw && /^\d+$/.test(refRaw) ? Number(refRaw) : null;
        out.push({
          type: "reply", eventId: String(m.id ?? ""), from: String(m.from ?? "").replace(/^91/, "").slice(-10),
          ref, code: code ?? null, text: m.text?.body ?? m.button?.text ?? null,
        });
      }
      // deno-lint-ignore no-explicit-any
      for (const s of (value.statuses as Record<string, any>[] | undefined) ?? [])
        if (["sent", "delivered", "read", "failed"].includes(s.status))
          out.push({ type: "status", providerId: String(s.id ?? ""), status: s.status, error: s.errors?.[0]?.title ?? null });
    }
  return out;
}

if (import.meta.main) {
  // deno run integrations/whatsapp.ts: the webhook shapes Meta sends
  const assert = (ok: boolean, what: string) => { if (!ok) throw new Error(what); };
  const [tap] = parseWebhook({ entry: [{ changes: [{ value: { messages: [{ id: "wamid.1", from: "919810000001", type: "button", button: { payload: "41:ORDER", text: "Order now" } }] } }] }] });
  assert(tap.type === "reply" && tap.ref === 41 && tap.code === "ORDER" && tap.from === "9810000001", "template quick reply");
  const [pick] = parseWebhook({ entry: [{ changes: [{ value: { messages: [{ id: "wamid.2", from: "919810000001", type: "interactive", interactive: { type: "list_reply", list_reply: { id: "77:SKIP_FORGOT", title: "Forgot" } } }] } }] }] });
  assert(pick.type === "reply" && pick.ref === 77 && pick.code === "SKIP_FORGOT", "list reply");
  const [text] = parseWebhook({ entry: [{ changes: [{ value: { messages: [{ id: "wamid.3", from: "919810000001", type: "text", text: { body: "STOP" } }] } }] }] });
  assert(text.type === "reply" && text.ref === null && text.text === "STOP", "free text");
  const [status] = parseWebhook({ entry: [{ changes: [{ value: { statuses: [{ id: "wamid.9", status: "read" }] } }] }] });
  assert(status.type === "status" && status.status === "read", "status");
  console.log("whatsapp ok");
}
