import { API_BASE, ApiError } from "./api";
import { getToken } from "./auth";

function extractFilename(contentDisposition: string | null, fallback: string) {
  if (!contentDisposition) return fallback;
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }
  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1] ?? fallback;
}

export async function downloadAuthenticatedFile(path: string, fallbackFilename: string) {
  const token = getToken();
  if (!token) {
    throw new ApiError(401, "Unauthenticated");
  }

  const res = await fetch(API_BASE + path, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const payload = await res.json().catch(() => null);
      const message = payload?.error ?? payload?.message;
      throw new ApiError(res.status, message ? String(message) : res.statusText);
    }
    const message = await res.text();
    throw new ApiError(res.status, message || res.statusText);
  }

  const blob = await res.blob();
  const filename = extractFilename(res.headers.get("content-disposition"), fallbackFilename);
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}
