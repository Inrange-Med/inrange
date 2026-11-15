// The signed prescription as an A4 PDF, in the Telemedicine Practice Guidelines 2020 format (Annexure 2):
// the practice and the prescriber (name, qualification, registration number), the patient, the
// consultation, the clinical picture, the medicines (generic name in capitals, strength, form, route,
// dose and frequency, duration, quantity), advice and follow-up, validity, the prescriber's signature
// and the legal notes. inrange branding: the outlined wordmark, Jost, ink on paper with mist surfaces
// (brand guidelines v1.1; never green on paper). Fonts are embedded (lib/fonts.ts).
import { PDFDocument, type PDFFont, type PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { JOST_MEDIUM, JOST_REGULAR } from "./fonts.ts";
import { LOGO_BODY_PATH, LOGO_DOT_PATH, LOGO_H, LOGO_PLUS_PATH } from "./wordmarkPaths.ts";

export type RxPdfItem = {
  brand: string; generic: string | null; form: string; strength: string; dose: string; frequency: string;
  route: string; duration: string; quantity: string; instructions: string;
};
export type RxPdf = {
  id: number; version: number;
  practice: { name: string; email: string; address: string | null; pharmacyLicence: string | null };
  doctor: { name: string; qualification: string; specialization: string; registrationNo: string };
  patient: { name: string; ageSex: string; patientId: string; mobile: string; address: string | null; vitals: string | null };
  consult: { mode: string; type: string; date: string; time: string; signedAt: string };
  clinical: { complaint: string; diagnosis: string; history: string; allergies: string; currentMedicines: string };
  items: RxPdfItem[];
  advice: string[];
  followUp: string;
  validUntil: string;
};

const INK = rgb(0.067, 0.067, 0.067);
const MUTED = rgb(0.4, 0.41, 0.42);
const FAINT = rgb(0.6, 0.6, 0.6);
const MIST = rgb(0.957, 0.957, 0.949);
const RULE = rgb(0.86, 0.86, 0.84);
const W = 595.28, H = 841.89, M = 44, CW = W - 2 * M;

const bytes = (b64: string) => Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
let fonts: [Uint8Array, Uint8Array] | null = null;
const loadFonts = () => (fonts ??= [bytes(JOST_REGULAR), bytes(JOST_MEDIUM)]);

/** Plain text a font can draw: no control characters, dashes as hyphens. */
const clean = (s: unknown) => String(s ?? "").replace(/[–—]/g, "-").replace(/[^\S ]+/g, " ").replace(/[\u0000-\u001f]/g, "").trim();

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of clean(text).split(/\n/)) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) { line = next; continue; }
      if (line) out.push(line);
      // a single word wider than the column is cut, never overflows
      let w = word;
      while (font.widthOfTextAtSize(w, size) > width && w.length > 1) {
        let cut = w.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > width) cut--;
        out.push(w.slice(0, cut));
        w = w.slice(cut);
      }
      line = w;
    }
    out.push(line);
  }
  return out.length ? out : [""];
}

const sentenceCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const roundRect = (w: number, h: number, r: number) => {
  const k = r * 0.5523;
  return `M ${r} 0 H ${w - r} C ${w - r + k} 0 ${w} ${r - k} ${w} ${r} V ${h - r} C ${w} ${h - r + k} ${w - r + k} ${h} ${w - r} ${h} ` +
    `H ${r} C ${r - k} ${h} 0 ${h - r + k} 0 ${h - r} V ${r} C 0 ${r - k} ${r - k} 0 ${r} 0 Z`;
};

export async function prescriptionPdf(rx: RxPdf): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [regBytes, medBytes] = loadFonts();
  const reg = await doc.embedFont(regBytes, { subset: true });
  const med = await doc.embedFont(medBytes, { subset: true });
  doc.setTitle(`Prescription ${rx.id} v${rx.version}`);
  doc.setAuthor(rx.doctor.name);
  doc.setCreator("inrange");
  doc.setProducer("inrange");

  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0;

  const text = (s: string, x: number, yy: number, size: number, font = reg, color = INK) =>
    page.drawText(clean(s), { x, y: yy, size, font, color });
  const right = (s: string, xr: number, yy: number, size: number, font = reg, color = INK) =>
    text(s, xr - font.widthOfTextAtSize(clean(s), size), yy, size, font, color);
  const box = (x: number, top: number, w: number, h: number, fill = MIST) =>
    page.drawSvgPath(roundRect(w, h, 8), { x, y: top, color: fill });

  /** The head every page carries: the practice on the left, the prescriber on the right. */
  function newPage() {
    page = doc.addPage([W, H]);
    pages.push(page);
    const scale = 22 / LOGO_H;
    const top = H - M;
    for (const d of [LOGO_BODY_PATH, LOGO_DOT_PATH, LOGO_PLUS_PATH])
      page.drawSvgPath(d, { x: M - 63.1 * scale, y: top - 705 * scale, scale, color: INK });
    let ly = top - 36;
    for (const line of [rx.practice.name, rx.practice.email, ...(rx.practice.address ? wrap(rx.practice.address, reg, 8, 230) : [])]) {
      text(line, M, ly, 8, reg, MUTED);
      ly -= 11;
    }
    let ry = top - 8;
    right(rx.doctor.name, W - M, ry, 13, med);
    ry -= 15;
    for (const line of [rx.doctor.qualification, rx.doctor.specialization, `Reg. No. ${rx.doctor.registrationNo}`].filter(Boolean)) {
      right(line, W - M, ry, 8.5, reg, MUTED);
      ry -= 11.5;
    }
    y = Math.min(ly, ry) - 6;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: RULE });
    y -= 20;
    text("Prescription", M, y, 15, med);
    right(`Rx ${rx.id}  ·  Version ${rx.version}`, W - M, y + 2, 8.5, reg, MUTED);
    y -= 14;
  }

  const FOOT = 146; // room kept for the signature and the legal notes
  const ensure = (h: number) => { if (y - h < FOOT) newPage(); };

  /** A titled card of label/value rows, laid out in a column. Returns its height. */
  function card(title: string, rows: [string, string][], x: number, w: number, top: number, draw: boolean) {
    const labelW = 70, size = 9, lh = 12;
    const lines = rows.map(([l, v]) => [l, wrap(v || "Not recorded", reg, size, w - 24 - labelW)] as const);
    const h = 28 + lines.reduce((n, [, v]) => n + v.length * lh + 2, 0) + 4;
    if (draw) {
      box(x, top, w, h);
      text(title.toUpperCase(), x + 12, top - 16, 7, med, MUTED);
      let yy = top - 30;
      for (const [label, vals] of lines) {
        text(label, x + 12, yy, size, reg, MUTED);
        vals.forEach((v, i) => text(v, x + 12 + labelW, yy - i * lh, size, label === "Name" ? med : reg));
        yy -= vals.length * lh + 2;
      }
    }
    return h;
  }

  function cardRow(left: [string, [string, string][]], rightCard: [string, [string, string][]]) {
    const w = (CW - 12) / 2;
    const h = Math.max(card(...left, M, w, 0, false), card(...rightCard, M + w + 12, w, 0, false));
    ensure(h + 10);
    card(...left, M, w, y, true);
    card(...rightCard, M + w + 12, w, y, true);
    y -= h + 10;
  }

  function fullCard(title: string, rows: [string, string][]) {
    const h = card(title, rows, M, CW, 0, false);
    ensure(h + 10);
    card(title, rows, M, CW, y, true);
    y -= h + 10;
  }

  newPage();
  cardRow(
    ["Patient", [["Name", rx.patient.name], ["Age, sex", rx.patient.ageSex], ["Patient ID", rx.patient.patientId],
      ["Mobile", rx.patient.mobile], ...(rx.patient.address ? [["Address", rx.patient.address] as [string, string]] : []),
      ...(rx.patient.vitals ? [["Vitals", rx.patient.vitals] as [string, string]] : [])]],
    ["Consultation", [["Mode", rx.consult.mode], ["Type", rx.consult.type], ["Date", rx.consult.date],
      ["Time", rx.consult.time], ["Signed", rx.consult.signedAt]]],
  );
  fullCard("Clinical assessment", [
    ["Complaint", rx.clinical.complaint], ["Diagnosis", rx.clinical.diagnosis], ["History", rx.clinical.history],
    ["Allergies", rx.clinical.allergies], ["Other medicines", rx.clinical.currentMedicines],
  ]);

  // ---- the medicines
  const cols = [
    { k: "medicine", label: "Medicine", w: 170 }, { k: "strength", label: "Strength", w: 54 },
    { k: "how", label: "Dose and frequency", w: 118 }, { k: "route", label: "Route", w: 62 },
    { k: "duration", label: "Duration", w: 56 }, { k: "qty", label: "Qty", w: CW - 170 - 54 - 118 - 62 - 56 },
  ];
  const head = () => {
    ensure(60);
    text("Rx", M, y - 10, 16, med);
    y -= 18;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: INK });
    let x = M;
    for (const c of cols) { text(c.label.toUpperCase(), x + 4, y - 13, 6.8, med, MUTED); x += c.w; }
    y -= 20;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.4, color: RULE });
  };
  head();
  rx.items.forEach((item, i) => {
    const cells: Record<string, { lines: string[]; font: PDFFont; size: number; color?: ReturnType<typeof rgb> }[]> = {
      medicine: [
        { lines: wrap(`${i + 1}. ${item.brand}`, med, 9.5, 162), font: med, size: 9.5 },
        ...(item.generic ? [{ lines: wrap(item.generic.toUpperCase(), reg, 7.8, 162), font: reg, size: 7.8, color: MUTED }] : []),
        ...(item.form ? [{ lines: wrap(item.form, reg, 7.8, 162), font: reg, size: 7.8, color: MUTED }] : []),
      ],
      strength: [{ lines: wrap(item.strength || "-", reg, 9, cols[1].w - 8), font: reg, size: 9 }],
      how: [{ lines: wrap(sentenceCase([item.dose, item.frequency].filter(Boolean).join(", ")) || "-", reg, 9, cols[2].w - 8), font: reg, size: 9 }],
      route: [{ lines: wrap(item.route || "-", reg, 9, cols[3].w - 8), font: reg, size: 9 }],
      duration: [{ lines: wrap(item.duration || "-", reg, 9, cols[4].w - 8), font: reg, size: 9 }],
      qty: [{ lines: wrap(item.quantity || "-", reg, 9, cols[5].w - 8), font: reg, size: 9 }],
    };
    const heightOf = (parts: typeof cells.medicine) => parts.reduce((n, p) => n + p.lines.length * (p.size + 3), 0);
    const instr = item.instructions ? wrap(item.instructions, reg, 8.2, CW - 20) : [];
    const rowH = Math.max(...Object.values(cells).map(heightOf)) + (instr.length ? instr.length * 11 + 4 : 0) + 11;
    if (y - rowH < FOOT) { newPage(); head(); }
    let x = M;
    for (const c of cols) {
      let yy = y - 14;
      for (const p of cells[c.k]) for (const line of p.lines) { text(line, x + 4, yy, p.size, p.font, p.color ?? INK); yy -= p.size + 3; }
      x += c.w;
    }
    if (instr.length) {
      let yy = y - rowH + 8 + instr.length * 11;
      for (const line of instr) { text(line, M + 16, yy, 8.2, reg, MUTED); yy -= 11; }
    }
    y -= rowH;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.4, color: RULE });
  });
  y -= 12;

  fullCard("Advice and follow-up", [
    ...(rx.advice.length ? [["Advice", rx.advice.join("\n")] as [string, string]] : []),
    ["Follow-up", rx.followUp], ["Valid until", rx.validUntil],
  ]);

  // ---- the signature, on the last page, above the notes
  ensure(0);
  const sy = 100;
  right("Digitally signed", W - M, sy + 34, 8, reg, MUTED);
  right(rx.doctor.name, W - M, sy + 20, 11, med);
  right(`${[rx.doctor.qualification, `Reg. No. ${rx.doctor.registrationNo}`].filter(Boolean).join("  ·  ")}`, W - M, sy + 8, 8, reg, MUTED);
  right(rx.consult.signedAt, W - M, sy - 3, 8, reg, MUTED);
  if (rx.practice.pharmacyLicence) text(rx.practice.pharmacyLicence, M, sy + 8, 7.5, reg, MUTED);

  // ---- every page: the legal notes and the page count
  const notes =
    "Issued by the registered medical practitioner named above after a video teleconsultation, under the Telemedicine " +
    "Practice Guidelines, 2020, on the basis of the history and information the patient gave. Valid only for the named " +
    "patient, not transferable, and to be dispensed only until the date shown. It may be filled at inrange's licensed " +
    "pharmacy or at any licensed pharmacy the patient prefers. Take the medicines as written; do not change the dose or " +
    "duration without the prescriber. Individual responses vary and no outcome is guaranteed. This is not for " +
    "emergencies: in an emergency, go to the nearest hospital. Personal data is processed under the Digital Personal " +
    `Data Protection Act, 2023 and the inrange privacy policy. Questions or grievances: ${rx.practice.email}.`;
  const noteLines = wrap(notes, reg, 6.6, CW);
  pages.forEach((p, i) => {
    page = p;
    page.drawLine({ start: { x: M, y: 74 }, end: { x: W - M, y: 74 }, thickness: 0.4, color: RULE });
    noteLines.forEach((line, n) => text(line, M, 64 - n * 8.6, 6.6, reg, FAINT));
    right(`Page ${i + 1} of ${pages.length}`, W - M, 18, 7, reg, FAINT);
    text(`${rx.practice.name}`, M, 18, 7, reg, FAINT);
  });

  return await doc.save();
}
