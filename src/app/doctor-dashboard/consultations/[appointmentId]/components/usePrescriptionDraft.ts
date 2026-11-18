"use client";

/*
  The prescription saves as the doctor types (PRD rule 4: never lose what someone typed). Changes wait
  0.8 s, then go to PUT /api/doctor/consultations/:id/prescription; a failed save keeps the words on the
  page, says "Not saved yet" and tries again every 5 s. Leaving with anything unsaved asks first.
  The page's text is the doctor's: answers update the saved time, the PDF state and which medicines are
  on the list, never the words in the boxes (so the cursor never jumps).
*/

import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/http/apiClient";
import { savePrescription } from "@/services/consultationService";
import type {
  MedicineLine,
  Prescription,
  PrescriptionDraft,
} from "@/types/consultation";

export type SaveState = "idle" | "saving" | "saved" | "error";

const EMPTY: PrescriptionDraft = {
  diagnosis: "",
  patientHistory: "",
  remarks: "",
  advice: "",
  medicines: [],
};

/** The form's copy of a saved prescription. */
export function draftOf(rx: Prescription | null): PrescriptionDraft {
  if (!rx) return EMPTY;
  return {
    diagnosis: rx.diagnosis,
    patientHistory: rx.patientHistory,
    remarks: rx.remarks,
    advice: rx.advice,
    medicines: rx.medicines.map(
      (m): MedicineLine => ({
        key: m.key || `${m.medicineId ?? m.name}`,
        medicineId: m.medicineId,
        name: m.name,
        genericName: m.genericName ?? null,
        dose: m.dose,
        frequency: m.frequency,
        frequencyOther: m.frequencyOther,
        durationValue: m.durationValue ?? 30,
        durationUnit: m.durationUnit ?? "DAYS",
        intake: m.intake,
        unlisted: m.unlisted,
      }),
    ),
  };
}

export function usePrescriptionDraft(
  appointmentId: string,
  initial: Prescription | null,
) {
  const [draft, setDraft] = useState<PrescriptionDraft>(() => draftOf(initial));
  const [saved, setSaved] = useState<Prescription | null>(initial);
  const [state, setState] = useState<SaveState>(
    initial?.savedAt ? "saved" : "idle",
  );
  const [problem, setProblem] = useState<string | null>(null);
  const edits = useRef(0); // bumps on every change; a save covers the edits made before it began
  const savedEdits = useRef(0);
  const latest = useRef(draft);
  const inFlight = useRef<Promise<Prescription | null> | null>(null);

  const save = useCallback(async (): Promise<Prescription | null> => {
    if (inFlight.current) await inFlight.current;
    if (savedEdits.current === edits.current) return null;
    const upTo = edits.current;
    setState("saving");
    const run = savePrescription(appointmentId, latest.current)
      .then((rx) => {
        savedEdits.current = upTo;
        setSaved(rx);
        // which lines the list knows, from the server; the words stay the doctor's
        setDraft((d) => ({
          ...d,
          medicines: d.medicines.map((m) => {
            const known = rx.medicines.find((x) => x.key === m.key);
            return known ? { ...m, unlisted: known.unlisted } : m;
          }),
        }));
        setState(savedEdits.current === edits.current ? "saved" : "saving");
        setProblem(null);
        return rx;
      })
      .catch((caught) => {
        setState("error");
        setProblem(
          errorMessage(caught, "Not saved yet. Check your connection."),
        );
        return null;
      })
      .finally(() => {
        inFlight.current = null;
      });
    inFlight.current = run;
    return run;
  }, [appointmentId]);

  const change = useCallback((patch: Partial<PrescriptionDraft>) => {
    setDraft((d) => {
      const next = { ...d, ...patch };
      latest.current = next;
      return next;
    });
    edits.current += 1;
    setState("saving");
  }, []);

  /** Starts over from a prescription the server made (a new version, or one just sent). */
  const reset = useCallback((rx: Prescription | null) => {
    const next = draftOf(rx);
    latest.current = next;
    setDraft(next);
    setSaved(rx);
    edits.current = 0;
    savedEdits.current = 0;
    setState(rx?.savedAt ? "saved" : "idle");
  }, []);

  /** Saves now, and answers the saved prescription (Create PDF waits on it). */
  const flush = useCallback(async () => {
    const rx = await save();
    if (savedEdits.current !== edits.current)
      throw new Error(problem ?? "Not saved yet. Check your connection.");
    return rx ?? saved;
  }, [save, saved, problem]);

  // 0.8 s after the last change; after a failure, every 5 s
  const pending = state === "saving" || state === "error";
  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(
      () => void save(),
      state === "error" ? 5000 : 800,
    );
    return () => clearTimeout(timer);
  }, [draft, pending, state, save]);

  useEffect(() => {
    if (!pending) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);

  return { draft, change, saved, setSaved, state, problem, flush, reset };
}
