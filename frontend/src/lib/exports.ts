import { api } from "./api";

export type ExportParams = Record<string, string | null | undefined>;

export function buildQuery(params: ExportParams): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
}

/**
 * Fetches an authenticated HTML export and opens it in a new tab (printable).
 * The object URL is revoked after a delay so the new tab has time to load it.
 */
export async function openHtmlExport(path: string, params: ExportParams = {}): Promise<void> {
  const html = await api<string>(path + buildQuery(params));
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
}
