import { test, expect, type Page } from "@playwright/test";
import { USER, loginAs, waitForApp } from "./helpers";

async function openAs(page: Page, path: string) {
  await loginAs(page, USER);
  await waitForApp(page);
  await page.goto(path);
  await waitForApp(page);
}

const helpButton = (page: Page) => page.getByRole("button", { name: /^(Guida di questa pagina|Help for this page)$/ });
/** The /models tour has three steps. */
const counter = (n: number) => new RegExp(`(Passo ${n} di|Step ${n} of) 3`);

test.describe("Guided tours", () => {
  test("the ? button opens the page tour; Next, Back and Esc work", async ({ page }) => {
    await openAs(page, "/models");
    const dialog = page.getByRole("dialog");
    // Auto-start is disabled by the helpers.
    await expect(dialog).toHaveCount(0);

    await helpButton(page).click();
    await expect(dialog).toContainText(counter(1));
    const back = dialog.getByRole("button", { name: /^(Indietro|Back)$/ });
    await expect(back).toBeDisabled();

    await dialog.getByRole("button", { name: /^(Avanti|Next)$/ }).click();
    await expect(dialog).toContainText(counter(2));
    await back.click();
    await expect(dialog).toContainText(counter(1));

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("starts by itself only the first time a page is visited", async ({ page }) => {
    await loginAs(page, USER);
    await waitForApp(page);
    await page.evaluate(() => localStorage.removeItem("guidedTours.disabled"));
    await page.goto("/models");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(counter(1));
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    await page.reload();
    await waitForApp(page);
    // Longer than the delay before an automatic start.
    await page.waitForTimeout(1500);
    await expect(dialog).toHaveCount(0);
  });
});

test.describe("Help page", () => {
  const startButton = (page: Page, name: string) =>
    page.getByRole("button", { name: new RegExp(`^(Avvia la guida|Start the tour): (${name})$`) });

  test("lists the sections available to the user and starts a tour", async ({ page }) => {
    await openAs(page, "/help");
    await expect(page.getByRole("heading", { level: 4, name: /^(Guida|Help)$/ })).toBeVisible();
    for (const name of ["Home", "Modelli|Models", "Iscrizioni|Enrollments"]) {
      await expect(startButton(page, name)).toBeVisible();
      await expect(page.getByRole("heading", { level: 6, name: new RegExp(`^(${name})$`) })).toBeVisible();
    }
    // Admin only sections are not documented to a user.
    await expect(startButton(page, "Amministrazione: regole|Admin: rules")).toHaveCount(0);

    await startButton(page, "Modelli|Models").click();
    await expect(page).toHaveURL("/models");
    await expect(page.getByRole("dialog")).toContainText(counter(1));
  });
});

test.describe("Tooltips", () => {
  test("a button explains itself on hover", async ({ page }) => {
    await openAs(page, "/models");
    const tooltip = page.getByRole("tooltip").filter({
      hasText: /(Apre la procedura guidata per iscrivere un nuovo modello\.|Opens the step-by-step enrollment of a new model\.)/
    });
    await expect(tooltip).toHaveCount(0);
    await page.locator('[data-tour="models-new"]').hover();
    await expect(tooltip).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(tooltip).toHaveCount(0);
  });
});
