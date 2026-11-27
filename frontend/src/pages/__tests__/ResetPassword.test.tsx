import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();

vi.mock("../../lib/api", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    code?: string;
    constructor(status: number, message: string, code?: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
  errorCode: (e: any) => e?.code,
  api: (...a: unknown[]) => apiMock(...a)
}));

import ResetPassword from "../ResetPassword";
import { ApiError } from "../../lib/api";

function renderReset(path: string) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[path]}>
      <ResetPassword language="en" />
    </MemoryRouter>
  );
}

async function submitNewPassword(user: ReturnType<typeof userEvent.setup>, password: string) {
  await user.type(screen.getByLabelText(/new password/i), password);
  await user.type(screen.getByLabelText(/confirm password/i), password);
  await user.click(screen.getByRole("button", { name: "Save password" }));
}

describe("ResetPassword page", () => {
  beforeEach(() => {
    apiMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("saves the new password for the token and links back to sign in", async () => {
    apiMock.mockResolvedValueOnce({});
    const user = userEvent.setup();
    renderReset("/reset-password?token=tok123");

    await submitNewPassword(user, "newpass123");

    expect(await screen.findByText("Password updated. You can now sign in with the new password.")).toBeInTheDocument();
    expect(apiMock).toHaveBeenCalledWith("/auth/reset-password", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(apiMock.mock.calls[0][1].body)).toEqual({ token: "tok123", password: "newpass123" });
    expect(screen.getByRole("link", { name: "Go to sign in" })).toHaveAttribute("href", "/login");
  });

  it("shows the invalid or expired message when the server rejects the token", async () => {
    apiMock.mockRejectedValueOnce(new ApiError(400, "invalid", "INVALID_OR_EXPIRED_TOKEN"));
    const user = userEvent.setup();
    renderReset("/reset-password?token=old");

    await submitNewPassword(user, "newpass123");

    expect(await screen.findByText("This link is invalid or has expired. Request a new link from the sign-in page.")).toBeInTheDocument();
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument();
  });

  it("shows the invalid message without a form when the link has no token", async () => {
    renderReset("/reset-password");

    expect(screen.getByText("This link is invalid or has expired. Request a new link from the sign-in page.")).toBeInTheDocument();
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument();
    await waitFor(() => expect(apiMock).not.toHaveBeenCalled());
  });

  it("keeps the form and does not call the API when the password is too short", async () => {
    const user = userEvent.setup();
    renderReset("/reset-password?token=tok123");

    await submitNewPassword(user, "short");

    expect(await screen.findByText("The password must be at least 8 characters long.")).toBeInTheDocument();
    expect(apiMock).not.toHaveBeenCalled();
  });
});
