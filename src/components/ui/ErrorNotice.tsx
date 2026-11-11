/** A failed load or save, in words, with an optional retry. */

import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import formStyles from "./styles/FormControls.module.css";
import styles from "./ErrorNotice.module.css";

export default function ErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <p className={formStyles.err} role="alert">
      <WarningCircle size={16} aria-hidden="true" />
      <span>{message}</span>
      {onRetry && (
        <button
          type="button"
          className={`${formStyles.link} ${styles.retry}`}
          onClick={onRetry}
        >
          Try again
        </button>
      )}
    </p>
  );
}
