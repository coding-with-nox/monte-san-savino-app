import { test, expect } from "@playwright/test";
import { ADMIN, MANAGER, USER, loginAs, waitForApp } from "./helpers";

test.describe("Navigation — admin role", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN);
    await waitForApp(page);
  });

  test("profile page loads after login", async ({ page }) => {
    await expect(page).toHaveURL("/");
    await expect(page.getByText(/profilo|profile/i).first()).toBeVisible();
  });

  test("models page loads", async ({ page }) => {
    await page.goto("/models");
    await waitForApp(page);
    await expect(page).toHaveURL("/models");
    await expect(page.getByText(/model|modell/i).first()).toBeVisible();
  });

  test("admin page accessible to admin role", async ({ page }) => {
    await page.goto("/admin");
    await waitForApp(page);
    await expect(page).toHaveURL("/admin");
  });

  test("settings page accessible to admin role", async ({ page }) => {
    await page.goto("/settings");
    await waitForApp(page);
    await expect(page).toHaveURL("/settings");
  });

  test("public events page loads without auth", async ({ page }) => {
    await page.goto("/public-events");
    await waitForApp(page);
    await expect(page).toHaveURL("/public-events");
  });
});

test.describe("Navigation — user role", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, USER);
    await waitForApp(page);
  });

  test("admin page redirects non-admin user", async ({ page }) => {
    await page.goto("/admin");
    await waitForApp(page);
    // Should be redirected away from /admin
    await expect(page).not.toHaveURL("/admin");
  });

  test("settings page redirects non-admin user", async ({ page }) => {
    await page.goto("/settings");
    await waitForApp(page);
    await expect(page).not.toHaveURL("/settings");
  });

  test("models page accessible to regular user", async ({ page }) => {
    await page.goto("/models");
    await waitForApp(page);
    await expect(page).toHaveURL("/models");
  });
});

test.describe("Navigation — manager role", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, MANAGER);
    await waitForApp(page);
  });

  test("admin page accessible to manager", async ({ page }) => {
    await page.goto("/admin");
    await waitForApp(page);
    await expect(page).toHaveURL("/admin");
  });

  test("settings page not accessible to manager", async ({ page }) => {
    await page.goto("/settings");
    await waitForApp(page);
    await expect(page).not.toHaveURL("/settings");
  });
});
