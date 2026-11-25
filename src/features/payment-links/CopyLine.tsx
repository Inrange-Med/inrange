"use client";

/* One thing to send someone, with a button that copies it: a payment link, a video call link. */

import { useToast } from "@/components/ui/ToastProvider";
import s from "@/components/ui/styles/StaffPanels.module.css";

export default function CopyLine({
  label,
  value,
}: {
  /** who or what it is for: "Patient", "Dr. Singh" */
  label: string;
  value: string;
}) {
  const toast = useToast();
  return (
    <span className={s.lineItem}>
      {label}{" "}
      <button
        type="button"
        className={s.chip}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            toast(`Link for ${label} copied`);
          } catch {
            toast(value);
          }
        }}
      >
        Copy link
      </button>{" "}
      <a href={value} target="_blank" rel="noreferrer">
        Open
      </a>
    </span>
  );
}
