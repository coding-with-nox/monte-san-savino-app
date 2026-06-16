import React, { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, Link as RouterLink, useLocation } from "react-router-dom";
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
import SvgIcon from "@mui/material/SvgIcon";
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
import GroupsIcon from "@mui/icons-material/Groups";

function FigurineIcon(props: React.ComponentProps<typeof SvgIcon>) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <circle cx="12" cy="4" r="2" />
      <path d="M9 8h6l1 5H8z" />
      <rect x="8" y="19" width="8" height="2" rx="1" />
      <line x1="10" y1="13" x2="9" y2="19" stroke="currentColor" strokeWidth="1.5" />
      <line x1="14" y1="13" x2="15" y2="19" stroke="currentColor" strokeWidth="1.5" />
      <line x1="9" y1="9" x2="7" y2="12" stroke="currentColor" strokeWidth="1.5" />
      <line x1="15" y1="9" x2="17" y2="12" stroke="currentColor" strokeWidth="1.5" />
    </SvgIcon>
  );
}
import Login from "./pages/Login";
import Judge from "./pages/Judge";
import Profile from "./pages/Profile";
import Models from "./pages/Models";
import Teams from "./pages/Teams";
import PublicEvents from "./pages/PublicEvents";
import Admin from "./pages/Admin";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import Labels from "./pages/Labels";
import { api } from "./lib/api";
import { getToken, getRole, roleAtLeast, clearToken, decodeJwt, Role } from "./lib/auth";
import { Language, t } from "./lib/i18n";
import { buildTheme } from "./lib/theme";

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
  const [themePreset, setThemePreset] = useState<"violet" | "ocean" | "forest">(() => {
    if (typeof window === "undefined") return "violet";
    const stored = window.localStorage.getItem("themePreset");
    if (stored === "ocean" || stored === "forest") return stored;
    return "violet";
  });
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === "undefined") return "it";
    return (window.localStorage.getItem("language") as Language) || "it";
  });
  const [appName, setAppName] = useState("Miniatures Contest");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

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
      if (storedPreset === "violet" || storedPreset === "ocean" || storedPreset === "forest") {
        setThemePreset(storedPreset);
      }
    };

    api<Record<string, string>>("/settings")
      .then((settings) => {
        if (settings.appTheme === "light" || settings.appTheme === "dark") {
          setThemeMode(settings.appTheme);
          window.localStorage.setItem("theme", settings.appTheme);
        }
        if (settings.themePreset === "violet" || settings.themePreset === "ocean" || settings.themePreset === "forest") {
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
  const [avatarMenuAnchor, setAvatarMenuAnchor] = useState<null | HTMLElement>(null);

  const userInitial = (() => {
    const token = getToken();
    if (!token) return "?";
    try {
      const payload = decodeJwt(token);
      const email = payload.email as string | undefined;
      return email ? email[0].toUpperCase() : "?";
    } catch { return "?"; }
  })();

  const handleLogout = () => {
    setAvatarMenuAnchor(null);
    clearToken();
    window.location.href = "/login";
  };

  const allNavItems = [
    { label: t(language, "navProfile"), path: "/", minRole: "user" as Role },
{ label: t(language, "navModels"), path: "/models", minRole: "user" as Role },
    { label: t(language, "navTeams"), path: "/teams", minRole: "user" as Role },
    { label: t(language, "navPublicEvents"), path: "/public-events", minRole: null },
    { label: t(language, "navJudge"), path: "/judge", minRole: "judge" as Role },
    { label: t(language, "navUsers"), path: "/users", minRole: "manager" as Role },
    { label: t(language, "navAdmin"), path: "/admin", minRole: "manager" as Role },
    { label: t(language, "navLabels"), path: "/labels", minRole: "manager" as Role },
    { label: t(language, "navSettings"), path: "/settings", minRole: "admin" as Role }
  ];

  const navItems = allNavItems.filter((item) => {
    if (!item.minRole) return true; // public pages always visible
    if (!role) return false; // no role = not logged in, hide protected
    return roleAtLeast(role, item.minRole);
  });

  const bottomNavItems = [
    { label: t(language, "navProfile"),      path: "/",              icon: <HomeIcon /> },
    { label: t(language, "navModels"),       path: "/models",        icon: <FigurineIcon /> },
    { label: t(language, "navTeams"),        path: "/teams",         icon: <GroupsIcon /> },
    { label: t(language, "navPublicEvents"), path: "/public-events", icon: <EventIcon /> },
    ...(role && roleAtLeast(role, "judge") ? [{ label: t(language, "navJudge"), path: "/judge", icon: <GavelIcon /> }] : []),
  ];

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
          >
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

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
        <AppBar position="static" elevation={0} sx={{ bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider" }}>
          <Toolbar sx={{ gap: 2 }}>
            {isMobile && (
              <IconButton color="default" edge="start" onClick={() => setDrawerOpen(true)}>
                <MenuIcon />
              </IconButton>
            )}
            <Typography variant="h6" sx={{ flexGrow: isMobile ? 1 : 0, color: "text.primary" }}>
              {appName}
            </Typography>
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
            <Stack direction="row" spacing={1} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 140, bgcolor: "background.paper", borderRadius: 1 }}>
                <InputLabel id="language-select-label">{labels.languageToggle}</InputLabel>
                <Select
                  labelId="language-select-label"
                  value={language}
                  label={labels.languageToggle}
                  onChange={(event) => setLanguage(event.target.value as Language)}
                >
                  <MenuItem value="it">🇮🇹 IT</MenuItem>
                  <MenuItem value="en">🇬🇧 EN</MenuItem>
                </Select>
              </FormControl>
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
                  <IconButton onClick={(e) => setAvatarMenuAnchor(e.currentTarget)} sx={{ p: 0 }}>
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
                    <MenuItem component={RouterLink} to="/" onClick={() => setAvatarMenuAnchor(null)}>
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
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
          {drawerContent}
        </Drawer>
        <Box sx={{ pb: isMobile && role ? "56px" : 0 }}>
          <Routes>
            <Route
              path="/login"
              element={(
                <Login
                  language={language}
                />
              )}
            />
            <Route path="/" element={<Protected><Profile language={language} /></Protected>} />
<Route path="/models" element={<Protected><Models language={language} /></Protected>} />
            <Route path="/teams" element={<Protected><Teams language={language} /></Protected>} />
            <Route path="/public-events" element={<PublicEvents language={language} />} />
            <Route path="/judge" element={<Protected><RequireRole min="judge"><Judge language={language} /></RequireRole></Protected>} />
            <Route path="/users" element={<Protected><RequireRole min="manager"><Users language={language} /></RequireRole></Protected>} />
            <Route path="/admin" element={<Protected><RequireRole min="manager"><Admin language={language} /></RequireRole></Protected>} />
            <Route path="/labels" element={<Protected><RequireRole min="manager"><Labels language={language} /></RequireRole></Protected>} />
            <Route path="/settings" element={<Protected><RequireRole min="admin"><Settings language={language} /></RequireRole></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
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
