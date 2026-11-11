"use client";

/**
 * Confirms removing a saved address (DELETE /api/address/:addressId). The patient sees which
 * address goes before anything is deleted.
 */

import { useState } from "react";
import { Trash, WarningCircle } from "@phosphor-icons/react";
import { errorMessage } from "@/lib/http/apiClient";
import { deleteAddress } from "@/services/addressService";
import type { Address } from "@/types/address";
import Sheet from "@/components/ui/Sheet";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import styles from "../LabBookingFlow.module.css";

export default function RemoveAddressSheet({
  address,
  onClose,
  onRemoved,
}: {
  address: Address | null;
  onClose: () => void;
  onRemoved: (address: Address) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    if (!address || busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAddress(address.id);
      onRemoved(address);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={address !== null}
      onClose={onClose}
      title="Remove this address"
    >
      <p className={styles.sheetMeta}>
        {address
          ? [address.addressLine, address.city, address.pincode]
              .filter(Boolean)
              .join(", ")
          : null}
      </p>
      {error && (
        <p className={formStyles.err} role="alert">
          <WarningCircle size={16} weight="fill" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
      <button
        type="button"
        className={`btn ${formStyles.go}`}
        onClick={remove}
        data-busy={busy}
        aria-busy={busy}
      >
        <span>{busy ? "Removing" : "Remove address"}</span>
        <span className="well" aria-hidden="true">
          {busy ? <i className={formStyles.spin} /> : <Trash size={18} />}
        </span>
      </button>
    </Sheet>
  );
}
