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
