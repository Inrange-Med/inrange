// India-time arithmetic for the medicine flow (docs/backend/medicine-flow.md):
// - daytime: when check-ins and reminders may reach a patient, 9 am to 9 pm;
// - working hours: when the care team answers, 10 am to 7 pm, Monday to Saturday. A task's due time
//   counts only working time, so "within 2 hours" asked at 6:30 pm is due at 11:30 the next morning.
const IST_MS = 5.5 * 3600_000;
const HOUR = 3600_000;

export const DAYTIME = { from: 9, to: 21 };
export const WORKING = { from: 10, to: 19, lastWeekday: 6 }; // ISO weekday: Monday 1 ... Saturday 6

/** The India-time wall clock of an instant. */
export function ist(d: Date) {
  const w = new Date(d.getTime() + IST_MS);
  return { date: w.toISOString().slice(0, 10), hour: w.getUTCHours() + w.getUTCMinutes() / 60, weekday: ((w.getUTCDay() + 6) % 7) + 1 };
}

/** The instant of an India-time date ("2026-11-17") and time ("09:00"). */
export function atIst(date: string, time: string): Date {
  return new Date(Date.parse(`${date}T${time}:00+05:30`));
}

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** `d`, or the next 9 am when it falls in the night. */
export function daytime(d: Date): Date {
  const { date, hour } = ist(d);
  if (hour >= DAYTIME.from && hour < DAYTIME.to) return d;
  return atIst(hour < DAYTIME.from ? date : addDays(date, 1), hh(DAYTIME.from));
}

const working = (weekday: number, hour: number) => weekday <= WORKING.lastWeekday && hour >= WORKING.from && hour < WORKING.to;

/** The next moment working hours start (or `d` itself when inside them). */
export function nextWorking(d: Date): Date {
  let { date, hour, weekday } = ist(d);
  if (working(weekday, hour)) return d;
  if (weekday <= WORKING.lastWeekday && hour < WORKING.from) return atIst(date, hh(WORKING.from));
  do { date = addDays(date, 1); weekday = (weekday % 7) + 1; } while (weekday > WORKING.lastWeekday);
  return atIst(date, hh(WORKING.from));
}

/** `hours` of working time after `from`. */
export function workingDue(from: Date, hours: number): Date {
  let at = nextWorking(from);
  let left = hours * HOUR;
  for (let guard = 0; left > 0 && guard < 30; guard++) {
    const { date } = ist(at);
    const close = atIst(date, hh(WORKING.to));
    const room = close.getTime() - at.getTime();
    if (left <= room) return new Date(at.getTime() + left);
    left -= room;
    at = nextWorking(new Date(close.getTime() + 1));
  }
  return at;
}

/** The next working morning after `from`'s day (the PRD's "next business day" call). */
export function nextWorkingMorning(from: Date): Date {
  const { date } = ist(from);
  return nextWorking(atIst(addDays(date, 1), "00:00"));
}

/** How a patient hears a due time: "within 2 hours", "by 11:30 am tomorrow", "on Monday morning". */
export function whenWords(due: Date, now = new Date()): string {
  const hours = (due.getTime() - now.getTime()) / HOUR;
  const a = ist(due), b = ist(now);
  if (a.date === b.date && hours <= 2.05) return hours <= 1.05 ? "within the hour" : "within 2 hours";
  const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })
    .format(due).replace(":00", "").replace(/\s?([ap])\.?m\.?/i, " $1m").toLowerCase();
  if (a.date === b.date) return `by ${time} today`;
  if (a.date === addDays(b.date, 1)) return `by ${time} tomorrow`;
  const day = new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone: "Asia/Kolkata" }).format(due);
  return `on ${day} by ${time}`;
}

/** "18 Nov" for messages. */
export const dayWords = (d: Date) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(d);

export { addDays };

if (import.meta.main) {
  const assert = (ok: boolean, what: string) => { if (!ok) throw new Error(what); };
  const at = (s: string) => new Date(Date.parse(s));
  const same = (a: Date, s: string) => a.getTime() === at(s).getTime();
  // Tuesday 17 Nov 2026
  assert(same(daytime(at("2026-11-17T23:30:00+05:30")), "2026-11-18T09:00:00+05:30"), "night moves to 9 am");
  assert(same(daytime(at("2026-11-17T07:00:00+05:30")), "2026-11-17T09:00:00+05:30"), "early morning moves to 9 am");
  assert(same(daytime(at("2026-11-17T15:00:00+05:30")), "2026-11-17T15:00:00+05:30"), "daytime stays");
  assert(same(workingDue(at("2026-11-17T12:00:00+05:30"), 2), "2026-11-17T14:00:00+05:30"), "2 h inside hours");
  assert(same(workingDue(at("2026-11-17T18:30:00+05:30"), 2), "2026-11-18T11:30:00+05:30"), "2 h across the evening");
  assert(same(workingDue(at("2026-11-21T18:00:00+05:30"), 2), "2026-11-23T11:00:00+05:30"), "Saturday evening to Monday");
  assert(same(workingDue(at("2026-11-22T12:00:00+05:30"), 1), "2026-11-23T11:00:00+05:30"), "Sunday to Monday");
  assert(same(nextWorkingMorning(at("2026-11-17T12:00:00+05:30")), "2026-11-18T10:00:00+05:30"), "next working morning");
  assert(same(nextWorkingMorning(at("2026-11-21T12:00:00+05:30")), "2026-11-23T10:00:00+05:30"), "Saturday's next is Monday");
  assert(whenWords(at("2026-11-17T14:00:00+05:30"), at("2026-11-17T12:00:00+05:30")) === "within 2 hours", "words: 2 hours");
  assert(whenWords(at("2026-11-18T11:30:00+05:30"), at("2026-11-17T18:30:00+05:30")) === "by 11:30 am tomorrow", "words: tomorrow");
  assert(ist(at("2026-11-22T12:00:00+05:30")).weekday === 7, "Sunday is 7");
  console.log("hours ok");
}
