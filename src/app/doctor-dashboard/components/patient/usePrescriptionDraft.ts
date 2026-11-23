"use client";

/*
  The prescription saves as the doctor types (PRD rule 4: never lose what someone typed). Changes wait
  0.8 s, then go to the target's autosave (a consultation's prescription, or one written with no
  consultation: consultationService savePrescription); a failed save keeps the words on the
  page, says "Not saved yet" and tries again every 5 s. Leaving with anything unsaved asks first.
  The page's text is the doctor's: answers update the saved time, the PDF state and which medicines are
  on the list, never the words in the boxes (so the cursor never jumps).
  A follow-up starts from the last prescription (`start`): shown at once, saved with the first change or at
  Create PDF, so opening the page alone writes nothing and leaving it asks nothing.
*/

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, errorMessage } from "@/lib/http/apiClient";
import { savePrescription } from "@/services/consultationService";
import type {
  MedicineLine,
  MedicineLineView,
  Prescription,
  PrescriptionDraft,
  PrescriptionEntry,
  RxTarget,
} from "@/types/consultation";

/** "refused": the server said no (the prescription was sent elsewhere, say): retrying cannot help */
export type SaveState = "idle" | "saving" | "saved" | "error" | "refused";

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
    medicines: linesOf(rx.medicines),
  };
}

/** A follow-up's start: the last prescription's diagnosis, history, medicines and advice (remarks are the visit's own). */
export function startFrom(
  last: Pick<
    PrescriptionEntry,
    "diagnosis" | "patientHistory" | "advice" | "medicines"
  > | null,
): PrescriptionDraft | null {
  if (!last) return null;
  return {
    diagnosis: last.diagnosis,
    patientHistory: last.patientHistory,
    remarks: "",
    advice: last.advice,
    medicines: linesOf(last.medicines),
  };
}

function linesOf(medicines: MedicineLineView[]): MedicineLine[] {
  return medicines.map(
    (m): MedicineLine => ({
      key: m.key || `${m.medicineId ?? m.name}`,
      medicineId: m.medicineId,
      name: m.name,
      genericName: m.genericName ?? null,
      brand: m.brand ?? null,
      form: m.form ?? "",
      dose: m.dose,
      frequency: m.frequency,
      frequencyOther: m.frequencyOther,
      durationValue: m.durationValue ?? 30,
      durationUnit: m.durationUnit ?? "DAYS",
      intake: m.intake,
      unlisted: m.unlisted,
    }),
  );
}

export function usePrescriptionDraft(
  target: RxTarget,
  initial: Prescription | null,
  start: PrescriptionDraft | null = null,
) {
  const [draft, setDraft] = useState<PrescriptionDraft>(() =>
    initial ? draftOf(initial) : (start ?? EMPTY),
  );
  const [saved, setSaved] = useState<Prescription | null>(initial);
  const [state, setState] = useState<SaveState>(
    initial?.savedAt ? "saved" : "idle",
  );
  const [problem, setProblem] = useState<string | null>(null);
  // bumps on every change; a save covers the edits made before it began. A start counts as one, not yet saved
  const edits = useRef(!initial && start ? 1 : 0);
  const savedEdits = useRef(0);
  const latest = useRef(draft);
  const inFlight = useRef<Promise<Prescription | null> | null>(null);
  const { kind, id } = target;

  const save = useCallback(async (): Promise<Prescription | null> => {
    if (inFlight.current) await inFlight.current;
    if (savedEdits.current === edits.current) return null;
    const upTo = edits.current;
    setState("saving");
    const run = savePrescription({ kind, id }, latest.current)
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
        // a refusal (409: sent from another tab; 403, 404) will not change by trying again; a lost connection will
        const refused =
          caught instanceof ApiError &&
          caught.status >= 400 &&
          caught.status < 500 &&
          ![408, 429].includes(caught.status);
        setState(refused ? "refused" : "error");
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
  }, [kind, id]);

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
