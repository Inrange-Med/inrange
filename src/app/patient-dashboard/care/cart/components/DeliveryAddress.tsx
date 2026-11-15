"use client";

/**
 * Where the medicines go. The cart arrives with the patient's address already chosen, so this is one line
 * with Change; with no saved address the form is open right here (no tap to reach it). Change opens the
 * saved addresses, where one tap picks and closes. New addresses use the lab booking's form, without
 * the lab's collection-area check (a courier delivers).
 */

import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import NewAddressForm from "@/features/lab-booking/components/NewAddressForm";
import Sheet from "@/components/ui/Sheet";
import { useApiResource } from "@/hooks/useApiResource";
import { listMyAddresses } from "@/services/addressService";
import type { MedicineCart } from "@/types/carePlan";
import styles from "../CartPage.module.css";

export default function DeliveryAddress({
  address,
  onChoose,
}: {
  address: MedicineCart["address"];
  onChoose: (addressId: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const saved = useApiResource(open ? "my-addresses" : null, listMyAddresses);

  if (!address)
    return (
      <NewAddressForm
        isFirst
        labReach={false}
        onSaved={async (id) => {
          if (id) await onChoose(id);
        }}
      />
    );

  const close = () => {
    setOpen(false);
    setAdding(false);
  };

  return (
    <>
      <div className={styles.address}>
        <p>
          {address.name && <strong>{address.name}</strong>}
          <span>{address.line}</span>
        </p>
        <button
          type="button"
          className={styles.change}
          onClick={() => setOpen(true)}
        >
          Change
        </button>
      </div>
      <Sheet open={open} onClose={close} title="Deliver to">
        {adding ? (
          <NewAddressForm
            isFirst={false}
            labReach={false}
            onCancel={() => setAdding(false)}
            onSaved={async (id) => {
              if (id) await onChoose(id);
              close();
            }}
          />
        ) : (
          <div className={styles.addressList}>
            {(saved.data ?? []).map((option) => (
              <button
                key={option.id}
                type="button"
                className={styles.addressOption}
                aria-pressed={String(option.id) === address.id}
                onClick={() => {
                  close();
                  if (String(option.id) !== address.id)
                    void onChoose(option.id);
                }}
              >
                <span>{option.addressLine}</span>
                <small>
                  {[option.landmark, option.city, option.pincode]
                    .filter(Boolean)
                    .join(", ")}
                </small>
              </button>
            ))}
            <button
              type="button"
              className={styles.addressOption}
              onClick={() => setAdding(true)}
            >
              <span className={styles.addNew}>
                <Plus size={16} aria-hidden="true" /> A new address
              </span>
            </button>
          </div>
        )}
      </Sheet>
    </>
  );
}
