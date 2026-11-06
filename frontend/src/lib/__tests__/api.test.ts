import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api, ApiError, API_BASE } from "../api";
import { getToken, setSession } from "../auth";

const fetchMock = vi.fn();

function jsonRes(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
function textRes(status: number, body: string) {
  return new Response(body, { status, headers: { "content-type": "text/plain" } });
}

describe("api()", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    localStorage.clear();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("location", { href: "/" });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses /api as default base without trailing slash", () => {
    expect(API_BASE).toBe("/api");
  });

  it("returns parsed JSON and sends the bearer token", async () => {
    setSession("tok", "ref", 3600);
    fetchMock.mockResolvedValueOnce(jsonRes(200, { ok: 1 }));
    const res = await api<{ ok: number }>("/models");
    expect(res).toEqual({ ok: 1 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/models");
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer tok");
  });

  it("omits Authorization without a token and sets JSON content type for string bodies", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(200, {}));
    await api("/x", { method: "POST", body: JSON.stringify({ a: 1 }) });
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.has("Authorization")).toBe(false);
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("does not override an explicit Content-Type", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(200, {}));
    await api("/x", { method: "POST", body: "a=1", headers: { "Content-Type": "text/plain" } });
    expect((fetchMock.mock.calls[0][1].headers as Headers).get("Content-Type")).toBe("text/plain");
  });

  it("returns undefined on 204 and text for non-JSON responses", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await api("/a")).toBeUndefined();
    fetchMock.mockResolvedValueOnce(textRes(200, "<html/>"));
    expect(await api("/b")).toBe("<html/>");
  });

  it("throws ApiError with the JSON error field", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(422, { error: "Invalid credentials" }));
    await expect(api("/auth/login")).rejects.toMatchObject({ name: "ApiError", status: 422, message: "Invalid credentials" });
  });

  it("falls back to the JSON message field, then to plain text", async () => {
    fetchMock.mockResolvedValueOnce(jsonRes(400, { message: "bad" }));
    await expect(api("/a")).rejects.toMatchObject({ status: 400, message: "bad" });
    fetchMock.mockResolvedValueOnce(textRes(500, "boom"));
    const err: any = await api("/b").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(500);
    expect(err.message).toBe("boom");
  });

  it("uses statusText when the error body is empty", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 404, statusText: "Not Found" }));
    await expect(api("/a")).rejects.toMatchObject({ status: 404, message: "Not Found" });
  });

  it("refreshes the session proactively when the token is about to expire", async () => {
    setSession("old", "ref", 60); // < 5 minutes left
    fetchMock
      .mockResolvedValueOnce(jsonRes(200, { accessToken: "new", refreshToken: "ref2", expiresIn: 3600 }))
      .mockResolvedValueOnce(jsonRes(200, { ok: true }));
    await api("/models");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/refresh");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ refreshToken: "ref" });
    expect(getToken()).toBe("new");
    expect((fetchMock.mock.calls[1][1].headers as Headers).get("Authorization")).toBe("Bearer new");
  });

  it("on 401 refreshes and retries the request once with the new token", async () => {
    setSession("old", "ref", 3600);
    fetchMock
      .mockResolvedValueOnce(textRes(401, ""))
      .mockResolvedValueOnce(jsonRes(200, { accessToken: "new", refreshToken: "r2", expires_in: 3600 }))
      .mockResolvedValueOnce(jsonRes(200, { done: true }));
    expect(await api("/models")).toEqual({ done: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect((fetchMock.mock.calls[2][1].headers as Headers).get("Authorization")).toBe("Bearer new");
  });

  it("surfaces the error of a failed retry", async () => {
    setSession("old", "ref", 3600);
    fetchMock
      .mockResolvedValueOnce(textRes(403, ""))
      .mockResolvedValueOnce(jsonRes(200, { accessToken: "n", refreshToken: "r", expiresIn: 3600 }))
      .mockResolvedValueOnce(jsonRes(403, { error: "Forbidden" }));
    await expect(api("/admin")).rejects.toMatchObject({ status: 403, message: "Forbidden" });
  });

  it("on 401 with a failing refresh clears the session and throws Session expired", async () => {
    setSession("old", "ref", 3600);
    fetchMock.mockResolvedValueOnce(textRes(401, "")).mockResolvedValueOnce(textRes(401, ""));
    await expect(api("/models")).rejects.toMatchObject({ status: 401, message: "Session expired" });
    expect(getToken()).toBeNull();
    expect(window.location.href).toBe("/login");
  });

  it("on 401 without refresh token throws Session expired", async () => {
    localStorage.setItem("token", "x");
    fetchMock.mockResolvedValueOnce(textRes(401, ""));
    await expect(api("/models")).rejects.toMatchObject({ message: "Session expired" });
    expect(getToken()).toBeNull();
  });

  it("on 403 with a failing refresh falls through to the 403 error", async () => {
    setSession("old", "ref", 3600);
    fetchMock.mockResolvedValueOnce(textRes(403, "nope")).mockRejectedValueOnce(new Error("net"));
    await expect(api("/admin")).rejects.toMatchObject({ status: 403, message: "nope" });
  });

  it("deduplicates concurrent refreshes", async () => {
    setSession("old", "ref", 60);
    let calls = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/auth/refresh")) {
        calls++;
        return jsonRes(200, { accessToken: "n", refreshToken: "r", expiresIn: 3600 });
      }
      return jsonRes(200, {});
    });
    await Promise.all([api("/a"), api("/b")]);
    expect(calls).toBe(1);
  });
});
