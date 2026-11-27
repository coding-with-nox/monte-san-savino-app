import React from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();
vi.mock("../../lib/api", () => ({ api: (...a: unknown[]) => apiMock(...a) }));

import CsvImportCard, { previewLines } from "../CsvImportCard";

describe("CsvImportCard", () => {
  beforeEach(() => { apiMock.mockReset(); });

  it("previewLines keeps only the first non-empty rows", () => {
    expect(previewLines("a\n\nb\r\nc\nd\ne\nf\ng", 3)).toEqual(["a", "b", "c"]);
  });

  it("previews, sends text/csv and lists per-line errors", async () => {
    apiMock.mockResolvedValue({ created: 2, errors: [{ line: 3, message: "duplicate" }] });
    const onImported = vi.fn();
    renderWithProviders(<CsvImportCard language="en" title="Levels" help="h" endpoint="/admin/import/levels" onImported={onImported} />);
    const file = new File(["name\nA\nB"], "levels.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", { value: () => Promise.resolve("name\nA\nB") });
    fireEvent.change(screen.getByTestId("csv-input"), { target: { files: [file] } });
    expect(await screen.findByTestId("csv-preview")).toHaveTextContent("name A B");
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() => expect(apiMock).toHaveBeenCalled());
    expect(apiMock.mock.calls[0][0]).toBe("/admin/import/levels");
    expect(apiMock.mock.calls[0][1]).toMatchObject({ method: "POST", headers: { "Content-Type": "text/csv" }, body: "name\nA\nB" });
    expect(await screen.findByText("duplicate")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(onImported).toHaveBeenCalled();
  });

  it("requires an event for the classes import and sends it as query", async () => {
    apiMock.mockResolvedValue({ created: 1, errors: [] });
    renderWithProviders(<CsvImportCard language="en" title="Classes" help="h" endpoint="/admin/import/classes" events={[{ id: "ev1", name: "MSS" }]} />);
    const file = new File(["x"], "c.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", { value: () => Promise.resolve("name\nA") });
    fireEvent.change(screen.getByTestId("csv-input"), { target: { files: [file] } });
    await screen.findByTestId("csv-preview");
    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
    fireEvent.mouseDown(screen.getByLabelText("Select event"));
    fireEvent.click(await screen.findByRole("option", { name: "MSS" }));
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() => expect(apiMock.mock.calls[0][0]).toBe("/admin/import/classes?eventId=ev1"));
  });

  it("with the parent's shared event (no own selector) stays disabled until an event is chosen", async () => {
    renderWithProviders(<CsvImportCard language="en" title="Medals" help="h" endpoint="/admin/import/medals" eventId="" />);
    const file = new File(["x"], "m.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", { value: () => Promise.resolve("Medal,Value,Low Limit,High Limit\nBronze,2,5,7") });
    fireEvent.change(screen.getByTestId("csv-input"), { target: { files: [file] } });
    await screen.findByTestId("csv-preview");
    expect(screen.queryByLabelText("Select event")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
    expect(apiMock).not.toHaveBeenCalled();
  });

  it("sends the shared event as ?eventId= and shows the imported count", async () => {
    apiMock.mockResolvedValue({ imported: 4, errors: [] });
    renderWithProviders(<CsvImportCard language="en" title="Medals" help="h" endpoint="/admin/import/medals" eventId="ev7" />);
    const file = new File(["x"], "m.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", { value: () => Promise.resolve("Medal,Value,Low Limit,High Limit\nBronze,2,5,7") });
    fireEvent.change(screen.getByTestId("csv-input"), { target: { files: [file] } });
    await screen.findByTestId("csv-preview");
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() => expect(apiMock.mock.calls[0][0]).toBe("/admin/import/medals?eventId=ev7"));
    expect(apiMock.mock.calls[0][1]).toMatchObject({ method: "POST", headers: { "Content-Type": "text/csv" } });
    expect(await screen.findByTestId("csv-result")).toHaveTextContent("Imported: 4 - Errors: 0");
  });

  it("sends a jury import without an event selector to the plain endpoint when no event scope is given", async () => {
    apiMock.mockResolvedValue({ imported: 0, errors: [{ line: 0, message: "Judge x has already voted in this event: the assignment cannot be removed" }] });
    renderWithProviders(<CsvImportCard language="en" title="Jury" help="h" endpoint="/admin/import/jury" />);
    const file = new File(["x"], "j.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", { value: () => Promise.resolve("Judge Email,Class Number,Stand-in\na@x.it,,0") });
    fireEvent.change(screen.getByTestId("csv-input"), { target: { files: [file] } });
    await screen.findByTestId("csv-preview");
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() => expect(apiMock).toHaveBeenCalled());
    expect(apiMock.mock.calls[0][0]).toBe("/admin/import/jury");
    expect(await screen.findByText(/has already voted in this event/)).toBeInTheDocument();
  });
});
