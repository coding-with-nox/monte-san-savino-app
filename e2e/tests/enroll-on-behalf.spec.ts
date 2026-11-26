import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { ADMIN, USER, loginAs, waitForApp } from "./helpers";

async function apiToken(request: APIRequestContext, user: { email: string; password: string }) {
  const res = await request.post("/api/auth/login", { data: user });
  expect(res.ok()).toBeTruthy();
  return { Authorization: `Bearer ${(await res.json()).accessToken}` };
}

async function openWizard(page: Page, user: { email: string; password: string }) {
  await loginAs(page, user);
  await waitForApp(page);
  await page.goto("/models");
  await waitForApp(page);
  await page.getByRole("button", { name: /^(Iscrivi modello|Enroll model)$/ }).first().click();
  const wizard = page.locator('[data-tour-scope="models-wizard"]');
  await expect(wizard).toBeVisible();
  return wizard;
}

const ownerField = /(Iscrivi per conto di|Enroll on behalf of)/;

// Creates its own event/category/level and removes the model it enrolls.
test.describe("Enrollment on behalf of another participant", () => {
  test.slow();
  const stamp = Date.now();
  const names = {
    event: `E2E Conto Evento ${stamp}`,
    category: `E2E Conto Categoria ${stamp}`,
    level: `E2E Conto Livello ${stamp}`,
    model: `E2E Conto Modello ${stamp}`
  };
  const ids = { event: "", category: "", level: "", model: "" };

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
  });

  test.afterAll(async ({ request }) => {
    const headers = await apiToken(request, ADMIN);
    if (ids.model) await request.delete(`/api/admin/models/${ids.model}`, { headers });
    await request.delete(`/api/categories/${ids.category}`, { headers });
    await request.delete(`/api/admin/levels/${ids.level}`, { headers });
    await request.delete(`/api/events/${ids.event}`, { headers });
  });

  test("admin enrolls a model for user1 and the summary shows the owner", async ({ page, request }) => {
    const admin = await apiToken(request, ADMIN);
    const found = await (await request.get("/api/admin/users/enrollable?q=user1@test.com", { headers: admin })).json();
    const number = String(found[0].participantNumber);

    const wizard = await openWizard(page, ADMIN);
    const owner = wizard.getByRole("combobox", { name: ownerField });
    await expect(owner).toHaveValue(/^(Me stesso|Myself)/);

    // Search by participant number, then by name.
    const option = page.getByRole("option", { name: /^Mario Rossi — (n\.|no\.) \d+$/ });
    await owner.click();
    await owner.fill(number);
    await expect(option).toBeVisible();
    await owner.fill("Rossi");
    await option.click();
    await expect(owner).toHaveValue(`Mario Rossi — n. ${number}`);

    const fields = wizard.locator('[data-tour="wizard-fields"]');
    const next = wizard.getByRole("button", { name: /^(Avanti|Next)$/ });
    await fields.getByRole("combobox").nth(0).click();
    await page.getByRole("option", { name: names.category }).click();
    await fields.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: names.level }).click();
    await next.click();
    await wizard.getByLabel(/^(Nome modello|Model name)$/).fill(names.model);
    await next.click();
    await next.click();

    await expect(wizard.getByText(/^(Titolare del modello|Model owner)$/)).toBeVisible();
    await expect(wizard.getByText(`Mario Rossi — n. ${number}`, { exact: true })).toBeVisible();
    await expect(wizard.getByRole("alert").filter({ hasText: "Mario Rossi" })).toBeVisible();

    const response = page.waitForResponse((r) => r.url().endsWith("/api/models") && r.request().method() === "POST");
    await wizard.getByRole("button", { name: /^(Iscrivi modello|Enroll model)$/ }).click();
    const created = await response;
    expect(created.status()).toBe(200);
    ids.model = (await created.json()).id;
    expect(created.request().postDataJSON().userId).toBe(found[0].id);
    await expect(page.getByText(/(Modello iscritto per|Model enrolled for) Mario Rossi\./)).toBeVisible();

    const modelIds = async (user: { email: string; password: string }) =>
      ((await (await request.get("/api/models", { headers: await apiToken(request, user) })).json()) as { id: string }[])
        .map((m) => m.id);
    expect(await modelIds(USER)).toContain(ids.model);
    expect(await modelIds(ADMIN)).not.toContain(ids.model);
  });

  test("the owner field is hidden without the permission", async ({ page }) => {
    const wizard = await openWizard(page, USER);
    await expect(wizard.getByRole("combobox").first()).toBeVisible();
    await expect(wizard.getByRole("combobox", { name: ownerField })).toHaveCount(0);
  });
});
