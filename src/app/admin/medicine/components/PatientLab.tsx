"use client";

/*
  The patient's blood test, for the team (23 Nov 2026 call: someone calls the patients who did not book by
  themselves, and books it with them on the phone). The team can book any day the lab offers (today up to
  4 days ahead; patients themselves book tomorrow or the day after only), at an address on the patient's
  account or a new one found by search. A time is held for 30 minutes and becomes a booking once it is paid
  for: the patient pays in the app (Home shows it), or on a payment link made here, or admin enters the
  payment ID of money taken another way. Someone whose paid test was cancelled is rebooked on that payment.
  A booked test can be moved (twice) or cancelled here.
*/

import { useState } from "react";
import DatePicker from "@/components/ui/DatePicker";
import ErrorNotice from "@/components/ui/ErrorNotice";
import { useToast } from "@/components/ui/ToastProvider";
import CopyLine from "@/features/payment-links/CopyLine";
import { clockWords, when } from "@/features/medicine-queue/words";
import { useApiResource } from "@/hooks/useApiResource";
import { useNow } from "@/hooks/useNow";
import { toApiDate } from "@/lib/format/dateTime";
import { formatRupees } from "@/lib/format/money";
import { errorMessage } from "@/lib/http/apiClient";
import {
  actOnLabBooking,
  addPatientAddress,
  getPatientLab,
  holdLabBooking,
  listLabSlots,
  setLabCredit,
  searchLabPlaces,
} from "@/services/medicineOpsService";
import type { LabPlace, PatientLab, TeamLabBooking } from "@/types/medicineOps";
import adminStyles from "@/components/ui/styles/StaffSurfaces.module.css";
import s from "@/components/ui/styles/StaffPanels.module.css";

const STATUS: Record<TeamLabBooking["status"], string> = {
  PAYMENT_PENDING: "Time held, waiting for payment",
  BOOKED: "Booked",
  COLLECTOR_ASSIGNED: "Collector assigned",
  SAMPLE_COLLECTED: "Sample collected",
  PROCESSING: "At the lab",
  REPORT_READY: "Report ready",
  CANCELLED: "Cancelled",
  EXPIRED: "Hold ended unpaid",
};
const DAY = 86_400_000;

/** A new address for the patient: found by search (which places it on the map), then the house and street. */
function AddressForm({
  patientId,
  onSaved,
  onClose,
}: {
  patientId: string;
  onSaved: (addressId: string) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<LabPlace[] | null>(null);
  const [place, setPlace] = useState<LabPlace | null>(null);
  const [line, setLine] = useState("");
  const [pincode, setPincode] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await work();
    } catch (caught) {
      toast(errorMessage(caught, "That did not work. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={s.planForm}>
      {!place ? (
        <>
          <input
            className={s.input}
            value={query}
            placeholder="Area, society or landmark"
            aria-label="Search for the area"
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className={s.chips}>
            <button
              type="button"
              className={s.chip}
              disabled={busy || query.trim().length < 3}
              onClick={() =>
                run(async () => setPlaces(await searchLabPlaces(query.trim())))
              }
            >
              {busy ? "Searching" : "Search"}
            </button>
            <button type="button" className={s.chip} onClick={onClose}>
              Close
            </button>
          </span>
          {places?.length === 0 && (
            <span className={adminStyles.muted}>
              Nothing found. Try the area or a landmark nearby.
            </span>
          )}
          {places?.map((found) => (
            <button
              key={found.eloc}
              type="button"
              className={s.chip}
              onClick={() => {
                setPlace(found);
                setPincode(found.pincode ?? "");
              }}
            >
              {found.name}, {found.address}
            </button>
          ))}
        </>
      ) : (
        <>
          <span className={adminStyles.muted}>
            {place.name}, {place.address}
          </span>
          <input
            className={s.input}
            value={line}
            maxLength={200}
            placeholder="House or flat number, building, street"
            aria-label="House, building and street"
            onChange={(e) => setLine(e.target.value)}
          />
          <input
            className={s.input}
            inputMode="numeric"
            value={pincode}
            placeholder="Pincode"
            aria-label="Pincode"
            onChange={(e) =>
              setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
          />
          <span className={s.chips}>
            <button
              type="button"
              className={s.chip}
              disabled={busy || line.trim().length < 3 || pincode.length !== 6}
              onClick={() =>
                run(async () =>
                  onSaved(
                    await addPatientAddress(patientId, {
                      addressLine: `${line.trim()}, ${place.name}, ${place.address}`,
                      pincode,
                      city: place.city,
                      state: place.state,
                      landmark: place.name,
                      eloc: place.eloc,
                    }),
                  ),
                )
              }
            >
              {busy ? "Saving" : "Save this address"}
            </button>
            <button
              type="button"
              className={s.chip}
              onClick={() => setPlace(null)}
            >
              Search again
            </button>
          </span>
        </>
      )}
    </div>
  );
}

/** Address, day and a free time; holds a new booking, or moves `moving`. */
function TimeForm({
  patientId,
  lab,
  moving,
  onDone,
  onAddress,
  onClose,
}: {
  patientId: string;
  lab: PatientLab;
  moving: TeamLabBooking | null;
  onDone: () => void;
  /** an address was added: the list reloads and the form stays open on it */
  onAddress: () => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const now = useNow(60_000);
  const today = toApiDate(new Date(now));
  const placed = lab.addresses.filter((a) => a.placed);
  // a move keeps the booking's own address, so its times are the ones read
  const [addressId, setAddressId] = useState(
    moving?.addressId ?? placed[0]?.id ?? "",
  );
  const [adding, setAdding] = useState(placed.length === 0 && !moving);
  const [date, setDate] = useState(toApiDate(new Date(now + DAY)));
  const [slotId, setSlotId] = useState<number | null>(null);
  const [name, setName] = useState(lab.person.name);
  const [age, setAge] = useState(String(lab.person.age ?? ""));
  const [gender, setGender] = useState(lab.person.gender ?? "");
  const [busy, setBusy] = useState(false);

  const slots = useApiResource(
    addressId ? `lab-slots-${patientId}-${addressId}-${date}` : null,
    () => listLabSlots(patientId, addressId, date),
  );
  const free = (slots.data ?? []).filter((slot) => slot.available > 0);

  const save = async () => {
    if (busy || slotId === null) return;
    setBusy(true);
    try {
      toast(
        moving
          ? (
              await actOnLabBooking(moving.id, "move", {
                collectionDate: date,
                slotId,
              })
            ).message
          : await holdLabBooking(patientId, {
              addressId,
              collectionDate: date,
              slotId,
              person: { name: name.trim(), age: Number(age), gender },
            }),
      );
      onDone();
    } catch (caught) {
      toast(errorMessage(caught, "That did not work. Try again."));
      slots.reload();
      setSlotId(null);
    } finally {
      setBusy(false);
    }
  };

  if (adding)
    return (
      <AddressForm
        patientId={patientId}
        onSaved={(id) => {
          setAdding(false);
          setAddressId(id);
          onAddress();
        }}
        onClose={() => (placed.length ? setAdding(false) : onClose())}
      />
    );

  return (
    <div className={s.planForm}>
      {!moving && (
        <>
          <select
            className={s.input}
            value={addressId}
            aria-label="Collection address"
            onChange={(e) => {
              if (e.target.value === "new") return setAdding(true);
              setAddressId(e.target.value);
              setSlotId(null);
            }}
          >
            {placed.map((a) => (
              <option key={a.id} value={a.id}>
                {a.line}
              </option>
            ))}
            {addressId && !placed.some((a) => a.id === addressId) && (
              <option value={addressId}>The address just added</option>
            )}
            <option value="new">Another address</option>
          </select>
          <input
            className={s.input}
            value={name}
            maxLength={30}
            placeholder="Name of the person tested (letters only)"
            aria-label="Name of the person tested"
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className={s.input}
            inputMode="numeric"
            value={age}
            placeholder="Age in years"
            aria-label="Age in years"
            onChange={(e) =>
              setAge(e.target.value.replace(/\D/g, "").slice(0, 3))
            }
          />
          <select
            className={s.input}
            value={gender === "Male" || gender === "Female" ? gender : ""}
            aria-label="Gender"
            onChange={(e) => setGender(e.target.value)}
          >
            <option value="">Male or female</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </>
      )}
      <DatePicker
        label="Day of the collection"
        value={date}
        min={today}
        max={toApiDate(new Date(now + 4 * DAY))}
        onChange={(next) => {
          setDate(next);
          setSlotId(null);
        }}
      />
      {slots.error && !slots.data ? (
        <span className={adminStyles.muted}>{slots.error}</span>
      ) : !slots.data ? (
        <span className={adminStyles.muted}>Loading the times</span>
      ) : free.length === 0 ? (
        <span className={adminStyles.muted}>
          No free time that day. Choose another day.
        </span>
      ) : (
        <span className={s.chips} role="radiogroup" aria-label="Time">
          {free.map((slot) => (
            <button
              key={slot.slotId}
              type="button"
              role="radio"
              aria-checked={slotId === slot.slotId}
              className={`${s.chip} num`}
              data-on={slotId === slot.slotId || undefined}
              onClick={() => setSlotId(slot.slotId)}
            >
              {clockWords(slot.startTime)}
            </button>
          ))}
        </span>
      )}
      <span className={s.chips}>
        <button
          type="button"
          className={s.chip}
          disabled={
            busy ||
            slotId === null ||
            (!moving && (!name.trim() || !age || !gender))
          }
          onClick={save}
        >
          {busy ? "Saving" : moving ? "Move it here" : "Hold this time"}
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

export default function PatientLabSection({
  patientId,
  onChanged,
}: {
  patientId: string;
  onChanged: () => void;
}) {
  const toast = useToast();
  const lab = useApiResource(`patient-lab-${patientId}`, () =>
    getPatientLab(patientId),
  );
  const [doing, setDoing] = useState<
    | null
    | { kind: "book" }
    | { kind: "credit" }
    | { kind: "move" | "cancel" | "paid"; id: string }
  >(null);
  const [text, setText] = useState("");
  const [link, setLink] = useState<{ id: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [refunded, setRefunded] = useState(false);
  const done = () => {
    setDoing(null);
    setText("");
    setRefunded(false);
    lab.reload();
    onChanged();
  };

  const act = async (
    id: string,
    action: "payment-link" | "paid" | "cancel",
    input: Record<string, unknown> = {},
  ) => {
    if (busy) return;
    setBusy(true);
    try {
      const out = await actOnLabBooking(id, action, input);
      toast(out.message);
      if (out.url) setLink({ id, url: out.url });
      done();
    } catch (caught) {
      toast(errorMessage(caught, "That did not work. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const credit = async (paymentRef: string | null) => {
    if (busy) return;
    setBusy(true);
    try {
      toast(await setLabCredit(patientId, paymentRef));
      done();
    } catch (caught) {
      toast(errorMessage(caught, "That did not work. Try again."));
    } finally {
      setBusy(false);
    }
  };

  if (lab.error && !lab.data)
    return <ErrorNotice message={lab.error} onRetry={lab.reload} />;
  if (!lab.data) return null;
  const { bookings, priceRupees } = lab.data;
  // one test at a time: a new one can be booked once none is held or under way
  // (one paid for whose time the lab refused is not in the way: the new time is booked on that payment)
  const live = bookings.some(
    (b) =>
      [
        "BOOKED",
        "COLLECTOR_ASSIGNED",
        "SAMPLE_COLLECTED",
        "PROCESSING",
      ].includes(b.status) ||
      (b.status === "PAYMENT_PENDING" && !b.paid),
  );

  return (
    <section className={s.section} aria-label="Blood test">
      <h3 className={s.sectionHead}>
        Blood test
        {lab.data.credit && (
          <span className={adminStyles.muted}>
            {" "}
            Paid for. A time booked now is confirmed at once, at no charge.
          </span>
        )}
      </h3>
      {bookings.length === 0 ? (
        <p className={adminStyles.empty}>No blood test booked yet.</p>
      ) : (
        <ol className={s.timeline}>
          {bookings.map((b) => {
            const open = doing && "id" in doing && doing.id === b.id;
            return (
              <li key={b.id}>
                <time dateTime={b.startsAt}>{when(b.startsAt)}</time>
                <span>
                  <strong>
                    {b.status === "PAYMENT_PENDING" && b.paid
                      ? "Paid, time not confirmed"
                      : STATUS[b.status]}
                    {b.bookedByTeam ? ", booked by the team" : ""}
                  </strong>
                  <span className={s.reply}>{b.address}</span>
                  {b.needsAttention && (
                    <span className={`${s.reply} ${s.problem}`}>
                      {b.needsAttention}
                    </span>
                  )}
                  {b.status === "PAYMENT_PENDING" && b.paid && (
                    <span className={s.reply}>
                      Book a new time below. It goes on this payment, at no
                      charge.
                    </span>
                  )}
                  {b.status === "PAYMENT_PENDING" && !b.paid && (
                    <span className={s.reply}>
                      <span className="num">{formatRupees(b.totalRupees)}</span>
                      . The patient can pay from Home in the app
                      {b.holdExpiresAt
                        ? `, until ${when(b.holdExpiresAt).split(", ")[1]}`
                        : ""}
                      .
                    </span>
                  )}
                  {link?.id === b.id && (
                    <CopyLine label="the patient" value={link.url} />
                  )}
                  {!open && (
                    <span className={s.chips}>
                      {b.status === "PAYMENT_PENDING" && !b.paid && (
                        <>
                          <button
                            type="button"
                            className={s.chip}
                            disabled={busy}
                            onClick={() => act(b.id, "payment-link")}
                          >
                            Make a payment link
                          </button>
                          <button
                            type="button"
                            className={s.chip}
                            onClick={() => setDoing({ kind: "paid", id: b.id })}
                          >
                            They paid another way
                          </button>
                        </>
                      )}
                      {b.status === "BOOKED" && b.reschedulesLeft > 0 && (
                        <button
                          type="button"
                          className={s.chip}
                          onClick={() => setDoing({ kind: "move", id: b.id })}
                        >
                          Move
                        </button>
                      )}
                      {(b.status === "BOOKED" ||
                        b.status === "PAYMENT_PENDING") && (
                        <button
                          type="button"
                          className={s.chip}
                          onClick={() => setDoing({ kind: "cancel", id: b.id })}
                        >
                          Cancel
                        </button>
                      )}
                    </span>
                  )}
                  {open && doing.kind === "move" && (
                    <TimeForm
                      patientId={patientId}
                      lab={lab.data!}
                      moving={b}
                      onDone={done}
                      onAddress={lab.reload}
                      onClose={() => setDoing(null)}
                    />
                  )}
                  {open &&
                    (doing.kind === "cancel" || doing.kind === "paid") && (
                      <div className={s.planForm}>
                        <input
                          className={s.input}
                          value={text}
                          maxLength={300}
                          placeholder={
                            doing.kind === "paid"
                              ? "Payment ID (from Razorpay or the bank)"
                              : "Why it is cancelled"
                          }
                          aria-label={
                            doing.kind === "paid"
                              ? "Payment ID"
                              : "Why the blood test is cancelled"
                          }
                          onChange={(e) => setText(e.target.value)}
                        />
                        {doing.kind === "cancel" && b.paid && (
                          <label className={adminStyles.muted}>
                            <input
                              type="checkbox"
                              checked={refunded}
                              onChange={(e) => setRefunded(e.target.checked)}
                            />{" "}
                            I have refunded it in Razorpay. Unticked, the
                            payment is kept for a new time.
                          </label>
                        )}
                        <span className={s.chips}>
                          <button
                            type="button"
                            className={s.chip}
                            disabled={busy || text.trim().length < 3}
                            onClick={() =>
                              act(
                                b.id,
                                doing.kind === "paid" ? "paid" : "cancel",
                                doing.kind === "paid"
                                  ? { paymentRef: text.trim() }
                                  : { reason: text.trim(), refunded },
                              )
                            }
                          >
                            {busy
                              ? "Saving"
                              : doing.kind === "paid"
                                ? "Confirm the booking"
                                : "Cancel the blood test"}
                          </button>
                          <button
                            type="button"
                            className={s.chip}
                            disabled={busy}
                            onClick={() => setDoing(null)}
                          >
                            Close
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
      {!live &&
        (doing?.kind === "book" ? (
          <TimeForm
            patientId={patientId}
            lab={lab.data}
            moving={null}
            onDone={done}
            onAddress={lab.reload}
            onClose={() => setDoing(null)}
          />
        ) : (
          <span className={s.chips}>
            {doing?.kind === "credit" ? (
              <>
                <input
                  className={s.input}
                  value={text}
                  maxLength={80}
                  placeholder="Payment ID (from Razorpay or the bank)"
                  aria-label="Payment ID"
                  onChange={(e) => setText(e.target.value)}
                />
                <button
                  type="button"
                  className={s.chip}
                  disabled={busy || text.trim().length < 4}
                  onClick={() => credit(text.trim())}
                >
                  Mark as paid
                </button>
                <button
                  type="button"
                  className={s.chip}
                  onClick={() => setDoing(null)}
                >
                  Close
                </button>
              </>
            ) : lab.data.credit ? (
              <button
                type="button"
                className={s.chip}
                disabled={busy}
                onClick={() => credit(null)}
              >
                Their payment was refunded
              </button>
            ) : (
              <button
                type="button"
                className={s.chip}
                onClick={() => setDoing({ kind: "credit" })}
              >
                They paid another way
              </button>
            )}
            <button
              type="button"
              className={s.chip}
              onClick={() => setDoing({ kind: "book" })}
            >
              Book a blood test for them
              {lab.data.credit
                ? ", already paid"
                : priceRupees
                  ? `, ${formatRupees(priceRupees)}`
                  : ""}
            </button>
          </span>
        ))}
    </section>
  );
}
