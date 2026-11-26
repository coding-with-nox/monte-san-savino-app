import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { ADMIN, USER, loginAs, waitForApp } from "./helpers";

async function apiToken(request: APIRequestContext, user: { email: string; password: string }) {
  const res = await request.post("/api/auth/login", { data: user });
  expect(res.ok()).toBeTruthy();
  return { Authorization: `Bearer ${(await res.json()).accessToken}` };
}

// Creates its own event/category/level/role, so the totals do not depend on existing data.
test.describe("Team model enrollment", () => {
  test.slow();
  const stamp = Date.now();
  const names = {
    event: `E2E Evento ${stamp}`,
    category: `E2E Categoria ${stamp}`,
    level: `E2E Livello ${stamp}`,
    role: `E2E Ruolo ${stamp}`,
    model: `E2E Modello ${stamp}`
  };
  const ids = { event: "", category: "", level: "", role: "" };

  test.beforeAll(async ({ request }) => {
    const headers = await apiToken(request, ADMIN);
    const create = async (path: string, data: unknown) => {
      const res = await request.post(`/api${path}`, { headers, data });
      expect(res.ok(), `POST ${path}`).toBeTruthy();
      return (await res.json()).id as string;
    };
    ids.event = await create("/events", { name: names.event, status: "active" });
    ids.category = await create("/categories", { eventId: ids.event, name: names.category });
    ids.level = await create("/admin/levels", { name: names.level });
    ids.role = await create("/admin/member-roles", { name: names.role, price: 1500 });
  });

  test.afterAll(async ({ request }) => {
    const user = await apiToken(request, USER);
    const models = await (await request.get("/api/models", { headers: user })).json();
    for (const m of models.filter((x: { name: string }) => x.name === names.model)) {
      await request.delete(`/api/models/${m.id}`, { headers: user });
    }
    const admin = await apiToken(request, ADMIN);
    await request.delete(`/api/categories/${ids.category}`, { headers: admin });
    await request.delete(`/api/admin/levels/${ids.level}`, { headers: admin });
    await request.delete(`/api/admin/member-roles/${ids.role}`, { headers: admin });
    await request.delete(`/api/events/${ids.event}`, { headers: admin });
  });

  /** Walks the enrollment steps as USER and submits a team model with one coauthor. */
  async function submitTeamModel(page: Page, notes?: string) {
    await loginAs(page, USER);
    await waitForApp(page);
    await page.goto("/models");
    await waitForApp(page);
    await page.getByRole("button", { name: /^(Iscrivi modello|Enroll model)$/ }).first().click();

    const panel = page.locator(".MuiPaper-root").filter({ has: page.locator(".MuiStepper-root") }).last();
    const next = panel.getByRole("button", { name: /^(Avanti|Next)$/ });

    await panel.getByRole("combobox").nth(0).click();
    await page.getByRole("option", { name: names.category }).click();
    await panel.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: names.level }).click();
    await next.click();

    await panel.getByLabel(/^(Nome modello|Model name)$/).fill(names.model);
    if (notes) await panel.getByRole("textbox", { name: /note/i }).fill(notes);
    await next.click();

    await panel.getByText(/^(Modello in team|Team model)$/).click();
    const coauthor = panel.getByRole("group", { name: /^(Coautore|Co-author) 1$/ });
    await coauthor.getByLabel(/^(Nome|First name)/).fill("Anna");
    await coauthor.getByLabel(/^(Cognome|Last name)/).fill("Verdi");
    await coauthor.getByRole("combobox").click();
    await page.getByRole("option", { name: new RegExp(names.role) }).click();
    await next.click();

    await expect(panel.getByTestId("price-preview")).toContainText(/Anna Verdi/);
    await panel.getByRole("button", { name: /^(Iscrivi modello|Enroll model)$/ }).click();
  }

  test("enrolls a team model and shows the total in the fee summary", async ({ page }) => {
    // Notes are filled to get around the bug covered by the next test.
    await submitTeamModel(page, "Nota E2E");

    // Success toast carries the team code <participant number>T<n>.
    await expect(page.getByText(/\b\d+T\d+\b/).first()).toBeVisible();

    const settings = await (await page.request.get("/api/settings", { headers: await apiToken(page.request, USER) })).json();
    const total = (Number(settings.baseFeeCents) + 1500) / 100;

    await page.goto("/enrollments");
    await waitForApp(page);
    const summary = page.locator(".MuiCard-root")
      .filter({ hasText: names.event })
      .getByTestId("price-summary");
    await expect(summary).toContainText("Anna Verdi");
    await expect(summary).toContainText(new RegExp(`(Totale|Total)\\D*${total}[,.]00`));
  });

  // BUG: the UI sends `notes: null` for empty notes and POST /models answers 422.
  // Remove test.fail() once fixed (Playwright reports an unexpected pass).
  test("enrolls a team model without notes", async ({ page }) => {
    test.fail();
    const response = page.waitForResponse((r) => r.url().endsWith("/api/models") && r.request().method() === "POST");
    await submitTeamModel(page);
    expect((await response).status()).toBe(200);
  });
});
