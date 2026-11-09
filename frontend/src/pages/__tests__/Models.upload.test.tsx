import React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();
vi.mock("../../lib/api", () => ({ ApiError: class extends Error {}, api: (...a: unknown[]) => apiMock(...a) }));
vi.mock("../../lib/auth", () => ({ getRole: () => "user", roleAtLeast: () => false }));
vi.mock("../../components/PrintActions", () => ({ default: () => null }));

import Models from "../Models";

const model = { id: "m1", name: "Space Marine", code: "A1", categoryId: "c1", levelId: "l1", isTeam: false };
let uploadError: Error | null = null;

function setupApi() {
  apiMock.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === "/models" && !init) return [model];
    if (path === "/models/m1" && !init) return { model, images: [] };
    if (path === "/models/m1/image-upload") {
      if (uploadError) throw uploadError;
      return { uploadUrl: "https://signed/put", publicUrl: "https://cdn/x" };
    }
    if (path === "/models/m1/images") return {};
    if (path === "/public/categories") return [{ id: "c1", eventId: "e1", name: "Historical", status: "open" }];
    if (path === "/public/levels") return [{ id: "l1", name: "Beginner" }];
    if (path === "/teams") return [];
    if (path.includes("settings")) return { modelImages: "true", maxModelsPerUser: "" };
    return [];
  });
}

async function openAndPick(file: File) {
  const user = userEvent.setup();
  const { container } = renderWithProviders(<Models language="en" />);
  await user.click(await screen.findByText("Space Marine"));
  await waitFor(() => expect(container.querySelector('input[type="file"]')).not.toBeNull());
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
}

function uploadCalls() {
  return apiMock.mock.calls.filter((c) => c[0] === "/models/m1/image-upload");
}

describe("Models image upload content type", () => {
  const fetchMock = vi.fn();
  let decodable = true;
  let encodedType = "image/jpeg";

  beforeEach(() => {
    apiMock.mockReset();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true });
    uploadError = null;
    decodable = true;
    encodedType = "image/jpeg";
    setupApi();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("createImageBitmap", async () => {
      if (!decodable) throw new Error("decode");
      return { width: 100, height: 100, close: () => {} };
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: () => {} } as any);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (cb: BlobCallback, type?: string) {
      cb(new Blob(["x"], { type: type === "image/webp" ? "image/webp" : encodedType }));
    } as any);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("re-encodes a gif to jpeg and uses the same type for backend and PUT", async () => {
    await openAndPick(new File(["g"], "a.gif", { type: "image/gif" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(uploadCalls()[0][1].body)).toEqual({ contentType: "image/jpeg" });
    expect(fetchMock.mock.calls[0][1].headers["Content-Type"]).toBe("image/jpeg");
    expect((fetchMock.mock.calls[0][1].body as Blob).type).toBe("image/jpeg");
  });

  it("shows a clear error and does not call the backend when the format cannot be decoded", async () => {
    decodable = false;
    await openAndPick(new File(["h"], "a.heic", { type: "image/heic" }));
    expect(await screen.findByText(/not supported by the browser/)).toBeInTheDocument();
    expect(uploadCalls()).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends small allowed files untouched with their own type", async () => {
    await openAndPick(new File(["p"], "a.png", { type: "image/png" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(uploadCalls()[0][1].body)).toEqual({ contentType: "image/png" });
    expect(fetchMock.mock.calls[0][1].headers["Content-Type"]).toBe("image/png");
  });

  it("errors out if the encoder returns a disallowed type for a disallowed source", async () => {
    encodedType = "image/gif";
    await openAndPick(new File(["g"], "a.gif", { type: "image/gif" }));
    expect(await screen.findByText(/not supported by the browser/)).toBeInTheDocument();
    expect(uploadCalls()).toHaveLength(0);
  });

  it("shows the backend message for 422", async () => {
    uploadError = Object.assign(new Error("contentType not allowed"), { status: 422 });
    await openAndPick(new File(["p"], "a.png", { type: "image/png" }));
    expect(await screen.findByText("contentType not allowed")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the backend message for 404 and a fallback when it is empty", async () => {
    uploadError = Object.assign(new Error(""), { status: 404 });
    await openAndPick(new File(["p"], "a.png", { type: "image/png" }));
    expect(await screen.findByText("Model not found.")).toBeInTheDocument();
  });
});
