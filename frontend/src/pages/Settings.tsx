import React, { useEffect, useState } from "react";
import {
  Alert,
  Container,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";

interface SettingsProps {
  language: Language;
}

export default function Settings({ language }: SettingsProps) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  async function load() {
    const res = await api<Record<string, string>>("/settings");
    setSettings(res);
  }

  async function toggle(key: string) {
    const current = settings[key] === "true";
    const newSettings = { ...settings, [key]: String(!current) };
    const prev = { ...settings };
    setSettings(newSettings);
    try {
      await api("/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ [key]: String(!current) })
      });
    } catch (err: any) {
      setMessage(err.message || "Error");
      setSettings(prev);
    }
  }

  useEffect(() => {
    load().catch((err) => setMessage(err.message));
  }, []);

  const settingRows = [
    { key: "modelImages", labelKey: "settingsModelImages" as const }
  ];

  return (
    <Container maxWidth="md">
      <Stack spacing={2}>
        <Typography variant="h4">{t(language, "settingsTitle")}</Typography>
        {message && <Alert severity="error" onClose={() => setMessage("")}>{message}</Alert>}
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>{t(language, "settingsSettingColumn")}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, width: 100 }}>{t(language, "settingsValueColumn")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {settingRows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell><Typography>{t(language, row.labelKey)}</Typography></TableCell>
                  <TableCell align="right">
                    <Switch
                      checked={settings[row.key] === "true"}
                      onChange={() => toggle(row.key)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
    </Container>
  );
}
