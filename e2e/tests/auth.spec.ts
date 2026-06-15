import { test, expect } from "@playwright/test";
import { ADMIN, INACTIVE, loginAs, waitForApp } from "./helpers";

test.describe("Authentication", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
  });

  test("unauthenticated redirect to login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login with valid admin credentials", async ({ page }) => {
    await loginAs(page, ADMIN);
    // loginAs already waits for redirect away from /login
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("login with wrong password shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(ADMIN.email);
    await page.getByLabel("Password").fill("WrongPassword123!");
    await page.getByRole("button", { name: "Login" }).click();
    // Error toast or message should appear
    await expect(page.getByText(/invalid|errore|credenziali|credential/i)).toBeVisible({ timeout: 5000 });
  });

  test("login with inactive user shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(INACTIVE.email);
    await page.getByLabel("Password").fill(INACTIVE.password);
    await page.getByRole("button", { name: "Login" }).click();
    // Backend returns "User disabled" → shown as toast
    await expect(page.getByText(/invalid|inactive|disabled|errore|disattivato/i)).toBeVisible({ timeout: 5000 });
  });

  test("logout redirects to login", async ({ page }) => {
    await loginAs(page, ADMIN);
    await waitForApp(page);
    // Click avatar button to open dropdown menu, then click Logout
    await page.locator(".MuiAvatar-root").click();
    await page.getByRole("menuitem", { name: /logout/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});
