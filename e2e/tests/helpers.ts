import { Page } from "@playwright/test";

export const ADMIN = { email: "admin@test.com", password: "Password1!" };
export const MANAGER = { email: "manager@test.com", password: "Password1!" };
export const USER = { email: "user1@test.com", password: "Password1!" };
export const INACTIVE = { email: "user4@test.com", password: "Password1!" };

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  // Clear any stale token from previous tests
  await page.evaluate(() => localStorage.clear());
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Login" }).click();
}

export async function loginAs(page: Page, user: { email: string; password: string }) {
  await login(page, user.email, user.password);
  // Wait until navigated away from /login (redirect after successful auth)
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 10000 });
}

export async function waitForApp(page: Page) {
  await page.waitForLoadState("networkidle");
}
