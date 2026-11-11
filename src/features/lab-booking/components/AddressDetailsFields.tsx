/**
 * The second part of adding an address: the chosen place, then house and street and a landmark
 * (Redcliffe requires one). The PIN code comes from the chosen place and shows as text with Edit;
 * it is a field only when the place had none or the patient edits it.
 */

import { useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import ErrorNotice from "@/components/ui/ErrorNotice";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import styles from "../LabBookingFlow.module.css";

export default function AddressDetailsFields({
  placeAddress,
  onChangePlace,
  line,
  onLine,
  landmark,
  onLandmark,
  pincode,
  onPincode,
  complete,
  saving,
  error,
  onSave,
}: {
  placeAddress: string;
  onChangePlace: () => void;
  line: string;
  onLine: (line: string) => void;
  landmark: string;
  onLandmark: (landmark: string) => void;
  pincode: string;
  onPincode: (pincode: string) => void;
  complete: boolean;
  saving: boolean;
  error: string | null;
  onSave: () => void;
}) {
  const [pinStartsOpen] = useState(() => !/^\d{6}$/.test(pincode));
  const [editingPin, setEditingPin] = useState(pinStartsOpen);
  return (
    <>
      <p className={styles.place}>
        <span>{placeAddress}</span>
        <button
          type="button"
          className={formStyles.link}
          onClick={onChangePlace}
        >
          Change
        </button>
      </p>
      <div className={styles.fields}>
        <label className={formStyles.field}>
          <span className={formStyles.label}>
            House or flat, building and street
          </span>
          <input
            className={formStyles.input}
            value={line}
            onChange={(event) => onLine(event.target.value)}
            autoComplete="address-line1"
            autoFocus
          />
        </label>
        <label className={formStyles.field}>
          <span className={formStyles.label}>Landmark</span>
          <input
            className={formStyles.input}
            value={landmark}
            onChange={(event) => onLandmark(event.target.value)}
            placeholder="For example, near the metro station"
          />
        </label>
        {/* the PIN code drops in when Edit opens it (the details as a whole already arrive) */}
        {editingPin ? (
          <div className={pinStartsOpen ? undefined : styles.drop}>
            <label className={formStyles.field}>
              <span className={formStyles.label}>PIN code</span>
              <input
                className={`${formStyles.input} num`}
                value={pincode}
                inputMode="numeric"
                maxLength={6}
                onChange={(event) =>
                  onPincode(event.target.value.replace(/\D/g, ""))
                }
                autoComplete="postal-code"
              />
            </label>
          </div>
        ) : (
          <p className={styles.place}>
            <span>
              PIN code <span className="num">{pincode}</span>
            </span>
            <button
              type="button"
              className={formStyles.link}
              onClick={() => setEditingPin(true)}
            >
              Edit
            </button>
          </p>
        )}
      </div>
      {error && <ErrorNotice message={error} />}
      <button
        type="button"
        className={`btn ${formStyles.go}`}
        disabled={!complete}
        onClick={onSave}
        data-busy={saving}
        aria-busy={saving}
      >
        <span>
          {saving
            ? "Saving"
            : complete
              ? "Save and continue"
              : "Add the address to continue"}
        </span>
        <span className="well" aria-hidden="true">
          {saving ? (
            <i className={formStyles.spin} />
          ) : (
            <ArrowRight size={18} />
          )}
        </span>
      </button>
    </>
  );
}
