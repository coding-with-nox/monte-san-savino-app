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
  createTheme,
  useMediaQuery
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonIcon from "@mui/icons-material/Person";
import Login from "./pages/Login";
import Judge from "./pages/Judge";
import Profile from "./pages/Profile";
import Teams from "./pages/Teams";
import Models from "./pages/Models";
import Enrollments from "./pages/Enrollments";
import PublicEvents from "./pages/PublicEvents";
import Admin from "./pages/Admin";
import StaffCheckin from "./pages/StaffCheckin";
import { getToken, getRole, roleAtLeast, clearToken, decodeJwt, Role } from "./lib/auth";
import { Language, t } from "./lib/i18n";

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
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === "undefined") return "it";
    return (window.localStorage.getItem("language") as Language) || "it";
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    window.localStorage.setItem("theme", themeMode);
  }, [themeMode]);

  useEffect(() => {
    window.localStorage.setItem("language", language);
  }, [language]);

  const labels = {
    themeToggle: t(language, "themeToggle"),
    themeLight: t(language, "themeLight"),
    themeDark: t(language, "themeDark"),
    languageToggle: t(language, "languageToggle"),
    languageIt: t(language, "languageIt"),
    languageEn: t(language, "languageEn")
  };

  const muiTheme = useMemo(() => createTheme({
    palette: {
      mode: themeMode,
      primary: {
        main: themeMode === "light" ? "#6750a4" : "#d0bcff"
      }
    },
    typography: {
      fontFamily: "\"Roboto\", \"Segoe UI\", system-ui, sans-serif"
    }
  }), [themeMode]);

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
    { label: t(language, "navTeams"), path: "/teams", minRole: "user" as Role },
    { label: t(language, "navModels"), path: "/models", minRole: "user" as Role },
    { label: t(language, "navEnrollments"), path: "/enrollments", minRole: "user" as Role },
    { label: t(language, "navPublicEvents"), path: "/public-events", minRole: null },
    { label: t(language, "navJudge"), path: "/judge", minRole: "judge" as Role },
    { label: t(language, "navStaff"), path: "/staff", minRole: "staff" as Role },
    { label: t(language, "navAdmin"), path: "/admin", minRole: "manager" as Role }
  ];

  const navItems = allNavItems.filter((item) => {
    if (!item.minRole) return true; // public pages always visible
    if (!role) return false; // no role = not logged in, hide protected
    return roleAtLeast(role, item.minRole);
  });

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const drawerContent = (
    <Box sx={{ width: 280 }} role="presentation" onClick={() => setDrawerOpen(false)}>
      <Typography variant="h6" sx={{ px: 2, py: 2 }}>
        Miniatures Contest
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
        <AppBar position="static" color="primary">
          <Toolbar sx={{ gap: 2 }}>
            {isMobile && (
              <IconButton color="inherit" edge="start" onClick={() => setDrawerOpen(true)}>
                <MenuIcon />
              </IconButton>
            )}
            <Typography variant="h6" sx={{ flexGrow: isMobile ? 1 : 0 }}>
              Miniatures Contest
            </Typography>
            {!isMobile && (
              <Stack direction="row" spacing={1} sx={{ flexGrow: 1, ml: 2, flexWrap: "wrap" }}>
                {navItems.map((item) => (
                  <Button
                    key={item.path}
                    color="inherit"
                    component={RouterLink}
                    to={item.path}
                    variant={isActive(item.path) ? "outlined" : "text"}
                    sx={{ borderColor: "rgba(255,255,255,0.4)" }}
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
                  <MenuItem value="it">{labels.languageIt}</MenuItem>
                  <MenuItem value="en">{labels.languageEn}</MenuItem>
                </Select>
              </FormControl>
              <IconButton
                color="inherit"
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
        <Box sx={{ py: 4 }}>
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
            <Route path="/teams" element={<Protected><Teams language={language} /></Protected>} />
            <Route path="/models" element={<Protected><Models language={language} /></Protected>} />
            <Route path="/enrollments" element={<Protected><Enrollments language={language} /></Protected>} />
            <Route path="/public-events" element={<PublicEvents language={language} />} />
            <Route path="/judge" element={<Protected><RequireRole min="judge"><Judge language={language} /></RequireRole></Protected>} />
            <Route path="/staff" element={<Protected><RequireRole min="staff"><StaffCheckin language={language} /></RequireRole></Protected>} />
            <Route path="/admin" element={<Protected><RequireRole min="manager"><Admin language={language} /></RequireRole></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
