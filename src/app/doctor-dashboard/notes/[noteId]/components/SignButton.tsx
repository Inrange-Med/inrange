/**
 * The note's Sign button (sign bar on a laptop, bottom bar on a phone): live once the note is ready.
 * While the signature is on its way (`busy`) it keeps its colour and turns its well into a spinner.
 */

import { Signature } from "@phosphor-icons/react";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import styles from "../NoteReviewPage.module.css";

export default function SignButton({
  ready,
  busy = false,
  onSign,
}: {
  ready: boolean;
  busy?: boolean;
  onSign: () => void;
}) {
  return (
    <button
      type="button"
      className={`btn ${styles.signBtn}`}
      disabled={!ready || busy}
      aria-busy={busy || undefined}
      data-busy={busy || undefined}
      onClick={onSign}
    >
      <span>{busy ? "Signing" : "Sign"}</span>
      <span className="well" aria-hidden="true">
        {busy ? <i className={formStyles.spin} /> : <Signature size={18} />}
      </span>
    </button>
  );
}
