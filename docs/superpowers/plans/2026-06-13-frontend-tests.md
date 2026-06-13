# Frontend Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Vitest + React Testing Library tests for all shared components and key page smoke tests.

**Architecture:** jsdom environment, ThemeProvider wrapper for MUI, vi.mock for API calls, vi.useFakeTimers for Snackbar auto-hide.

**Tech Stack:** Vitest 2.x, React Testing Library 16.x, @testing-library/jest-dom 6.x, jsdom 24.x

---

## File Map

| Path | Action | Responsibility |
|------|--------|----------------|
| `frontend/vitest.config.ts` | Create | Vitest config: jsdom env, globals, setup file |
| `frontend/src/test/setup.ts` | Create | Import jest-dom matchers |
| `frontend/src/test/renderWithProviders.tsx` | Create | Wrap UI with MUI ThemeProvider |
| `frontend/src/components/__tests__/PageContainer.test.tsx` | Create | Tests for `PageContainer` |
| `frontend/src/components/__tests__/SectionCard.test.tsx` | Create | Tests for `SectionCard` |
| `frontend/src/components/__tests__/Field.test.tsx` | Create | Tests for `Field` + `EmptyValue` |
| `frontend/src/components/__tests__/EmptyState.test.tsx` | Create | Tests for `EmptyState` |
| `frontend/src/components/__tests__/useToast.test.tsx` | Create | Tests for `useToast` hook |
| `frontend/src/pages/__tests__/Login.smoke.test.tsx` | Create | Smoke test for `Login` page |
| `frontend/src/pages/__tests__/Profile.smoke.test.tsx` | Create | Smoke test for `Profile` page |
| `frontend/package.json` | Modify | Add test devDependencies + `test`/`test:watch` scripts |

---

## Task 1: Install Vitest + RTL, configure, create test infrastructure

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/src/test/renderWithProviders.tsx`

- [ ] **Step 1: Install dependencies**

From the `frontend/` directory:

```bash
bun add -D vitest@^2.0.0 @vitest/coverage-v8@^2.0.0 @testing-library/react@^16.0.0 @testing-library/user-event@^14.0.0 @testing-library/jest-dom@^6.0.0 jsdom@^24.0.0
```

Expected: packages added to `devDependencies` in `package.json`.

- [ ] **Step 2: Add test scripts to `frontend/package.json`**

The `"scripts"` section must become:

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: Create `frontend/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
```

- [ ] **Step 4: Create `frontend/src/test/setup.ts`**

```ts
import "@testing-library/jest-dom";
```

- [ ] **Step 5: Create `frontend/src/test/renderWithProviders.tsx`**

```tsx
import React from "react";
import { render, RenderResult } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import { buildTheme } from "../lib/theme";

const theme = buildTheme("dark", "violet");

export function renderWithProviders(ui: React.ReactElement): RenderResult {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}
```

- [ ] **Step 6: Verify the setup compiles**

```bash
cd frontend && bun run test
```

Expected output (no test files yet, no errors):
```
No test files found, exiting with code 0
```

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/bun.lockb frontend/vitest.config.ts frontend/src/test/setup.ts frontend/src/test/renderWithProviders.tsx
git commit -m "test: install Vitest + RTL, add vitest.config.ts and test infrastructure"
```

---

## Task 2: Test `PageContainer`

**Files:**
- Create: `frontend/src/components/__tests__/PageContainer.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
import React from "react";
import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import PageContainer from "../PageContainer";
import { renderWithProviders } from "../../test/renderWithProviders";

describe("PageContainer", () => {
  it("renders children", () => {
    renderWithProviders(
      <PageContainer>
        <span>Hello world</span>
      </PageContainer>
    );
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders multiple children", () => {
    renderWithProviders(
      <PageContainer>
        <span>First</span>
        <span>Second</span>
      </PageContainer>
    );
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("renders with default maxWidth md without crashing", () => {
    const { container } = renderWithProviders(
      <PageContainer>
        <span>content</span>
      </PageContainer>
    );
    expect(container.querySelector(".MuiContainer-maxWidthMd")).toBeInTheDocument();
  });

  it("renders with custom maxWidth sm", () => {
    const { container } = renderWithProviders(
      <PageContainer maxWidth="sm">
        <span>content</span>
      </PageContainer>
    );
    expect(container.querySelector(".MuiContainer-maxWidthSm")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and verify**

```bash
cd frontend && bun run test src/components/__tests__/PageContainer.test.tsx
```

Expected: 4 pass, 0 fail

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/__tests__/PageContainer.test.tsx
git commit -m "test: add PageContainer component tests"
```

---

## Task 3: Test `SectionCard`

**Files:**
- Create: `frontend/src/components/__tests__/SectionCard.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
import React from "react";
import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import SectionCard from "../SectionCard";
import { renderWithProviders } from "../../test/renderWithProviders";

describe("SectionCard", () => {
  it("renders title text", () => {
    renderWithProviders(
      <SectionCard title="My Title">
        <span>body</span>
      </SectionCard>
    );
    expect(screen.getByText("My Title")).toBeInTheDocument();
  });

  it("renders children content", () => {
    renderWithProviders(
      <SectionCard title="T">
        <span>child content</span>
      </SectionCard>
    );
    expect(screen.getByText("child content")).toBeInTheDocument();
  });

  it("renders icon badge when icon prop is provided", () => {
    renderWithProviders(
      <SectionCard title="T" icon={<span data-testid="my-icon">icon</span>}>
        <span>body</span>
      </SectionCard>
    );
    expect(screen.getByTestId("my-icon")).toBeInTheDocument();
  });

  it("renders action node when action prop is provided", () => {
    renderWithProviders(
      <SectionCard title="T" action={<button>Click me</button>}>
        <span>body</span>
      </SectionCard>
    );
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("does not render action button when action prop is omitted", () => {
    renderWithProviders(
      <SectionCard title="T">
        <span>body</span>
      </SectionCard>
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and verify**

```bash
cd frontend && bun run test src/components/__tests__/SectionCard.test.tsx
```

Expected: 5 pass, 0 fail

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/__tests__/SectionCard.test.tsx
git commit -m "test: add SectionCard component tests"
```

---

## Task 4: Test `Field` + `EmptyValue`

**Files:**
- Create: `frontend/src/components/__tests__/Field.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
import React from "react";
import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Field, { EmptyValue } from "../Field";
import { renderWithProviders } from "../../test/renderWithProviders";

describe("Field", () => {
  it("renders label text", () => {
    renderWithProviders(<Field label="Email" value="test@example.com" />);
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("renders string value when provided", () => {
    renderWithProviders(<Field label="City" value="Florence" />);
    expect(screen.getByText("Florence")).toBeInTheDocument();
  });

  it("renders EmptyValue placeholder when value is undefined", () => {
    renderWithProviders(<Field label="Phone" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders EmptyValue placeholder when value is empty string", () => {
    renderWithProviders(<Field label="Phone" value="" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders a ReactNode value correctly", () => {
    renderWithProviders(
      <Field label="Role" value={<span data-testid="chip">admin</span>} />
    );
    expect(screen.getByTestId("chip")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
  });
});

describe("EmptyValue", () => {
  it("renders a non-empty DOM with an em dash", () => {
    renderWithProviders(<EmptyValue />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and verify**

```bash
cd frontend && bun run test src/components/__tests__/Field.test.tsx
```

Expected: 6 pass, 0 fail

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/__tests__/Field.test.tsx
git commit -m "test: add Field and EmptyValue component tests"
```

---

## Task 5: Test `EmptyState`

**Files:**
- Create: `frontend/src/components/__tests__/EmptyState.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import EmptyState from "../EmptyState";
import { renderWithProviders } from "../../test/renderWithProviders";

describe("EmptyState", () => {
  it("renders title message", () => {
    renderWithProviders(<EmptyState title="Nothing here yet" />);
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    renderWithProviders(
      <EmptyState title="No data" description="Try adding something first." />
    );
    expect(screen.getByText("Try adding something first.")).toBeInTheDocument();
  });

  it("renders an svg icon", () => {
    const { container } = renderWithProviders(<EmptyState title="Empty" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders custom icon when icon prop is provided", () => {
    renderWithProviders(
      <EmptyState title="Empty" icon={<span data-testid="custom-icon" />} />
    );
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });

  it("renders action button when action prop is provided", () => {
    renderWithProviders(
      <EmptyState title="Empty" action={{ label: "Add item", onClick: vi.fn() }} />
    );
    expect(screen.getByRole("button", { name: "Add item" })).toBeInTheDocument();
  });

  it("fires action callback when button is clicked", async () => {
    const handleClick = vi.fn();
    renderWithProviders(
      <EmptyState title="Empty" action={{ label: "Add item", onClick: handleClick }} />
    );
    await userEvent.click(screen.getByRole("button", { name: "Add item" }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not render a button when action prop is omitted", () => {
    renderWithProviders(<EmptyState title="Empty" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run and verify**

```bash
cd frontend && bun run test src/components/__tests__/EmptyState.test.tsx
```

Expected: 7 pass, 0 fail

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/__tests__/EmptyState.test.tsx
git commit -m "test: add EmptyState component tests"
```

---

## Task 6: Test `useToast` hook

**Files:**
- Create: `frontend/src/components/__tests__/useToast.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
import React from "react";
import { screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import useToast from "../useToast";
import { renderWithProviders } from "../../test/renderWithProviders";

function ToastTester({ fn }: { fn: (toast: ReturnType<typeof useToast>) => void }) {
  const toast = useToast();
  return (
    <>
      <button onClick={() => fn(toast)}>trigger</button>
      {toast.node}
    </>
  );
}

describe("useToast", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); });

  it("show() displays the snackbar with the provided message", async () => {
    renderWithProviders(<ToastTester fn={(toast) => toast.show("Hello toast")} />);
    await userEvent.click(screen.getByRole("button", { name: "trigger" }));
    expect(screen.getByText("Hello toast")).toBeInTheDocument();
  });

  it("error() displays an Alert with severity error", async () => {
    renderWithProviders(<ToastTester fn={(toast) => toast.error("Something broke")} />);
    await userEvent.click(screen.getByRole("button", { name: "trigger" }));
    expect(screen.getByText("Something broke")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveClass("MuiAlert-filledError");
  });

  it("success() displays an Alert with severity success", async () => {
    renderWithProviders(<ToastTester fn={(toast) => toast.success("Saved!")} />);
    await userEvent.click(screen.getByRole("button", { name: "trigger" }));
    expect(screen.getByText("Saved!")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveClass("MuiAlert-filledSuccess");
  });

  it("info() displays an Alert with severity info", async () => {
    renderWithProviders(<ToastTester fn={(toast) => toast.info("FYI")} />);
    await userEvent.click(screen.getByRole("button", { name: "trigger" }));
    expect(screen.getByText("FYI")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveClass("MuiAlert-filledInfo");
  });

  it("auto-hides the snackbar after 4000 ms", async () => {
    renderWithProviders(<ToastTester fn={(toast) => toast.show("Temporary")} />);
    await userEvent.click(screen.getByRole("button", { name: "trigger" }));
    expect(screen.getByText("Temporary")).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(4001); });

    expect(screen.queryByText("Temporary")).not.toBeVisible();
  });
});
```

- [ ] **Step 2: Run and verify**

```bash
cd frontend && bun run test src/components/__tests__/useToast.test.tsx
```

Expected: 5 pass, 0 fail

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/__tests__/useToast.test.tsx
git commit -m "test: add useToast hook tests with fake timers"
```

---

## Task 7: Smoke test `Login.tsx`

**Files:**
- Create: `frontend/src/pages/__tests__/Login.smoke.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material";
import { render } from "@testing-library/react";
import { buildTheme } from "../../lib/theme";
import Login from "../Login";

const theme = buildTheme("dark", "violet");

function renderLogin() {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <Login language="en" />
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe("Login smoke tests", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("renders email input", () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it("renders password input", () => {
    renderLogin();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("renders login submit button", () => {
    renderLogin();
    expect(screen.getByRole("button", { name: /login/i })).toBeInTheDocument();
  });

  it("shows error toast when API returns 401", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      headers: { get: () => "application/json" },
      json: async () => ({ error: "Invalid credentials" }),
      text: async () => "Invalid credentials",
    });
    vi.stubGlobal("fetch", mockFetch);

    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), "bad@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "wrongpass");
    await userEvent.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run and verify**

```bash
cd frontend && bun run test src/pages/__tests__/Login.smoke.test.tsx
```

Expected: 4 pass, 0 fail

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/__tests__/Login.smoke.test.tsx
git commit -m "test: add Login page smoke tests"
```

---

## Task 8: Smoke test `Profile.tsx`

**Files:**
- Create: `frontend/src/pages/__tests__/Profile.smoke.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
import React from "react";
import { screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ThemeProvider } from "@mui/material";
import { render } from "@testing-library/react";
import { buildTheme } from "../../lib/theme";
import Profile from "../Profile";

const theme = buildTheme("dark", "violet");

const mockProfile = {
  email: "mario@example.com",
  role: "user",
  firstName: "Mario",
  lastName: "Rossi",
  phone: null,
  city: "Florence",
  emergencyContact: null,
  emergencyContactName: null,
};

function makeOkFetch(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { get: (name: string) => (name === "content-type" ? "application/json" : null) },
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

function renderProfile() {
  return render(
    <ThemeProvider theme={theme}>
      <Profile language="en" />
    </ThemeProvider>
  );
}

describe("Profile smoke tests", () => {
  beforeEach(() => { vi.stubGlobal("fetch", makeOkFetch(mockProfile)); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("renders without crashing and shows page heading", async () => {
    renderProfile();
    await waitFor(() => {
      expect(screen.getByText("Profile")).toBeInTheDocument();
    });
  });

  it("renders the user first name after data loads", async () => {
    renderProfile();
    await waitFor(() => {
      expect(screen.getByText("Mario")).toBeInTheDocument();
    });
  });

  it("renders the user last name after data loads", async () => {
    renderProfile();
    await waitFor(() => {
      expect(screen.getByText("Rossi")).toBeInTheDocument();
    });
  });

  it("renders the user email after data loads", async () => {
    renderProfile();
    await waitFor(() => {
      expect(screen.getByText("mario@example.com")).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run and verify**

```bash
cd frontend && bun run test src/pages/__tests__/Profile.smoke.test.tsx
```

Expected: 4 pass, 0 fail

- [ ] **Step 3: Run the full test suite**

```bash
cd frontend && bun run test
```

Expected: all test files pass, 0 fail.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/__tests__/Profile.smoke.test.tsx
git commit -m "test: add Profile page smoke tests, all frontend tests passing"
```
