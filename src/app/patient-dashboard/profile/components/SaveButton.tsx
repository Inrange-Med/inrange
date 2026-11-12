/*
  The submit at the foot of a profile sheet: its label, or "Saving" with a spinner. A sheet has one
  primary action, so a second submit in the same sheet is `quiet`: the ghost pill across the sheet
  (Arhaan App.module.css .wide), its spinner beside the label.
*/

import { ArrowRight } from "@phosphor-icons/react";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import styles from "../ProfilePage.module.css";

export default function SaveButton({
  busy,
  label = "Save",
  busyLabel = "Saving",
  quiet = false,
}: {
  busy: boolean;
  label?: string;
  busyLabel?: string;
  quiet?: boolean;
}) {
  if (quiet) {
    return (
      <button
        type="submit"
        className={`btn btn--ghost ${styles.wide}`}
        data-busy={busy}
        disabled={busy}
      >
        {busy && <span className={formStyles.spin} aria-hidden="true" />}
        <span>{busy ? busyLabel : label}</span>
      </button>
    );
  }
  return (
    <button
      type="submit"
      className={`btn ${formStyles.go}`}
      data-busy={busy}
      disabled={busy}
    >
      <span>{busy ? busyLabel : label}</span>
      <span className="well" aria-hidden="true">
        {busy ? <span className={formStyles.spin} /> : <ArrowRight size={18} />}
      </span>
    </button>
  );
}
