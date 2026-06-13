# Frontend — Miniatures Contest

React single-page app for the Monte San Savino miniatures contest. Material 3 themed, role-aware, multi-language (IT/EN).

## Stack

| Concern        | Tech                                |
|----------------|-------------------------------------|
| UI library     | React 18                            |
| Language       | TypeScript 5                        |
| Build tool     | Vite 5                              |
| Components     | MUI v5 (@mui/material, icons)       |
| Routing        | React Router v6                     |
| Maps           | Leaflet + react-leaflet             |
| Testing        | Vitest 2.x + React Testing Library  |

## Project structure

```
src/
  App.tsx          — Shell: theme, nav (AppBar + Drawer + bottom nav), routes, role guards
  pages/           — 12 pages: Login, Profile, Models, Enrollments, Judge, Users,
                     Admin, Labels, Settings, Dashboard, PublicEvents, StaffCheckin
  components/      — Shared: PageContainer, SectionCard, Field, EmptyState, useToast
  lib/
    theme.ts       — buildTheme(mode, preset): Material 3 tonal theme factory
    api.ts         — fetch wrapper for /api/* routes
    auth.ts        — JWT decode, role checks (getToken, getRole, roleAtLeast)
    i18n.ts        — t(language, key) translation helper
    download.ts    — file download helpers
    leafletSetup.ts — Leaflet marker icon fix
  test/            — renderWithProviders, setup.ts
```

## Theme system

3 presets (**violet** / **ocean** / **forest**) × 2 modes (**light** / **dark**) = 6 combinations, built by `buildTheme(mode, preset)` in `lib/theme.ts` (Material 3 tonal palette).

- Switched from the **Settings** page (and the AppBar light/dark toggle).
- Persisted via `localStorage` keys `theme` and `themePreset`.
- On change, a `theme-settings-updated` CustomEvent notifies `App.tsx` to re-read storage and re-apply.
- For logged-in users, theme/preset are also synced from the backend `/settings` endpoint on load.

## Scripts

| Script               | Command          | Purpose                                  |
|----------------------|------------------|------------------------------------------|
| `bun run dev`        | `vite`           | Start the Vite dev server (HMR) on 5173. |
| `bun run build`      | `tsc -b && vite build` | Type-check then build to `dist/`.  |
| `bun run preview`    | `vite preview`   | Serve the production build locally.      |
| `bun run test`       | `vitest run`     | Run the test suite once.                 |
| `bun run test:watch` | `vitest`         | Run tests in watch mode.                 |

> Scripts also work with `npm run …`.

## Proxy

The Vite dev server proxies `/api/*` to the backend, stripping the `/api` prefix:

```
/api/foo  →  http://localhost:3000/foo
```

Target host is configurable via `VITE_PROXY_TARGET` (default `http://localhost:3000`; set to `http://backend:3000` inside Docker). Configured in `vite.config.ts`. The dev server listens on port **5173**.

## Tests

```bash
bun run test
```

Vitest in a **jsdom** environment with React Testing Library. Tests live in
`src/components/__tests__/` and `src/pages/__tests__/`. Shared `renderWithProviders`
and global setup are in `src/test/`.

## Build

```bash
bun run build   # outputs to dist/
```

The `dist/` bundle is served by **nginx** in the Docker image.

## Docker (GHCR)

```bash
docker build -t ghcr.io/coding-with-nox/monte-san-savino-app-frontend:latest .
```
