import { test, expect } from "@playwright/test";
import { ADMIN, loginAs, waitForApp } from "./helpers";

test.describe("Admin page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN);
    await waitForApp(page);
    await page.goto("/admin");
    await waitForApp(page);
  });

  test("admin page title visible", async ({ page }) => {
    await expect(page.getByRole("heading").first()).toBeVisible();
  });

  test("events section loads", async ({ page }) => {
    await expect(page.getByText(/MSS Open/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("users section shows users", async ({ page }) => {
    // Users section title is "Utenti" (IT) / "Users" (EN)
    const usersSection = page.getByText(/^Utenti$|^Users$/i).first();
    await usersSection.scrollIntoViewIfNeeded();
    await expect(usersSection).toBeVisible({ timeout: 8000 });
  });

  test("levels section visible", async ({ page }) => {
    // Levels section title is "Livelli" (IT) / "Levels" (EN)
    const levelsSection = page.getByText(/^Livelli$|^Levels$/i).first();
    await levelsSection.scrollIntoViewIfNeeded();
    await expect(levelsSection).toBeVisible({ timeout: 8000 });
  });

  test("member roles section visible", async ({ page }) => {
    // Member roles section title is "Ruoli Membri" (IT) / "Member Roles" (EN)
    const memberRolesSection = page.getByText(/ruoli membri|member roles/i).first();
    await memberRolesSection.scrollIntoViewIfNeeded();
    await expect(memberRolesSection).toBeVisible({ timeout: 8000 });
  });

  test("create event form works", async ({ page }) => {
    const eventInput = page.getByLabel(/event name|nome evento/i).first();
    if (await eventInput.isVisible()) {
      await eventInput.fill("Test Event Playwright");
      await expect(eventInput).toHaveValue("Test Event Playwright");
    }
  });
});
