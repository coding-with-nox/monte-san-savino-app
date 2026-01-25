import React from "react";
import { Button, Container, Stack, Typography } from "@mui/material";
import { clearToken, getRole } from "../lib/auth";
import { Language, t } from "../lib/i18n";

interface DashboardProps {
  language: Language;
}

export default function Dashboard({ language }: DashboardProps) {
  return (
    <Container maxWidth="md">
      <Stack spacing={2}>
        <Typography variant="h4">{t(language, "dashboardTitle")}</Typography>
        <Typography>
          {t(language, "dashboardRoleLabel")}:{" "}
          <Typography component="span" fontWeight={600}>
            {getRole() ?? t(language, "dashboardRoleUnknown")}
          </Typography>
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            clearToken();
            location.href = "/login";
          }}
          sx={{ alignSelf: "flex-start" }}
        >
          {t(language, "logoutButton")}
        </Button>
        <Typography variant="body2" color="text.secondary">
          {t(language, "dashboardHint")}
        </Typography>
      </Stack>
    </Container>
  );
}
