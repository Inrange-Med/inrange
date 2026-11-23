"use client";

/*
  The patient's consultations, for the team (23 Nov 2026). Patients book and move their own in the app; this
  is for when the team does it for them (19 Nov 2026 call: someone on the team books the consultation):
  book one with any doctor at any open time, move one (to another time, or another doctor's), or cancel
  one with the reason. A consultation the patient agreed to have recorded (they are asked on their Join
  screen, each call) can be watched here by an admin; the recording is kept for 15 days.
  A coach sees the list only.
*/

import { useState } from "react";
import DatePicker from "@/components/ui/DatePicker";
import { useToast } from "@/components/ui/ToastProvider";
import { useApiResource } from "@/hooks/useApiResource";
import { useNow } from "@/hooks/useNow";
import { combineDateAndTime, toApiDate } from "@/lib/format/dateTime";
import { errorMessage } from "@/lib/http/apiClient";
import { listDoctors } from "@/services/adminService";
import {
  bookConsultation,
  cancelConsultation,
  getRecordingLink,
  listDoctorSlots,
} from "@/services/medicineOpsService";
import type { OpsConsultation, OpsPatient } from "@/types/medicineOps";
import adminStyles from "@/app/admin/styles/AdminSurfaces.module.css";
import s from "./Medicine.module.css";
import { clockWords, when } from "./words";

const STATUS: Record<OpsConsultation["status"], string> = {
  Booked: "Booked",
  InProgress: "In progress",
  Completed: "Done",
  Cancelled: "Cancelled",
  NoShow: "No one joined",
};
const DAY = 86_400_000;

/** Choose a doctor, a day and a free time; books a new consultation, or moves `moving`. */
function SlotForm({
  data,
  moving,
  onDone,
  onClose,
}: {
  data: OpsPatient;
  moving: OpsConsultation | null;
  onDone: () => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const doctors = useApiResource("admin-doctors", listDoctors);
  const active = (doctors.data ?? []).filter((d) => d.active);
  const [doctorId, setDoctorId] = useState(
    moving?.doctorId ?? data.patient.doctors[0]?.id ?? "",
  );
  const now = useNow(60_000);
  const today = toApiDate(new Date(now));
  const [date, setDate] = useState(today);
  const [slotId, setSlotId] = useState("");
  const [busy, setBusy] = useState(false);
  const slots = useApiResource(
    doctorId ? `slots-${doctorId}-${date}` : null,
    () => listDoctorSlots(doctorId, date),
  );
  // free times still to come (today's earlier ones have passed)
  const free = (slots.data ?? []).filter(
    (slot) =>
      slot.free &&
      Date.parse(combineDateAndTime(date, slot.startTime)) > now,
  );

  const save = async () => {
    if (busy || !slotId) return;
    setBusy(true);
    try {
      toast(await bookConsultation(data.patient.id, slotId, moving?.id));
      onDone();
    } catch (caught) {
      toast(errorMessage(caught, "That did not work. Try again."));
      slots.reload();
      setSlotId("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={s.planForm}>
      <select
        className={s.input}
        value={doctorId}
        aria-label="Doctor"
        onChange={(e) => {
          setDoctorId(e.target.value);
          setSlotId("");
        }}
      >
        <option value="">Choose the doctor</option>
        {active.map((d) => (
          <option key={d.id} value={d.id}>
            {d.fullName}
            {data.patient.doctors.some((own) => own.id === String(d.id))
              ? " (their doctor)"
              : ""}
          </option>
        ))}
      </select>
      <DatePicker
        label="Day of the consultation"
        value={date}
        min={today}
        max={toApiDate(new Date(now + 60 * DAY))}
        onChange={(next) => {
          setDate(next);
          setSlotId("");
        }}
      />
      {doctorId &&
        (slots.error && !slots.data ? (
          <span className={adminStyles.muted}>The times could not load.</span>
        ) : !slots.data ? (
          <span className={adminStyles.muted}>Loading the times</span>
        ) : free.length === 0 ? (
          <span className={adminStyles.muted}>
            No free time that day. Choose another day, or add hours for this
            doctor under Doctors.
          </span>
        ) : (
          <span className={s.chips} role="radiogroup" aria-label="Time">
            {free.map((slot) => (
              <button
                key={slot.id}
                type="button"
                role="radio"
                aria-checked={slotId === slot.id}
                className={`${s.chip} num`}
                data-on={slotId === slot.id || undefined}
                onClick={() => setSlotId(slot.id)}
              >
                {clockWords(slot.startTime)}
              </button>
            ))}
          </span>
        ))}
      <span className={s.chips}>
        <button
          type="button"
          className={s.chip}
          disabled={!slotId || busy}
          onClick={save}
        >
          {busy ? "Saving" : moving ? "Move it here" : "Book this time"}
        </button>
        <button
          type="button"
          className={s.chip}
          disabled={busy}
          onClick={onClose}
        >
          Close
        </button>
      </span>
    </div>
  );
}

export default function PatientConsultations({
  data,
  isAdmin,
  onChanged,
}: {
  data: OpsPatient;
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  // what is open: the booking form, a move, or a cancel (one at a time)
  const [doing, setDoing] = useState<
    null | { kind: "book" } | { kind: "move" | "cancel"; id: string }
  >(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const done = () => {
    setDoing(null);
    setReason("");
    onChanged();
  };

  const cancel = async (id: string) => {
    if (busy) return;
    if (reason.trim().length < 3)
      return toast("Say why the consultation is cancelled.");
    setBusy(true);
    try {
      toast(await cancelConsultation(id, reason.trim()));
      done();
    } catch (caught) {
      toast(errorMessage(caught, "It was not cancelled. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const watch = async (id: string) => {
    // opened before the wait, so the browser treats the new tab as the person's own click
    const tab = window.open("", "_blank");
    try {
      const url = await getRecordingLink(id);
      // a browser that refused the new tab gets the link in this one
      (tab ?? window).location.assign(url);
    } catch (caught) {
      tab?.close();
      toast(errorMessage(caught, "The recording could not be opened."));
    }
  };

  return (
    <section className={s.section} aria-label="Consultations">
      <h3 className={s.sectionHead}>Consultations</h3>
      {data.consultations.length === 0 ? (
        <p className={adminStyles.empty}>No consultations yet.</p>
      ) : (
        <ol className={s.timeline}>
          {data.consultations.map((a) => {
            const movable =
              isAdmin && (a.status === "Booked" || a.status === "InProgress");
            const open = doing && "id" in doing && doing.id === a.id;
            return (
              <li key={a.id}>
                <time dateTime={a.startsAt}>{when(a.startsAt)}</time>
                <span>
                  <strong>
                    {a.doctorName},{" "}
                    {a.visitType === "FOLLOW_UP"
                      ? "follow-up"
                      : "first consultation"}
                    . {STATUS[a.status]}
                  </strong>
                  {a.recording === "RECORDED" && (
                    <span className={s.reply}>
                      Recorded, with the patient&apos;s yes.
                    </span>
                  )}
                  {a.recording === "FAILED" && (
                    <span className={s.reply}>
                      The patient agreed to recording, but it did not start
                      {a.recordingProblem ? `: ${a.recordingProblem}` : "."}
                    </span>
                  )}
                  {a.recording === "AGREED" && (
                    <span className={s.reply}>
                      The patient agreed to recording.
                    </span>
                  )}
                  {(movable || (isAdmin && a.recording === "RECORDED")) &&
                    !open && (
                      <span className={s.chips}>
                        {isAdmin && a.recording === "RECORDED" && (
                          <button
                            type="button"
                            className={s.chip}
                            onClick={() => watch(a.id)}
                          >
                            Watch the recording
                          </button>
                        )}
                        {movable && (
                          <>
                            <button
                              type="button"
                              className={s.chip}
                              onClick={() =>
                                setDoing({ kind: "move", id: a.id })
                              }
                            >
                              Move
                            </button>
                            <button
                              type="button"
                              className={s.chip}
                              onClick={() =>
                                setDoing({ kind: "cancel", id: a.id })
                              }
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </span>
                    )}
                  {open && doing.kind === "move" && (
                    <SlotForm
                      data={data}
                      moving={a}
                      onDone={done}
                      onClose={() => setDoing(null)}
                    />
                  )}
                  {open && doing.kind === "cancel" && (
                    <div className={s.planForm}>
                      <input
                        className={s.input}
                        value={reason}
                        maxLength={300}
                        placeholder="Why it is cancelled"
                        aria-label="Why the consultation is cancelled"
                        onChange={(e) => setReason(e.target.value)}
                      />
                      <span className={adminStyles.muted}>
                        Nothing is sent to the patient or the doctor: call them.
                      </span>
                      <span className={s.chips}>
                        <button
                          type="button"
                          className={s.chip}
                          disabled={busy}
                          onClick={() => cancel(a.id)}
                        >
                          {busy ? "Cancelling" : "Cancel the consultation"}
                        </button>
                        <button
                          type="button"
                          className={s.chip}
                          disabled={busy}
                          onClick={() => setDoing(null)}
                        >
                          Keep it
                        </button>
                      </span>
                    </div>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {isAdmin &&
        (doing?.kind === "book" ? (
          <SlotForm
            data={data}
            moving={null}
            onDone={done}
            onClose={() => setDoing(null)}
          />
        ) : (
          <span className={s.chips}>
            <button
              type="button"
              className={s.chip}
              onClick={() => setDoing({ kind: "book" })}
            >
              Book a consultation for them
            </button>
          </span>
        ))}
    </section>
  );
}
