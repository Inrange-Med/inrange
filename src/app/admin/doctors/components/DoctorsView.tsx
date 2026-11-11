"use client";

/*
  /admin/doctors: the roster, active doctors first. "Add a doctor" opens the form above the list;
  Edit opens the same form in place of that doctor's row. A saved doctor replaces their row at once.
*/

import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import PageHead from "@/components/ui/PageHead";
import { useApiResource } from "@/hooks/useApiResource";
import { listDoctors } from "@/services/adminService";
import type { AdminDoctor } from "@/types/admin";
import DoctorForm from "./DoctorForm";
import DoctorRow from "./DoctorRow";
import adminStyles from "@/app/admin/styles/AdminSurfaces.module.css";

const rosterOrder = (a: AdminDoctor, b: AdminDoctor) =>
  Number(b.active) - Number(a.active) || a.fullName.localeCompare(b.fullName);

export default function DoctorsView() {
  const doctors = useApiResource("admin-doctors", listDoctors);
  const [editing, setEditing] = useState<number | "new" | null>(null);

  const saved = (doctor: AdminDoctor) => {
    const others = (doctors.data ?? []).filter(
      (entry) => entry.id !== doctor.id,
    );
    doctors.setData([...others, doctor]);
    setEditing(null);
  };

  const list = [...(doctors.data ?? [])].sort(rosterOrder);

  return (
    <main className={adminStyles.page}>
      <PageHead
        className={adminStyles.pageHead}
        title="Doctors"
        sub="Doctors set their own consultation hours from their dashboard. Until they do, they use the default hours."
        action={
          editing !== "new" && (
            <button
              type="button"
              className={`btn btn--ghost ${adminStyles.ghostSm}`}
              onClick={() => setEditing("new")}
            >
              <Plus size={16} aria-hidden="true" />
              Add a doctor
            </button>
          )
        }
      />
      {doctors.error && !doctors.data ? (
        <ErrorNotice message={doctors.error} onRetry={doctors.reload} />
      ) : !doctors.data ? (
        <LoadingSkeleton />
      ) : (
        <div className={adminStyles.stack}>
          {editing === "new" && (
            <section
              className={adminStyles.panel}
              aria-labelledby="doctors-add-h"
            >
              <div className={adminStyles.panelHead}>
                <h2 id="doctors-add-h" className={adminStyles.h2}>
                  Add a doctor
                </h2>
              </div>
              <DoctorForm
                doctor={null}
                onSaved={saved}
                onCancel={() => setEditing(null)}
              />
            </section>
          )}
          <section
            className={adminStyles.panel}
            aria-labelledby="doctors-roster-h"
          >
            <div className={adminStyles.panelHead}>
              <h2 id="doctors-roster-h" className={adminStyles.h2}>
                Roster
              </h2>
              <span className={`${adminStyles.count} num`}>{list.length}</span>
            </div>
            {list.length === 0 ? (
              <p className={adminStyles.empty}>
                No doctors yet. Add the first one with Add a doctor.
              </p>
            ) : (
              <ul className={adminStyles.list}>
                {list.map((doctor) =>
                  editing === doctor.id ? (
                    <li
                      key={doctor.id}
                      className={`${adminStyles.item} ${adminStyles.editing}`}
                    >
                      <strong className={adminStyles.name}>
                        Edit {doctor.fullName}
                      </strong>
                      <DoctorForm
                        doctor={doctor}
                        onSaved={saved}
                        onCancel={() => setEditing(null)}
                      />
                    </li>
                  ) : (
                    <DoctorRow
                      key={doctor.id}
                      doctor={doctor}
                      onEdit={() => setEditing(doctor.id)}
                      onSaved={saved}
                    />
                  ),
                )}
              </ul>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
