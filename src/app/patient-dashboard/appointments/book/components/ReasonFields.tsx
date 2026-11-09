/** What the consultation is about, in the patient's words: optional, 300 characters. */

import formStyles from "@/components/ui/styles/FormControls.module.css";
import styles from "../BookPage.module.css";

const MAX_LENGTH = 300;

export default function ReasonFields({
  reason,
  onReasonChange,
}: {
  reason: string;
  onReasonChange: (value: string) => void;
}) {
  return (
    <div className={styles.fields}>
      <label className={formStyles.field}>
        <span className={styles.labelRow}>
          <span className={formStyles.label}>
            Anything your doctor should know (optional)
          </span>
          <span className={`${formStyles.hint} num`}>
            {reason.length}/{MAX_LENGTH}
          </span>
        </span>
        <textarea
          className={styles.textarea}
          rows={3}
          maxLength={MAX_LENGTH}
          value={reason}
          placeholder="Symptoms, questions or anything that has changed"
          onChange={(event) => onReasonChange(event.target.value)}
        />
      </label>
    </div>
  );
}
