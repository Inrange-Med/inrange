"use client";

/*
  One doctor on the roster: name, specialisation, registration number, mobile, fee, hours, upcoming
  consultations and whether they are active. Deactivate and Reactivate ask once, in place. A
  deactivated doctor keeps their booked consultations; their open times are removed.
*/

import { useState } from "react";
import { ArrowCounterClockwise, Prohibit } from "@phosphor-icons/react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import { useToast } from "@/components/ui/ToastProvider";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import { formatRupees } from "@/lib/format/money";
import { spacedMobile } from "@/lib/format/phone";
import { errorMessage } from "@/lib/http/apiClient";
import { updateDoctor } from "@/services/adminService";
import type { AdminDoctor } from "@/types/admin";
import adminStyles from "@/app/admin/styles/AdminSurfaces.module.css";

export default function DoctorRow({
  doctor,
  onEdit,
  onSaved,
}: {
  doctor: AdminDoctor;
  onEdit: () => void;
  onSaved: (doctor: AdminDoctor) => void;
}) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upcoming = doctor.upcomingConsultations;

  const toggleActive = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await updateDoctor(doctor.id, {
        active: !doctor.active,
      });
      toast(
        `${doctor.fullName} ${updated.active ? "reactivated" : "deactivated"}`,
      );
      setConfirming(false);
      onSaved(updated);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={adminStyles.item}>
      <div className={adminStyles.itemHead}>
        <strong className={adminStyles.name}>{doctor.fullName}</strong>
        <span
          className={adminStyles.pill}
          data-tone={doctor.active ? "ok" : "pending"}
        >
          {doctor.active ? "Active" : "Inactive"}
        </span>
      </div>
      <p className={adminStyles.facts}>
        <span>{doctor.specialization || "Specialisation not set"}</span>
        <span className="num">
          Reg. no. {doctor.registrationNo || "not set"}
        </span>
        <a className="num" href={`tel:+91${doctor.mobile}`}>
          {spacedMobile(doctor.mobile)}
        </a>
      </p>
      {/* facts are text in the portal; pills are kept for status */}
      <p className={`${adminStyles.facts} ${adminStyles.factsQuiet}`}>
        <span className="num">
          {doctor.consultationFeeRupees === null
            ? "No fee set"
            : `Fee ${formatRupees(doctor.consultationFeeRupees)}`}
        </span>
        <span>{doctor.usesDefaultHours ? "Default hours" : "Own hours"}</span>
        <span className="num">
          {upcoming} upcoming consultation{upcoming === 1 ? "" : "s"}
        </span>
      </p>

      {error && <ErrorNotice message={error} />}

      {confirming ? (
        <div className={adminStyles.confirm}>
          <p>
            {doctor.active
              ? `Deactivate ${doctor.fullName}? Patients can no longer book them. Booked consultations stay; their open times are removed.`
              : `Reactivate ${doctor.fullName}? Patients can book their hours again.`}
          </p>
          <div className={adminStyles.actions}>
            <button
              type="button"
              className="btn"
              disabled={busy}
              data-busy={busy}
              onClick={toggleActive}
            >
              <span>
                {busy ? "Saving" : doctor.active ? "Deactivate" : "Reactivate"}
              </span>
              <span className="well" aria-hidden="true">
                {busy ? (
                  <span className={formStyles.spin} />
                ) : doctor.active ? (
                  <Prohibit size={18} />
                ) : (
                  <ArrowCounterClockwise size={18} />
                )}
              </span>
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy}
              data-busy={false}
              onClick={() => setConfirming(false)}
            >
              {doctor.active ? "Keep active" : "Keep inactive"}
            </button>
          </div>
        </div>
      ) : (
        <div className={adminStyles.actions}>
          <button
            type="button"
            className={adminStyles.textBtn}
            onClick={onEdit}
          >
            Edit details
          </button>
          <button
            type="button"
            className={adminStyles.textBtn}
            onClick={() => setConfirming(true)}
          >
            {doctor.active ? "Deactivate" : "Reactivate"}
          </button>
        </div>
      )}
    </li>
  );
}
