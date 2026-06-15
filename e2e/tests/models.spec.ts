import { test, expect } from "@playwright/test";
import { ADMIN, USER, loginAs, waitForApp } from "./helpers";

test.describe("Models page", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, USER);
    await waitForApp(page);
    await page.goto("/models");
    await waitForApp(page);
  });

  test("models page renders", async ({ page }) => {
    await expect(page).toHaveURL("/models");
  });

  test("model list or empty state visible", async ({ page }) => {
    // Either models are listed or an empty state message is shown
    const hasModels = await page.getByRole("listitem").count() > 0 ||
      await page.getByRole("row").count() > 1;
    const hasEmptyState = await page.getByText(/no model|nessun modell|empty/i).isVisible();
    expect(hasModels || hasEmptyState).toBe(true);
  });
});

test.describe("Models page — admin", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN);
    await waitForApp(page);
    await page.goto("/models");
    await waitForApp(page);
  });

  test("admin sees models from seed data", async ({ page }) => {
    // admin@test.com has 15 models from 02-test-data.sh
    await expect(page.getByText(/messerschmitt|spitfire|MSS/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("add model button visible", async ({ page }) => {
    // Button text is "Iscrivi modello" (IT) / "Enroll model" (EN)
    const addBtn = page.getByRole("button", { name: /iscrivi|enroll|add|aggiungi|new|nuovo/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 5000 });
  });
});
