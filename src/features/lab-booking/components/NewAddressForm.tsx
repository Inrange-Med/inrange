"use client";

/**
 * Adding a collection address: search the area (Redcliffe's place search, through the backend),
 * choose the right place, and the collectors' reach is checked straight away. Then the house and
 * street, a landmark and the PIN code, saved with the place's map location (useNewAddressForm).
 */

import { useNewAddressForm } from "../useNewAddressForm";
import AddressDetailsFields from "./AddressDetailsFields";
import AddressPlaceSearch from "./AddressPlaceSearch";

export default function NewAddressForm({
  isFirst,
  onSaved,
  onCancel,
}: {
  isFirst: boolean;
  onSaved: (addressId: number | null) => Promise<void>;
  onCancel?: () => void;
}) {
  const form = useNewAddressForm(isFirst, onSaved);

  if (!form.place)
    return (
      <AddressPlaceSearch
        query={form.query}
        onQuery={form.changeQuery}
        matches={form.matches}
        searching={form.searching}
        locating={form.locating}
        onLocate={form.locate}
        checkingEloc={form.checkingEloc}
        onPick={form.pick}
        error={form.error}
        onCancel={onCancel}
      />
    );

  return (
    <AddressDetailsFields
      placeAddress={form.place.address}
      onChangePlace={form.changePlace}
      line={form.line}
      onLine={form.setLine}
      landmark={form.landmark}
      onLandmark={form.setLandmark}
      pincode={form.pincode}
      onPincode={form.setPincode}
      complete={form.complete}
      saving={form.saving}
      error={form.error}
      onSave={form.save}
    />
  );
}
