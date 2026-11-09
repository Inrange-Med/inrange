/** One readable line for a saved address: house line, place, city, state and PIN, each part once. */

import type { Address } from "@/types/address";

export function addressText(
  address: Pick<Address, "addressLine" | "city" | "state" | "pincode">,
): string {
  const seen = new Set<string>();
  return [
    ...address.addressLine.split(","),
    address.city,
    address.state,
    address.pincode,
  ]
    .map((part) => part.trim())
    .filter((part) => {
      const key = part.toLowerCase();
      if (!part || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(", ");
}
