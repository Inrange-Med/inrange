"use client";

/**
 * Step 2: where to collect. Saved addresses (the team's /api/address endpoints); tapping one checks
 * at once that Redcliffe's collectors reach it, and moves on if they do. A new address is found
 * with the area search, so it is saved with its map location (Redcliffe books by latitude and longitude).
 * A saved address can be removed (RemoveAddressSheet).
 */

import { useState } from "react";
import { CaretRight, Plus, WarningCircle } from "@phosphor-icons/react";
import { useApiResource } from "@/hooks/useApiResource";
import { listMyAddresses } from "@/services/addressService";
import { checkLabServiceability } from "@/services/labTestService";
import { errorMessage } from "@/lib/http/apiClient";
import { labAddressProblem } from "@/lib/validation/labBookingRules";
import type { Address } from "@/types/address";
import ErrorNotice from "@/components/ui/ErrorNotice";
import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import { useToast } from "@/components/ui/ToastProvider";
import formStyles from "@/components/ui/styles/FormControls.module.css";
import NewAddressForm from "./NewAddressForm";
import RemoveAddressSheet from "./RemoveAddressSheet";
import styles from "../LabBookingFlow.module.css";

const NOT_SERVED =
  "Our partner lab does not collect at this address yet. Try another address.";

export default function CollectionAddressStep({
  chosenId,
  onChoose,
}: {
  chosenId: number | null;
  onChoose: (address: Address) => void;
}) {
  const addresses = useApiResource("my-addresses", listMyAddresses);
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Address | null>(null);
  const [checkingId, setCheckingId] = useState<number | null>(null);
  const [problem, setProblem] = useState<{
    id: number;
    message: string;
  } | null>(null);

  const choose = async (address: Address) => {
    if (checkingId !== null) return;
    // Redcliffe books by map point, landmark and PIN: say what is missing before asking the lab
    const missing = labAddressProblem(address);
    if (missing || address.latitude === null || address.longitude === null) {
      setProblem({
        id: address.id,
        message: missing ?? "This address has no map location.",
      });
      return;
    }
    setCheckingId(address.id);
    setProblem(null);
    try {
      const result = await checkLabServiceability({
        latitude: address.latitude,
        longitude: address.longitude,
      });
      if (result.serviceable) onChoose(address);
      else setProblem({ id: address.id, message: NOT_SERVED });
    } catch (caught) {
      setProblem({ id: address.id, message: errorMessage(caught) });
    } finally {
      setCheckingId(null);
    }
  };

  /** After a save: reload the list, then go on with the new address (already checked by the form). */
  const saved = async (newId: number | null) => {
    const list = await listMyAddresses();
    addresses.setData(list);
    setAdding(false);
    const created =
      list.find((address) => address.id === newId) ??
      [...list].sort((a, b) => b.id - a.id)[0];
    if (created) onChoose(created);
  };

  const removed = (address: Address) => {
    setRemoving(null);
    addresses.setData(
      (addresses.data ?? []).filter((saved) => saved.id !== address.id),
    );
    if (problem?.id === address.id) setProblem(null);
    toast("Address removed");
  };

  if (addresses.loading) return <LoadingSkeleton />;
  if (addresses.error)
    return <ErrorNotice message={addresses.error} onRetry={addresses.reload} />;

  const list = addresses.data ?? [];
  if (adding || list.length === 0) {
    return (
      <NewAddressForm
        isFirst={list.length === 0}
        onSaved={saved}
        onCancel={list.length ? () => setAdding(false) : undefined}
      />
    );
  }

  return (
    <>
      <p className={styles.sheetMeta}>
        The lab&apos;s collector comes to this address.
      </p>
      <ul className={styles.packets}>
        {list.map((address) => (
          <li key={address.id} className={styles.addressRow}>
            <button
              type="button"
              className={styles.packet}
              data-chosen={address.id === chosenId || undefined}
              onClick={() => choose(address)}
              aria-busy={checkingId === address.id}
            >
              <span className={styles.packetText}>
                <span className={styles.packetHead}>
                  <strong>{address.addressLine}</strong>
                </span>
                <span className={styles.packetWhat}>
                  {[address.landmark, address.city, address.pincode]
                    .filter(Boolean)
                    .join(", ")}
                </span>
                {address.isPrimary && <em className={styles.tag}>Primary</em>}
              </span>
              {checkingId === address.id ? (
                <i
                  className={`${formStyles.spin} ${styles.spin}`}
                  aria-label="Checking"
                />
              ) : (
                <CaretRight
                  size={17}
                  className={styles.go}
                  aria-hidden="true"
                />
              )}
            </button>
            <button
              type="button"
              className={`${formStyles.link} ${styles.removeAddress}`}
              onClick={() => setRemoving(address)}
              aria-label={`Remove ${address.addressLine}`}
            >
              Remove
            </button>
            {problem?.id === address.id && (
              <p className={formStyles.err} role="alert">
                <WarningCircle size={16} weight="fill" aria-hidden="true" />
                <span>{problem.message}</span>
              </p>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={`btn btn--ghost ${styles.pill}`}
        onClick={() => setAdding(true)}
      >
        <Plus size={17} /> Add an address
      </button>
      <RemoveAddressSheet
        address={removing}
        onClose={() => setRemoving(null)}
        onRemoved={removed}
      />
    </>
  );
}
