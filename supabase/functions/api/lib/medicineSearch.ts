// The doctor's medicine search over the master list (the medicines table: PDPL's medicines and
// supplements). Forgiving on purpose (17 Nov 2026 call): "rybelsus" must find "Tablet Rybelsus 3 mg", so
// case, spaces, punctuation and form words (tab, tablet, cap, inj...) are ignored. When nothing matches,
// "Did you mean" offers the closest names, so a doctor never adds a second spelling of a listed item.
// Duplicates break ordering: a medicine typed by hand prints, but never reaches a cart until admin
// matches it (a MATCH_MEDICINE task, lib/medicineFlow.ts). docs/backend/doctor-portal-v2.md.
import { sql } from "./db.ts";

export type ListItem = {
  id: number; brand: string; molecule: string; form: string; strength: string; pack: string; pack_days: number;
  route: string; default_frequency: string; default_dose: string; kind: string; mrp_paise: number | null;
};

const FORM_WORDS = /\b(tab|tabs|tablet|tablets|cap|caps|capsule|capsules|inj|injection|injections|syp|syrup|susp|suspension|sachet|sachets|powder|pwd|oral|solution|soln)\b/g;

/** "Tablet Rybelsus 3 mg" -> "rybelsus3mg": what a search compares. */
export const keyOf = (s: string) =>
  s.toLowerCase().replace(/[–—-]/g, " ").replace(FORM_WORDS, " ").replace(/[^a-z0-9.]+/g, "").replace(/\.(?!\d)/g, "");

/** Letter pairs, for how alike two keys are (Sørensen-Dice, 0 to 1). */
function pairs(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) m.set(s.slice(i, i + 2), (m.get(s.slice(i, i + 2)) ?? 0) + 1);
  return m;
}
export function alike(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const pa = pairs(a), pb = pairs(b);
  let both = 0;
  for (const [k, n] of pa) both += Math.min(n, pb.get(k) ?? 0);
  return (2 * both) / (a.length - 1 + b.length - 1);
}

/** The name a line prints and a search shows: "Mounjaro KwikPen 2.5 mg". */
export const displayName = (m: Pick<ListItem, "brand" | "strength">) => `${m.brand} ${m.strength}`.trim();

let cache: { at: number; rows: ListItem[] } | null = null;
async function list(): Promise<ListItem[]> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.rows;
  const rows = await sql`
    select id, brand, molecule, form, strength, pack, pack_days, route, default_frequency, default_dose, kind, mrp_paise
    from medicines where active order by brand, substring(strength from '[0-9]+(?:\.[0-9]+)?')::numeric nulls last`;
  cache = { at: Date.now(), rows: rows as unknown as ListItem[] };
  return cache.rows;
}
/** After an import or a change to the list. */
export const forgetList = () => { cache = null; };

/** Every word of the query must appear in the item's brand, molecule, strength or form, keys compared. */
export function matchList(rows: ListItem[], query: string, limit = 12) {
  const words = query.toLowerCase().replace(FORM_WORDS, " ").split(/[\s,]+/).map(keyOf).filter(Boolean).slice(0, 5);
  if (!words.length) return { matches: [] as ListItem[], didYouMean: [] as ListItem[] };
  const hay = (m: ListItem) => keyOf(`${m.brand} ${m.molecule} ${m.strength} ${m.form}`);
  const whole = keyOf(query);
  const matches = rows.filter((m) => {
    const h = hay(m);
    return h.includes(whole) || words.every((w) => h.includes(w));
  });
  // brand first, then molecule matches, then the rest; the list is already sorted by strength
  const starts = (m: ListItem) => (keyOf(m.brand).startsWith(words[0]) ? 0 : keyOf(m.molecule).startsWith(words[0]) ? 1 : 2);
  matches.sort((a, b) => starts(a) - starts(b));
  if (matches.length) return { matches: matches.slice(0, limit), didYouMean: [] };
  // nothing: the closest names, one per brand, judged on the name words only
  const name = keyOf(query.replace(/\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|units?)?/gi, " ")) || whole;
  const scored = rows
    .map((m) => ({ m, score: Math.max(alike(name, keyOf(m.brand)), alike(name, keyOf(m.molecule))) }))
    .filter((x) => x.score >= 0.45)
    .sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const didYouMean = scored.filter((x) => !seen.has(x.m.brand) && seen.add(x.m.brand)).slice(0, 3).map((x) => x.m);
  return { matches: [], didYouMean };
}

export async function searchList(query: string, limit = 12) {
  return matchList(await list(), query.slice(0, 60), limit);
}

/** How many packs a duration needs: a pen of 28 days covers "1 month"; at least one. */
export const packsFor = (days: number, packDays: number) => Math.min(12, Math.max(1, Math.round(days / Math.max(1, packDays))));

/** "30 days", "4 weeks", "3 months" -> days (a month is 30). */
export function daysOf(value: number, unit: string): number {
  const n = Math.max(1, Math.min(365, Math.round(Number(value) || 0)));
  return unit === "MONTHS" ? n * 30 : unit === "WEEKS" ? n * 7 : n;
}

export const toListItem = (m: ListItem) => ({
  id: String(m.id), name: displayName(m), brand: m.brand, molecule: m.molecule, form: m.form, strength: m.strength,
  kind: m.kind, dose: m.default_dose || (m.form === "Pen injection" ? "1 injection" : m.form === "Tablet" ? "1 tablet" : ""),
  frequency: m.default_frequency, packDays: m.pack_days, orderable: m.mrp_paise != null,
});

// ---------------------------------------------------------------- self-check
if (import.meta.main) {
  const item = (id: number, brand: string, molecule: string, strength: string, form = "Tablet"): ListItem => ({
    id, brand, molecule, form, strength, pack: "strip of 10", pack_days: 30, route: "By mouth", default_frequency: "",
    default_dose: "", kind: "MEDICINE", mrp_paise: 100,
  });
  const rows = [
    item(1, "Tablet Rybelsus", "Semaglutide", "3 mg"), item(2, "Tablet Rybelsus", "Semaglutide", "7 mg"),
    item(3, "Glycomet", "Metformin", "500 mg"), item(4, "Mounjaro KwikPen", "Tirzepatide", "2.5 mg", "Pen injection"),
    item(5, "Ensure", "Nutritional supplement", "400 g", "Powder"),
  ];
  const assert = (ok: boolean, what: string) => { if (!ok) throw new Error(what); };
  const ids = (q: string) => matchList(rows, q).matches.map((m) => m.id).join(",");
  assert(ids("rybelsus") === "1,2", "rybelsus finds both strengths");
  assert(ids("RYBELSUS 3") === "1", "case and strength");
  assert(ids("tab rybelsus 3mg") === "1", "form word and joined unit");
  assert(ids("Tablet Rybelsus 3 mg") === "1", "the full name");
  assert(ids("metformin") === "3", "by molecule");
  assert(ids("mounjaro 2.5") === "4", "decimal strength");
  assert(ids("ensure") === "5", "a supplement");
  assert(matchList(rows, "rybelsis").didYouMean[0]?.id === 1, "did you mean a misspelling");
  assert(matchList(rows, "glycomett 500").didYouMean[0]?.id === 3, "did you mean with a strength");
  assert(!matchList(rows, "zzqx").didYouMean.length, "nothing alike");
  assert(packsFor(30, 28) === 1 && packsFor(90, 28) === 3 && packsFor(7, 28) === 1 && packsFor(60, 30) === 2, "packs");
  assert(daysOf(3, "MONTHS") === 90 && daysOf(2, "WEEKS") === 14 && daysOf(30, "DAYS") === 30, "days");
  console.log("medicineSearch: ok");
}
