/**
 * The lab booking form checks: what Redcliffe (or the backend's address rule) would refuse, said
 * as one sentence, or null when fine. The screens run them on a form; createLabBooking and addAddress
 * run theirs again before calling, so a bad form never reaches the backend.
 */

import type { Address, NewAddress } from "@/types/address";
import type { LabPatient } from "@/types/labTest";

/** The first thing Redcliffe would refuse about the person, in words, or null. */
export function labPatientProblem(patient: LabPatient): string | null {
  if (!/^[A-Za-z ]{3,30}$/.test(patient.name.trim()))
    return "Enter the full name in letters only, 3 to 30 characters.";
  if (!Number.isInteger(patient.age) || patient.age < 1 || patient.age > 120)
    return "Enter the age in years.";
  if (patient.gender !== "Male" && patient.gender !== "Female")
    return "The lab records male or female. Choose one.";
  if (!/^[6-9]\d{9}$/.test(patient.mobile))
    return "Enter a 10-digit Indian mobile number.";
  if (!/^\S+@\S+\.\S+$/.test(patient.email.trim()))
    return "Enter an email address for the lab's confirmation.";
  return null;
}

/** The first thing Redcliffe would refuse about a saved address (it books by map point and PIN; an empty landmark is filled from the address), or null. */
export function labAddressProblem(address: Address): string | null {
  if (address.latitude === null || address.longitude === null)
    return "This address has no map location. Add it again with the area search.";
  if (!address.addressLine.trim())
    return "Add the house or flat and street to this address.";
  if (!/^\d{6}$/.test(address.pincode))
    return "Add the 6-digit PIN code to this address.";
  return null;
}

/** The backend's own rule: address line and a 6-digit PIN code are required. Null when fine. */
export function newAddressProblem(address: NewAddress): string | null {
  if (!address.addressLine.trim()) return "Add the house, flat or street.";
  if (!/^\d{6}$/.test(address.pincode.trim()))
    return "Enter the 6-digit PIN code.";
  return null;
}
