// What an uploaded file really is, read from its own bytes (the browser's stated type is only a claim),
// and, for a PDF, whether it carries scripts or attachments and which app made it and when. The admin
// uses those facts to spot an edited, old or reused report; the checks never decide on their own.

export type FileKind = "pdf" | "png" | "jpg";
export const MIME: Record<FileKind, string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg" };

/** The facts kept with a report (reports.file_meta). Dates are ISO strings. */
export type FileMeta = {
  kind: FileKind;
  producer?: string;
  creator?: string;
  created?: string;
  modified?: string;
  encrypted?: boolean;
};

const latin1 = new TextDecoder("latin1");

export function sniff(b: Uint8Array): FileKind | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a) return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  // the PDF header may follow a little junk, which every reader accepts
  if (latin1.decode(b.subarray(0, 1024)).includes("%PDF-")) return "pdf";
  return null;
}

export async function sha256(b: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", b as Uint8Array<ArrayBuffer>));
  return Array.from(digest, (x) => x.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------- PDF

const MAX_STREAMS = 200;
const MAX_INFLATED = 20 * 1024 * 1024;

/** Inflates one zlib stream, stopping at `limit` bytes (a tiny file can inflate to gigabytes). */
async function inflate(data: Uint8Array, limit: number): Promise<Uint8Array | null> {
  try {
    const reader = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream("deflate")).getReader();
    const parts: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        break;
      }
      parts.push(value);
    }
    const out = new Uint8Array(Math.min(size, limit));
    let at = 0;
    for (const p of parts) {
      out.set(p.subarray(0, out.length - at), at);
      at += p.byteLength;
      if (at >= out.length) break;
    }
    return out;
  } catch {
    return null; // not deflate, damaged, or encrypted: the raw text is still checked
  }
}

/**
 * The PDF's object text: the raw file plus every compressed object stream, where newer PDFs keep
 * their dictionaries (and where a script would hide from a plain scan).
 */
async function pdfText(b: Uint8Array): Promise<string> {
  const raw = latin1.decode(b);
  const texts = [raw];
  let budget = MAX_INFLATED;
  let count = 0;
  const re = /stream\r?\n/g;
  for (let m = re.exec(raw); m && count < MAX_STREAMS && budget > 0; m = re.exec(raw)) {
    if (raw[m.index - 1] === "d") continue; // the tail of "endstream"
    const dict = raw.slice(Math.max(0, m.index - 400), m.index);
    const open = dict.lastIndexOf("<<");
    if (open < 0) continue;
    const head = dict.slice(open);
    if (!/\/(ObjStm|Metadata)\b/.test(head) || !/\/FlateDecode/.test(head)) continue;
    const start = m.index + m[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) break;
    count++;
    const inflated = await inflate(b.subarray(start, end), budget);
    if (inflated) {
      budget -= inflated.byteLength;
      texts.push(latin1.decode(inflated));
    }
  }
  // "/J#61vaScript" is a legal way to spell /JavaScript; undo the escapes before looking
  return texts.join("\n").replace(/#([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/** Scripts, launch actions, attached files, forms that post data: none belong in a lab report. */
const ACTIVE = /\/(JavaScript|JS|Launch|EmbeddedFiles?|RichMedia|SubmitForm|ImportData|GoToE|XFA)(?![A-Za-z])/;

function decodeString(token: string): string {
  let bytes: number[];
  if (token.startsWith("<")) {
    const hex = token.slice(1, -1).replace(/\s+/g, "");
    bytes = (hex.match(/../g) ?? []).map((h) => parseInt(h, 16));
  } else {
    const body = token.slice(1, -1);
    bytes = [];
    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if (ch !== "\\") {
        bytes.push(ch.charCodeAt(0) & 0xff);
        continue;
      }
      const next = body[++i];
      const oct = body.slice(i).match(/^[0-7]{1,3}/);
      if (oct) {
        bytes.push(parseInt(oct[0], 8) & 0xff);
        i += oct[0].length - 1;
      } else bytes.push(({ n: 10, r: 13, t: 9, b: 8, f: 12 } as Record<string, number>)[next] ?? next?.charCodeAt(0) ?? 0);
    }
  }
  const u8 = new Uint8Array(bytes);
  const text = u8[0] === 0xfe && u8[1] === 0xff ? new TextDecoder("utf-16be").decode(u8.subarray(2)) : latin1.decode(u8);
  // deno-lint-ignore no-control-regex
  return text.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 120);
}

/** "D:20241103101530+05'30'" -> ISO; null when it is not a real date. */
export function pdfDate(s: string): string | null {
  if (/^\d{4}-\d{2}/.test(s)) {
    // XMP writes ISO dates already
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : new Date(t).toISOString();
  }
  const m = s.match(/(?:D:)?(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?\s*([Zz+-])?\s*(\d{2})?'?(\d{2})?/);
  if (!m) return null;
  const [, y, mo = "01", d = "01", h = "00", mi = "00", sec = "00", sign, oh = "00", om = "00"] = m;
  const zone = !sign || sign.toUpperCase() === "Z" ? "Z" : `${sign}${oh}:${om}`;
  const t = Date.parse(`${y}-${mo}-${d}T${h}:${mi}:${sec}${zone}`);
  return Number.isNaN(t) || Number(y) < 1990 ? null : new Date(t).toISOString();
}

/** The last value of a document-info entry (an edited file appends a newer Info), else the XMP one. */
function infoValue(text: string, key: string, xmpKeys: string[]): string | undefined {
  const re = new RegExp(`/${key}\\s*(\\((?:\\\\.|[^\\\\)])*\\)|<[0-9A-Fa-f\\s]*>)`, "g");
  let last: string | undefined;
  for (const m of text.matchAll(re)) last = decodeString(m[1]);
  if (last) return last;
  for (const x of xmpKeys) {
    const m = text.match(new RegExp(`<${x}>\\s*([^<]+?)\\s*</${x}>`)) ?? text.match(new RegExp(`${x}="([^"]+)"`));
    if (m) return m[1].trim().slice(0, 120);
  }
  return undefined;
}

export async function readPdf(b: Uint8Array): Promise<{ active: boolean; meta: FileMeta }> {
  const text = await pdfText(b);
  const encrypted = /\/Encrypt\s*(\d+\s+\d+\s+R|<<)/.test(text);
  const meta: FileMeta = { kind: "pdf" };
  if (encrypted) meta.encrypted = true;
  else {
    // an encrypted file's strings are ciphertext, so its info is not read
    meta.producer = infoValue(text, "Producer", ["pdf:Producer"]);
    meta.creator = infoValue(text, "Creator", ["xmp:CreatorTool"]);
    const created = infoValue(text, "CreationDate", ["xmp:CreateDate"]);
    const modified = infoValue(text, "ModDate", ["xmp:ModifyDate"]);
    meta.created = (created && pdfDate(created)) || undefined;
    meta.modified = (modified && pdfDate(modified)) || undefined;
  }
  return { active: ACTIVE.test(text), meta };
}

/** Reads any accepted upload; null when the bytes are not a PDF, PNG or JPEG. */
export async function checkFile(b: Uint8Array): Promise<{ kind: FileKind; active: boolean; meta: FileMeta } | null> {
  const kind = sniff(b);
  if (!kind) return null;
  if (kind !== "pdf") return { kind, active: false, meta: { kind } };
  const { active, meta } = await readPdf(b);
  return { kind, active, meta };
}
