import React from "react";
import { Box, Stack, Typography } from "@mui/material";

export type BarItem = { key: string; label: string; value: number };

interface BarListProps {
  items: BarItem[];
  emptyLabel: string;
  /** Larger text for projection mode. */
  large?: boolean;
}

/** Horizontal bar chart built with plain CSS (no chart dependency). */
export default function BarList({ items, emptyLabel, large = false }: BarListProps) {
  if (items.length === 0) return <Typography color="text.secondary">{emptyLabel}</Typography>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <Stack spacing={large ? 1.5 : 1} role="list">
      {items.map((i) => (
        <Box key={i.key} role="listitem" sx={{ display: "grid", gridTemplateColumns: large ? "220px 1fr 56px" : "140px 1fr 40px", gap: 1.5, alignItems: "center" }}>
          <Typography variant={large ? "h6" : "body2"} noWrap title={i.label}>{i.label}</Typography>
          <Box sx={{ bgcolor: "action.hover", borderRadius: 1, height: large ? 28 : 16, overflow: "hidden" }}>
            <Box
              data-testid="bar-fill"
              sx={{ width: `${(i.value / max) * 100}%`, height: "100%", bgcolor: "primary.main", borderRadius: 1, transition: "width 400ms ease", "@media (prefers-reduced-motion: reduce)": { transition: "none" } }}
            />
          </Box>
          <Typography variant={large ? "h6" : "body2"} fontWeight={700} align="right">{i.value}</Typography>
        </Box>
      ))}
    </Stack>
  );
}
