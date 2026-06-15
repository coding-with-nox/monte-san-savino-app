# UI Modernization — Material 3 Expressive Dark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize all 12 pages of the Miniatures Contest app to Material 3 / Expressive Dark style — tonal surfaces, rounded containers, correct toast severities, M3 navigation, and shared reusable components.

**Architecture:** Phase 1 creates a centralized `lib/theme.ts` that upgrades all pages visually at once via MUI component overrides. Phase 2 adds 5 shared components (`PageContainer`, `SectionCard`, `Field`, `EmptyState`, `useToast`) that eliminate duplication. Phase 3 migrates each page to use those components.

**Tech Stack:** React 18, MUI v5, TypeScript 5, Vite 5, React Router v6. No test runner — build verification via `npm run build` in `frontend/`.

---

## File Map

**Created:**
- `frontend/src/lib/theme.ts` — `buildTheme(mode, preset)` factory, all MUI overrides
- `frontend/src/components/PageContainer.tsx` — centered max-width layout wrapper
- `frontend/src/components/SectionCard.tsx` — tonal card with icon+title header
- `frontend/src/components/Field.tsx` — label/value pair with empty state
- `frontend/src/components/EmptyState.tsx` — block empty list placeholder + `EmptyValue` inline
- `frontend/src/components/useToast.tsx` — toast hook with correct severity

**Modified:**
- `frontend/src/App.tsx` — use `buildTheme`, modernize AppBar/nav
- `frontend/src/pages/Profile.tsx`
- `frontend/src/pages/Models.tsx`
- `frontend/src/pages/PublicEvents.tsx`
- `frontend/src/pages/Enrollments.tsx`
- `frontend/src/pages/Judge.tsx`
- `frontend/src/pages/Users.tsx`
- `frontend/src/pages/Admin.tsx`
- `frontend/src/pages/Labels.tsx`
- `frontend/src/pages/Settings.tsx`
- `frontend/src/pages/StaffCheckin.tsx`
- `frontend/src/pages/Login.tsx`
- `frontend/src/components/ProfileEditSections.tsx`

---

## Phase 1 — Theme Foundation

---

### Task 1: Extract theme to `lib/theme.ts`

**Files:**
- Create: `frontend/src/lib/theme.ts`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create `frontend/src/lib/theme.ts` with the extracted factory**

```typescript
import { createTheme, Theme } from "@mui/material";

export type ThemePreset = "violet" | "ocean" | "forest";
export type ThemeMode = "light" | "dark";

const presetPrimary: Record<ThemePreset, { light: string; dark: string }> = {
  violet: { light: "#6750a4", dark: "#d0bcff" },
  ocean:  { light: "#006d77", dark: "#83c5be" },
  forest: { light: "#2d6a4f", dark: "#95d5b2" },
};

export function buildTheme(mode: ThemeMode, preset: ThemePreset): Theme {
  return createTheme({
    palette: {
      mode,
      primary: {
        main: mode === "light" ? presetPrimary[preset].light : presetPrimary[preset].dark,
      },
    },
    typography: {
      fontFamily: '"Roboto", "Segoe UI", system-ui, sans-serif',
    },
  });
}
```

- [ ] **Step 2: Update `App.tsx` to import and use `buildTheme`**

Remove `createTheme` from the MUI import line (L25) and add the import. Replace the `presetPrimary` map and `useMemo(createTheme...)` block (L125-141):

```typescript
// Add at top of App.tsx imports:
import { buildTheme } from "./lib/theme";

// Remove from MUI import: createTheme
// Remove lines 125-141 (presetPrimary map + useMemo createTheme)

// Replace with:
const muiTheme = useMemo(() => buildTheme(themeMode, themePreset), [themeMode, themePreset]);
```

- [ ] **Step 3: Verify build passes**

```bash
cd frontend && npm run build
```
Expected: no errors, `dist/` produced.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/theme.ts frontend/src/App.tsx
git commit -m "refactor(theme): extract buildTheme factory to lib/theme.ts"
```

---

### Task 2: Add M3 shape, tonal surfaces, secondary palette

**Files:**
- Modify: `frontend/src/lib/theme.ts`

- [ ] **Step 1: Add TypeScript module augmentation for custom palette tokens**

Add this block at the top of `theme.ts` (before the `presetPrimary` map):

```typescript
import { createTheme, Theme, PaletteColorOptions } from "@mui/material";

declare module "@mui/material/styles" {
  interface Palette {
    surfaceContainer: string;
    surfaceVariant: string;
  }
  interface PaletteOptions {
    surfaceContainer?: string;
    surfaceVariant?: string;
  }
}
```

- [ ] **Step 2: Add secondary colors and surface tokens per preset/mode in `buildTheme`**

Replace the `buildTheme` function body with:

```typescript
const surfaceTokens: Record<ThemePreset, Record<ThemeMode, { default: string; paper: string; container: string; variant: string }>> = {
  violet: {
    dark:  { default: "#141218", paper: "#1d1b20", container: "#2b2930", variant: "#4a4458" },
    light: { default: "#fef7ff", paper: "#ffffff",  container: "#f3edf7", variant: "#e8def8" },
  },
  ocean: {
    dark:  { default: "#0e1a1b", paper: "#141f20", container: "#1f2d2e", variant: "#374849" },
    light: { default: "#f2fbfc", paper: "#ffffff",  container: "#e6f4f5", variant: "#cce8ea" },
  },
  forest: {
    dark:  { default: "#101a14", paper: "#16201a", container: "#1e2d22", variant: "#2d4233" },
    light: { default: "#f2faf4", paper: "#ffffff",  container: "#e6f4ea", variant: "#c8e6ce" },
  },
};

const secondaryMain: Record<ThemePreset, { light: string; dark: string }> = {
  violet: { light: "#625b71", dark: "#ccc2dc" },
  ocean:  { light: "#4a6267", dark: "#a0cdd2" },
  forest: { light: "#52634f", dark: "#b4ccb0" },
};

export function buildTheme(mode: ThemeMode, preset: ThemePreset): Theme {
  const s = surfaceTokens[preset][mode];
  return createTheme({
    palette: {
      mode,
      primary: {
        main: mode === "light" ? presetPrimary[preset].light : presetPrimary[preset].dark,
      },
      secondary: {
        main: mode === "light" ? secondaryMain[preset].light : secondaryMain[preset].dark,
      },
      background: {
        default: s.default,
        paper: s.paper,
      },
      surfaceContainer: s.container,
      surfaceVariant: s.variant,
    },
    shape: { borderRadius: 16 },
    typography: {
      fontFamily: '"Roboto", "Segoe UI", system-ui, sans-serif',
    },
  });
}
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build
```
Expected: no TypeScript errors. `surfaceContainer` and `surfaceVariant` resolve correctly.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/theme.ts
git commit -m "feat(theme): add M3 tonal surfaces, secondary palette, shape.borderRadius"
```

---

### Task 3: Typography scale

**Files:**
- Modify: `frontend/src/lib/theme.ts`

- [ ] **Step 1: Add typography overrides inside `createTheme` call in `buildTheme`**

Add `typography` block after `shape`:

```typescript
typography: {
  fontFamily: '"Roboto", "Segoe UI", system-ui, sans-serif',
  h4: {
    fontWeight: 600,
    letterSpacing: "-0.02em",
  },
  h6: {
    fontWeight: 600,
    fontSize: "1rem",
    letterSpacing: "0.01em",
  },
  caption: {
    fontWeight: 500,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    fontSize: "0.7rem",
  },
  body1: {
    fontWeight: 400,
  },
},
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build
```
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/theme.ts
git commit -m "feat(theme): add M3 typography scale (h4/h6/caption)"
```

---

### Task 4: MUI component default overrides

**Files:**
- Modify: `frontend/src/lib/theme.ts`

- [ ] **Step 1: Add `components` key to `createTheme` in `buildTheme`**

Add this block after `typography` inside `createTheme({...})`:

```typescript
components: {
  MuiCard: {
    defaultProps: { elevation: 0 },
    styleOverrides: {
      root: {
        backgroundColor: s.container,
        borderRadius: 20,
        border: `1px solid ${mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
      },
    },
  },
  MuiCardContent: {
    styleOverrides: {
      root: {
        padding: "20px 24px",
        "&:last-child": { paddingBottom: "20px" },
      },
    },
  },
  MuiButton: {
    defaultProps: { disableElevation: true },
    styleOverrides: {
      root: {
        borderRadius: 20,
        textTransform: "none",
        fontWeight: 600,
        paddingLeft: 20,
        paddingRight: 20,
      },
    },
  },
  MuiAlert: {
    styleOverrides: {
      root: { borderRadius: 16 },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: { borderRadius: 8 },
    },
  },
  MuiDialog: {
    styleOverrides: {
      paper: { borderRadius: 20 },
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: { borderRadius: 12 },
    },
  },
},
```

- [ ] **Step 2: Verify build and check for MuiTelInput conflict**

```bash
cd frontend && npm run build
```
Expected: clean build. Then open the app in the browser, navigate to Profile edit mode, and verify the phone input (`MuiTelInput`) renders without clipped borders. If clipped, add to `components`:
```typescript
MuiInputBase: {
  styleOverrides: { root: { borderRadius: 12 } },
},
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/theme.ts
git commit -m "feat(theme): add MUI component overrides for M3 style (cards, buttons, alerts, inputs)"
```

---

## Phase 2 — Shared Components

---

### Task 5: `PageContainer` component

**Files:**
- Create: `frontend/src/components/PageContainer.tsx`

- [ ] **Step 1: Create the component**

```typescript
import React from "react";
import { Container, ContainerProps } from "@mui/material";

interface PageContainerProps {
  children: React.ReactNode;
  maxWidth?: ContainerProps["maxWidth"];
}

export default function PageContainer({ children, maxWidth = "md" }: PageContainerProps) {
  return (
    <Container maxWidth={maxWidth} sx={{ py: { xs: 2, md: 4 } }}>
      {children}
    </Container>
  );
}
```

- [ ] **Step 2: Remove the outer `<Box sx={{ py: 4 }}>` in `App.tsx` since `PageContainer` owns that padding**

In `App.tsx` L299, change:
```typescript
// Before:
<Box sx={{ py: 4 }}>
  <Routes>
    ...
  </Routes>
</Box>

// After:
<Box>
  <Routes>
    ...
  </Routes>
</Box>
```

- [ ] **Step 3: Verify build**

```bash
cd frontend && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/PageContainer.tsx frontend/src/App.tsx
git commit -m "feat(components): add PageContainer with consistent max-width and padding"
```

---

### Task 6: `SectionCard` component

**Files:**
- Create: `frontend/src/components/SectionCard.tsx`

- [ ] **Step 1: Create the component**

```typescript
import React from "react";
import { Box, Card, CardContent, Stack, Typography, useTheme } from "@mui/material";

interface SectionCardProps {
  icon?: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export default function SectionCard({ icon, title, action, children }: SectionCardProps) {
  const theme = useTheme();
  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            {icon && (
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  bgcolor: "surfaceVariant",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "primary.main",
                }}
              >
                {icon}
              </Box>
            )}
            <Typography variant="h6">{title}</Typography>
          </Stack>
          {action && <Box>{action}</Box>}
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build
```
Expected: TypeScript resolves `"surfaceVariant"` from palette augmentation added in Task 2.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/SectionCard.tsx
git commit -m "feat(components): add SectionCard with tonal icon badge and action slot"
```

---

### Task 7: `Field` and `EmptyValue` components

**Files:**
- Create: `frontend/src/components/Field.tsx`

- [ ] **Step 1: Create the component**

```typescript
import React from "react";
import { Box, Typography } from "@mui/material";

export function EmptyValue() {
  return (
    <Typography variant="body2" sx={{ color: "text.disabled", fontStyle: "italic" }}>
      —
    </Typography>
  );
}

interface FieldProps {
  label: string;
  value?: React.ReactNode;
}

export default function Field({ label, value }: FieldProps) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      {value !== null && value !== undefined && value !== "" ? (
        <Typography variant="body1" fontWeight={500}>
          {value}
        </Typography>
      ) : (
        <EmptyValue />
      )}
    </Box>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Field.tsx
git commit -m "feat(components): add Field label/value pair and EmptyValue placeholder"
```

---

### Task 8: `EmptyState` component

**Files:**
- Create: `frontend/src/components/EmptyState.tsx`

- [ ] **Step 1: Create the component**

```typescript
import React from "react";
import { Box, Button, Typography } from "@mui/material";
import InboxIcon from "@mui/icons-material/Inbox";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        py: 8,
        gap: 1.5,
        color: "text.disabled",
      }}
    >
      <Box sx={{ fontSize: 48, lineHeight: 1, color: "text.disabled" }}>
        {icon ?? <InboxIcon sx={{ fontSize: 48 }} />}
      </Box>
      <Typography variant="h6" color="text.secondary" fontWeight={500}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.disabled" textAlign="center">
          {description}
        </Typography>
      )}
      {action && (
        <Button variant="contained" color="secondary" onClick={action.onClick} sx={{ mt: 1 }}>
          {action.label}
        </Button>
      )}
    </Box>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/EmptyState.tsx
git commit -m "feat(components): add EmptyState block placeholder for empty lists"
```

---

### Task 9: `useToast` hook

**Files:**
- Create: `frontend/src/components/useToast.tsx`

- [ ] **Step 1: Create the hook**

```typescript
import React, { useState, useCallback } from "react";
import { Alert, AlertColor, Snackbar } from "@mui/material";

interface ToastState {
  open: boolean;
  message: string;
  severity: AlertColor;
}

interface UseToastReturn {
  show: (message: string, severity?: AlertColor) => void;
  error: (message: string) => void;
  success: (message: string) => void;
  info: (message: string) => void;
  node: React.ReactNode;
}

export default function useToast(): UseToastReturn {
  const [state, setState] = useState<ToastState>({ open: false, message: "", severity: "success" });

  const show = useCallback((message: string, severity: AlertColor = "success") => {
    setState({ open: true, message, severity });
  }, []);

  const error   = useCallback((message: string) => show(message, "error"),   [show]);
  const success = useCallback((message: string) => show(message, "success"), [show]);
  const info    = useCallback((message: string) => show(message, "info"),    [show]);

  const handleClose = () => setState((prev) => ({ ...prev, open: false }));

  const node = (
    <Snackbar
      open={state.open}
      autoHideDuration={4000}
      onClose={handleClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      <Alert
        onClose={handleClose}
        severity={state.severity}
        variant="filled"
        sx={{ width: "100%", borderRadius: 3 }}
      >
        {state.message}
      </Alert>
    </Snackbar>
  );

  return { show, error, success, info, node };
}
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/useToast.tsx
git commit -m "feat(components): add useToast hook with correct severity (error=red, success=green)"
```

---

## Phase 3 — Page Migration

---

### Task 10: Modernize AppBar + Add Mobile Bottom Navigation

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add `BottomNavigation` imports to `App.tsx`**

Add to the MUI import block:
```typescript
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
```

Add icon imports:
```typescript
import HomeIcon from "@mui/icons-material/Home";
import CategoryIcon from "@mui/icons-material/Category";
import EventIcon from "@mui/icons-material/Event";
import GavelIcon from "@mui/icons-material/Gavel";
```

- [ ] **Step 2: Change AppBar from `color="primary"` to tonal surface**

On `App.tsx` L220, change:
```typescript
// Before:
<AppBar position="static" color="primary">

// After:
<AppBar position="static" elevation={0} sx={{ bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider" }}>
```

Update all `color="inherit"` children that relied on white text on primary background. Change icon buttons and Typography to use `color="text.primary"`:

```typescript
// Hamburger icon (L223):
<IconButton color="default" edge="start" onClick={() => setDrawerOpen(true)}>

// App title (L227):
<Typography variant="h6" sx={{ flexGrow: isMobile ? 1 : 0, color: "text.primary" }}>

// Theme toggle icon (L259):
<IconButton
  color="default"
  onClick={() => setThemeMode(themeMode === "light" ? "dark" : "light")}
  ...
>
```

- [ ] **Step 3: Replace outlined active nav button with tonal pill**

Replace the desktop nav `Stack` (L231-244):

```typescript
{!isMobile && (
  <Stack direction="row" spacing={0.5} sx={{ flexGrow: 1, ml: 2, flexWrap: "wrap" }}>
    {navItems.map((item) => (
      <Button
        key={item.path}
        component={RouterLink}
        to={item.path}
        variant={isActive(item.path) ? "contained" : "text"}
        color={isActive(item.path) ? "secondary" : "inherit"}
        sx={{ color: isActive(item.path) ? undefined : "text.primary" }}
      >
        {item.label}
      </Button>
    ))}
  </Stack>
)}
```

- [ ] **Step 4: Add bottom navigation for mobile**

Define bottom nav items after the `navItems` declaration (after L179):

```typescript
const bottomNavItems = [
  { label: t(language, "navProfile"),       path: "/",             icon: <HomeIcon /> },
  { label: t(language, "navModels"),        path: "/models",       icon: <CategoryIcon /> },
  { label: t(language, "navPublicEvents"),  path: "/public-events", icon: <EventIcon /> },
  ...(role && roleAtLeast(role, "judge") ? [{ label: t(language, "navJudge"), path: "/judge", icon: <GavelIcon /> }] : []),
];

const bottomNavValue = bottomNavItems.findIndex((item) =>
  item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path)
);
```

Add the `BottomNavigation` component just before the closing `</Box>` on the outer wrapper (after `</Drawer>` at L298):

```typescript
{isMobile && role && (
  <BottomNavigation
    value={bottomNavValue === -1 ? false : bottomNavValue}
    showLabels
    sx={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: (theme) => theme.zIndex.appBar,
      borderTop: "1px solid",
      borderColor: "divider",
      bgcolor: "background.paper",
    }}
  >
    {bottomNavItems.map((item) => (
      <BottomNavigationAction
        key={item.path}
        label={item.label}
        icon={item.icon}
        component={RouterLink}
        to={item.path}
      />
    ))}
  </BottomNavigation>
)}
```

Add bottom padding to the `<Box>` that wraps `<Routes>` (L299) so content is not hidden behind bottom nav:

```typescript
<Box sx={{ pb: isMobile && role ? "56px" : 0 }}>
  <Routes>
    ...
  </Routes>
</Box>
```

- [ ] **Step 5: Verify build**

```bash
cd frontend && npm run build
```

- [ ] **Step 6: Manual check**

Open the app in a browser. Verify:
- AppBar is no longer solid primary color
- Active desktop nav item has a filled tonal pill background (no white outline)
- On a narrow viewport (<960px), bottom navigation appears with 3-4 icons
- Hamburger drawer still opens and lists all nav items + logout
- Theme and language toggles still work

- [ ] **Step 7: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(nav): modernize AppBar to tonal surface, add M3 active pill, mobile bottom nav"
```

---

### Task 11: Migrate `Profile.tsx`

**Files:**
- Modify: `frontend/src/pages/Profile.tsx`

- [ ] **Step 1: Replace imports**

```typescript
import React, { useEffect, useState } from "react";
import { Button, Chip, Grid, Stack, Typography } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import PersonIcon from "@mui/icons-material/Person";
import PhoneIcon from "@mui/icons-material/Phone";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import { matchIsValidTel } from "mui-tel-input";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";
import ProfileEditSections from "../components/ProfileEditSections";
import PageContainer from "../components/PageContainer";
import SectionCard from "../components/SectionCard";
import Field, { EmptyValue } from "../components/Field";
import useToast from "../components/useToast";
```

- [ ] **Step 2: Replace state and handlers**

Remove `const [message, setMessage] = useState("")` and replace with:

```typescript
const toast = useToast();
```

Update `load()`:
```typescript
async function load() {
  try {
    const res = await api<Profile>("/users/profile");
    setProfile(res ?? {});
  } catch (err: any) {
    toast.error(err.message);
  }
}
```

Update `save()` — replace `setMessage(t(language, "profileSaved"))` with `toast.success(t(language, "profileSaved"))`:
```typescript
async function save() {
  if (editProfile.phone && !matchIsValidTel(editProfile.phone)) {
    setPhoneError(true);
    return;
  }
  if (editProfile.emergencyContact && !matchIsValidTel(editProfile.emergencyContact)) {
    setEmergencyPhoneError(true);
    return;
  }
  try {
    const { email, role, ...body } = editProfile;
    await api("/users/profile", { method: "PUT", body: JSON.stringify(body) });
    toast.success(t(language, "profileSaved"));
    setProfile(editProfile);
    setEditing(false);
  } catch (err: any) {
    toast.error(err.message);
  }
}
```

Remove `const fieldValue = ...` line (L84).

- [ ] **Step 3: Replace view mode JSX**

Replace the `if (!editing)` return block:

```typescript
if (!editing) {
  return (
    <PageContainer>
      {toast.node}
      <Stack spacing={3}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h4">{t(language, "profileTitle")}</Typography>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<EditIcon />}
            onClick={startEdit}
          >
            {t(language, "profileEditButton")}
          </Button>
        </Stack>

        <SectionCard icon={<PersonIcon />} title={t(language, "profilePersonalSection")}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Field label={t(language, "profileFirstName")} value={profile.firstName} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Field label={t(language, "profileLastName")} value={profile.lastName} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Field label="Email" value={profile.email} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Field
                label={t(language, "profileRole")}
                value={
                  profile.role
                    ? <Chip label={profile.role} size="small" color="primary" variant="outlined" />
                    : <EmptyValue />
                }
              />
            </Grid>
          </Grid>
        </SectionCard>

        <SectionCard icon={<PhoneIcon />} title={t(language, "profileContactSection")}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Field label={t(language, "profilePhone")} value={profile.phone} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Field
                label={t(language, "profileEmergencyContact")}
                value={
                  profile.emergencyContactName
                    ? `${profile.emergencyContactName} — ${profile.emergencyContact ?? ""}`
                    : profile.emergencyContact ?? undefined
                }
              />
            </Grid>
          </Grid>
        </SectionCard>

        <SectionCard icon={<LocationOnIcon />} title={t(language, "profileAddressSection")}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Field label={t(language, "profileCity")} value={profile.city} />
            </Grid>
          </Grid>
        </SectionCard>
      </Stack>
    </PageContainer>
  );
}
```

- [ ] **Step 4: Replace edit mode JSX — wrap in `PageContainer`, add `toast.node`**

```typescript
return (
  <PageContainer>
    {toast.node}
    <Stack spacing={3}>
      <Typography variant="h4">{t(language, "profileTitle")}</Typography>
      <ProfileEditSections
        language={language}
        value={editProfile}
        onChange={(next) => setEditProfile(next)}
        phoneError={phoneError}
        emergencyPhoneError={emergencyPhoneError}
        onPhoneErrorChange={setPhoneError}
        onEmergencyPhoneErrorChange={setEmergencyPhoneError}
        showIdentityFields
      />
      <Stack direction="row" spacing={2}>
        <Button variant="contained" onClick={save}>
          {t(language, "profileSaveButton")}
        </Button>
        <Button variant="outlined" onClick={cancelEdit}>
          {t(language, "profileCancelButton")}
        </Button>
      </Stack>
    </Stack>
  </PageContainer>
);
```

- [ ] **Step 5: Verify build**

```bash
cd frontend && npm run build
```

- [ ] **Step 6: Manual check**

Open Profile page. Verify: tonal cards, no `—` for empty fields, edit button is filled tonal. Trigger a save — success shows green toast. Break connectivity (stop backend) — load shows red toast.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Profile.tsx
git commit -m "feat(profile): migrate to PageContainer, SectionCard, Field, useToast"
```

---

### Task 12: Migrate `PublicEvents.tsx`

**Files:**
- Modify: `frontend/src/pages/PublicEvents.tsx`

- [ ] **Step 1: Read the file to understand its current structure**

Key patterns to find: `Container maxWidth`, `Alert severity="info"`, empty state handling, main action buttons.

- [ ] **Step 2: Update imports**

Add:
```typescript
import PageContainer from "../components/PageContainer";
import EmptyState from "../components/EmptyState";
import useToast from "../components/useToast";
```
Remove: `Container`, `Alert` from MUI imports (if no longer needed after migration).

- [ ] **Step 3: Replace `useState` message pattern with `useToast`**

Find all `const [message, setMessage]` — remove. Add `const toast = useToast();`.
Replace `.catch(err => setMessage(err.message))` → `.catch(err => toast.error(err.message))`.
Replace success `setMessage(...)` → `toast.success(...)`.

- [ ] **Step 4: Replace `Container` with `PageContainer`**

Wrap the top-level return in `<PageContainer>...</PageContainer>` and remove `<Container maxWidth="...">`.
Add `{toast.node}` as first child.

- [ ] **Step 5: Replace empty list `—` with `EmptyState`**

Find the conditional rendering for when the event list is empty (currently renders `—`). Replace with:
```typescript
{events.length === 0 && (
  <EmptyState
    title={t(language, "noEvents")}
    description={t(language, "noEventsDescription")}
  />
)}
```
If `noEvents`/`noEventsDescription` keys don't exist in `i18n.ts`, use the literal Italian strings: `"Nessun evento"` / `"Non ci sono eventi pubblici al momento."`.

- [ ] **Step 6: Change Refresh button to tonal**

Find `<Button variant="outlined" ...>` for the refresh action. Change to `variant="contained" color="secondary"`.

- [ ] **Step 7: Verify build and commit**

```bash
cd frontend && npm run build
git add frontend/src/pages/PublicEvents.tsx
git commit -m "feat(public-events): migrate to PageContainer, EmptyState, useToast"
```

---

### Task 13: Migrate `Login.tsx`

**Files:**
- Modify: `frontend/src/pages/Login.tsx`

- [ ] **Step 1: Update imports**

Add: `import PageContainer from "../components/PageContainer";`, `import useToast from "../components/useToast";`
Add: `import SectionCard from "../components/SectionCard";`
Remove: `Container` from MUI imports.

- [ ] **Step 2: Replace message state with `useToast`**

Find `const [message, setMessage]`. Remove. Add `const toast = useToast();`.
Replace login error `.catch(err => setMessage(err.message))` → `.catch(err => toast.error(err.message))`.

- [ ] **Step 3: Replace layout**

Find top-level `return (` and wrap content in `<PageContainer maxWidth="sm">`. Add `{toast.node}`. Remove `<Container>` wrapper. Wrap the form card in `<SectionCard title="Miniatures Contest">` (no icon).

- [ ] **Step 4: Change submit button to `variant="contained"`**

Find the submit `<Button>` — ensure it has `variant="contained"` (not outlined).

- [ ] **Step 5: Remove existing `Alert` for message if present**

Remove any `{message && <Alert ...>}` block — replaced by toast.

- [ ] **Step 6: Verify build and commit**

```bash
cd frontend && npm run build
git add frontend/src/pages/Login.tsx
git commit -m "feat(login): migrate to PageContainer, SectionCard, useToast"
```

---

### Task 14: Migrate `Models.tsx`

**Files:**
- Modify: `frontend/src/pages/Models.tsx`

- [ ] **Step 1: Update imports**

Add: `PageContainer`, `SectionCard`, `EmptyState`, `useToast`.

- [ ] **Step 2: Replace message state with `useToast`**

Remove `const [message, setMessage]`. Add `const toast = useToast();`.
For ALL error paths (`.catch(err => setMessage(err.message))`): replace with `toast.error(err.message)`.
For ALL success paths (`setMessage(t(language, ...))` after successful API calls): replace with `toast.success(t(language, ...))`.

- [ ] **Step 3: Replace `Container` with `PageContainer`**

Change `<Container maxWidth="lg">` → `<PageContainer maxWidth="lg">`. Add `{toast.node}`.

- [ ] **Step 4: Replace empty list with `EmptyState`**

Find the conditional for empty models list. Replace with:
```typescript
{models.length === 0 && (
  <EmptyState
    title={t(language, "noModels")}
    icon={<CategoryIcon sx={{ fontSize: 48 }} />}
    action={{ label: t(language, "addModel"), onClick: () => setDialogOpen(true) }}
  />
)}
```
Use the actual i18n keys from `i18n.ts`; if missing, use Italian literals.

- [ ] **Step 5: Wrap list section in `SectionCard`**

Wrap the models list in `<SectionCard title={t(language, "myModels")}>`.

- [ ] **Step 6: Update primary action button**

Find the "Add model" / create button — change to `variant="contained"`.

- [ ] **Step 7: Remove existing `Alert` blocks**

Remove `{message && <Alert severity="info" ...>}` — replaced by toast.

- [ ] **Step 8: Verify build and commit**

```bash
cd frontend && npm run build
git add frontend/src/pages/Models.tsx
git commit -m "feat(models): migrate to PageContainer, SectionCard, EmptyState, useToast"
```

---

### Task 15: Migrate `Enrollments.tsx`

**Files:**
- Modify: `frontend/src/pages/Enrollments.tsx`

- [ ] **Step 1: Update imports**

Add: `PageContainer`, `SectionCard`, `EmptyState`, `useToast`.

- [ ] **Step 2: Replace message state with `useToast`**

Remove `const [message, setMessage]`. Add `const toast = useToast();`.
All `.catch(err => setMessage(err.message))` → `toast.error(err.message)`.
All success `setMessage(...)` → `toast.success(...)`.

- [ ] **Step 3: Replace layout**

`<Container maxWidth="lg">` → `<PageContainer maxWidth="lg">`. Add `{toast.node}`.

- [ ] **Step 4: Add `EmptyState` for empty enrollment lists**

```typescript
{enrollments.length === 0 && (
  <EmptyState title="Nessuna iscrizione" />
)}
```

- [ ] **Step 5: Remove `Alert` message block**

Remove `{message && <Alert severity="info" ...>}`.

- [ ] **Step 6: Verify build and commit**

```bash
cd frontend && npm run build
git add frontend/src/pages/Enrollments.tsx
git commit -m "feat(enrollments): migrate to PageContainer, EmptyState, useToast"
```

---

### Task 16: Migrate `Judge.tsx`

**Files:**
- Modify: `frontend/src/pages/Judge.tsx`

- [ ] **Step 1: Update imports**

Add: `PageContainer`, `SectionCard`, `EmptyState`, `useToast`.

- [ ] **Step 2: Replace existing message/severity state with `useToast`**

Judge already has a `messageSeverity` state. Remove both `message` and `messageSeverity` states. Add `const toast = useToast();`.
Replace `setMessage("...", "success")` pattern → `toast.success("...")`.
Replace `setMessage("...", "error")` pattern → `toast.error("...")`.

- [ ] **Step 3: Replace layout**

`<Container ...>` → `<PageContainer maxWidth="lg">`. Add `{toast.node}`.

- [ ] **Step 4: Add `EmptyState` for no assigned models**

Find the conditional for empty model list. Add:
```typescript
{models.length === 0 && (
  <EmptyState
    title={t(language, "noModelsToJudge")}
    icon={<GavelIcon sx={{ fontSize: 48 }} />}
  />
)}
```

- [ ] **Step 5: Remove existing `Alert` block**

Remove `{message && <Alert severity={messageSeverity} ...>}`.

- [ ] **Step 6: Verify build and commit**

```bash
cd frontend && npm run build
git add frontend/src/pages/Judge.tsx
git commit -m "feat(judge): migrate to PageContainer, EmptyState, useToast"
```

---

### Task 17: Migrate `Users.tsx`

**Files:**
- Modify: `frontend/src/pages/Users.tsx`

- [ ] **Step 1: Update imports**

Add: `PageContainer`, `SectionCard`, `EmptyState`, `useToast`.

- [ ] **Step 2: Replace message state with `useToast`**

Remove `const [message, setMessage]`. Add `const toast = useToast();`.
All error paths → `toast.error(...)`. All success paths → `toast.success(...)`.

- [ ] **Step 3: Replace layout**

`<Container maxWidth="md">` → `<PageContainer>`. Add `{toast.node}`.

- [ ] **Step 4: Empty user list**

```typescript
{users.length === 0 && (
  <EmptyState title="Nessun utente" />
)}
```

- [ ] **Step 5: Remove `Alert` block. Verify build and commit**

```bash
cd frontend && npm run build
git add frontend/src/pages/Users.tsx
git commit -m "feat(users): migrate to PageContainer, EmptyState, useToast"
```

---

### Task 18: Migrate `Admin.tsx`

**Files:**
- Modify: `frontend/src/pages/Admin.tsx`

- [ ] **Step 1: Update imports**

Add: `PageContainer`, `SectionCard`, `EmptyState`, `useToast`, `Field`, `{ EmptyValue }`.

- [ ] **Step 2: Replace message state with `useToast`**

Remove `const [message, setMessage]`. Add `const toast = useToast();`.
All error paths → `toast.error(...)`. All success paths → `toast.success(...)`.

- [ ] **Step 3: Replace layout**

`<Container maxWidth="lg">` → `<PageContainer maxWidth="lg">`. Add `{toast.node}`.

- [ ] **Step 4: Replace `?? "—"` in category date secondary text**

Find the category list secondary text that renders `?? "—"`. Replace with:
```typescript
secondary={category.date ?? <EmptyValue />}
```

- [ ] **Step 5: Wrap Levels, Member Roles, Categories, Judges sections in `SectionCard`**

For each management section in Admin, wrap with:
```typescript
<SectionCard title="Levels">
  {/* existing section content */}
</SectionCard>
```
Use appropriate titles from the existing section headings.

- [ ] **Step 6: Remove `Alert` block. Verify build and commit**

```bash
cd frontend && npm run build
git add frontend/src/pages/Admin.tsx
git commit -m "feat(admin): migrate to PageContainer, SectionCard, EmptyValue, useToast"
```

---

### Task 19: Migrate `Labels.tsx`

**Files:**
- Modify: `frontend/src/pages/Labels.tsx`

- [ ] **Step 1: Update imports**

Add: `PageContainer`, `SectionCard`, `useToast`.

- [ ] **Step 2: Replace message state with `useToast`**

Remove `const [message, setMessage]`. Add `const toast = useToast();`.
All error paths → `toast.error(...)`. All success paths → `toast.success(...)`.

- [ ] **Step 3: Replace layout, wrap panels in `SectionCard`**

`<Container maxWidth="md">` → `<PageContainer>`. Add `{toast.node}`. Wrap export panel and print panel in `SectionCard`.

- [ ] **Step 4: Change primary action buttons to tonal. Remove `Alert` block. Verify build and commit**

```bash
cd frontend && npm run build
git add frontend/src/pages/Labels.tsx
git commit -m "feat(labels): migrate to PageContainer, SectionCard, useToast"
```

---

### Task 20: Migrate `Settings.tsx`

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`

- [ ] **Step 1: Update imports**

Add: `PageContainer`, `SectionCard`, `useToast`.

- [ ] **Step 2: Replace message state with `useToast`**

Remove `const [message, setMessage]`. Add `const toast = useToast();`.
ALL 6+ error/success paths → appropriate `toast.error(...)` / `toast.success(...)`.

- [ ] **Step 3: Replace layout, wrap settings groups in `SectionCard`**

`<Container maxWidth="md">` → `<PageContainer>`. Add `{toast.node}`.
Wrap theme settings, language settings, and general settings in separate `SectionCard` components.

Verify `window.dispatchEvent(new Event("theme-settings-updated"))` still fires on save (don't remove it — App.tsx listens to this).

- [ ] **Step 4: Change save button to `variant="contained"`. Remove `Alert` block. Verify build and commit**

```bash
cd frontend && npm run build
git add frontend/src/pages/Settings.tsx
git commit -m "feat(settings): migrate to PageContainer, SectionCard, useToast"
```

---

### Task 21: Migrate `StaffCheckin.tsx`

**Files:**
- Modify: `frontend/src/pages/StaffCheckin.tsx`

- [ ] **Step 1: Update imports**

Add: `PageContainer`, `SectionCard`, `useToast`.

- [ ] **Step 2: Replace message state with `useToast`**

Remove `const [message, setMessage]`. Add `const toast = useToast();`.
Scan success → `toast.success(...)`. Scan failure → `toast.error(...)`.

- [ ] **Step 3: Replace layout**

`<Container maxWidth="md">` → `<PageContainer>`. Add `{toast.node}`.
Wrap scan panel in `<SectionCard title={t(language, "staffCheckin")}>`.

- [ ] **Step 4: Change primary action button to large tonal**

Find main action button. Change to:
```typescript
<Button variant="contained" color="primary" size="large" ...>
```

- [ ] **Step 5: Remove `Alert` block. Verify build and commit**

```bash
cd frontend && npm run build
git add frontend/src/pages/StaffCheckin.tsx
git commit -m "feat(staff-checkin): migrate to PageContainer, SectionCard, useToast"
```

---

### Task 22: Update `ProfileEditSections.tsx`

**Files:**
- Modify: `frontend/src/components/ProfileEditSections.tsx`

- [ ] **Step 1: Replace `Card`/`CardContent` section wrappers with `SectionCard`**

Read the file to identify the `<Card><CardContent>` blocks with icon+title headers. Import and replace with `<SectionCard icon={...} title={...}>`.

- [ ] **Step 2: Verify build and commit**

```bash
cd frontend && npm run build
git add frontend/src/components/ProfileEditSections.tsx
git commit -m "feat(profile-edit): use SectionCard in ProfileEditSections"
```

---

## Final Verification

- [ ] **Build passes cleanly**

```bash
cd frontend && npm run build
```

- [ ] **Manual regression check — all 3 presets × 2 modes**

Open the app, go to Settings, cycle through: violet dark, violet light, ocean dark, ocean light, forest dark, forest light. Each should show a coherent tonal surface palette.

- [ ] **Toast severity check**

On Profile page: disconnect backend, reload — should show red error toast. Reconnect, save profile — should show green success toast.

- [ ] **Mobile check**

Narrow browser to <960px. Verify bottom navigation appears with correct active highlight. Verify content is not occluded behind bottom nav.

- [ ] **Empty state check**

Log in with a user with no models. Go to Models page — should show `EmptyState` with icon, not `—`.
