// What a tap, pick or message on WhatsApp does. One handler for every source: the WhatsApp webhook, the
// app's own buttons (routes/medicines.ts) and the admin panel's "play the reply" in test mode. Each reply is
// recorded once by Meta's event id, and each button acts once per message (a double tap is one tap).
// Doctors can only opt out here; everything else they do in the app. docs/backend/whatsapp.md, "Replies".
import { sql } from "./db.ts";
import { ist, whenWords } from "./hours.ts";
import { ACKS, type Action, SKIP_REASONS } from "./messages.ts";
import * as flow from "./medicineFlow.ts";
import { replyList, replyText } from "./notify.ts";

type Reply = { userId: number; role: string; ref: number | null; code: string | null; text: string | null; eventId: string };

/** STOP and its usual forms, in English and Hindi, with any punctuation. "Cancel" is not one: it usually means an order. */
const STOP_WORDS = /^(stop|stop all|stop messages|unsubscribe|opt out|band karo|band kar do|बंद|बंद करो|रोको)$/i;
const isStop = (t: string) => STOP_WORDS.test(t.trim().toLowerCase().replace(/[.!?,;:'"]+/g, "").replace(/\s+/g, " "));
const words = (t: string, due: Date | null) => t.replace("{{when}}", due ? whenWords(due) : "soon");

async function stop(userId: number) {
  await sql`update consents set revoked_at = now() where user_id = ${userId} and consent_type = 'WHATSAPP' and revoked_at is null`;
  await sql`update patient_profiles set reminders = reminders || '{"whatsappReminders": false}'::jsonb where user_id = ${userId}`;
}

/** Handles one reply; returns what it did, in a few words, for the timeline. */
export async function handleReply(r: Reply): Promise<string> {
  const [ref] = r.ref ? await sql`select * from patient_messages where id = ${r.ref} and patient_id = ${r.userId}` : [];
  const code = (ref && r.code ? r.code : null) as Action | null;
  // a second reply with the same event id (Meta's retry), or a second tap of the same button, is dropped
  const [rec] = await sql`
    insert into patient_message_replies (patient_id, message_id, provider_event_id, action, text)
    values (${r.userId}, ${ref?.id ?? null}, ${r.eventId || null}, ${code}, ${r.text?.slice(0, 2000) ?? null})
    on conflict do nothing returning id`;
  if (!rec) return "Already handled";
  const ack = (line: string) => replyText(r.userId, rec.id, line);
  let outcome = "Recorded";

  try {
    if (!code && r.text && isStop(r.text)) {
      await stop(r.userId);
      await ack(ACKS.STOP);
      outcome = "Turned WhatsApp off (STOP)";
    } else if (r.role !== "PATIENT") {
      outcome = "Not a patient: nothing to do";
    } else if (!code) {
      // anything written goes to the team; one task and one acknowledgement a day (India time), however many messages
      const today = ist(new Date()).date;
      const due = await flow.questions(r.userId, null, `wa:text:${r.userId}:${today}`, r.text);
      const [first] = await sql`select count(*)::int as n from patient_message_replies
        where patient_id = ${r.userId} and action is null and (received_at at time zone 'Asia/Kolkata')::date = ${today}::date`;
      if (first.n <= 1) await ack(words(ACKS.FREE_TEXT, due));
      outcome = "Passed to the care team";
    } else if (code === "CLEAR") {
      await ack(ACKS.CLEAR);
      outcome = "All clear";
    } else if (code === "ELSEWHERE") {
      if (ref.cart_id) outcome = await flow.boughtElsewhere(ref.cart_id, r.userId, "WhatsApp");
      await ack(ACKS.ELSEWHERE);
    } else if (code === "LATER") {
      outcome = ref.cart_id ? await flow.later(ref.cart_id) : "No order on this message";
      await ack(outcome === flow.LAST_CHECK_IN ? ACKS.LATER_LAST : ACKS.LATER);
    } else if (code === "QUESTIONS") {
      const due = await flow.questions(r.userId, ref.cart_id, `reply:${rec.id}`, 'Tapped "I have questions" on WhatsApp');
      await ack(words(ACKS.QUESTIONS, due));
      outcome = "Call back booked";
    } else if (code === "GOOD" || code === "ISSUE") {
      const due = ref.medicine_order_id ? await flow.orderFeedback(ref.medicine_order_id, r.userId, code, null) : null;
      await ack(code === "GOOD" ? ACKS.GOOD : words(ACKS.ISSUE, due));
      outcome = code === "GOOD" ? "Delivery: all good" : "Delivery problem: urgent call";
    } else if (code === "ENOUGH") {
      outcome = ref.medicine_order_id ? await flow.haveEnough(ref.medicine_order_id, r.userId) : "No order on this message";
      await ack(ACKS.ENOUGH);
    } else if (code === "TAKEN" && ref.dose_event_id) {
      await flow.recordDose(ref.dose_event_id, r.userId, "TAKEN", null);
      await ack(ACKS.TAKEN);
      outcome = "Dose taken";
    } else if (code === "SNOOZE" && ref.dose_event_id) {
      outcome = await flow.snoozeDose(ref.dose_event_id, r.userId);
      await ack(outcome === "Reminding again in an hour" ? ACKS.SNOOZE : outcome + ".");
    } else if (code === "SKIP" && ref.dose_event_id) {
      await replyList(r.userId, rec.id, ACKS.SKIP_REASON, SKIP_REASONS.map((s) => ({ code: s.code, label: s.label })), ref.id);
      outcome = "Asked why";
    } else if (code.startsWith("SKIP_") && ref.dose_event_id) {
      const reason = SKIP_REASONS.find((s) => s.code === code)?.reason ?? "OTHER";
      const due = await flow.recordDose(ref.dose_event_id, r.userId, "SKIPPED", reason);
      await ack(reason === "SIDE_EFFECTS" ? words(ACKS.SIDE_EFFECTS, due) : ACKS.SKIPPED);
      outcome = `Dose skipped: ${reason.toLowerCase().replace("_", " ")}`;
    } else outcome = "Nothing to do";
  } catch (e) {
    // the reply is recorded, so Meta's retry would be dropped: a person picks it up instead
    console.error("whatsapp reply", rec.id, (e as Error).message);
    outcome = `Failed: ${(e as Error).message}`.slice(0, 200);
    await flow.openTask(sql, {
      kind: "QUESTIONS", priority: "HIGH", patientId: r.role === "PATIENT" ? r.userId : null,
      title: "A WhatsApp reply could not be handled", detail: `${code ?? "Message"}${r.text ? `: ${r.text.slice(0, 300)}` : ""}. Call and sort it out.`,
      dueAt: new Date(), dedupeKey: `reply:${rec.id}:failed`,
    }).catch((err) => console.error("fallback task", rec.id, (err as Error).message));
  }
  await sql`update patient_message_replies set outcome = ${outcome} where id = ${rec.id}`;
  return outcome;
}
