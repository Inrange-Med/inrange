"use client";

/*
  One call note: the draft to check, edit and sign, with the call's transcript beside it. Every
  edit shows at once and is saved in the background (useNoteSaving); if a save fails the note
  reloads as the backend has it. Signing and addenda are useNoteSigning. Where the transcript sits
  is useTranscriptPlacement; the note-to-call links are useTranscriptLinks.
*/

import { useState } from "react";
import { useRouter } from "next/navigation";
import BackLink from "@/components/ui/BackLink";
import Sheet from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/ToastProvider";
import type { BackDestination } from "@/lib/navigation/backDestination";
import type { ClinicalNote, NoteSectionKey } from "@/types/clinicalNote";
import type { PatientRecord } from "@/types/patientRecord";
import {
  blockers,
  firstName,
  isReady,
  missedOpen,
  reviewProgress,
  toSign,
  writing,
} from "@/app/doctor-dashboard/notes/components/noteState";
import {
  quotesBySegment,
  segmentIds,
} from "@/app/doctor-dashboard/notes/components/noteFormat";
import { useUntil } from "@/app/doctor-dashboard/notes/components/useUntil";
import { jumpTo } from "./noteScroll";
import {
  NoteReviewContext,
  type NoteReviewState,
  type ReviewDoctor,
} from "./NoteReviewContext";
import { useFlagResolving } from "./useFlagResolving";
import { useNoteSaving } from "./useNoteSaving";
import { useNoteSigning } from "./useNoteSigning";
import { useReviewKeys } from "./useReviewKeys";
import { useTranscriptLinks } from "./useTranscriptLinks";
import { useTranscriptPlacement } from "./useTranscriptPlacement";
import NextToSignLink from "./NextToSignLink";
import NoteFooter from "./NoteFooter";
import NoteHeader from "./NoteHeader";
import NoteSections from "./NoteSections";
import NoteStatusPill from "./NoteStatusPill";
import PhoneBottomBar from "./PhoneBottomBar";
import PhoneTopBar from "./PhoneTopBar";
import SignButton from "./SignButton";
import SignSheet from "./SignSheet";
import SignStatus from "./SignStatus";
import TranscriptPanel, { type TranscriptFilter } from "./TranscriptPanel";
import clinicStyles from "@/app/doctor-dashboard/styles/ClinicSurfaces.module.css";
import styles from "../NoteReviewPage.module.css";

export default function NoteReviewBody({
  note,
  notes,
  record,
  their,
  doctor,
  back,
  setNote,
  reloadNote,
}: {
  note: ClinicalNote;
  /** every note, for the queue of notes to sign */
  notes: ClinicalNote[];
  /** null while the patient record is not available */
  record: PatientRecord | null;
  their: string;
  doctor: ReviewDoctor;
  /** where Back goes: the screen the note was opened from */
  back: BackDestination;
  setNote: (note: ClinicalNote) => void;
  reloadNote: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const now = useUntil(note.status === "DRAFT" ? Date.parse(note.readyAt) : 0);
  const [fadeIn] = useState(() => writing(note, Date.now()));
  const [hoverable] = useState(
    () => window.matchMedia("(hover: hover) and (pointer: fine)").matches,
  );
  const [editing, setEditing] = useState<{
    key: NoteSectionKey;
    caret?: string;
  } | null>(null);
  const [keysOpen, setKeysOpen] = useState(false);
  const [filter, setFilter] = useState<TranscriptFilter>("all");

  const { apply, latest, saved } = useNoteSaving(
    note,
    setNote,
    reloadNote,
    toast,
  );
  const placement = useTranscriptPlacement();
  const { mode } = placement;
  const links = useTranscriptLinks({
    note,
    latest,
    mode,
    transcriptShown: placement.shown,
    closeSheet: placement.closeSheet,
    apply,
    toast,
  });

  const { undos, resolve } = useFlagResolving({
    note,
    latest,
    apply,
    announce: links.announce,
  });

  const queueSource = notes.some((other) => other.id === note.id)
    ? notes.map((other) => (other.id === note.id ? note : other))
    : [...notes, note];
  const queue = toSign(queueSource, now);
  const at = queue.findIndex((queued) => queued.id === note.id);
  const signing = useNoteSigning({
    note,
    queueSource,
    queue,
    their,
    setNote,
    toast,
    saved,
  });
  const go = (to?: ClinicalNote) =>
    to && router.push(`/doctor-dashboard/notes/${to.id}`);

  const isWriting = writing(note, now);
  const done = note.status === "SIGNED";
  const ready = isReady(note, now);
  const missed = done ? [] : missedOpen(note);
  const nextPrescriptionVersion =
    Math.max(
      0,
      ...(record?.prescriptions ?? []).map(
        (prescription) => prescription.version,
      ),
    ) + 1;
  const { showMedicines, showFollowUps, unchecked, sectionsShown } =
    reviewProgress(note);
  const nextUp = signing.nextUp;
  const flaggedSymptoms =
    record?.symptoms.filter(
      (symptom) => symptom.requiresReview && !symptom.acknowledged,
    ) ?? [];

  const openEditor = (key: NoteSectionKey, caret?: string) => {
    links.setPin(null);
    setEditing({ key, caret });
  };
  const closeEditor = (key: NoteSectionKey) => {
    setEditing(null);
    requestAnimationFrame(() =>
      (
        document.getElementById(`edit-${key}`) ??
        document.getElementById(`sec-${key}`)
      )?.focus({ preventScroll: true }),
    );
  };

  useReviewKeys({
    note,
    editable: !done && !isWriting,
    ready,
    keysOpen,
    hasPin: !!links.pin,
    drawerOpen: placement.drawerOpen,
    closeKeys: () => setKeysOpen(false),
    clearPin: links.clearPin,
    closeDrawer: placement.closeDrawer,
    toggleKeys: () => setKeysOpen((open) => !open),
    openEditor,
    apply,
    jumpTo,
    showTranscript: placement.toggle,
    previousNote: () => at > 0 && go(queue[at - 1]),
    nextNote: () => at >= 0 && at < queue.length - 1 && go(queue[at + 1]),
    startSigning: signing.openSheet,
  });

  const context: NoteReviewState = {
    note,
    done,
    shown: placement.shown,
    pin: links.pin,
    lit: links.lit,
    flash: links.flash,
    editing,
    undos,
    hoverable,
    doctor,
    pinIt: links.pinIt,
    setHover: links.setHover,
    openEditor,
    closeEditor,
    resolve,
    openTranscript: (segmentId) =>
      placement.open(segmentId ?? links.pin?.evidence[0]?.segmentId),
    apply,
    toast,
  };
  const pinSegments = links.pin ? segmentIds(links.pin.evidence) : [];
  const transcript = (
    <TranscriptPanel
      note={note}
      doctorName={doctor.shortName}
      boxRef={placement.transcriptRef}
      lit={new Set(pinSegments)}
      preview={
        new Set((links.hover ?? []).map((evidence) => evidence.segmentId))
      }
      quotes={quotesBySegment(links.pin?.evidence ?? [])}
      notUsed={links.notUsed}
      missed={missed}
      filter={missed.length ? filter : "all"}
      setFilter={setFilter}
      onSegment={links.onSegment}
      onAdd={links.onAdd}
      step={
        links.pin && pinSegments.length
          ? {
              i: links.step,
              of: pinSegments.length,
              move: links.moveStep,
              clear: () => links.setPin(null),
            }
          : null
      }
      onClose={mode === "mid" ? placement.closeDrawer : undefined}
    />
  );
  const pill = (
    <NoteStatusPill
      signedAt={note.signed?.at ?? null}
      isWriting={isWriting}
      ready={ready}
      now={now}
      sectionsShown={sectionsShown}
      uncheckedCount={unchecked.length}
    />
  );
  const signButton = <SignButton ready={ready} onSign={signing.openSheet} />;
  const status = (
    <SignStatus
      isWriting={isWriting}
      blockers={blockers(note)}
      uncheckedCount={unchecked.length}
      onJump={jumpTo}
    />
  );

  return (
    <NoteReviewContext.Provider value={context}>
      {/* a phone: its own top bar, as a pushed screen */}
      <PhoneTopBar note={note} now={now} pill={pill} back={back} />

      {/* data-own-bars: the shell hides its phone bars while this screen shows its own */}
      <main
        className={`${clinicStyles.page} ${styles.page}`}
        data-mode={mode}
        data-own-bars
      >
        <div className={styles.backLink}>
          <BackLink href={back.href} label={back.label} />
        </div>
        <div className={styles.grid}>
          <article
            className={styles.note}
            aria-label={`Call note, ${note.patientName}`}
          >
            <NoteHeader
              note={note}
              now={now}
              pill={pill}
              isWriting={isWriting}
              done={done}
              stepper={
                at >= 0 && queue.length > 1
                  ? {
                      at,
                      total: queue.length,
                      onPrevious: () => go(queue[at - 1]),
                      onNext: () => go(queue[at + 1]),
                    }
                  : null
              }
              mode={mode}
              drawerOpen={placement.drawerOpen}
              onToggleDrawer={placement.toggleDrawer}
              drawerButton={placement.drawerButton}
              hoverable={hoverable}
              keysOpen={keysOpen}
              setKeysOpen={setKeysOpen}
              record={record}
            />
            <NoteSections
              fadeIn={fadeIn}
              isWriting={isWriting}
              showMedicines={showMedicines}
              showFollowUps={showFollowUps}
              nextPrescriptionVersion={nextPrescriptionVersion}
            />
            <NoteFooter
              done={done}
              nextUp={nextUp}
              toSignCount={queue.length}
              status={status}
              signButton={signButton}
              onAddAddendum={signing.addAddendum}
            />
          </article>

          {mode === "wide" && (
            <aside className={styles.tPanel}>{transcript}</aside>
          )}
        </div>
        <p className="sr-only" aria-live="polite">
          {links.announcement}
        </p>
      </main>

      {mode === "mid" && placement.drawerOpen && (
        <aside className={styles.drawer} aria-label="Transcript">
          {transcript}
        </aside>
      )}
      {mode === "narrow" && (
        <>
          <Sheet
            open={placement.sheetOpen}
            onClose={placement.closeSheet}
            title="Transcript"
          >
            {transcript}
          </Sheet>
          <PhoneBottomBar
            status={done ? null : status}
            action={
              done
                ? nextUp && (
                    <NextToSignLink
                      note={nextUp}
                      label={`Next: ${firstName(nextUp)}`}
                    />
                  )
                : signButton
            }
            onTranscript={placement.openSheet}
          />
        </>
      )}
      <SignSheet
        note={note}
        doctor={doctor}
        their={their}
        flaggedSymptoms={flaggedSymptoms}
        open={signing.sheetOpen}
        onClose={signing.closeSheet}
        onSign={signing.sign}
        unchecked={unchecked}
        nextPrescriptionVersion={nextPrescriptionVersion}
      />
    </NoteReviewContext.Provider>
  );
}
