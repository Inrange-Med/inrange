/*
  Who runs inrange, as the footer and contact lines show it (client call, 12 Nov 2026: a registered
  office address and an email build trust, and since inrange supplies medicine, the drug licence
  belongs there too). A line shows only once its value is filled in here, so the site never shows
  a placeholder. CONFIRM each value with inrange before filling it:
  - registeredOffice: the address on the certificate of incorporation (MCA), in one line.
  - drugLicence: the retail licence numbers (Forms 20 and 21) of the pharmacy that dispenses, with
    the name it is issued to. Counsel first: the parent company is not named on the site yet.
*/
export const COMPANY = {
  legalName: "Novaxis Lifesciences Pvt Ltd",
  email: "care@inrangemed.com",
  registeredOffice: null as string | null,
  drugLicence: null as { holder: string; numbers: string } | null,
};
