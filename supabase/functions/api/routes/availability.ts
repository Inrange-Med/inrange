// A doctor's own hours. Mounted at /api. Role DOCTOR (an admin may pass ?doctorId= to act for one).
//   GET  /doctor/availability                 -> { weekly: [{ weekday, start, end }], daysOff: ["YYYY-MM-DD"], usesDefault }
//   PUT  /doctor/availability  { weekly }     replaces the weekly hours
//   PUT  /doctor/days-off/:date               marks a day off
//   DELETE /doctor/days-off/:date             works that day again
// Slots come from these on demand (routes/care.ts prepareSlots). A change removes only open future
// slots, so they are made again from the new hours; booked and held times are never touched, and the
// answer says how many consultations stay booked outside the new hours.
import { Hono } from "hono";
import type { Context } from "hono";
import { sql } from "../lib/db.ts";
import { body, fail, intParam, ok, todayIST } from "../lib/http.ts";
import { requireUser } from "../lib/auth.ts";

export const availabilityRoutes = new Hono();

type Range = { weekday: number; start: string; end: string };

const TIME = /^([01]\d|2[0-3]):(00|30)$/;

/** The doctor acted for: the caller, or ?doctorId= when an admin calls. */
async function doctorFor(c: Context): Promise<number> {
  const me = await requireUser(c, "DOCTOR");
  if (me.role !== "ADMIN") return me.id;
  const id = intParam(c.req.query("doctorId"), "doctor");
  const [d] = await sql`select id from doctors where id = ${id}`;
  if (!d) fail(404, "That doctor was not found.");
  return id;
}

function validRanges(raw: unknown): Range[] {
  if (!Array.isArray(raw)) fail(400, "Send the weekly hours.");
  const ranges = (raw as Range[]).map((r) => ({ weekday: Number(r?.weekday), start: String(r?.start), end: String(r?.end) }));
  for (const r of ranges) {
    if (!Number.isInteger(r.weekday) || r.weekday < 1 || r.weekday > 7) fail(400, "A day of the week is not valid.");
    if (!TIME.test(r.start) || !TIME.test(r.end)) fail(400, "Times go in half hours, for example 09:00 or 14:30.");
    if (r.end <= r.start) fail(400, "Each range has to end after it starts.");
  }
  // no two ranges on one day may overlap
  const byDay = Object.groupBy(ranges, (r) => r.weekday);
  for (const day of Object.values(byDay)) {
    const sorted = [...(day ?? [])].sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 1; i < sorted.length; i++)
      if (sorted[i].start < sorted[i - 1].end) fail(400, "Two time ranges on the same day overlap.");
  }
  return ranges;
}

/** Booked or in-progress consultations from today on that fall outside the doctor's slots-to-be. */
async function bookedOutside(doctorId: number) {
  const [row] = await sql`
    select count(*)::int as n from appointments a join doctor_slots s on s.id = a.slot_id
    where a.doctor_id = ${doctorId} and a.status in ('Booked', 'InProgress') and s.slot_date >= ${todayIST()}::date
      and (exists (select 1 from doctor_days_off o where o.doctor_id = a.doctor_id and o.day = s.slot_date)
        or (exists (select 1 from doctor_hours h where h.doctor_id = a.doctor_id)
          and not exists (select 1 from doctor_hours h where h.doctor_id = a.doctor_id
            and h.weekday = extract(isodow from s.slot_date) and s.start_time >= h.start_time and s.end_time <= h.end_time)))`;
  return row.n as number;
}

async function current(doctorId: number) {
  const weekly = await sql`
    select weekday, to_char(start_time, 'HH24:MI') as start, to_char(end_time, 'HH24:MI') as end
    from doctor_hours where doctor_id = ${doctorId} order by weekday, start_time`;
  const off = await sql`
    select to_char(day, 'YYYY-MM-DD') as day from doctor_days_off
    where doctor_id = ${doctorId} and day >= ${todayIST()}::date order by day`;
  return {
    weekly: [...weekly],
    daysOff: off.map((o) => o.day as string),
    usesDefault: weekly.length === 0,
    bookedOutside: await bookedOutside(doctorId),
  };
}

/** Open future slots go, so the next look at those days makes them from the new hours. */
const clearOpenSlots = (doctorId: number, day?: string) => sql`
  delete from doctor_slots where doctor_id = ${doctorId} and status = 'Available'
    and slot_date >= ${todayIST()}::date ${day ? sql`and slot_date = ${day}::date` : sql``}`;

availabilityRoutes.get("/doctor/availability", async (c) => ok(c, await current(await doctorFor(c))));

availabilityRoutes.put("/doctor/availability", async (c) => {
  const doctorId = await doctorFor(c);
  const ranges = validRanges((await body<{ weekly?: unknown }>(c)).weekly);
  await sql.begin(async (tx) => {
    await tx`delete from doctor_hours where doctor_id = ${doctorId}`;
    if (ranges.length)
      await tx`insert into doctor_hours ${tx(ranges.map((r) => ({ doctor_id: doctorId, weekday: r.weekday, start_time: r.start, end_time: r.end })))}`;
  });
  await clearOpenSlots(doctorId);
  return ok(c, await current(doctorId), "Hours saved");
});

function futureDay(raw: string | undefined): string {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) fail(400, "Choose a valid date.");
  if (raw! < todayIST()) fail(400, "Choose today or a later day.");
  return raw!;
}

availabilityRoutes.put("/doctor/days-off/:date", async (c) => {
  const doctorId = await doctorFor(c);
  const day = futureDay(c.req.param("date"));
  await sql`insert into doctor_days_off (doctor_id, day) values (${doctorId}, ${day}) on conflict do nothing`;
  await clearOpenSlots(doctorId, day);
  return ok(c, await current(doctorId), "Day off added");
});

availabilityRoutes.delete("/doctor/days-off/:date", async (c) => {
  const doctorId = await doctorFor(c);
  const day = futureDay(c.req.param("date"));
  await sql`delete from doctor_days_off where doctor_id = ${doctorId} and day = ${day}`;
  return ok(c, await current(doctorId), "Day off removed");
});
