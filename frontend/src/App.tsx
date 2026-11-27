import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import {
  AppBar,
  Avatar,
  Box,
  CssBaseline,
  Divider,
  Drawer,
  FormControl,
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
  Tooltip,
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
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import PrivacyTipIcon from "@mui/icons-material/PrivacyTip";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import ReplayIcon from "@mui/icons-material/Replay";
import ShareIcon from "@mui/icons-material/Share";
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
const Help = lazy(() => import("./pages/Help"));
const Privacy = lazy(() => import("./pages/Privacy"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Socials = lazy(() => import("./pages/Socials"));
import PageSkeleton from "./components/PageSkeleton";
import SideNav from "./components/SideNav";
import { ActionButton, TipIconButton, TipMenuItem } from "./components/ActionButton";
import AppLogo from "./components/AppLogo";
import FlagIcon from "./components/FlagIcon";
import LoginIcon from "@mui/icons-material/Login";
import usePageTour from "./components/usePageTour";
import { Access, AccessContext, NO_ACCESS } from "./lib/access";
import { api, API_BASE, AUTH_LOGOUT_EVENT, AuthLogoutDetail } from "./lib/api";
import { getToken, getRole, roleAtLeast, roleReaches, clearToken, decodeJwt, Role } from "./lib/auth";
import { Language, LANGUAGES, isLanguage, languageFromBrowser, t } from "./lib/i18n";
import { buildTheme, DEFAULT_THEME_PRESET, isThemePreset, ThemePreset } from "./lib/theme";
import { loginPathFor } from "./lib/redirect";

function Protected({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return getToken() ? <>{children}</> : <Navigate to={loginPathFor(location.pathname, location.search)} replace />;
}
function RequireRole({ min, children }: { min: any; children: React.ReactNode }) {
  const location = useLocation();
  const r = getRole();
  if (!r) return <Navigate to={loginPathFor(location.pathname, location.search)} replace />;
  return roleReaches(r, min) ? <>{children}</> : <Navigate to="/" replace />;
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
    const stored = window.localStorage.getItem("language");
    if (isLanguage(stored)) return stored;
    // First visit: the browser language if supported (it, en, es, fr, de), otherwise English.
    return languageFromBrowser(window.navigator.language);
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
    document.documentElement.lang = language;
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
  const [access, setAccess] = useState<Access>(NO_ACCESS);
  useEffect(() => {
    setAccess(NO_ACCESS);
    if (!role) return;
    let cancelled = false;
    api<{ sections?: string[]; permissions?: string[] }>("/settings/section-visibility")
      .then((res) => {
        if (cancelled) return;
        setAccess({
          sections: Array.isArray(res?.sections) ? res.sections : null,
          permissions: Array.isArray(res?.permissions) ? res.permissions : []
        });
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [role]);
  const { sections } = access;
  const tourContext = useMemo(() => ({ role, ...access }), [role, access]);
  const tour = usePageTour(language, tourContext);
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
    { label: t(language, "navSocials"), path: "/socials", minRole: null, section: null, icon: <ShareIcon /> },
    { label: t(language, "navCheckin"), path: "/staff-checkin", minRole: "staff" as Role, section: "checkin", icon: <HowToRegIcon /> },
    { label: t(language, "navJudge"), path: "/judge", minRole: "judge" as Role, section: "judge", icon: <GavelIcon /> },
    { label: t(language, "navUsers"), path: "/users", minRole: "manager" as Role, section: "users", icon: <PeopleIcon /> },
    { label: t(language, "navAdmin"), path: "/admin", minRole: "manager" as Role, section: "admin", icon: <AdminPanelSettingsIcon /> },
    { label: t(language, "navLabels"), path: "/labels", minRole: "manager" as Role, section: "labels", icon: <LocalOfferIcon /> },
    { label: t(language, "navStats"), path: "/stats", minRole: "jury_president" as Role, section: "stats", icon: <BarChartIcon /> },
    { label: t(language, "navAwards"), path: "/podium", minRole: "manager" as Role, section: "podium", icon: <EmojiEventsIcon /> },
    { label: t(language, "navSettings"), path: "/settings", minRole: "admin" as Role, section: "settings", icon: <SettingsIcon /> },
    { label: t(language, "navHelp"), path: "/help", minRole: null, section: null, icon: <MenuBookIcon /> },
    { label: t(language, "navPrivacy"), path: "/privacy", minRole: null, section: null, icon: <PrivacyTipIcon /> }
  ];

  const navItems = allNavItems.filter((item) => {
    if (!item.minRole) return true; // public pages always visible
    if (!role) return false; // no role = not logged in, hide protected
    return roleReaches(role, item.minRole) && sectionVisible(item.section);
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
      <Box sx={{ px: 2, py: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
        <AppLogo size={28} />
        <Typography variant="h6" noWrap>{appName}</Typography>
      </Box>
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
            <Tooltip title={t(language, "tipLogout")} describeChild>
              <ListItemButton onClick={handleLogout}>
                <ListItemIcon><LogoutIcon /></ListItemIcon>
                <ListItemText primary={t(language, "logoutButton")} />
              </ListItemButton>
            </Tooltip>
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
          <ActionButton tip={t(language, "tipMaintenanceRetry")} variant="outlined" onClick={() => { setBackendDown(false); window.location.reload(); }}>{t(language, "retryButton")}</ActionButton>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <AccessContext.Provider value={access}>
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", display: "flex", flexDirection: "column" }}>
        <AppBar position="static" elevation={0} sx={{ bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider" }}>
          <Toolbar sx={{ gap: 2 }}>
            {isMobile && (
              <TipIconButton tip={t(language, "tipMenuOpen")} data-tour="topbar-nav" color="default" edge="start" aria-label={t(language, "navOpenMenu")} onClick={() => setDrawerOpen(true)}>
                <MenuIcon />
              </TipIconButton>
            )}
            <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
              <AppLogo size={32} />
              <Typography variant="h6" noWrap sx={{ color: "text.primary" }}>
                {appName}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Select
                data-tour="topbar-lang"
                size="small"
                value={language}
                onChange={(event) => setLanguage(event.target.value as Language)}
                renderValue={(val) => <FlagIcon code={val as Language} />}
                inputProps={{ "aria-label": LANGUAGES.find((l) => l.code === language)?.name }}
                sx={{ bgcolor: "background.paper", borderRadius: 1, minWidth: 52, "& .MuiSelect-select": { display: "flex", alignItems: "center", py: 1.1 } }}
              >
                {LANGUAGES.map((l) => (
                  <MenuItem key={l.code} value={l.code} sx={{ gap: 1.5 }}>
                    <FlagIcon code={l.code} /> {l.name}
                  </MenuItem>
                ))}
              </Select>
              <TipIconButton
                tip={t(language, "tipHelpPage")}
                color="default"
                data-tour="topbar-help"
                aria-label={t(language, "helpButtonLabel")}
                onClick={tour.start}
              >
                <HelpOutlineIcon />
              </TipIconButton>
              <TipIconButton
                tip={t(language, themeMode === "light" ? "tipThemeToDark" : "tipThemeToLight")}
                data-tour="topbar-theme"
                color="default"
                onClick={() => setThemeMode(themeMode === "light" ? "dark" : "light")}
                aria-label={`${labels.themeToggle}: ${themeMode === "light" ? labels.themeDark : labels.themeLight}`}
              >
                {themeMode === "light" ? <Brightness4Icon /> : <Brightness7Icon />}
              </TipIconButton>
              {!role && location.pathname !== "/login" && (
                <ActionButton tip={t(language, "tipGoToLogin")} variant="contained" size="small" startIcon={<LoginIcon />} onClick={() => navigate(loginPathFor(location.pathname, location.search))}>
                  {t(language, "loginButton")}
                </ActionButton>
              )}
              {role && (
                <>
                  <TipIconButton tip={t(language, "tipAccountMenu")} data-tour="topbar-account" aria-label={t(language, "navProfile")} onClick={(e) => setAvatarMenuAnchor(e.currentTarget)} sx={{ p: 0 }}>
                    <Avatar sx={{ width: 36, height: 36, bgcolor: "secondary.main", fontSize: 16 }}>
                      {userInitial}
                    </Avatar>
                  </TipIconButton>
                  <Menu
                    anchorEl={avatarMenuAnchor}
                    open={Boolean(avatarMenuAnchor)}
                    onClose={() => setAvatarMenuAnchor(null)}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                    transformOrigin={{ vertical: "top", horizontal: "right" }}
                  >
                    <TipMenuItem tip={t(language, "tipMenuProfile")} component={RouterLink} to="/profile" onClick={() => setAvatarMenuAnchor(null)}>
                      <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
                      {t(language, "navProfile")}
                    </TipMenuItem>
                    <TipMenuItem tip={t(language, "tipMenuReplayTours")} onClick={() => { setAvatarMenuAnchor(null); tour.replayAll(); }}>
                      <ListItemIcon><ReplayIcon fontSize="small" /></ListItemIcon>
                      {t(language, "tourReplay")}
                    </TipMenuItem>
                    <Divider />
                    <TipMenuItem tip={t(language, "tipLogout")} onClick={handleLogout}>
                      <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                      {t(language, "logoutButton")}
                    </TipMenuItem>
                  </Menu>
                </>
              )}
            </Stack>
          </Toolbar>
        </AppBar>
        <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
          {drawerContent}
        </Drawer>
        <Box sx={{ display: "flex", flexGrow: 1 }}>
        {!isMobile && <SideNav items={navItems} isActive={isActive} language={language} />}
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
            <Route path="/socials" element={<Socials language={language} />} />
            <Route path="/reset-password" element={<ResetPassword language={language} />} />
            <Route path="/judge" element={<Protected><RequireRole min="judge">{guard("judge", <Judge language={language} />)}</RequireRole></Protected>} />
            <Route path="/users" element={<Protected><RequireRole min="manager">{guard("users", <Users language={language} />)}</RequireRole></Protected>} />
            <Route path="/admin" element={<Protected><RequireRole min="manager">{guard("admin", <Admin language={language} />)}</RequireRole></Protected>} />
            <Route path="/labels" element={<Protected><RequireRole min="manager">{guard("labels", <Labels language={language} />)}</RequireRole></Protected>} />
            <Route path="/stats" element={<Protected><RequireRole min="jury_president">{guard("stats", <Stats language={language} />)}</RequireRole></Protected>} />
            <Route path="/podium" element={<Protected><RequireRole min="manager">{guard("podium", <Podium language={language} />)}</RequireRole></Protected>} />
            <Route path="/settings" element={<Protected><RequireRole min="admin">{guard("settings", <Settings language={language} />)}</RequireRole></Protected>} />
            <Route path="/help" element={<Help language={language} />} />
            <Route path="/privacy" element={<Privacy language={language} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </Box>
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
      {tour.node}
      </AccessContext.Provider>
    </ThemeProvider>
  );
}
