// What a patient's tap, pick or text does. One handler for every source: the WhatsApp webhook, the app's
// own buttons (routes/medicines.ts) and the admin panel's "play the patient's reply" while WhatsApp is in
// mock mode. Each reply is recorded once (patient_message_replies.provider_event_id), so Meta's retries
// and double taps act once. docs/backend/medicine-flow.md, "Replies".
import { sql } from "./db.ts";
import { whenWords } from "./hours.ts";
import { ACKS, type Action, SKIP_REASONS } from "./messages.ts";
import * as flow from "./medicineFlow.ts";
import { replyList, replyText } from "./notify.ts";

type Reply = { patientId: number; ref: number | null; code: string | null; text: string | null; eventId: string };

const STOP_WORDS = /^\s*(stop|unsubscribe|stop all|cancel)\s*$/i;
const words = (t: string, due: Date | null) => t.replace("{{when}}", due ? whenWords(due) : "soon");

/** Handles one reply; returns what it did, in a few words, for the timeline. */
export async function handleReply(r: Reply): Promise<string> {
  const [ref] = r.ref ? await sql`select * from patient_messages where id = ${r.ref} and patient_id = ${r.patientId}` : [];
  const code = (ref && r.code ? r.code : null) as Action | null;
  const [rec] = await sql`
    insert into patient_message_replies (patient_id, message_id, provider_event_id, action, text)
    values (${r.patientId}, ${ref?.id ?? null}, ${r.eventId || null}, ${code}, ${r.text?.slice(0, 2000) ?? null})
    on conflict (provider_event_id) do nothing returning id`;
  if (!rec) return "Already handled";
  const ack = (line: string) => replyText(r.patientId, rec.id, line);
  let outcome = "Recorded";

  try {
    if (!code) {
      if (r.text && STOP_WORDS.test(r.text)) {
        await ack(ACKS.STOP);
        await sql`update consents set revoked_at = now() where user_id = ${r.patientId} and consent_type = 'WHATSAPP' and revoked_at is null`;
        await sql`update patient_profiles set reminders = reminders || '{"whatsappReminders": false}'::jsonb where user_id = ${r.patientId}`;
        outcome = "Turned WhatsApp off (STOP)";
      } else {
        // anything typed goes to the team; one task and one acknowledgement a day, however many messages
        const due = await flow.questions(r.patientId, null, `wa:text:${r.patientId}:${new Date().toISOString().slice(0, 10)}`, r.text);
        const [first] = await sql`select count(*)::int as n from patient_message_replies
          where patient_id = ${r.patientId} and action is null and received_at::date = now()::date`;
        if (first.n <= 1) await ack(words(ACKS.FREE_TEXT, due));
        outcome = "Passed to the care team";
      }
    } else if (code === "ORDER") {
      outcome = ref.cart_id ? await flow.orderNow(ref.cart_id, r.patientId, "WhatsApp", `reply:${rec.id}`) : "No order on this message";
    } else if (code === "ELSEWHERE") {
      if (ref.cart_id) outcome = await flow.boughtElsewhere(ref.cart_id, r.patientId, "WhatsApp");
      await ack(ACKS.ELSEWHERE);
    } else if (code === "LATER") {
      outcome = ref.cart_id ? await flow.later(ref.cart_id) : "No order on this message";
      await ack(ACKS.LATER);
    } else if (code === "QUESTIONS") {
      const due = await flow.questions(r.patientId, ref.cart_id, `reply:${rec.id}`, "Tapped \"I have questions\" on WhatsApp");
      await ack(words(ACKS.QUESTIONS, due));
      outcome = "Call back booked";
    } else if (code === "GOOD" || code === "ISSUE") {
      const due = ref.medicine_order_id ? await flow.orderFeedback(ref.medicine_order_id, r.patientId, code, null) : null;
      await ack(code === "GOOD" ? ACKS.GOOD : words(ACKS.ISSUE, due));
      outcome = code === "GOOD" ? "Delivery: all good" : "Delivery problem: urgent call";
    } else if (code === "ENOUGH") {
      outcome = ref.medicine_order_id ? await flow.haveEnough(ref.medicine_order_id, r.patientId) : "No order on this message";
      await ack(ACKS.ENOUGH);
    } else if (code === "TAKEN" && ref.dose_event_id) {
      await flow.recordDose(ref.dose_event_id, r.patientId, "TAKEN", null);
      await ack(ACKS.TAKEN);
      outcome = "Dose taken";
    } else if (code === "SNOOZE" && ref.dose_event_id) {
      outcome = await flow.snoozeDose(ref.dose_event_id, r.patientId);
      await ack(outcome === "Reminding again in an hour" ? ACKS.SNOOZE : outcome + ".");
    } else if (code === "SKIP" && ref.dose_event_id) {
      await replyList(r.patientId, rec.id, ACKS.SKIP_REASON, SKIP_REASONS.map((s) => ({ code: s.code, label: s.label })), ref.id);
      outcome = "Asked why";
    } else if (code.startsWith("SKIP_") && ref.dose_event_id) {
      const reason = SKIP_REASONS.find((s) => s.code === code)?.reason ?? "OTHER";
      const due = await flow.recordDose(ref.dose_event_id, r.patientId, "SKIPPED", reason);
      await ack(reason === "SIDE_EFFECTS" ? words(ACKS.SIDE_EFFECTS, due) : ACKS.SKIPPED);
      outcome = `Dose skipped: ${reason.toLowerCase().replace("_", " ")}`;
    } else outcome = "Nothing to do";
  } catch (e) {
    console.error("whatsapp reply", rec.id, (e as Error).message);
    outcome = `Failed: ${(e as Error).message}`.slice(0, 200);
  }
  await sql`update patient_message_replies set outcome = ${outcome} where id = ${rec.id}`;
  return outcome;
}
