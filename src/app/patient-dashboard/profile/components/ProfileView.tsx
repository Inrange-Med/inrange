"use client";

/*
  Profile (Arhaan Profile.tsx): who the patient is, their plan and settings, as rows that each open
  one sheet. Nothing goes deeper than that sheet. Data: GET /api/patient/profile; each sheet saves
  through its own patientProfileService call and hands the change back, so the rows stay current.
*/

import { useCallback, useState } from "react";
import {
  Bell,
  CaretRight,
  CreditCard,
  Heartbeat,
  IdentificationCard,
  Lifebuoy,
  ShieldCheck,
} from "@phosphor-icons/react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import PageGhosts from "@/app/patient-dashboard/components/PageGhosts";
import PageHead from "@/components/ui/PageHead";
import Sheet from "@/components/ui/Sheet";
import { useApiResource } from "@/hooks/useApiResource";
import { getSessionUser } from "@/lib/session/authSession";
import { getMyProfile } from "@/services/patientProfileService";
import type { PatientProfile } from "@/types/patientProfile";
import layoutStyles from "@/components/ui/styles/PageLayout.module.css";
import HealthProfileForm from "./HealthProfileForm";
import HelpAndSupport from "./HelpAndSupport";
import PersonalDetailsForm from "./PersonalDetailsForm";
import PlanSummary from "./PlanSummary";
import PrivacySettings from "./PrivacySettings";
import ReminderSettings from "./ReminderSettings";
import SignOutFoot from "./SignOutFoot";
import styles from "../ProfilePage.module.css";

type Panel = "details" | "health" | "plan" | "notify" | "privacy" | "help";

const TITLES: Record<Panel, string> = {
  details: "Personal details",
  health: "Health profile",
  plan: "Plan and payments",
  notify: "Reminders",
  privacy: "Privacy and security",
  help: "Help and support",
};

/** "+91 98765 43210" from whatever shape the backend stored the number in. */
function spacedMobile(phone: string) {
  const digits = phone.replace(/\D/g, "").slice(-10);
  return digits.length === 10
    ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
    : phone;
}

/** "On, by WhatsApp and email", for the Reminders row. */
function remindersLine(profile: PatientProfile) {
  if (!profile.remindersEnabled) return "Off";
  const channels = [
    profile.whatsappReminders && "WhatsApp",
    profile.emailReminders && "email",
  ].filter(Boolean);
  return channels.length ? `On, by ${channels.join(" and ")}` : "On";
}

export default function ProfileView() {
  const resource = useApiResource("patient-profile", getMyProfile);
  const { data: profile, setData } = resource;
  // the panel stays set while the sheet closes, so its content does not vanish mid-slide
  const [panel, setPanel] = useState<Panel>("details");
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  if (!profile) {
    return (
      <main className={layoutStyles.page}>
        {resource.error ? (
          <ErrorNotice message={resource.error} onRetry={resource.reload} />
        ) : (
          <PageGhosts title heights={[180, 180]} />
        )}
      </main>
    );
  }

  const saved = (changes: Partial<PatientProfile>) =>
    setData({ ...profile, ...changes });
  const savedAndClose = (changes: Partial<PatientProfile>) => {
    saved(changes);
    close();
  };
  const show = (id: Panel) => {
    setPanel(id);
    setOpen(true);
  };

  const name = profile.fullName || getSessionUser()?.fullName || "Your account";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
  const active = profile.planStatus.trim().toLowerCase() === "active";
  const mobile = profile.phone || getSessionUser()?.mobile || "";

  const groups: {
    title: string;
    rows: { id: Panel; icon: typeof Bell; label: string; line: string }[];
  }[] = [
    {
      title: "Your account",
      rows: [
        {
          id: "details",
          icon: IdentificationCard,
          label: "Personal details",
          line: "Name, email and age",
        },
        {
          id: "health",
          icon: Heartbeat,
          label: "Health profile",
          line: "Conditions and BMI",
        },
        {
          id: "plan",
          icon: CreditCard,
          label: "Plan and payments",
          line: profile.planName || "No programme yet",
        },
      ],
    },
    {
      title: "Settings and help",
      rows: [
        {
          id: "notify",
          icon: Bell,
          label: "Reminders",
          line: remindersLine(profile),
        },
        {
          id: "privacy",
          icon: ShieldCheck,
          label: "Privacy and security",
          line: "Consents and your data",
        },
        {
          id: "help",
          icon: Lifebuoy,
          label: "Help and support",
          line: "FAQs, emergency",
        },
      ],
    },
  ];

  return (
    <main className={layoutStyles.page}>
      <PageHead
        title={<span className={styles.name}>{name}</span>}
        sub={
          mobile ? (
            <span className="num">{spacedMobile(mobile)}</span>
          ) : undefined
        }
        action={
          <span className={styles.avatar} aria-hidden="true">
            {initials}
          </span>
        }
      />

      <div className={styles.layout}>
        {groups.map((group) => (
          <section
            key={group.title}
            className={styles.group}
            aria-label={group.title}
          >
            <ul className={styles.rows}>
              {group.rows.map((row) => {
                const Icon = row.icon;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      className={styles.row}
                      onClick={() => show(row.id)}
                    >
                      <span className={styles.rowIcon} aria-hidden="true">
                        <Icon size={20} />
                      </span>
                      <span className={styles.rowText}>
                        <strong>{row.label}</strong>
                        <span>{row.line}</span>
                      </span>
                      <CaretRight
                        size={16}
                        className={styles.rowGo}
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <SignOutFoot />
      </div>

      <Sheet open={open} onClose={close} title={TITLES[panel]}>
        {/* keyed by the open state, so a form always starts from the saved profile */}
        {panel === "details" && (
          <PersonalDetailsForm
            key={String(open)}
            profile={profile}
            onSaved={savedAndClose}
          />
        )}
        {panel === "health" && (
          <HealthProfileForm
            key={String(open)}
            profile={profile}
            onSaved={savedAndClose}
          />
        )}
        {panel === "plan" && <PlanSummary profile={profile} active={active} />}
        {panel === "notify" && (
          <ReminderSettings
            key={String(open)}
            profile={profile}
            onSaved={saved}
          />
        )}
        {panel === "privacy" && (
          <PrivacySettings
            key={String(open)}
            profile={profile}
            onSaved={saved}
          />
        )}
        {panel === "help" && <HelpAndSupport />}
      </Sheet>
    </main>
  );
}
