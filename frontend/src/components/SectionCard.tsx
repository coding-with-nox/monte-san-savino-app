import React from "react";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";

interface SectionCardProps {
  icon?: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export default function SectionCard({ icon, title, action, children }: SectionCardProps) {
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
