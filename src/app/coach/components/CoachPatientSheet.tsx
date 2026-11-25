"use client";

/*
  One patient, for their coach (23 Nov 2026 call): who they are, their doctors, the plan and what it
  includes, the next doctor's consultation, and the current prescription to follow (read only: a coach never
  writes or changes one, and never sees a sale). Below: the diet chart or exercise plan, the calls made, and
  the remarks the doctor reads at the follow-up. Opening the sheet is logged.
*/

import ErrorNotice from "@/components/ui/ErrorNotice";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import Sheet from "@/components/ui/Sheet";
import CoachingSections from "@/features/coaching/CoachingSections";
import CoachRemarks from "@/features/coaching/CoachRemarks";
import { when } from "@/features/medicine-queue/words";
import { useApiResource } from "@/hooks/useApiResource";
import { shortDate } from "@/lib/format/dateTime";
import { spacedMobile } from "@/lib/format/phone";
import { getCoachPatient } from "@/services/coachService";
import surfaceStyles from "@/components/ui/styles/StaffSurfaces.module.css";
import s from "@/components/ui/styles/StaffPanels.module.css";

export default function CoachPatientSheet({
  patientId,
  onClose,
  onChanged,
}: {
  patientId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const patient = useApiResource(
    patientId ? `coach-patient-${patientId}` : null,
    () => getCoachPatient(patientId!),
  );
  // the last patient stays loaded while the next one loads: never show or act on them
  const data = patient.data?.patient.id === patientId ? patient.data : null;
  const refresh = () => {
    patient.reload();
    onChanged();
  };
  const p = data?.patient;

  return (
    <Sheet
      open={patientId !== null}
      onClose={onClose}
      title={p?.name ?? "Patient"}
    >
      {patient.error && !data ? (
        <ErrorNotice message={patient.error} onRetry={patient.reload} />
      ) : !data || !p ? (
        <LoadingSkeleton />
      ) : (
        <div className={s.sheet}>
          <dl className={s.facts}>
            <div>
              <dt>Mobile</dt>
              <dd>
                <a href={`tel:+91${p.mobile}`} className="num">
                  {spacedMobile(p.mobile)}
                </a>
              </dd>
            </div>
            <div>
              <dt>About</dt>
              <dd className="num">
                {[
                  p.age && `${p.age} years`,
                  p.gender,
                  p.heightCm && `${p.heightCm} cm`,
                  p.weightKg && `${p.weightKg} kg at sign-up`,
                ]
                  .filter(Boolean)
                  .join(", ") || "Not filled in"}
              </dd>
            </div>
            <div>
              <dt>Doctors</dt>
              <dd>{p.doctors.join(", ") || "No doctor yet"}</dd>
            </div>
            <div>
              <dt>Coaches</dt>
              <dd>
                {[
                  p.coachName && `${p.coachName} (health)`,
                  p.fitnessCoachName &&
                    `${p.fitnessCoachName} (fitness${p.fitnessStartsOn ? `, from ${shortDate(p.fitnessStartsOn)}` : ""})`,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </dd>
            </div>
            <div>
              <dt>Plan</dt>
              <dd>
                {data.plan ? (
                  <>
                    <span className={s.lineItem}>
                      {data.plan.name}, until {shortDate(data.plan.endsAt)}
                    </span>
                    <span className={`${s.lineItem} ${surfaceStyles.muted}`}>
                      {[
                        data.plan.doctorConsults != null &&
                          `${data.plan.doctorConsults} doctor consultations`,
                        data.plan.coachCalls != null &&
                          `${data.plan.coachCalls} coach calls`,
                        data.plan.fitnessCalls != null &&
                          `${data.plan.fitnessCalls} fitness calls`,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </>
                ) : (
                  "No plan yet"
                )}
              </dd>
            </div>
            <div>
              <dt>Next doctor call</dt>
              <dd>
                {data.nextConsultation
                  ? `${when(data.nextConsultation.startsAt)}, ${data.nextConsultation.doctorName}`
                  : "None booked"}
              </dd>
            </div>
            {data.prescription && (
              <div>
                <dt>Prescription</dt>
                <dd>
                  {data.prescription.diagnosis && (
                    <span className={s.lineItem}>
                      {data.prescription.diagnosis}
                    </span>
                  )}
                  {data.prescription.medicines.map((m, i) => (
                    <span key={i} className={s.lineItem}>
                      {m.name}
                      {m.words ? `: ${m.words}` : ""}
                    </span>
                  ))}
                  {data.prescription.advice && (
                    <span className={`${s.lineItem} ${s.pre}`}>
                      Advice: {data.prescription.advice}
                    </span>
                  )}
                  <span className={`${s.lineItem} ${surfaceStyles.muted}`}>
                    {data.prescription.doctorName}
                    {data.prescription.sentAt
                      ? `, ${shortDate(data.prescription.sentAt)}`
                      : ""}
                  </span>
                </dd>
              </div>
            )}
          </dl>
          <CoachingSections
            key={p.id}
            patientId={p.id}
            can={data.can}
            diet={data.diet}
            fitness={data.fitness}
            calls={data.calls}
            included={
              data.plan && {
                coachCalls: data.plan.coachCalls,
                fitnessCalls: data.plan.fitnessCalls,
                healthCallsMade: data.healthCallsMade,
                fitnessCallsMade: data.fitnessCallsMade,
              }
            }
            onSaved={refresh}
          />
          <CoachRemarks
            key={`remarks-${p.id}`}
            patientId={p.id}
            remarks={data.remarks}
            onSaved={refresh}
          />
        </div>
      )}
    </Sheet>
  );
}
