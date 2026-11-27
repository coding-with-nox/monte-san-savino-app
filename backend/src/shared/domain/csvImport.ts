export const CSV_MAX_BYTES = 256 * 1024;
export const CSV_MAX_ROWS = 2000;
export const CELL_MAX_LENGTH = 200;

export type CsvRow = { line: number; cells: string[] };
export type ImportError = { line: number; message: string };

/**
 * Parser CSV minimale (RFC 4180): virgolette, "" escape, CRLF/LF, BOM.
 * `line` e' il numero di riga fisico (1-based) in cui inizia il record.
 * Le righe completamente vuote sono ignorate.
 */
export function parseCsv(text: string): { rows: CsvRow[]; error?: string } {
  const src = text.replace(/^﻿/, "");
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let cell = "";
  let inQuotes = false;
  let line = 1;
  let startLine = 1;
  let touched = false;

  const endRecord = () => {
    cells.push(cell);
    if (touched || cells.length > 1 || cells[0] !== "") rows.push({ line: startLine, cells });
    cells = [];
    cell = "";
    touched = false;
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else {
        if (ch === "\n") line++;
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell === "") { inQuotes = true; touched = true; continue; }
    if (ch === ",") { cells.push(cell); cell = ""; touched = true; continue; }
    if (ch === "\r") continue;
    if (ch === "\n") {
      endRecord();
      line++;
      startLine = line;
      continue;
    }
    cell += ch;
  }
  if (inQuotes) return { rows, error: "Unterminated quoted field" };
  if (cell !== "" || cells.length > 0 || touched) endRecord();
  return { rows };
}

/** Valida una cella testuale: niente formule, HTML o caratteri di controllo. */
export function validateCell(value: string, field: string, opts: { required?: boolean } = {}):
  | { ok: true; value: string }
  | { ok: false; error: string } {
  const v = value.trim();
  if (!v) return opts.required ? { ok: false, error: `${field} is required` } : { ok: true, value: "" };
  if (v.length > CELL_MAX_LENGTH) return { ok: false, error: `${field} too long (max ${CELL_MAX_LENGTH})` };
  if (/[\u0000-\u001f\u007f]/.test(v)) return { ok: false, error: `${field} contains invalid characters` };
  if (/^[=+\-@]/.test(v)) return { ok: false, error: `${field} must not start with = + - @` };
  if (/[<>]/.test(v)) return { ok: false, error: `${field} must not contain < or >` };
  return { ok: true, value: v };
}

export function parseFlag(value: string, field: string): { ok: true; value: boolean } | { ok: false; error: string } {
  const v = value.trim();
  if (v === "1") return { ok: true, value: true };
  if (v === "0" || v === "") return { ok: true, value: false };
  return { ok: false, error: `${field} must be 1 or 0` };
}

const LEVEL_HEADER = ["level name", "free to enter(1/0)"];
const CLASS_HEADER = ["class number", "level name", "class name", "category", "presentation order number", "out of competition(1/0)"];

function isHeader(cells: string[], expected: string[]) {
  const norm = cells.map((c) => c.trim().toLowerCase().replace(/\s*\(/g, "("));
  return norm[0] === expected[0].replace(/\s*\(/g, "(");
}

export type LevelImportRow = { line: number; name: string; freeToEnter: boolean };
export type ClassImportRow = {
  line: number; classNumber: string; levelName: string; name: string;
  group: string; presentationOrder: number | null; outOfCompetition: boolean;
};

export type ParsedImport<T> = { valid: T[]; errors: ImportError[] };

function guard(text: string): { rows?: CsvRow[]; errors?: ImportError[] } {
  if (typeof text !== "string") return { errors: [{ line: 0, message: "Body must be text/csv" }] };
  if (new TextEncoder().encode(text).length > CSV_MAX_BYTES) {
    return { errors: [{ line: 0, message: `CSV too large (max ${CSV_MAX_BYTES} bytes)` }] };
  }
  const parsed = parseCsv(text);
  if (parsed.error) return { errors: [{ line: 0, message: parsed.error }] };
  if (parsed.rows.length > CSV_MAX_ROWS + 1) {
    return { errors: [{ line: 0, message: `Too many rows (max ${CSV_MAX_ROWS})` }] };
  }
  return { rows: parsed.rows };
}

export function parseLevelsCsv(text: string): ParsedImport<LevelImportRow> {
  const g = guard(text);
  if (!g.rows) return { valid: [], errors: g.errors! };
  const rows = g.rows[0] && isHeader(g.rows[0].cells, LEVEL_HEADER) ? g.rows.slice(1) : g.rows;
  const valid: LevelImportRow[] = [];
  const errors: ImportError[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.cells.length !== 2) { errors.push({ line: r.line, message: "Expected 2 columns" }); continue; }
    const name = validateCell(r.cells[0], "Level Name", { required: true });
    if (!name.ok) { errors.push({ line: r.line, message: name.error }); continue; }
    const free = parseFlag(r.cells[1], "Free To Enter");
    if (!free.ok) { errors.push({ line: r.line, message: free.error }); continue; }
    const key = name.value.toLowerCase();
    if (seen.has(key)) { errors.push({ line: r.line, message: `Duplicate level "${name.value}" in file` }); continue; }
    seen.add(key);
    valid.push({ line: r.line, name: name.value, freeToEnter: free.value });
  }
  return { valid, errors };
}

export function parseClassesCsv(text: string): ParsedImport<ClassImportRow> {
  const g = guard(text);
  if (!g.rows) return { valid: [], errors: g.errors! };
  const rows = g.rows[0] && isHeader(g.rows[0].cells, CLASS_HEADER) ? g.rows.slice(1) : g.rows;
  const valid: ClassImportRow[] = [];
  const errors: ImportError[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.cells.length !== 6) { errors.push({ line: r.line, message: "Expected 6 columns" }); continue; }
    const num = validateCell(r.cells[0], "Class Number");
    const level = validateCell(r.cells[1], "Level Name", { required: true });
    const name = validateCell(r.cells[2], "Class Name", { required: true });
    const group = validateCell(r.cells[3], "Category");
    const bad = [num, level, name, group].find((c) => !c.ok);
    if (bad && !bad.ok) { errors.push({ line: r.line, message: bad.error }); continue; }
    const orderRaw = r.cells[4].trim();
    let order: number | null = null;
    if (orderRaw) {
      if (!/^\d{1,6}$/.test(orderRaw)) { errors.push({ line: r.line, message: "Presentation Order Number must be a non-negative integer" }); continue; }
      order = Number.parseInt(orderRaw, 10);
    }
    const ooc = parseFlag(r.cells[5], "Out Of Competition");
    if (!ooc.ok) { errors.push({ line: r.line, message: ooc.error }); continue; }
    const v = (c: any) => c.value as string;
    const key = v(name).toLowerCase();
    if (seen.has(key)) { errors.push({ line: r.line, message: `Duplicate class "${v(name)}" in file` }); continue; }
    seen.add(key);
    valid.push({
      line: r.line, classNumber: v(num), levelName: v(level), name: v(name),
      group: v(group), presentationOrder: order, outOfCompetition: ooc.value
    });
  }
  return { valid, errors };
}

const PREVIOUS_RESULTS_HEADER = ["email", "first name", "last name", "level", "medal rank", "year"];
/** Same upper bound as the medal ranks of the bracket presets (contest/domain/photography MAX_MEDAL_RANK). */
const PREVIOUS_MEDAL_RANK_MAX = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PreviousResultImportRow = {
  line: number; email: string | null; firstName: string | null; lastName: string | null;
  levelName: string; medalRank: number; year: number | null;
};

/**
 * Previous results: Email,First Name,Last Name,Level,Medal Rank,Year.
 * A row needs an email or both first and last name; the year is optional (four digits).
 */
export function parsePreviousResultsCsv(text: string): ParsedImport<PreviousResultImportRow> {
  const g = guard(text);
  if (!g.rows) return { valid: [], errors: g.errors! };
  const rows = g.rows[0] && isHeader(g.rows[0].cells, PREVIOUS_RESULTS_HEADER) ? g.rows.slice(1) : g.rows;
  const valid: PreviousResultImportRow[] = [];
  const errors: ImportError[] = [];
  for (const r of rows) {
    if (r.cells.length !== 6) { errors.push({ line: r.line, message: "Expected 6 columns" }); continue; }
    const email = validateCell(r.cells[0], "Email");
    const first = validateCell(r.cells[1], "First Name");
    const last = validateCell(r.cells[2], "Last Name");
    const level = validateCell(r.cells[3], "Level", { required: true });
    const bad = [email, first, last, level].find((c) => !c.ok);
    if (bad && !bad.ok) { errors.push({ line: r.line, message: bad.error }); continue; }
    const v = (c: any) => c.value as string;
    if (v(email) && !EMAIL_RE.test(v(email))) { errors.push({ line: r.line, message: "Email is not valid" }); continue; }
    if (!v(email) && !(v(first) && v(last))) {
      errors.push({ line: r.line, message: "Email or First Name and Last Name are required" }); continue;
    }
    const rankRaw = r.cells[4].trim();
    if (!/^\d{1,2}$/.test(rankRaw) || Number(rankRaw) > PREVIOUS_MEDAL_RANK_MAX) {
      errors.push({ line: r.line, message: `Medal Rank must be an integer between 0 and ${PREVIOUS_MEDAL_RANK_MAX}` }); continue;
    }
    const yearRaw = r.cells[5].trim();
    if (yearRaw && !/^(19|20)\d{2}$/.test(yearRaw)) {
      errors.push({ line: r.line, message: "Year must be a four-digit year" }); continue;
    }
    valid.push({
      line: r.line,
      email: v(email) ? v(email).toLowerCase() : null,
      firstName: v(first) || null,
      lastName: v(last) || null,
      levelName: v(level),
      medalRank: Number(rankRaw),
      year: yearRaw ? Number(yearRaw) : null
    });
  }
  return { valid, errors };
}

const MEDAL_HEADER = ["medal", "value", "low limit", "high limit"];
const HONOR_HEADER = ["code", "name", "order"];
const JURY_HEADER = ["judge email", "class number", "stand-in"];
const NON_NEGATIVE_INT_RE = /^\d{1,6}$/;

export type MedalImportRow = { line: number; medalLabel: string; medalRank: number; lowLimit: number; highLimit: number };
export type HonorImportRow = { line: number; code: string; name: string; sortOrder: number | null };
export type JuryImportRow = { line: number; judgeEmail: string; classNumber: string | null; standingIn: boolean };

/**
 * Medal brackets: Medal,Value,Low Limit,High Limit. `Value` is the medal rank and must be unique in the file.
 * Range rules (rank 0-10, low <= high) are applied by the route with bracketInputError.
 */
export function parseMedalBracketsCsv(text: string): ParsedImport<MedalImportRow> {
  const g = guard(text);
  if (!g.rows) return { valid: [], errors: g.errors! };
  const rows = g.rows[0] && isHeader(g.rows[0].cells, MEDAL_HEADER) ? g.rows.slice(1) : g.rows;
  const valid: MedalImportRow[] = [];
  const errors: ImportError[] = [];
  const seen = new Set<number>();
  for (const r of rows) {
    if (r.cells.length !== 4) { errors.push({ line: r.line, message: "Expected 4 columns" }); continue; }
    const label = validateCell(r.cells[0], "Medal", { required: true });
    if (!label.ok) { errors.push({ line: r.line, message: label.error }); continue; }
    const value = r.cells[1].trim();
    const low = r.cells[2].trim();
    const high = r.cells[3].trim();
    if (!NON_NEGATIVE_INT_RE.test(value)) { errors.push({ line: r.line, message: "Value must be an integer" }); continue; }
    if (!NON_NEGATIVE_INT_RE.test(low)) { errors.push({ line: r.line, message: "Low Limit must be a non-negative integer" }); continue; }
    if (!NON_NEGATIVE_INT_RE.test(high)) { errors.push({ line: r.line, message: "High Limit must be a non-negative integer" }); continue; }
    const medalRank = Number(value);
    if (seen.has(medalRank)) { errors.push({ line: r.line, message: `Duplicate Value ${medalRank} in file` }); continue; }
    seen.add(medalRank);
    valid.push({ line: r.line, medalLabel: label.value, medalRank, lowLimit: Number(low), highLimit: Number(high) });
  }
  return { valid, errors };
}

/**
 * Special awards: Code,Name[,Order]. Code and name are checked for syntax here; their length limits
 * are applied by the route with honorInputError. Order is optional (empty = keep / next available).
 */
export function parseHonorsCsv(text: string): ParsedImport<HonorImportRow> {
  const g = guard(text);
  if (!g.rows) return { valid: [], errors: g.errors! };
  const rows = g.rows[0] && isHeader(g.rows[0].cells, HONOR_HEADER) ? g.rows.slice(1) : g.rows;
  const valid: HonorImportRow[] = [];
  const errors: ImportError[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.cells.length !== 2 && r.cells.length !== 3) { errors.push({ line: r.line, message: "Expected 2 or 3 columns" }); continue; }
    const code = validateCell(r.cells[0], "Code", { required: true });
    if (!code.ok) { errors.push({ line: r.line, message: code.error }); continue; }
    const name = validateCell(r.cells[1], "Name", { required: true });
    if (!name.ok) { errors.push({ line: r.line, message: name.error }); continue; }
    const orderRaw = (r.cells[2] ?? "").trim();
    if (orderRaw && !NON_NEGATIVE_INT_RE.test(orderRaw)) { errors.push({ line: r.line, message: "Order must be a non-negative integer" }); continue; }
    const key = code.value.toLowerCase();
    if (seen.has(key)) { errors.push({ line: r.line, message: `Duplicate code "${code.value}" in file` }); continue; }
    seen.add(key);
    valid.push({ line: r.line, code: code.value, name: name.value, sortOrder: orderRaw ? Number(orderRaw) : null });
  }
  return { valid, errors };
}

/** Stand-in flag: 1/yes = true, 0/no/empty = false (case-insensitive). */
function parseStandIn(value: string): { ok: true; value: boolean } | { ok: false; error: string } {
  const v = value.trim().toLowerCase();
  if (v === "1" || v === "yes") return { ok: true, value: true };
  if (v === "0" || v === "no" || v === "") return { ok: true, value: false };
  return { ok: false, error: "Stand-in must be 1/0 or yes/no" };
}

/**
 * Judge assignments: Judge Email,Class Number,Stand-in. An empty Class Number means the whole event;
 * a stand-in needs a class. The judge's account and the class of the event are checked by the route.
 */
export function parseJuryCsv(text: string): ParsedImport<JuryImportRow> {
  const g = guard(text);
  if (!g.rows) return { valid: [], errors: g.errors! };
  const rows = g.rows[0] && isHeader(g.rows[0].cells, JURY_HEADER) ? g.rows.slice(1) : g.rows;
  const valid: JuryImportRow[] = [];
  const errors: ImportError[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.cells.length !== 3) { errors.push({ line: r.line, message: "Expected 3 columns" }); continue; }
    const judgeEmail = r.cells[0].trim().toLowerCase();
    if (!judgeEmail) { errors.push({ line: r.line, message: "Judge Email is required" }); continue; }
    if (!EMAIL_RE.test(judgeEmail)) { errors.push({ line: r.line, message: "Judge Email is not valid" }); continue; }
    const cls = validateCell(r.cells[1], "Class Number");
    if (!cls.ok) { errors.push({ line: r.line, message: cls.error }); continue; }
    const classNumber = cls.value || null;
    const standIn = parseStandIn(r.cells[2]);
    if (!standIn.ok) { errors.push({ line: r.line, message: standIn.error }); continue; }
    if (standIn.value && classNumber === null) { errors.push({ line: r.line, message: "Stand-in requires a Class Number" }); continue; }
    const key = `${judgeEmail}|${classNumber ?? ""}`;
    if (seen.has(key)) {
      errors.push({ line: r.line, message: `Duplicate assignment for ${judgeEmail}${classNumber ? ` in class ${classNumber}` : ""} in file` });
      continue;
    }
    seen.add(key);
    valid.push({ line: r.line, judgeEmail, classNumber, standingIn: standIn.value });
  }
  return { valid, errors };
}
