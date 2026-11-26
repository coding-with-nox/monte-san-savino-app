import React, { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Box, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Tooltip } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { Language, t } from "../lib/i18n";

export const SIDE_NAV_STORAGE_KEY = "sideNavCollapsed";
const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 64;

export interface SideNavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

interface SideNavProps {
  items: SideNavItem[];
  isActive: (path: string) => boolean;
  language: Language;
}

function readCollapsed() {
  try {
    return window.localStorage.getItem(SIDE_NAV_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

// Desktop navigation, docked on the right side of the page.
export default function SideNav({ items, isActive, language }: SideNavProps) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggleLabel = t(language, collapsed ? "navExpandMenu" : "navCollapseMenu");

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem(SIDE_NAV_STORAGE_KEY, String(next));
    } catch {
      // storage unavailable: the state just isn't remembered
    }
  };

  return (
    <Box
      component="nav"
      className="no-print"
      aria-label={t(language, "navMainLabel")}
      sx={{
        width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH,
        flexShrink: 0,
        bgcolor: "background.paper",
        borderLeft: "1px solid",
        borderColor: "divider",
        transition: (theme) => theme.transitions.create("width"),
      }}
    >
      <Box sx={{ position: "sticky", top: 0, maxHeight: "100vh", overflowX: "hidden", overflowY: "auto" }}>
        <Box sx={{ display: "flex", justifyContent: collapsed ? "center" : "flex-start", px: 1.5, pt: 1 }}>
          <Tooltip title={toggleLabel} placement="left">
            <IconButton aria-label={toggleLabel} aria-expanded={!collapsed} aria-controls="side-nav-list" onClick={toggle}>
              {collapsed ? <ChevronLeftIcon /> : <ChevronRightIcon />}
            </IconButton>
          </Tooltip>
        </Box>
        <List id="side-nav-list">
          {items.map((item) => {
            const active = isActive(item.path);
            return (
              <Tooltip key={item.path} title={collapsed ? item.label : ""} placement="left">
                <ListItemButton
                  component={RouterLink}
                  to={item.path}
                  selected={active}
                  aria-current={active ? "page" : undefined}
                  sx={{
                    minHeight: 48,
                    px: 2.5,
                    "&.Mui-selected, &.Mui-selected .MuiListItemIcon-root": { color: "primary.main" },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: collapsed ? 0 : 40 }}>{item.icon}</ListItemIcon>
                  {!collapsed && <ListItemText primary={item.label} primaryTypographyProps={{ noWrap: true }} />}
                </ListItemButton>
              </Tooltip>
            );
          })}
        </List>
      </Box>
    </Box>
  );
}
