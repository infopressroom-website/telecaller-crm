import { z } from "zod";
import { normalizeMobile } from "@/validations/common";
import {
  IMPORT_FIELDS, IMPORT_FIELD_KEYS, LEAD_PRIORITIES, type ImportFieldKey, type LeadPriorityValue,
} from "./fields";

export type Mapping = Record<string, ImportFieldKey | "">;

export type ImportedLead = {
  name: string;
  primaryMobile: string;
  alternateMobile?: string;
  email?: string;
  city?: string;
  state?: string;
  sourceId?: string;
  priority?: LeadPriorityValue;
  notes?: string;
};

export const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Suggests a field for each header; each field is used at most once. */
export function guessMapping(headers: string[]): Mapping {
  const used = new Set<ImportFieldKey>();
  const mapping: Mapping = {};
  for (const h of headers) {
    const n = normalizeHeader(h);
    const field = IMPORT_FIELDS.find((f) => !used.has(f.key) && (f.aliases as readonly string[]).includes(n));
    if (field) used.add(field.key);
    mapping[h] = field ? field.key : "";
  }
  return mapping;
}

/** Returns a human-readable problem, or null when the mapping is usable. */
export function validateMapping(mapping: Mapping, headers: string[]): string | null {
  const seen = new Set<string>();
  for (const h of headers) {
    const f = mapping[h];
    if (!f) continue;
    if (!IMPORT_FIELD_KEYS.includes(f)) return `Unknown field for column "${h}".`;
    if (seen.has(f)) return `"${IMPORT_FIELDS.find((x) => x.key === f)?.label}" is mapped to more than one column.`;
    seen.add(f);
  }
  if (!seen.has("name")) return "Map a column to Name.";
  if (!seen.has("primaryMobile")) return "Map a column to Primary mobile.";
  return null;
}

const mobileOk = (v: string) => /^91[6-9]\d{9}$/.test(v);
const emailSchema = z.string().email();

export function validateImportRow(
  raw: Record<string, string>,
  mapping: Mapping,
  sourcesByName: Map<string, string>,
): { ok: true; data: ImportedLead } | { ok: false; errors: string[] } {
  const get = (field: ImportFieldKey) => {
    const header = Object.keys(mapping).find((h) => mapping[h] === field);
    return header ? (raw[header] ?? "").trim() : "";
  };
  const errors: string[] = [];
  const data: Partial<ImportedLead> = {};

  const name = get("name");
  if (!name) errors.push("Name is missing");
  else if (name.length > 120) errors.push("Name is longer than 120 characters");
  else data.name = name;

  const mobileRaw = get("primaryMobile");
  if (!mobileRaw) errors.push("Primary mobile is missing");
  else {
    const m = normalizeMobile(mobileRaw);
    if (mobileOk(m)) data.primaryMobile = m;
    else errors.push(`Invalid primary mobile "${mobileRaw.slice(0, 20)}"`);
  }

  const alt = get("alternateMobile");
  if (alt) {
    const m = normalizeMobile(alt);
    if (mobileOk(m)) data.alternateMobile = m;
    else errors.push(`Invalid alternate mobile "${alt.slice(0, 20)}"`);
  }

  const email = get("email");
  if (email) {
    if (emailSchema.safeParse(email).success && email.length <= 254) data.email = email.toLowerCase();
    else errors.push(`Invalid email "${email.slice(0, 40)}"`);
  }

  for (const f of ["city", "state"] as const) {
    const v = get(f);
    if (v.length > 100) errors.push(`${f === "city" ? "City" : "State"} is longer than 100 characters`);
    else if (v) data[f] = v;
  }

  const source = get("source");
  if (source) {
    const id = sourcesByName.get(source.toLowerCase());
    if (id) data.sourceId = id;
    else errors.push(`Unknown source "${source.slice(0, 40)}"`);
  }

  const priority = get("priority");
  if (priority) {
    const p = priority.toUpperCase() as LeadPriorityValue;
    if ((LEAD_PRIORITIES as readonly string[]).includes(p)) data.priority = p;
    else errors.push(`Invalid priority "${priority.slice(0, 20)}" (use Low, Medium, High or Urgent)`);
  }

  const notes = get("notes");
  if (notes.length > 2000) errors.push("Notes are longer than 2000 characters");
  else if (notes) data.notes = notes;

  return errors.length ? { ok: false, errors } : { ok: true, data: data as ImportedLead };
}
