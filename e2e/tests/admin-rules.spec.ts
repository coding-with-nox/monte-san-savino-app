import { test, expect, type Page } from "@playwright/test";
import { ADMIN, MANAGER, loginAs, waitForApp } from "./helpers";

async function openAdmin(page: Page, user: { email: string; password: string }) {
  await loginAs(page, user);
  await waitForApp(page);
  await page.goto("/admin");
  await waitForApp(page);
}

const rulesTab = (page: Page) => page.getByRole("tab", { name: /^(Regole|Rules)$/ });

test.describe("Admin rules tab", () => {
  test.slow();
  test("shows base fee, section visibility and prize order, and saves the order", async ({ page }) => {
    await openAdmin(page, ADMIN);
    await rulesTab(page).click();

    await expect(page.getByLabel(/Quota base in euro|Base fee in euros/)).toBeVisible();
    await expect(page.getByText(/Visibilità sezioni per ruolo|Section visibility by role/)).toBeVisible();
    await expect(page.getByRole("checkbox").first()).toBeVisible();

    const items = page.getByTestId("prize-order").getByRole("listitem");
    await expect(items).toHaveCount(4);
    await waitForApp(page);
    const labels = async () => (await items.allInnerTexts()).map((s) => s.trim().replace(/^\d+\.\s*/, ""));
    const original = await labels();
    const swapped = [original[1], original[0], ...original.slice(2)];

    const save = () => page.locator(".MuiCard-root")
      .filter({ has: page.getByTestId("prize-order") })
      .getByRole("button", { name: /^(Salva|Save)$/ })
      .click();
    const moveDown = (label: string) =>
      page.getByRole("button", { name: new RegExp(`^(Sposta giù|Move down): ${label}$`) }).click();

    await moveDown(original[0]);
    await save();
    await expect(page.getByText(/^(Salvato\.|Saved\.)$/).first()).toBeVisible();

    await page.reload();
    await waitForApp(page);
    await rulesTab(page).click();
    await expect.poll(labels).toEqual(swapped);

    // Restore the original order.
    await moveDown(swapped[0]);
    await save();
    await expect(page.getByText(/^(Salvato\.|Saved\.)$/).first()).toBeVisible();
  });

  test("saves a row of the permissions matrix, admin always granted", async ({ page }) => {
    await openAdmin(page, ADMIN);
    await rulesTab(page).click();

    const permission = "(Iscrivere modelli per conto di altri|Enroll models on behalf of others)";
    const staff = page.getByRole("checkbox", { name: new RegExp(`^staff: ${permission}$`) });
    const admin = page.getByRole("checkbox", { name: new RegExp(`^admin: ${permission}$`) });
    await expect(admin).toBeChecked();
    await expect(admin).toBeDisabled();

    const save = async () => {
      const response = page.waitForResponse(
        (r) => r.url().endsWith("/api/admin/settings/section-visibility") && r.request().method() === "PUT"
      );
      await page.locator(".MuiCard-root")
        .filter({ has: page.locator('[data-tour="rules-permissions"]') })
        .getByRole("button", { name: /^(Salva|Save)$/ })
        .click();
      return (await (await response).json()).permissions as Record<string, string[]>;
    };

    const initial = await staff.isChecked();
    await staff.setChecked(!initial);
    expect((await save()).staff).toEqual(initial ? [] : ["enrollOnBehalf"]);
    await expect(page.getByText(/^(Salvato\.|Saved\.)$/).first()).toBeVisible();

    await page.reload();
    await waitForApp(page);
    await rulesTab(page).click();
    await expect(staff).toBeChecked({ checked: !initial });

    // Restore.
    await staff.setChecked(initial);
    expect((await save()).staff).toEqual(initial ? ["enrollOnBehalf"] : []);
  });

  test("is hidden from managers", async ({ page }) => {
    await openAdmin(page, MANAGER);
    await expect(page.getByRole("tab").first()).toBeVisible();
    await expect(rulesTab(page)).toHaveCount(0);
  });
});
