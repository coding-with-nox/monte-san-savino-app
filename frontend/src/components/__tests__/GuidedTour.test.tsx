import React from "react";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { renderWithProviders } from "../../test/renderWithProviders";
import GuidedTour from "../GuidedTour";
import usePageTour, { TOUR_SETTLE_MS } from "../usePageTour";
import { t, translations, TranslationKey } from "../../lib/i18n";
import { canSeeTour, isTourSeen, resetTours, TOURS, TourContext, TOURS_SEEN_KEY, tourSteps } from "../../lib/tours";

const steps = [
  { target: "one", title: "First", text: "First text" },
  { target: "hidden", title: "Hidden", text: "never shown" },
  { target: "missing", title: "Missing", text: "never shown" },
  { target: "two", title: "Second", text: "Second text" }
];

function renderTour(onClose = vi.fn()) {
  renderWithProviders(
    <>
      <button data-tour="one">one</button>
      <div hidden><span data-tour="hidden">hidden</span></div>
      <button data-tour="two">two</button>
      <GuidedTour language="en" open steps={steps} onClose={onClose} />
    </>
  );
  return onClose;
}

describe("GuidedTour", () => {
  it("is an accessible dialog that skips steps whose target is not visible", async () => {
    renderTour();
    const dialog = await screen.findByRole("dialog", { name: "First" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
    await waitFor(() => expect(dialog).toHaveFocus());
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
  });

  it("moves forward and back with the buttons and finishes on the last step", async () => {
    const user = userEvent.setup();
    const onClose = renderTour();
    await user.click(await screen.findByRole("button", { name: "Next" }));
    expect(screen.getByRole("dialog", { name: "Second" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("dialog", { name: "First" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Finish" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("is keyboard driven: arrows move, Escape closes, page shortcuts stay silent", async () => {
    const user = userEvent.setup();
    const pageShortcut = vi.fn();
    window.addEventListener("keydown", pageShortcut);
    const onClose = renderTour();
    await screen.findByRole("dialog", { name: "First" });
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("dialog", { name: "Second" })).toBeInTheDocument();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("dialog", { name: "First" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(pageShortcut).not.toHaveBeenCalled();
    window.removeEventListener("keydown", pageShortcut);
  });

  it("closes with Skip", async () => {
    const user = userEvent.setup();
    const onClose = renderTour();
    await user.click(await screen.findByRole("button", { name: "Skip" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

const ctx: TourContext = { role: "user", permissions: [], sections: null };

function Page({ context }: { context: TourContext }) {
  const tour = usePageTour("en", context);
  return (
    <>
      <button data-tour="models-new">new</button>
      <div data-tour="models-list">list</div>
      <button onClick={tour.start}>?</button>
      <button onClick={tour.replayAll}>replay</button>
      {tour.node}
    </>
  );
}
const renderPage = () =>
  renderWithProviders(<MemoryRouter initialEntries={["/models"]}><Page context={ctx} /></MemoryRouter>);
const wait = { timeout: TOUR_SETTLE_MS + 2000 };
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, TOUR_SETTLE_MS + 200)));
const title = t("en", "tourModelsModelsNewTitle");

describe("page tours", () => {
  beforeEach(() => {
    localStorage.clear();
    resetTours();
  });

  it("starts by itself only on the first visit of the page", async () => {
    const user = userEvent.setup();
    const first = renderPage();
    expect(await screen.findByRole("dialog", { name: title }, wait)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(TOURS_SEEN_KEY)!)).toEqual(["models"]);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    first.unmount();

    renderPage();
    await settle();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("can be started again with the help button and re-enabled for all pages", async () => {
    localStorage.setItem(TOURS_SEEN_KEY, JSON.stringify(["models"]));
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "?" }));
    expect(await screen.findByRole("dialog", { name: title })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "replay" }));
    expect(isTourSeen("models")).toBe(false);
    expect(await screen.findByRole("dialog", { name: title }, wait)).toBeInTheDocument();
  });

  it("still starts at most once when storage is unavailable", async () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("denied"); });
    const user = userEvent.setup();
    const first = renderPage();
    expect(await screen.findByRole("dialog", {}, wait)).toBeInTheDocument();
    await user.keyboard("{Escape}");
    first.unmount();
    renderPage();
    await settle();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    get.mockRestore();
    set.mockRestore();
  });
});

describe("tour definitions", () => {
  it("has IT and EN texts for every tour and step", () => {
    const keys = TOURS.flatMap((tour) => [
      `${tour.key}Name`, `${tour.key}Desc`, ...tour.steps.flatMap((s) => [`${s.key}Title`, `${s.key}Text`])
    ]);
    for (const lang of ["it", "en"] as const) {
      expect(keys.filter((k) => !translations[lang][k as TranslationKey])).toEqual([]);
    }
  });

  it("covers every page and tab of the application", () => {
    expect(TOURS.map((tour) => tour.id).sort()).toEqual([
      "admin-awards", "admin-catalog", "admin-events", "admin-judges", "admin-judging", "admin-rules", "admin-sponsors",
      "checkin", "enrollments", "events", "help", "home", "judge", "judge-score", "labels", "login",
      "models", "models-wizard", "podium", "profile", "settings-export", "settings-general",
      "settings-team", "settings-theme", "stats", "teams", "users"
    ]);
  });

  it("anchors every step to an element that exists in the application", () => {
    const sources = Object.values(import.meta.glob(["../../**/*.tsx", "!../../**/__tests__/**"], {
      query: "?raw", import: "default", eager: true
    }) as Record<string, string>).join("\n");
    const missing = TOURS.flatMap((tour) => tour.steps)
      .filter((s) => !sources.includes(`data-tour="${s.target}"`) && !sources.includes(`tourId="${s.target}"`))
      .map((s) => s.target);
    expect(missing).toEqual([]);
  });

  it("filters tours and steps by role, section and permission", () => {
    const visible = (c: TourContext) => TOURS.filter((tour) => canSeeTour(tour, c)).map((tour) => tour.id);
    expect(visible({ role: null, permissions: [], sections: null })).toEqual(["login", "events", "help"]);
    expect(visible(ctx)).not.toContain("users");
    expect(visible({ role: "manager", permissions: [], sections: ["admin"] })).not.toContain("users");
    expect(visible({ role: "manager", permissions: [], sections: ["admin"] })).not.toContain("admin-rules");

    const wizard = TOURS.find((tour) => tour.id === "models-wizard")!;
    const targets = (c: TourContext) => tourSteps(wizard, c).map((s) => s.target);
    expect(targets(ctx)).not.toContain("wizard-owner");
    expect(targets({ ...ctx, permissions: ["enrollOnBehalf"] })).toContain("wizard-owner");
    expect(targets({ ...ctx, role: "admin" })).toContain("wizard-owner");
  });
});
