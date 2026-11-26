import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  CssBaseline,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Select,
  Stack,
  ThemeProvider,
  Toolbar,
  Typography,
  useMediaQuery
} from "@mui/material";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import MenuIcon from "@mui/icons-material/Menu";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonIcon from "@mui/icons-material/Person";
import HomeIcon from "@mui/icons-material/Home";
import EventIcon from "@mui/icons-material/Event";
import GavelIcon from "@mui/icons-material/Gavel";
import AssignmentIcon from "@mui/icons-material/Assignment";
import BarChartIcon from "@mui/icons-material/BarChart";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import PeopleIcon from "@mui/icons-material/People";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import ViewInArIcon from "@mui/icons-material/ViewInAr";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import SettingsIcon from "@mui/icons-material/Settings";
import Login from "./pages/Login";
const Judge = lazy(() => import("./pages/Judge"));
const Profile = lazy(() => import("./pages/Profile"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Enrollments = lazy(() => import("./pages/Enrollments"));
const StaffCheckin = lazy(() => import("./pages/StaffCheckin"));
const Models = lazy(() => import("./pages/Models"));
const Teams = lazy(() => import("./pages/Teams"));
const PublicEvents = lazy(() => import("./pages/PublicEvents"));
const Admin = lazy(() => import("./pages/Admin"));
const Users = lazy(() => import("./pages/Users"));
const Settings = lazy(() => import("./pages/Settings"));
const Labels = lazy(() => import("./pages/Labels"));
const Stats = lazy(() => import("./pages/Stats"));
const Podium = lazy(() => import("./pages/Podium"));
import PageSkeleton from "./components/PageSkeleton";
import SideNav from "./components/SideNav";
import { api, API_BASE, AUTH_LOGOUT_EVENT, AuthLogoutDetail } from "./lib/api";
import { getToken, getRole, roleAtLeast, clearToken, decodeJwt, Role } from "./lib/auth";
import { Language, t } from "./lib/i18n";
import { buildTheme, DEFAULT_THEME_PRESET, isThemePreset, ThemePreset } from "./lib/theme";

function Protected({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />;
}
function RequireRole({ min, children }: { min: any; children: React.ReactNode }) {
  const r = getRole();
  if (!r) return <Navigate to="/login" replace />;
  return roleAtLeast(r, min) ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  const [themeMode, setThemeMode] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return (window.localStorage.getItem("theme") as "light" | "dark") || "light";
  });
  const [themePreset, setThemePreset] = useState<ThemePreset>(() => {
    if (typeof window === "undefined") return DEFAULT_THEME_PRESET;
    const stored = window.localStorage.getItem("themePreset");
    return isThemePreset(stored) ? stored : DEFAULT_THEME_PRESET;
  });
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === "undefined") return "it";
    return (window.localStorage.getItem("language") as Language) || "it";
  });
  const [appName, setAppName] = useState("Miniatures Contest");
  const [backendDown, setBackendDown] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [avatarMenuAnchor, setAvatarMenuAnchor] = useState<null | HTMLElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Session expiry (api.ts) and manual logout: client-side navigation, no full reload.
  const endSession = useCallback(() => {
    clearToken();
    setAvatarMenuAnchor(null);
    setDrawerOpen(false);
    navigate("/login", { replace: true });
  }, [navigate]);

  useEffect(() => {
    const onLogout = (event: Event) => {
      const detail = (event as CustomEvent<AuthLogoutDetail>).detail;
      if (detail) detail.handled = true;
      endSession();
    };
    window.addEventListener(AUTH_LOGOUT_EVENT, onLogout);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, onLogout);
  }, [endSession]);

  useEffect(() => {
    window.localStorage.setItem("theme", themeMode);
  }, [themeMode]);

  useEffect(() => {
    window.localStorage.setItem("themePreset", themePreset);
  }, [themePreset]);

  useEffect(() => {
    window.localStorage.setItem("language", language);
  }, [language]);

  useEffect(() => {
    if (!getToken()) return;

    const applyThemeFromStorage = () => {
      const storedMode = window.localStorage.getItem("theme");
      const storedPreset = window.localStorage.getItem("themePreset");
      if (storedMode === "light" || storedMode === "dark") setThemeMode(storedMode);
      if (isThemePreset(storedPreset)) {
        setThemePreset(storedPreset);
      }
    };

    fetch(API_BASE + "/health").catch(() => setBackendDown(true));

    api<Record<string, string>>("/settings")
      .then((settings) => {
        if (settings.appTheme === "light" || settings.appTheme === "dark") {
          setThemeMode(settings.appTheme);
          window.localStorage.setItem("theme", settings.appTheme);
        }
        if (isThemePreset(settings.themePreset)) {
          setThemePreset(settings.themePreset);
          window.localStorage.setItem("themePreset", settings.themePreset);
        }
        if (settings.app_name) {
          setAppName(settings.app_name);
        }
      })
      .catch(() => {
        applyThemeFromStorage();
      });

    window.addEventListener("theme-settings-updated", applyThemeFromStorage);
    return () => window.removeEventListener("theme-settings-updated", applyThemeFromStorage);
  }, []);

  const labels = {
    themeToggle: t(language, "themeToggle"),
    themeLight: t(language, "themeLight"),
    themeDark: t(language, "themeDark"),
    languageToggle: t(language, "languageToggle")
  };

  const muiTheme = useMemo(() => buildTheme(themeMode, themePreset), [themeMode, themePreset]);

  const isMobile = useMediaQuery(muiTheme.breakpoints.down("md"));

  const role = getRole();

  // null = unknown (loading or endpoint unavailable): fall back to the role-based behaviour.
  const [sections, setSections] = useState<string[] | null>(null);
  useEffect(() => {
    setSections(null);
    if (!role) return;
    let cancelled = false;
    api<{ sections?: string[] }>("/settings/section-visibility")
      .then((res) => { if (!cancelled && Array.isArray(res?.sections)) setSections(res.sections); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [role]);
  const sectionVisible = (section: string | null) =>
    !section || sections === null || role === "admin" || sections.includes(section);
  const guard = (section: string, element: React.ReactNode) =>
    sectionVisible(section) ? element : <Navigate to="/" replace />;

  const userInitial = (() => {
    const token = getToken();
    if (!token) return "?";
    try {
      const payload = decodeJwt(token);
      const email = payload.email as string | undefined;
      return email ? email[0].toUpperCase() : "?";
    } catch { return "?"; }
  })();

  const handleLogout = endSession;

  // `section` is matched against the backend visibility matrix; role minimums always apply too.
  const allNavItems = [
    { label: t(language, "navHome"), path: "/", minRole: "user" as Role, section: null, icon: <HomeIcon /> },
    { label: t(language, "navModels"), path: "/models", minRole: "user" as Role, section: "models", icon: <ViewInArIcon /> },
    { label: t(language, "navEnrollments"), path: "/enrollments", minRole: "user" as Role, section: "enrollments", icon: <AssignmentIcon /> },
    { label: t(language, "navPublicEvents"), path: "/public-events", minRole: null, section: null, icon: <EventIcon /> },
    { label: t(language, "navCheckin"), path: "/staff-checkin", minRole: "staff" as Role, section: "checkin", icon: <HowToRegIcon /> },
    { label: t(language, "navJudge"), path: "/judge", minRole: "judge" as Role, section: "judge", icon: <GavelIcon /> },
    { label: t(language, "navUsers"), path: "/users", minRole: "manager" as Role, section: "users", icon: <PeopleIcon /> },
    { label: t(language, "navAdmin"), path: "/admin", minRole: "manager" as Role, section: "admin", icon: <AdminPanelSettingsIcon /> },
    { label: t(language, "navLabels"), path: "/labels", minRole: "manager" as Role, section: "labels", icon: <LocalOfferIcon /> },
    { label: t(language, "navStats"), path: "/stats", minRole: "jury_president" as Role, section: "stats", icon: <BarChartIcon /> },
    { label: t(language, "navAwards"), path: "/podium", minRole: "manager" as Role, section: "podium", icon: <EmojiEventsIcon /> },
    { label: t(language, "navSettings"), path: "/settings", minRole: "admin" as Role, section: "settings", icon: <SettingsIcon /> }
  ];

  const navItems = allNavItems.filter((item) => {
    if (!item.minRole) return true; // public pages always visible
    if (!role) return false; // no role = not logged in, hide protected
    return roleAtLeast(role, item.minRole) && sectionVisible(item.section);
  });

  // Mobile bar: at most five destinations, by role.
  const bottomNavPaths =
    role && roleAtLeast(role, "manager")
      ? ["/", "/models", "/judge", "/users", "/admin"]
      : role === "jury_president"
        ? ["/", "/judge", "/stats", "/models", "/enrollments"]
        : ["/", "/models", "/enrollments", role === "staff" ? "/staff-checkin" : "/judge", "/public-events"];
  const bottomNavItems = bottomNavPaths.flatMap((path) => navItems.filter((item) => item.path === path));

  const bottomNavValue = bottomNavItems.findIndex((item) =>
    item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path)
  );

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const drawerContent = (
    <Box sx={{ width: 280 }} role="presentation" onClick={() => setDrawerOpen(false)}>
      <Typography variant="h6" sx={{ px: 2, py: 2 }}>
        {appName}
      </Typography>
      <Divider />
      <List>
        {navItems.map((item) => (
          <ListItemButton
            key={item.path}
            component={RouterLink}
            to={item.path}
            selected={isActive(item.path)}
            aria-current={isActive(item.path) ? "page" : undefined}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
        {role && (
          <>
            <Divider />
            <ListItemButton onClick={handleLogout}>
              <ListItemIcon><LogoutIcon /></ListItemIcon>
              <ListItemText primary={t(language, "logoutButton")} />
            </ListItemButton>
          </>
        )}
      </List>
    </Box>
  );

  if (backendDown) {
    return (
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        <Box sx={{ minHeight: "100vh", bgcolor: "background.default", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 2, p: 4 }}>
          <Typography variant="h4" sx={{ color: "error.main" }}>⚠ {t(language, "maintenanceTitle")}</Typography>
          <Typography variant="body1" color="text.secondary" textAlign="center">{t(language, "maintenanceSubtitle")}</Typography>
          <Button variant="outlined" onClick={() => { setBackendDown(false); window.location.reload(); }}>{t(language, "retryButton")}</Button>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", display: "flex", flexDirection: "column" }}>
        <AppBar position="static" elevation={0} sx={{ bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider" }}>
          <Toolbar sx={{ gap: 2 }}>
            {isMobile && (
              <IconButton color="default" edge="start" aria-label={t(language, "navOpenMenu")} onClick={() => setDrawerOpen(true)}>
                <MenuIcon />
              </IconButton>
            )}
            <Typography variant="h6" sx={{ flexGrow: 1, color: "text.primary" }}>
              {appName}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Select
                size="small"
                value={language}
                onChange={(event) => setLanguage(event.target.value as Language)}
                renderValue={(val) => val === "it" ? "🇮🇹" : "🇬🇧"}
                sx={{ bgcolor: "background.paper", borderRadius: 1, minWidth: 52 }}
              >
                <MenuItem value="it">🇮🇹 Italiano</MenuItem>
                <MenuItem value="en">🇬🇧 English</MenuItem>
              </Select>
              <IconButton
                color="default"
                onClick={() => setThemeMode(themeMode === "light" ? "dark" : "light")}
                aria-label={`${labels.themeToggle}: ${themeMode === "light" ? labels.themeDark : labels.themeLight}`}
                title={`${labels.themeToggle}: ${themeMode === "light" ? labels.themeDark : labels.themeLight}`}
              >
                {themeMode === "light" ? <Brightness4Icon /> : <Brightness7Icon />}
              </IconButton>
              {role && (
                <>
                  <IconButton aria-label={t(language, "navProfile")} onClick={(e) => setAvatarMenuAnchor(e.currentTarget)} sx={{ p: 0 }}>
                    <Avatar sx={{ width: 36, height: 36, bgcolor: "secondary.main", fontSize: 16 }}>
                      {userInitial}
                    </Avatar>
                  </IconButton>
                  <Menu
                    anchorEl={avatarMenuAnchor}
                    open={Boolean(avatarMenuAnchor)}
                    onClose={() => setAvatarMenuAnchor(null)}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                    transformOrigin={{ vertical: "top", horizontal: "right" }}
                  >
                    <MenuItem component={RouterLink} to="/profile" onClick={() => setAvatarMenuAnchor(null)}>
                      <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
                      {t(language, "navProfile")}
                    </MenuItem>
                    <Divider />
                    <MenuItem onClick={handleLogout}>
                      <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                      {t(language, "logoutButton")}
                    </MenuItem>
                  </Menu>
                </>
              )}
            </Stack>
          </Toolbar>
        </AppBar>
        <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
          {drawerContent}
        </Drawer>
        <Box sx={{ display: "flex", flexGrow: 1 }}>
        <Box sx={{ flexGrow: 1, minWidth: 0, pb: isMobile && role ? "56px" : 0 }}>
          <Suspense fallback={<PageSkeleton variant="table" />}>
          <Routes>
            <Route
              path="/login"
              element={(
                <Login
                  language={language}
                />
              )}
            />
            <Route path="/" element={<Protected><Dashboard language={language} /></Protected>} />
            <Route path="/profile" element={<Protected><Profile language={language} /></Protected>} />
            <Route path="/models" element={<Protected>{guard("models", <Models language={language} />)}</Protected>} />
            <Route path="/enrollments" element={<Protected>{guard("enrollments", <Enrollments language={language} />)}</Protected>} />
            <Route path="/staff-checkin" element={<Protected><RequireRole min="staff">{guard("checkin", <StaffCheckin language={language} />)}</RequireRole></Protected>} />
            <Route path="/teams" element={<Protected><Teams language={language} /></Protected>} />
            <Route path="/public-events" element={<PublicEvents language={language} />} />
            <Route path="/judge" element={<Protected><RequireRole min="judge">{guard("judge", <Judge language={language} />)}</RequireRole></Protected>} />
            <Route path="/users" element={<Protected><RequireRole min="manager">{guard("users", <Users language={language} />)}</RequireRole></Protected>} />
            <Route path="/admin" element={<Protected><RequireRole min="manager">{guard("admin", <Admin language={language} />)}</RequireRole></Protected>} />
            <Route path="/labels" element={<Protected><RequireRole min="manager">{guard("labels", <Labels language={language} />)}</RequireRole></Protected>} />
            <Route path="/stats" element={<Protected><RequireRole min="jury_president">{guard("stats", <Stats language={language} />)}</RequireRole></Protected>} />
            <Route path="/podium" element={<Protected><RequireRole min="manager">{guard("podium", <Podium language={language} />)}</RequireRole></Protected>} />
            <Route path="/settings" element={<Protected><RequireRole min="admin">{guard("settings", <Settings language={language} />)}</RequireRole></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </Box>
        {!isMobile && <SideNav items={navItems} isActive={isActive} language={language} />}
        </Box>
        {isMobile && role && (
          <BottomNavigation
            value={bottomNavValue === -1 ? false : bottomNavValue}
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
      </Box>
    </ThemeProvider>
  );
}
