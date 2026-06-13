# Frontend Tests Spec — Monte San Savino App

Date: 2026-06-13
Branch: `feat/teams-levels-displaynumber`
Runtime: Vite 5 + Vitest 2.x + React Testing Library 16.x
Language: TypeScript 5

---

## Scope

- Component tests for all shared components (`src/components/`)
- Smoke tests for key pages to catch rendering regressions

---

## Dependencies to Add

```json
// devDependencies
"vitest": "^2.0.0",
"@vitest/coverage-v8": "^2.0.0",
"@testing-library/react": "^16.0.0",
"@testing-library/user-event": "^14.0.0",
"@testing-library/jest-dom": "^6.0.0",
"jsdom": "^24.0.0"
```

---

## Vitest Configuration

Add `vitest.config.ts` at `frontend/vitest.config.ts`:

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

Add `frontend/src/test/setup.ts`:
```ts
import "@testing-library/jest-dom";
```

Add test script to `package.json`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

---

## Component Tests

Location: `frontend/src/components/__tests__/`

### `PageContainer`

File: `PageContainer.test.tsx`

- Renders `children` inside container
- Default maxWidth is `"md"` (check container has correct className or data-testid)
- Custom `maxWidth="sm"` renders smaller container

### `SectionCard`

File: `SectionCard.test.tsx`

- Renders `title` text
- Renders `children` content
- With `icon` prop: icon badge visible in DOM
- With `action` prop: action node rendered
- Without `action` prop: no extra node

### `Field`

File: `Field.test.tsx`

- Renders `label` text
- Renders `value` when provided
- When no `value`: renders `EmptyValue` placeholder (dash or muted char)
- `value` is a ReactNode (non-string): renders correctly

### `EmptyState` and `EmptyValue`

File: `EmptyState.test.tsx`

- `EmptyState` renders `title` message
- `EmptyState` with `action` prop: button renders, click fires callback
- `EmptyState` without `action`: no button
- `EmptyValue` renders a muted placeholder (not empty DOM)

### `useToast`

File: `useToast.test.tsx`

- `toast.show("msg")` → Snackbar with `"msg"` appears
- `toast.error("err")` → Alert with severity `"error"` visible
- `toast.success("ok")` → Alert with severity `"success"` visible
- `toast.info("info")` → Alert with severity `"info"` visible
- Auto-hide: after `autoHideDuration`, snackbar closes (use `vi.useFakeTimers()`)

Test wrapper for `useToast`:
```tsx
function ToastTester({ fn }: { fn: (toast: ReturnType<typeof useToast>) => void }) {
  const toast = useToast();
  return (
    <>
      <button onClick={() => fn(toast)}>trigger</button>
      {toast.node}
    </>
  );
}
```

---

## Page Smoke Tests

Location: `frontend/src/pages/__tests__/`

All pages mock API calls via `vi.mock("../api")` or intercept `fetch` with `vi.fn()`.

### `Login.tsx`

File: `Login.smoke.test.tsx`

- Renders email input field
- Renders password input field
- Renders submit button
- With invalid credentials response: error toast visible

### `Profile.tsx`

File: `Profile.smoke.test.tsx`

- Mock `fetch` → returns user profile JSON
- Component renders without crash
- User name appears in DOM

---

## Shared Test Utils

`frontend/src/test/renderWithProviders.tsx`:
```tsx
import { render } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import { buildTheme } from "../lib/theme";

const theme = buildTheme("dark", "violet");

export function renderWithProviders(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}
```

---

## Non-Goals

- No E2E tests (Playwright/Cypress) in this phase
- No full page tests requiring router setup (smoke only)
- No API integration tests from frontend
