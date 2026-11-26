import React from "react";
import { Box, Typography } from "@mui/material";
import InboxIcon from "@mui/icons-material/Inbox";
import { ActionButton } from "./ActionButton";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: { label: string; tip: string; onClick: () => void };
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
        <Typography variant="body2" color="text.secondary" textAlign="center">
          {description}
        </Typography>
      )}
      {action && (
        <ActionButton tip={action.tip} variant="contained" color="secondary" onClick={action.onClick} sx={{ mt: 1 }}>
          {action.label}
        </ActionButton>
      )}
    </Box>
  );
}
