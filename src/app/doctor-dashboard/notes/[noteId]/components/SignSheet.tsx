"use client";

/**
 * Before signing: everything the signature writes and where it goes, then the signature itself. One
 * signature also signs the prescription and sends it (15 Nov 2026: no second "Review and sign"); on a
 * plan the doctor picks how many months it covers, which sets the cart and its discount.
 */

import { useEffect, useRef, useState } from "react";
import {
  ChatsCircle,
  IdentificationBadge,
  ListChecks,
  Notepad,
  Prescription,
  Signature,
  WarningCircle,
} from "@phosphor-icons/react";
import SegmentedControl from "@/components/ui/SegmentedControl";
import Sheet from "@/components/ui/Sheet";
import { shortDate } from "@/lib/format/dateTime";
import type { ClinicalNote } from "@/types/clinicalNote";
import type { Symptom } from "@/types/patientRecord";
import {
  firstName,
  rxChanges,
  sectionOf,
} from "@/app/doctor-dashboard/notes/components/noteState";
import {
  andList,
  stampOf,
  VISIT_TYPE,
} from "@/app/doctor-dashboard/notes/components/noteFormat";
import type { ReviewDoctor } from "./NoteReviewContext";
import SignSheetRow from "./SignSheetRow";
import styles from "./SignSheet.module.css";

export default function SignSheet({
  note,
  doctor,
  their,
  flaggedSymptoms,
  open,
  onClose,
  onSign,
  unchecked,
  nextPrescriptionVersion,
}: {
  note: ClinicalNote;
  doctor: ReviewDoctor;
  /** "her", "his" or "their" */
  their: string;
  flaggedSymptoms: Symptom[];
  open: boolean;
  onClose: () => void;
  onSign: (sendToApp: boolean, rxMonths: number) => void;
  unchecked: string[];
  nextPrescriptionVersion: number;
}) {
  const [sendToApp, setSendToApp] = useState(true);
  const [rxMonths, setRxMonths] = useState("1");
  const onPlan = note.patientOnPlan === true;
  const primary = useRef<HTMLButtonElement>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    // the sheet settles, then the signature button takes focus so Enter signs
    const timer = window.setTimeout(() => {
      setNow(Date.now());
      primary.current?.focus();
    }, 180);
    return () => clearTimeout(timer);
  }, [open]);

  const first = firstName(note);
  const Their = `${their[0].toUpperCase()}${their.slice(1)}`;
  const plan = sectionOf(note, "plan").current;
  const forPatient = sectionOf(note, "patient").current.length > 0;
  const changes = rxChanges(note);
  const updates = note.recordUpdates.filter((update) => update.include);
  const followUps = note.followUps.filter((followUp) => followUp.include);
  const followUpsWhere = (["Care team", "Dietitian", "You"] as const)
    .map(
      (owner) =>
        [
          owner,
          followUps.filter((followUp) => followUp.owner === owner).length,
        ] as const,
    )
    .filter(([, count]) => count)
    .map(([owner, count]) =>
      owner === "You"
        ? `${count} on your list`
        : `${count} to the ${owner === "Care team" ? "care team" : "dietitian"}`,
    );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Sign and add to ${first}'s record`}
    >
      <ul className={styles.sList}>
        <SignSheetRow
          icon={<Notepad size={17} />}
          title="Visit summary and assessment"
          where={`Visits in ${their} record, as the ${shortDate(note.callAt)} ${VISIT_TYPE[note.type].toLowerCase()} call`}
        />
        <SignSheetRow
          icon={<ListChecks size={17} />}
          title={`Plan, ${plan.length} ${plan.length === 1 ? "point" : "points"}`}
          where="Visits, as told to the patient"
        />
        {changes.length ? (
          <SignSheetRow
            icon={<Prescription size={17} />}
            title={`Prescription version ${nextPrescriptionVersion}, signed and sent`}
            where={
              onPlan
                ? `To ${their} app, with a cart of what our pharmacy stocks`
                : `One month, as a first consultation, with a cart of what our pharmacy stocks`
            }
          >
            {onPlan && (
              <SegmentedControl
                label="Months the prescription covers"
                value={rxMonths}
                onChange={setRxMonths}
                options={["1", "2", "3", "6"].map((months) => ({
                  value: months,
                  label: `${months} mo`,
                }))}
              />
            )}
          </SignSheetRow>
        ) : (
          <SignSheetRow
            icon={<Prescription size={17} />}
            title="No prescription change"
            where="The current prescription stands"
            off
          />
        )}
        {forPatient ? (
          <SignSheetRow
            icon={<ChatsCircle size={17} />}
            title={`Summary for ${first}`}
            where={
              sendToApp
                ? `${Their} app, under past consultations`
                : "Kept in the record only"
            }
          >
            <button
              type="button"
              role="switch"
              aria-checked={sendToApp}
              className={styles.switch}
              onClick={() => setSendToApp((on) => !on)}
            >
              <span className={styles.knob} aria-hidden="true" />
              Send to {their} app
            </button>
          </SignSheetRow>
        ) : (
          <SignSheetRow
            icon={<ChatsCircle size={17} />}
            title={`No summary for ${first}`}
            where="Nothing goes to the app"
            off
          />
        )}
        {updates.map((update) => (
          <SignSheetRow
            key={update.id}
            icon={<IdentificationBadge size={17} />}
            title={update.label}
            where={update.to}
          />
        ))}
        {flaggedSymptoms.map((symptom) => (
          <SignSheetRow
            key={symptom.id}
            icon={<WarningCircle size={17} />}
            title={`${symptom.label}, flagged ${shortDate(symptom.at)}`}
            where="Marked as discussed on the call"
          />
        ))}
        {followUps.length > 0 && (
          <SignSheetRow
            icon={<ListChecks size={17} />}
            title={`${followUps.length} ${followUps.length === 1 ? "follow-up" : "follow-ups"}`}
            where={andList(followUpsWhere)}
          />
        )}
      </ul>
      {unchecked.length > 0 && (
        <p className={styles.sNote}>
          {unchecked.length > 3
            ? `${unchecked.length} sections are not marked checked. Signing confirms the note as written.`
            : `${andList(unchecked)} ${unchecked.length === 1 ? "is" : "are"} not marked checked. Signing confirms ${unchecked.length === 1 ? "it" : "them"} as written.`}
        </p>
      )}
      <div className={styles.sig}>
        <span>
          {doctor.name}
          {doctor.qualification ? `, ${doctor.qualification}` : ""}
        </span>
        <span className="num">{stampOf(new Date(now).toISOString())}</span>
      </div>
      <div className={styles.sActions}>
        <button
          ref={primary}
          type="button"
          className="btn"
          onClick={() => onSign(forPatient && sendToApp, Number(rxMonths))}
        >
          <span>Sign as {doctor.name}</span>
          <span className="well" aria-hidden="true">
            <Signature size={18} />
          </span>
        </button>
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Not yet
        </button>
      </div>
    </Sheet>
  );
}
