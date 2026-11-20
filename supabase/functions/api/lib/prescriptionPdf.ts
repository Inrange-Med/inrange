// The signed prescription as an A4 PDF: template v2 (inrange-prescription-template-v2.pdf, 16 Nov 2026), in the
// Telemedicine Practice Guidelines 2020 format: the practice and the prescriber (qualification, registration
// number and council, practice address, contact), the patient, the consultation, the clinical picture, the
// medicines (GENERIC first, brand in brackets, form, strength, dose and frequency, route, when, quantity; a dose
// step-up shows Step 1, Step 2 with the weeks), a note when strengths follow each other, advice and follow-up,
// validity, the digital signature and the legal notes. inrange wordmark (its plus in green, per template v2),
// Jost (embedded, lib/fonts.ts), ink on paper with mist cards.
import { PDFDocument, type PDFFont, type PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { JOST_MEDIUM, JOST_REGULAR } from "./fonts.ts";
import { LOGO_BODY_PATH, LOGO_DOT_PATH, LOGO_H, LOGO_PLUS_PATH } from "./wordmarkPaths.ts";

export type RxPdfItem = {
  generic: string; brand: string | null; form: string; strength: string; how: string; route: string;
  step: number | null; when: string; quantity: string; instructions: string;
};
export type RxPdf = {
  rxNumber: number; version: number; supersedes: string | null;
  practice: { name: string; address: string; supportPhone: string };
  doctor: { name: string; qualification: string; registration: string; practiceAddress: string; contact: string };
  patient: { name: string; ageSex: string; patientId: string; mobile: string; city: string | null; vitals: string | null };
  consult: { mode: string; type: string; dateTime: string; signedAt: string };
  clinical: { complaint: string; diagnosis: string; history?: string | null; allergies: string; otherMedicines: string };
  items: RxPdfItem[];
  callout: string | null;
  advice: [string, string][];
  signature: { method: string; reference: string };
};

const INK = rgb(0.067, 0.067, 0.067);
const MUTED = rgb(0.38, 0.39, 0.4);
const FAINT = rgb(0.55, 0.55, 0.55);
const MIST = rgb(0.957, 0.957, 0.949);
const RULE = rgb(0.86, 0.86, 0.84);
const PAPER = rgb(1, 1, 1);
const GREEN = rgb(0.2, 0.74, 0.4); // template v2: the plus and the note bar
const GREEN_WASH = rgb(0.925, 0.976, 0.937);
const W = 595.28, H = 841.89, M = 44, CW = W - 2 * M;

const bytes = (b64: string) => Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
let fonts: [Uint8Array, Uint8Array] | null = null;
const loadFonts = () => (fonts ??= [bytes(JOST_REGULAR), bytes(JOST_MEDIUM)]);

/** Plain text a font can draw: no control characters, dashes as hyphens. */
const clean = (s: unknown) => String(s ?? "").replace(/[–—]/g, "-").replace(/[^\S ]+/g, " ").replace(/[\u0000-\u001f]/g, "").trim();
const sentenceCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of String(text ?? "").split(/\n/).map(clean)) {
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
  doc.setTitle(`Prescription ${rx.rxNumber} v${rx.version}`);
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
  const box = (x: number, top: number, w: number, h: number, fill = MIST, r = 8) =>
    page.drawSvgPath(roundRect(w, h, r), { x, y: top, color: fill });

  /** Every page's head: the practice on the left, the prescriber on the right, then the title row. */
  function newPage() {
    page = doc.addPage([W, H]);
    pages.push(page);
    const scale = 22 / LOGO_H;
    const top = H - M;
    const at = { x: M - 63.1 * scale, y: top - 705 * scale, scale };
    page.drawSvgPath(LOGO_BODY_PATH, { ...at, color: INK });
    page.drawSvgPath(LOGO_DOT_PATH, { ...at, color: INK });
    page.drawSvgPath(LOGO_PLUS_PATH, { ...at, color: GREEN });
    let ly = top - 36;
    for (const line of [rx.practice.name, ...wrap(rx.practice.address, reg, 8.4, 240), rx.practice.supportPhone]) {
      text(line, M, ly, 8.4, reg, MUTED);
      ly -= 11.5;
    }
    let ry = top - 8;
    right(rx.doctor.name, W - M, ry, 13, med);
    ry -= 15;
    for (const line of [rx.doctor.qualification, rx.doctor.registration, rx.doctor.practiceAddress, rx.doctor.contact].filter(Boolean)) {
      for (const part of wrap(line, reg, 8.4, 260)) { right(part, W - M, ry, 8.4, reg, MUTED); ry -= 11.5; }
    }
    y = Math.min(ly, ry) - 4;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: RULE });
    y -= 22;
    text("Prescription", M, y, 16, med);
    right(`Rx ${rx.rxNumber}  ·  Version ${rx.version}`, W - M, y + 3, 8.6, reg, MUTED);
    if (rx.supersedes) right(rx.supersedes, W - M, y - 9, 8.6, reg, MUTED);
    y -= 16;
  }

  const FOOT = 80; // room kept for the legal notes; the signature asks for its own room on the last page
  const ensure = (h: number) => { if (y - h < FOOT) newPage(); };

  /** A titled card of label/value rows. Returns its height; draws only when asked. */
  function card(title: string, rows: [string, string][], x: number, w: number, top: number, draw: boolean, labelW = 62) {
    const size = 9, lh = 12;
    const lines = rows.map(([l, v]) => [l, wrap(v || "Not recorded", reg, size, w - 24 - labelW)] as const);
    const h = 26 + lines.reduce((n, [, v]) => n + v.length * lh + 2, 0) + 4;
    if (draw) {
      box(x, top, w, h);
      text(title.toUpperCase(), x + 12, top - 16, 7, med, MUTED);
      let yy = top - 28;
      for (const [label, vals] of lines) {
        text(label, x + 12, yy, size, reg, MUTED);
        vals.forEach((v, i) => text(v, x + 12 + labelW, yy - i * lh, size, label === "Full name" ? med : reg));
        yy -= vals.length * lh + 2;
      }
    }
    return h;
  }
  function cardRow(a: [string, [string, string][]], b: [string, [string, string][]]) {
    const w = (CW - 12) / 2;
    const h = Math.max(card(...a, M, w, 0, false), card(...b, M + w + 12, w, 0, false));
    ensure(h + 8);
    card(...a, M, w, y, true);
    card(...b, M + w + 12, w, y, true);
    y -= h + 8;
  }
  function fullCard(title: string, rows: [string, string][], labelW = 84) {
    const h = card(title, rows, M, CW, 0, false, labelW);
    ensure(h + 8);
    card(title, rows, M, CW, y, true, labelW);
    y -= h + 8;
  }

  newPage();
  cardRow(
    ["Patient", [["Full name", rx.patient.name], ["Age, sex", rx.patient.ageSex], ["Patient ID", rx.patient.patientId],
      ["Mobile", rx.patient.mobile], ...(rx.patient.city ? [["City", rx.patient.city] as [string, string]] : []),
      ...(rx.patient.vitals ? [["Vitals", rx.patient.vitals] as [string, string]] : [])]],
    ["Consultation", [["Mode", rx.consult.mode], ["Type", rx.consult.type], ["Date, time", rx.consult.dateTime],
      ["Signed", rx.consult.signedAt]]],
  );
  fullCard("Clinical assessment", [
    ["Complaint", rx.clinical.complaint], ["Diagnosis", rx.clinical.diagnosis],
    // the consultation page's "Patient history" (doctor portal v2), only when the doctor wrote one
    ...(rx.clinical.history ? [["History", rx.clinical.history] as [string, string]] : []),
    ["Allergies", rx.clinical.allergies], ["Other medicines", rx.clinical.otherMedicines],
  ]);

  // ---- the medicines
  const cols = [
    { k: "medicine", label: "Medicine", w: 160 }, { k: "strength", label: "Strength", w: 50 },
    { k: "how", label: "Dose and frequency", w: 116 }, { k: "route", label: "Route", w: 52 },
    { k: "when", label: "When", w: 80 }, { k: "qty", label: "Qty", w: CW - 160 - 50 - 116 - 52 - 80 },
  ];
  const head = () => {
    ensure(60);
    text("Rx", M, y - 12, 16, med);
    y -= 20;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.7, color: INK });
    let x = M;
    for (const c of cols) { text(c.label.toUpperCase(), x + (c.k === "medicine" ? 0 : 4), y - 13, 6.8, med, MUTED); x += c.w; }
    y -= 20;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.4, color: RULE });
  };
  head();
  type Part = { lines: string[]; font: PDFFont; size: number; color?: ReturnType<typeof rgb>; chip?: string };
  rx.items.forEach((item, i) => {
    const colW = (k: string) => cols.find((c) => c.k === k)!.w - 8;
    const cells: Record<string, Part[]> = {
      medicine: [
        { lines: wrap(`${i + 1}. ${item.generic.toUpperCase()}`, med, 9.6, cols[0].w - 6), font: med, size: 9.6 },
        ...(item.brand ? [{ lines: wrap(`(${item.brand})`, reg, 7.8, cols[0].w - 6), font: reg, size: 7.8, color: MUTED }] : []),
        ...(item.form ? [{ lines: wrap(item.form, reg, 7.8, cols[0].w - 6), font: reg, size: 7.8, color: MUTED }] : []),
      ],
      strength: [{ lines: wrap(item.strength || "-", reg, 9, colW("strength")), font: reg, size: 9 }],
      how: [{ lines: wrap(sentenceCase(item.how) || "-", reg, 9, colW("how")), font: reg, size: 9 }],
      route: [{ lines: wrap(item.route || "-", reg, 9, colW("route")), font: reg, size: 9 }],
      when: [
        ...(item.step ? [{ lines: [""], font: med, size: 9, chip: `STEP ${item.step}` }] : []),
        { lines: wrap(item.when || "-", reg, 9, colW("when")), font: reg, size: 9 },
      ],
      qty: [{ lines: wrap(item.quantity || "-", reg, 9, colW("qty")), font: reg, size: 9 }],
    };
    const heightOf = (parts: Part[]) => parts.reduce((n, p) => n + (p.chip ? 15 : p.lines.length * (p.size + 3)), 0);
    const instr = item.instructions ? wrap(item.instructions, reg, 8.2, CW - 20) : [];
    const rowH = Math.max(...Object.values(cells).map(heightOf)) + (instr.length ? instr.length * 11 + 4 : 0) + 12;
    if (y - rowH < FOOT) { newPage(); head(); }
    let x = M;
    for (const c of cols) {
      let yy = y - 14;
      const pad = c.k === "medicine" ? 0 : 4;
      for (const p of cells[c.k]) {
        if (p.chip) {
          const cw = med.widthOfTextAtSize(p.chip, 6.6) + 10;
          box(x + pad, yy + 9, cw, 12, INK, 3);
          text(p.chip, x + pad + 5, yy + 0.6, 6.6, med, PAPER);
          yy -= 15;
          continue;
        }
        for (const line of p.lines) { text(line, x + pad, yy, p.size, p.font, p.color ?? INK); yy -= p.size + 3; }
      }
      x += c.w;
    }
    if (instr.length) {
      let yy = y - rowH + 8 + instr.length * 11;
      for (const line of instr) { text(line, M + 12, yy, 8.2, reg, MUTED); yy -= 11; }
    }
    y -= rowH;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.4, color: RULE });
  });
  y -= 10;

  // the step-up note: a green bar on a pale green band
  if (rx.callout) {
    const lines = wrap(rx.callout, reg, 8.8, CW - 26);
    const h = lines.length * 12 + 12;
    ensure(h + 8);
    page.drawRectangle({ x: M, y: y - h, width: CW, height: h, color: GREEN_WASH });
    page.drawRectangle({ x: M, y: y - h, width: 3, height: h, color: GREEN });
    lines.forEach((line, n) => text(line, M + 14, y - 14.5 - n * 12, 8.8, reg, INK));
    y -= h + 8;
  }

  fullCard("Advice and follow-up", rx.advice);

  // ---- the signature, on the last page, above the notes (a page of its own only if the last one is full)
  if (y < 126) newPage();
  const sy = 84;
  right(`Digitally signed (${rx.signature.method})`, W - M, sy + 31, 7.8, reg, MUTED);
  right(rx.doctor.name, W - M, sy + 19, 11, med);
  right(`${[rx.doctor.qualification, rx.doctor.registration.split("·")[0].trim()].filter(Boolean).join("  ·  ")}`, W - M, sy + 9, 7.8, reg, MUTED);
  right(`${rx.consult.signedAt}  ·  Signature ID ${rx.signature.reference}`, W - M, sy, 7.8, reg, MUTED);

  // ---- every page: the legal notes and the page count
  const notes =
    "Issued by the registered medical practitioner named above after a video teleconsultation, under the Telemedicine " +
    "Practice Guidelines, 2020, on the basis of the history and information the patient gave. Valid only for the named " +
    "patient, not transferable, and to be dispensed only until the date shown. It may be filled at inrange's licensed " +
    "pharmacy or at any licensed pharmacy the patient prefers. Take the medicines as written; do not change the dose or " +
    "duration without the prescriber. Individual responses vary and no outcome is guaranteed. This is not for " +
    "emergencies: in an emergency, go to the nearest hospital. Personal data is processed under the Digital Personal " +
    `Data Protection Act, 2023 and the inrange privacy policy. Questions or grievances: ${rx.practice.supportPhone.replace(/^Support:?\s*/i, "")}.`;
  const noteLines = wrap(notes, reg, 6.4, CW);
  pages.forEach((p, i) => {
    page = p;
    page.drawLine({ start: { x: M, y: 74 }, end: { x: W - M, y: 74 }, thickness: 0.4, color: RULE });
    noteLines.forEach((line, n) => text(line, M, 65 - n * 8, 6.4, reg, FAINT));
    right(`Page ${i + 1} of ${pages.length}`, W - M, 18, 7, reg, FAINT);
    text(rx.practice.name, M, 18, 7, reg, FAINT);
  });

  return await doc.save();
}
