import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import ConfirmDialog, { useConfirm } from "../ConfirmDialog";

describe("ConfirmDialog", () => {
  it("renders message and fires callbacks", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderWithProviders(
      <ConfirmDialog open message="Sure?" confirmLabel="Yes" cancelLabel="No" onConfirm={onConfirm} onCancel={onCancel} />
    );
    expect(screen.getByText("Sure?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "No" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("is not visible when closed", () => {
    renderWithProviders(<ConfirmDialog open={false} message="Hidden" onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });
});

function Harness({ onResult }: { onResult: (v: boolean) => void }) {
  const { confirm, node } = useConfirm("en");
  return (
    <>
      <button onClick={async () => onResult(await confirm("Delete it?"))}>ask</button>
      {node}
    </>
  );
}

describe("useConfirm", () => {
  it("resolves true on confirm", async () => {
    const onResult = vi.fn();
    renderWithProviders(<Harness onResult={onResult} />);
    await userEvent.click(screen.getByText("ask"));
    expect(await screen.findByText("Delete it?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
  });

  it("resolves false on cancel", async () => {
    const onResult = vi.fn();
    renderWithProviders(<Harness onResult={onResult} />);
    await userEvent.click(screen.getByText("ask"));
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });
});
