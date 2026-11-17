// WhatsApp through Meta's Cloud API (Graph v26.0). Live when WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID and
// WHATSAPP_APP_SECRET are set; until then test mode: nothing leaves, every message is recorded as sent
// (provider id "mock-..."), and the admin panel can play a reply (POST /admin/medicine/messages/:id/reply).
// Webhook: GET /webhooks/whatsapp answers Meta's verification (WHATSAPP_VERIFY_TOKEN); POST is signed with
// the app secret (X-Hub-Signature-256). Templates are created from lib/messages.ts (syncTemplates, needs
// WHATSAPP_BUSINESS_ACCOUNT_ID). docs/backend/whatsapp.md.
import { env, live } from "../lib/env.ts";
import { type Button, type Template, templateDefinition } from "../lib/messages.ts";

export const whatsappLive = live.whatsapp;

const GRAPH = "https://graph.facebook.com/v26.0";

type Sent = { providerId: string };

/** A send Meta refused. `retry`: worth another try later (rate limits, Meta's own hiccups); otherwise final. */
export class WhatsAppError extends Error {
  code: number;
  retry: boolean;
  constructor(code: number, message: string, retry: boolean) {
    super(`${code}: ${message}`.slice(0, 500));
    this.code = code;
    this.retry = retry;
  }
}

// Meta's error codes (developers.facebook.com/documentation/business-messaging/whatsapp/support/error-codes):
// rate limits, pair limits and temporary errors are retried; anything else (bad number, template missing or
// paused, policy, expired token) would fail the same way again
const RETRY = new Set([1, 2, 4, 17, 341, 130429, 131000, 131016, 131049, 131056, 132015, 133004]);
const retryable = (code: number, status: number) => RETRY.has(code) || status >= 500;

async function graph(path: string, init: RequestInit & { timeout?: number }) {
  let res: Response;
  try {
    res = await fetch(`${GRAPH}/${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${env.whatsappToken}`, ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...init.headers },
      signal: AbortSignal.timeout(init.timeout ?? 15_000),
    });
  } catch (e) {
    // a timeout or a dropped connection: Meta may have accepted it, so the retry waits (lib/notify.ts backs off)
    throw new WhatsAppError(0, `network: ${(e as Error).message}`, true);
  }
  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = out?.error ?? {};
    const code = Number(err.code) || res.status;
    const detail = err.error_data?.details ?? err.message ?? "no detail";
    if (code === 190 || res.status === 401) console.error("WHATSAPP TOKEN REJECTED: set a new WHATSAPP_TOKEN", detail);
    throw new WhatsAppError(code, detail, retryable(code, res.status));
  }
  return out;
}

async function post(ref: number | string, payload: Record<string, unknown>): Promise<Sent> {
  const out = await graph(`${env.whatsappPhoneNumberId}/messages`, {
    method: "POST",
    // biz_opaque_callback_data comes back on every status, so a status that beats our own write still finds the row
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", biz_opaque_callback_data: `pm:${ref}`, ...payload }),
  });
  const id = out?.messages?.[0]?.id;
  if (!id) throw new WhatsAppError(0, "no message id in the answer", true);
  return { providerId: id };
}

const mock = (ref: string | number): Sent => ({ providerId: `mock-${ref}-${crypto.randomUUID().slice(0, 8)}` });
/** E.164 with the plus: without it Meta prepends the business number's own country code. */
const e164 = (mobile: string) => `+91${mobile}`;
/** Meta refuses parameters with newlines, tabs, more than four spaces in a row, or nothing in them. */
export const cleanParam = (text: string) => text.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim().slice(0, 900) || "-";

/**
 * A template message. `values` fill the body's {{n}}; quick replies carry `${ref}:${code}` back on a tap;
 * each dynamic URL button takes the next of `links` as the id after its fixed path.
 */
export async function sendTemplate(input: {
  to: string; ref: number; template: Template; values: string[]; links?: string[];
}): Promise<Sent> {
  if (!whatsappLive()) return mock(input.ref);
  const components: Record<string, unknown>[] = [];
  if (input.values.length)
    components.push({ type: "body", parameters: input.values.map((text) => ({ type: "text", text: cleanParam(text) })) });
  let link = 0;
  (input.template.buttons ?? []).forEach((b: Button, index) => {
    if (b.kind === "QUICK")
      components.push({ type: "button", sub_type: "quick_reply", index: String(index), parameters: [{ type: "payload", payload: `${input.ref}:${b.code}` }] });
    else if (b.dynamic)
      components.push({ type: "button", sub_type: "url", index: String(index), parameters: [{ type: "text", text: encodeURIComponent(input.links?.[link++] ?? "") }] });
  });
  return await post(input.ref, {
    to: e164(input.to), type: "template", template: { name: input.template.name, language: { code: "en" }, components },
  });
}

/** A plain message, allowed only inside the 24 hours after the person wrote or tapped. */
export async function sendText(to: string, ref: number, text: string): Promise<Sent> {
  if (!whatsappLive()) return mock(ref);
  return await post(ref, { to: e164(to), type: "text", text: { body: text, preview_url: false } });
}

/** A list to pick from (the skip reasons), also inside the 24-hour window. */
export async function sendList(to: string, ref: number, text: string, rows: { code: string; label: string }[]): Promise<Sent> {
  if (!whatsappLive()) return mock(ref);
  return await post(ref, {
    to: e164(to), type: "interactive",
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
  | { type: "status"; providerId: string; ref: number | null; status: "sent" | "delivered" | "read" | "failed"; error: string | null };

/** Only Indian mobiles are ours: a foreign number's last ten digits must never match a patient. */
const indianMobile = (wa: unknown) => {
  const m = /^91([6-9]\d{9})$/.exec(String(wa ?? ""));
  return m ? m[1] : null;
};
// what someone sent that is not words or a tap: passed to the team as a note (a photo of a report, a voice note)
const MEDIA: Record<string, string> = {
  image: "a photo", audio: "a voice note", video: "a video", document: "a document", sticker: "a sticker", location: "a location", contacts: "a contact",
};

/**
 * What a webhook body says, flattened: replies (taps, list picks, text, media) and delivery statuses, for
 * our business number only. Reactions, edits, deletions and system notices are left out.
 */
export function parseWebhook(payload: unknown, phoneNumberId = env.whatsappPhoneNumberId): Inbound[] {
  const out: Inbound[] = [];
  const entries = (payload as { entry?: { changes?: { field?: string; value?: Record<string, unknown> }[] }[] })?.entry ?? [];
  for (const entry of entries)
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const metadata = value.metadata as { phone_number_id?: string } | undefined;
      if (phoneNumberId && metadata?.phone_number_id && metadata.phone_number_id !== phoneNumberId) continue;
      // deno-lint-ignore no-explicit-any
      for (const m of (value.messages as Record<string, any>[] | undefined) ?? []) {
        const from = indianMobile(m.from);
        if (!from || !m.id) continue;
        let text: string | null = null;
        if (m.type === "text") text = m.text?.body ?? null;
        else if (m.type === "button") text = m.button?.text ?? null;
        else if (MEDIA[m.type]) text = `(sent ${MEDIA[m.type]}${m[m.type]?.caption ? `: ${m[m.type].caption}` : ""})`;
        else if (m.type !== "interactive") continue;
        // a quick reply on a template arrives as "button" (payload); on a session message as "interactive"
        const payloadId: string | null = m.button?.payload ?? m.interactive?.button_reply?.id ?? m.interactive?.list_reply?.id ?? null;
        const [refRaw, code] = payloadId?.includes(":") ? payloadId.split(":", 2) : [null, null];
        out.push({
          type: "reply", eventId: String(m.id), from,
          ref: refRaw && /^\d+$/.test(refRaw) ? Number(refRaw) : null, code: code ?? null, text,
        });
      }
      // deno-lint-ignore no-explicit-any
      for (const s of (value.statuses as Record<string, any>[] | undefined) ?? [])
        if (["sent", "delivered", "read", "failed"].includes(s.status)) {
          const e = s.errors?.[0];
          const ref = /^pm:(\d+)$/.exec(String(s.biz_opaque_callback_data ?? ""));
          out.push({
            type: "status", providerId: String(s.id ?? ""), ref: ref ? Number(ref[1]) : null, status: s.status,
            error: e ? `${e.code}: ${e.error_data?.details ?? e.title ?? e.message ?? ""}`.slice(0, 500) : null,
          });
        }
    }
  return out;
}

/**
 * Submits every template in lib/messages.ts that Meta does not have yet, and returns each one's status
 * (APPROVED, PENDING, REJECTED, PAUSED...). Safe to run again: existing templates are left alone.
 */
export async function syncTemplates(templates: Template[], appUrl: string) {
  if (!whatsappLive() || !env.whatsappBusinessAccountId) throw new WhatsAppError(0, "Set WHATSAPP_BUSINESS_ACCOUNT_ID and the WhatsApp keys first.", false);
  const have = new Map<string, { status: string; category: string; reason?: string }>();
  let next: string | null = `${env.whatsappBusinessAccountId}/message_templates?fields=name,status,category,language,rejected_reason&limit=200`;
  while (next) {
    const page = await graph(next.replace(`${GRAPH}/`, ""), { method: "GET" });
    for (const t of page.data ?? []) if (t.language === "en") have.set(t.name, { status: t.status, category: t.category, reason: t.rejected_reason });
    next = page.paging?.next ?? null;
  }
  const out: { name: string; status: string; category: string | null; note: string | null }[] = [];
  for (const t of templates) {
    const known = have.get(t.name);
    if (known) {
      out.push({ name: t.name, status: known.status, category: known.category, note: known.reason && known.reason !== "NONE" ? known.reason : null });
      continue;
    }
    try {
      const made = await graph(`${env.whatsappBusinessAccountId}/message_templates`, { method: "POST", body: JSON.stringify(templateDefinition(t, appUrl)) });
      out.push({ name: t.name, status: made.status ?? "PENDING", category: made.category ?? "UTILITY", note: "Submitted" });
    } catch (e) {
      out.push({ name: t.name, status: "NOT_SUBMITTED", category: null, note: (e as Error).message });
    }
  }
  return out;
}

if (import.meta.main) {
  // deno run integrations/whatsapp.ts: the webhook shapes Meta sends
  const assert = (ok: boolean, what: string) => { if (!ok) throw new Error(what); };
  const wrap = (value: Record<string, unknown>) => ({ entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "PN" }, ...value } }] }] });
  const [tap] = parseWebhook(wrap({ messages: [{ id: "wamid.1", from: "919810000001", type: "button", button: { payload: "41:CLEAR", text: "All clear" } }] }), "PN");
  assert(tap.type === "reply" && tap.ref === 41 && tap.code === "CLEAR" && tap.from === "9810000001", "template quick reply");
  const [pick] = parseWebhook(wrap({ messages: [{ id: "wamid.2", from: "919810000001", type: "interactive", interactive: { type: "list_reply", list_reply: { id: "77:SKIP_FORGOT", title: "Forgot" } } }] }), "PN");
  assert(pick.type === "reply" && pick.ref === 77 && pick.code === "SKIP_FORGOT", "list reply");
  const [text] = parseWebhook(wrap({ messages: [{ id: "wamid.3", from: "919810000001", type: "text", text: { body: "STOP" } }] }), "PN");
  assert(text.type === "reply" && text.ref === null && text.text === "STOP", "free text");
  assert(parseWebhook(wrap({ messages: [{ id: "wamid.4", from: "19171234567", type: "text", text: { body: "STOP" } }] }), "PN").length === 0, "foreign number ignored");
  assert(parseWebhook(wrap({ messages: [{ id: "wamid.5", from: "919810000001", type: "reaction", reaction: { emoji: "👍" } }] }), "PN").length === 0, "reaction ignored");
  assert(parseWebhook(wrap({ messages: [{ id: "wamid.6", from: "919810000001", type: "text", text: { body: "hi" } }] }), "OTHER").length === 0, "another number's webhook");
  const [photo] = parseWebhook(wrap({ messages: [{ id: "wamid.7", from: "919810000001", type: "image", image: { caption: "my report" } }] }), "PN");
  assert(photo.type === "reply" && photo.text === "(sent a photo: my report)", "media as a note");
  const [status] = parseWebhook(wrap({ statuses: [{ id: "wamid.9", status: "failed", biz_opaque_callback_data: "pm:12", errors: [{ code: 131026, title: "Message undeliverable" }] }] }), "PN");
  assert(status.type === "status" && status.ref === 12 && status.error === "131026: Message undeliverable", "failed status");
  assert(cleanParam("Dr.\nMehta    Rao ") === "Dr. Mehta Rao" && cleanParam("  ") === "-", "params cleaned");
  console.log("whatsapp ok");
}
