"use client";

/*
  The patient's consultations, for the team (23 Nov 2026). Patients book and move their own in the app; this
  is for when the team does it for them (19 Nov 2026 call: someone on the team books the consultation):
  book one with any doctor at any open time, move one (to another time, or another doctor's), or cancel
  one with the reason. A consultation the patient agreed to have recorded (they are asked on their Join
  screen, each call) can be watched here by an admin; the recording is kept for 15 days.
  A booking can name the salesperson who joins the call after the doctor. "Video links" gives the call's links
  for the patient, the doctor and the salesperson, to send by any means (CallLinksBlock).
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
  listSalespeople,
} from "@/services/medicineOpsService";
import CallLinksBlock from "./CallLinksBlock";
import type { OpsConsultation, OpsPatient } from "@/types/medicineOps";
import adminStyles from "@/components/ui/styles/StaffSurfaces.module.css";
import s from "@/components/ui/styles/StaffPanels.module.css";
import a from "@/features/medicine-queue/OpsActions.module.css";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import { clockWords, when } from "@/features/medicine-queue/words";

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
  // a booking names the salesperson who joins after the doctor (23 Nov 2026 call)
  const team = useApiResource(moving ? null : "salespeople", listSalespeople);
  const sellers = team.data?.filter((p) => p.active) ?? [];
  const [seller, setSeller] = useState(data.patient.salespersonId ?? "");
  const slots = useApiResource(
    doctorId ? `slots-${doctorId}-${date}` : null,
    () => listDoctorSlots(doctorId, date),
  );
  // free times still to come (today's earlier ones have passed)
  const free = (slots.data ?? []).filter(
    (slot) =>
      slot.free && Date.parse(combineDateAndTime(date, slot.startTime)) > now,
  );

  const save = async () => {
    if (busy || !slotId) return;
    setBusy(true);
    try {
      toast(
        await bookConsultation(
          data.patient.id,
          slotId,
          moving?.id,
          // only a choice from the list changes who sells to them
          sellers.some((p) => p.id === seller) ? seller : undefined,
        ),
      );
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
    <div className={a.form}>
      <label className={formStyles.field}>
        <span className={formStyles.label}>Doctor</span>
        <select
          className={s.input}
          value={doctorId}
          onChange={(e) => {
            setDoctorId(e.target.value);
            setSlotId("");
          }}
        >
          <option value="">Choose</option>
          {active.map((d) => (
            <option key={d.id} value={d.id}>
              {d.fullName}
              {data.patient.doctors.some((own) => own.id === String(d.id))
                ? " (their doctor)"
                : ""}
            </option>
          ))}
        </select>
      </label>
      {!moving && sellers.length > 0 && (
        <label className={formStyles.field}>
          <span className={formStyles.label}>Salesperson on the call</span>
          <select
            className={s.input}
            value={sellers.some((p) => p.id === seller) ? seller : ""}
            onChange={(e) => setSeller(e.target.value)}
          >
            <option value="">No change</option>
            {sellers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.rank}. {p.fullName}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className={formStyles.field}>
        <span className={formStyles.label} aria-hidden="true">
          Day
        </span>
        <DatePicker
          label="Day"
          value={date}
          min={today}
          max={toApiDate(new Date(now + 60 * DAY))}
          onChange={(next) => {
            setDate(next);
            setSlotId("");
          }}
        />
      </div>
      {doctorId &&
        (slots.error && !slots.data ? (
          <span className={adminStyles.muted}>The times could not load.</span>
        ) : !slots.data ? (
          <span className={adminStyles.muted}>Loading</span>
        ) : free.length === 0 ? (
          <span className={adminStyles.muted}>
            No free time. Try another day.
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
      <div className={a.actions}>
        <button
          type="button"
          className={a.btn}
          disabled={!slotId || busy}
          onClick={save}
        >
          {busy ? "Saving" : moving ? "Move" : "Book"}
        </button>
        <button
          type="button"
          className={adminStyles.textBtn}
          disabled={busy}
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function PatientConsultations({
  data,
  isAdmin,
  canWatch = isAdmin,
  onChanged,
}: {
  data: OpsPatient;
  /** may book, move and cancel (an admin, or the consultations desk) */
  isAdmin: boolean;
  /** may watch a recording: admins only */
  canWatch?: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  // what is open: the booking form, a move, or a cancel (one at a time)
  const [doing, setDoing] = useState<
    null | { kind: "book" } | { kind: "move" | "cancel" | "links"; id: string }
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
    if (reason.trim().length < 3) return toast("Add the reason.");
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
          {data.consultations.map((c) => {
            const movable =
              isAdmin && (c.status === "Booked" || c.status === "InProgress");
            const open = doing && "id" in doing && doing.id === c.id;
            return (
              <li key={c.id}>
                <time dateTime={c.startsAt}>{when(c.startsAt)}</time>
                <span>
                  <strong>
                    {c.doctorName},{" "}
                    {c.visitType === "FOLLOW_UP"
                      ? "follow-up"
                      : "first consultation"}
                    . {STATUS[c.status]}
                  </strong>
                  {c.recording === "RECORDED" && (
                    <span className={s.reply}>Recorded</span>
                  )}
                  {c.recording === "FAILED" && (
                    <span className={s.reply}>
                      Recording did not start
                      {c.recordingProblem ? `: ${c.recordingProblem}` : ""}
                    </span>
                  )}
                  {c.recording === "AGREED" && (
                    <span className={s.reply}>Recording agreed</span>
                  )}
                  {(movable || (canWatch && c.recording === "RECORDED")) &&
                    !open && (
                      <span className={a.actions}>
                        {canWatch && c.recording === "RECORDED" && (
                          <button
                            type="button"
                            className={adminStyles.textBtn}
                            onClick={() => watch(c.id)}
                          >
                            Watch recording
                          </button>
                        )}
                        {movable && (
                          <>
                            <button
                              type="button"
                              className={adminStyles.textBtn}
                              onClick={() =>
                                setDoing({ kind: "links", id: c.id })
                              }
                            >
                              Video links
                            </button>
                            <button
                              type="button"
                              className={adminStyles.textBtn}
                              onClick={() =>
                                setDoing({ kind: "move", id: c.id })
                              }
                            >
                              Move
                            </button>
                            <button
                              type="button"
                              className={adminStyles.textBtn}
                              onClick={() =>
                                setDoing({ kind: "cancel", id: c.id })
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
                      moving={c}
                      onDone={done}
                      onClose={() => setDoing(null)}
                    />
                  )}
                  {open && doing.kind === "links" && (
                    <>
                      <CallLinksBlock
                        consultationId={c.id}
                        patientName={data.patient.name}
                        doctorName={c.doctorName}
                      />
                      <span className={a.actions}>
                        <button
                          type="button"
                          className={adminStyles.textBtn}
                          onClick={() => setDoing(null)}
                        >
                          Hide links
                        </button>
                      </span>
                    </>
                  )}
                  {open && doing.kind === "cancel" && (
                    <div className={a.form}>
                      <label className={formStyles.field}>
                        <span className={formStyles.label}>Reason</span>
                        <input
                          className={s.input}
                          value={reason}
                          maxLength={300}
                          onChange={(e) => setReason(e.target.value)}
                        />
                      </label>
                      <span className={adminStyles.muted}>
                        No message is sent. Call the patient and the doctor.
                      </span>
                      <div className={a.actions}>
                        <button
                          type="button"
                          className={a.btn}
                          disabled={busy}
                          onClick={() => cancel(c.id)}
                        >
                          {busy ? "Cancelling" : "Cancel consultation"}
                        </button>
                        <button
                          type="button"
                          className={adminStyles.textBtn}
                          disabled={busy}
                          onClick={() => setDoing(null)}
                        >
                          Keep it
                        </button>
                      </div>
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
          <div className={a.actions}>
            <button
              type="button"
              className={a.btn}
              onClick={() => setDoing({ kind: "book" })}
            >
              Book consultation
            </button>
          </div>
        ))}
    </section>
  );
}
