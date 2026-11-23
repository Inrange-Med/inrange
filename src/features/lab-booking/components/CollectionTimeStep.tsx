"use client";

/**
 * Step 4: the day and time. The app's slot chooser (Arhaan's Booking: days, then times grouped
 * Morning, Afternoon and Evening) over Redcliffe's one-hour windows at the chosen address. Redcliffe
 * offers times up to 4 days ahead; patients book tomorrow or the day after (23 Nov 2026 call); any other day the team arranges on a call.
 */

import { useCallback } from "react";
import { toApiDate } from "@/lib/format/dateTime";
import { listLabSlots } from "@/services/labTestService";
import type { LabPackage } from "@/types/labTest";
import SlotPicker, {
  NO_CLOSED_DAYS,
  type PickableSlot,
} from "@/components/ui/SlotPicker";
import styles from "../LabBookingFlow.module.css";
import { fastingSentence } from "@/lib/format/labPackage";

export default function CollectionTimeStep({
  addressId,
  labPackage,
  onChoose,
}: {
  addressId: number;
  labPackage: LabPackage;
  onChoose: (slot: PickableSlot) => void;
}) {
  const loadSlots = useCallback(
    async (day: Date): Promise<PickableSlot[]> =>
      (await listLabSlots(toApiDate(day), addressId)).map((slot) => ({
        id: slot.id,
        at: slot.startsAt,
        open: slot.open,
      })),
    [addressId],
  );

  return (
    <>
      {fastingSentence(labPackage.fastingNote) && (
        <p className={styles.fast}>{fastingSentence(labPackage.fastingNote)}</p>
      )}
      <SlotPicker
        loadSlots={loadSlots}
        onConfirm={async (slot) => onChoose(slot)}
        confirmLabel="Continue with"
        dayCount={2}
        firstDay={1}
        closedWeekdays={NO_CLOSED_DAYS}
        note="The collector comes within the hour you pick."
      />
    </>
  );
}
