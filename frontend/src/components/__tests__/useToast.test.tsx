import React from "react";
import { screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import useToast from "../useToast";
import { renderWithProviders } from "../../test/renderWithProviders";

function ToastTester({ fn }: { fn: (toast: ReturnType<typeof useToast>) => void }) {
  const toast = useToast();
  return (
    <>
      <button onClick={() => fn(toast)}>trigger</button>
      {toast.node}
    </>
  );
}

describe("useToast", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("show() displays the snackbar with the provided message", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ToastTester fn={(toast) => toast.show("Hello toast")} />);
    await user.click(screen.getByRole("button", { name: "trigger" }));
    expect(screen.getByText("Hello toast")).toBeInTheDocument();
  });

  it("error() displays an Alert with severity error", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ToastTester fn={(toast) => toast.error("Something broke")} />);
    await user.click(screen.getByRole("button", { name: "trigger" }));
    expect(screen.getByText("Something broke")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveClass("MuiAlert-filledError");
  });

  it("success() displays an Alert with severity success", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ToastTester fn={(toast) => toast.success("Saved!")} />);
    await user.click(screen.getByRole("button", { name: "trigger" }));
    expect(screen.getByText("Saved!")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveClass("MuiAlert-filledSuccess");
  });

  it("info() displays an Alert with severity info", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ToastTester fn={(toast) => toast.info("FYI")} />);
    await user.click(screen.getByRole("button", { name: "trigger" }));
    expect(screen.getByText("FYI")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveClass("MuiAlert-filledInfo");
  });

  it("snackbar closes when the alert close button is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ToastTester fn={(toast) => toast.show("Closeable")} />);
    await user.click(screen.getByRole("button", { name: "trigger" }));
    expect(screen.getByText("Closeable")).toBeInTheDocument();

    // MUI Alert renders a close button with aria-label "Close"
    const closeBtn = screen.getByRole("button", { name: /close/i });
    await user.click(closeBtn);

    expect(screen.queryByText("Closeable")).not.toBeVisible();
  });
});
