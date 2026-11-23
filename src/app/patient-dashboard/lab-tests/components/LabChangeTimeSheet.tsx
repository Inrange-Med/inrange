"use client";

/**
 * Moving a booked home test to another time, in one sheet: the same day and time chooser as booking
 * (today or the next two days: 23 Nov 2026 call). Redcliffe allows two moves, and none once a collector
 * is assigned; the page only opens this sheet when a move is allowed.
 */

import { useCallback } from "react";
import Sheet from "@/components/ui/Sheet";
import SlotPicker, {
  NO_CLOSED_DAYS,
  type PickableSlot,
} from "@/components/ui/SlotPicker";
import { clockTime, spokenDay, toApiDate } from "@/lib/format/dateTime";
import { listLabSlots, rescheduleLabBooking } from "@/services/labTestService";
import type { LabBooking } from "@/types/labTest";
import styles from "../LabTestsPage.module.css";

export default function LabChangeTimeSheet({
  booking,
  open,
  onClose,
  onMoved,
}: {
  booking: LabBooking;
  open: boolean;
  onClose: () => void;
  onMoved: (updated: LabBooking) => void;
}) {
  const addressId = booking.addressId;
  const loadSlots = useCallback(
    async (day: Date): Promise<PickableSlot[]> =>
      (await listLabSlots(toApiDate(day), addressId)).map((slot) => ({
        id: slot.id,
        at: slot.startsAt,
        open: slot.open,
      })),
    [addressId],
  );

  const move = async (slot: PickableSlot) => {
    const updated = await rescheduleLabBooking(
      booking.id,
      toApiDate(new Date(slot.at)),
      slot.id,
    );
    onMoved(updated);
  };

  const booked = new Date(booking.collectionStartsAt);
  return (
    <Sheet open={open} onClose={onClose} title="Change the time">
      <p className={styles.text}>
        Booked for {spokenDay(booked)},{" "}
        <span className="num">{clockTime(booked)}</span>. You can move it{" "}
        {booking.reschedulesLeft === 1
          ? "once more"
          : `${booking.reschedulesLeft} more times`}
        .
      </p>
      {open && (
        <SlotPicker
          loadSlots={loadSlots}
          onConfirm={move}
          confirmLabel="Move to"
          dayCount={3}
          closedWeekdays={NO_CLOSED_DAYS}
        />
      )}
    </Sheet>
  );
}
