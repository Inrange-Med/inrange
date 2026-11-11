/*
  The doctors on the care team, shown as a plain directory. Each card shows only what every doctor has
  given us: name and qualifications, as on the register (client, 19 Oct 2026), plus a portrait, and years in
  practice where the doctor has stated them (client, 19 Oct 2026; docs/compliance.md allows experience stated
  factually). Nothing promotional: no ratings, patient counts, success lines or quotes (NMC Guidelines on
  Ethical Advertising, 6 Oct 2026; IMC Regulations 2002). Council, registration number and languages render
  only once they are filled in for a doctor.

  Portraits are graded to one set: each subject cut out of its original background and placed on the same
  carbon studio backdrop, 4:5, head and shoulders, eyes about 34% from the top (masters and the cut-out
  script in the session scratchpad; redo new photos the same way). Better originals are always welcome:
  at least 1600 x 2000 px, chest up, plain wall, soft window light.

  Order: Dr. Govind Singh first (client, 19 Oct 2026), then alphabetical by first name.
  CONFIRM for every doctor: consent to be listed, council and registration number.
*/

export type Doctor = {
  name: string;
  /** recognised qualifications, as on the register */
  degrees: string;
  /** years in practice, as the doctor or their CV states it ("35+"); shown beside the degrees, factually */
  years?: string;
  specialty?: string;
  /** e.g. "Delhi Medical Council" */
  council?: string;
  reg?: string;
  languages?: string;
  /** a portrait from the doctor, graded to the set */
  photo?: string;
};

export const DOCTORS: Doctor[] = [
  // first by the client's choice (19 Oct 2026); the rest alphabetical by first name
  { name: "Dr. Govind Singh", degrees: "MD (General Medicine)", years: "35+", photo: "/img/doc-govind-singh-v2.jpg" },
  { name: "Dr. Arunim Purkayastha", degrees: "MBBS, MD (General Medicine), MACP", years: "11+", photo: "/img/doc-arunim-purkayastha-v2.jpg" },
  { name: "Dr. Barun Kumar", degrees: "MBBS, DNB", years: "14", photo: "/img/doc-barun-kumar-v2.jpg" },
  { name: "Dr. Imran Ahmad Khan", degrees: "MBBS, MD (General Medicine)", photo: "/img/doc-imran-ahmad-khan-v3.jpg" },
  // from his CV (Sep 2026): MBBS (Zhengzhou University), MPH (Florida International University); in practice in
  // India since January 2017 (Kailash Hospital, then Park Hospital and Medanta), so 9+ years. CONFIRM with him.
  { name: "Dr. Rakesh Mishra", degrees: "MBBS, MPH", years: "9+", photo: "/img/doc-rakesh-mishra-v4.jpg" },
];

/** Every doctor on the care team is listed. */
export const LISTED_DOCTORS = DOCTORS;
