/**
 * The days a booking can be made on, laid out like a calendar for SlotPicker: the next open days
 * from today, in Monday-to-Saturday rows. Every day is noon in India (lib/format/dateTime), so the
 * rows match the backend's calendar on a phone in any time zone.
 */

import { indiaNoon, inIndiaTime, shortDate } from "@/lib/format/dateTime";

export type BookingWeek = {
  name: string;
  range: string;
  monday: number;
  days: (Date | null)[];
};

const DAY_MS = 864e5;

/** 0 = Sunday, on India's calendar. */
const weekdayOf = (day: Date) => inIndiaTime(day).getUTCDay();

/** The Monday of a day's week (both are noon in India, so whole days apart). */
const mondayOf = (day: Date) =>
  new Date(day.getTime() - ((weekdayOf(day) + 6) % 7) * DAY_MS);

/** The next `count` open days from today, or from `firstDay` days ahead (1 = tomorrow). closedWeekdays: 0 = Sunday. */
export function upcomingOpenDays(
  count: number,
  closedWeekdays: number[],
  firstDay = 0,
) {
  const days: Date[] = [];
  for (let i = firstDay; days.length < count && i < firstDay + count * 2; i++) {
    const day = indiaNoon(i);
    if (!closedWeekdays.includes(weekdayOf(day))) days.push(day);
  }
  return days;
}

/** The open days in Monday-to-Saturday rows (at most two weeks), so the row reads like a calendar. */
export function groupIntoWeeks(days: Date[]): BookingWeek[] {
  const weeks = new Map<number, BookingWeek>();
  const thisMonday = mondayOf(indiaNoon(1)).getTime();
  days.forEach((day) => {
    const monday = mondayOf(day);
    const key = monday.getTime();
    if (!weeks.has(key)) {
      // two weeks at most, so the week switcher fits one row on a phone
      if (weeks.size === 2) return;
      const saturday = new Date(key + 5 * DAY_MS);
      const offset = Math.round((key - thisMonday) / (7 * DAY_MS));
      const sameMonth =
        inIndiaTime(monday).getUTCMonth() ===
        inIndiaTime(saturday).getUTCMonth();
      weeks.set(key, {
        name:
          offset === 0
            ? "This week"
            : offset === 1
              ? "Next week"
              : `Week of ${shortDate(monday.toISOString())}`,
        range: `${sameMonth ? inIndiaTime(monday).getUTCDate() : shortDate(monday.toISOString())} to ${shortDate(saturday.toISOString())}`,
        monday: key,
        days: Array.from({ length: 6 }, () => null),
      });
    }
    weeks.get(key)!.days[(weekdayOf(day) + 6) % 7] = day;
  });
  return [...weeks.values()];
}
