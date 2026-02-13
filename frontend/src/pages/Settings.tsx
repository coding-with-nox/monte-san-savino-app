import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Container,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";
import ActiveSwitch from "../lib/ActiveSwitch";

interface SettingsProps {
  language: Language;
}

export default function Settings({ language }: SettingsProps) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [prefixDraft, setPrefixDraft] = useState("");
  const [sheetNameDraft, setSheetNameDraft] = useState("");
  const [filePrefixDraft, setFilePrefixDraft] = useState("");
  const [savingPrefix, setSavingPrefix] = useState(false);
  const [savingExcelLayout, setSavingExcelLayout] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const res = await api<Record<string, string>>("/settings");
    setSettings(res);
    setPrefixDraft(res.printCodePrefix ?? "MSS");
    setSheetNameDraft(res.excelSheetName ?? "Export");
    setFilePrefixDraft(res.excelFilePrefix ?? "contest-export");
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

  async function savePrefix() {
    const next = prefixDraft.trim().toUpperCase();
    if (!next) {
      setMessage("Il prefisso non puo essere vuoto.");
      return;
    }
    const prev = { ...settings };
    setSavingPrefix(true);
    setSettings({ ...settings, printCodePrefix: next });
    try {
      await api("/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ printCodePrefix: next })
      });
    } catch (err: any) {
      setMessage(err.message || "Error");
      setSettings(prev);
    } finally {
      setSavingPrefix(false);
    }
  }

  async function saveExcelLayout() {
    const sheetName = sheetNameDraft.trim();
    const filePrefix = filePrefixDraft.trim();
    if (!sheetName || !filePrefix) {
      setMessage(t(language, "settingsExcelLayoutError"));
      return;
    }
    const prev = { ...settings };
    setSavingExcelLayout(true);
    setSettings({ ...settings, excelSheetName: sheetName, excelFilePrefix: filePrefix });
    try {
      await api("/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          excelSheetName: sheetName,
          excelFilePrefix: filePrefix
        })
      });
    } catch (err: any) {
      setMessage(err.message || "Error");
      setSettings(prev);
    } finally {
      setSavingExcelLayout(false);
    }
  }

  useEffect(() => {
    load().catch((err) => setMessage(err.message));
  }, []);

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
                <TableCell align="right" sx={{ fontWeight: 700, width: 300 }}>{t(language, "settingsValueColumn")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell><Typography>{t(language, "settingsModelImages")}</Typography></TableCell>
                <TableCell align="right">
                  <ActiveSwitch
                    checked={settings.modelImages === "true"}
                    onChange={() => toggle("modelImages")}
                    activeLabel={t(language, "adminUserActive")}
                    inactiveLabel={t(language, "adminUserInactive")}
                  />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell><Typography>{t(language, "settingsPrintCodePrefix")}</Typography></TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <TextField
                      size="small"
                      value={prefixDraft}
                      onChange={(event) => setPrefixDraft(event.target.value)}
                      sx={{ minWidth: 180 }}
                    />
                    <Button variant="contained" onClick={savePrefix} disabled={savingPrefix || !prefixDraft.trim()}>
                      {savingPrefix ? "..." : t(language, "profileSaveButton")}
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell><Typography>{t(language, "settingsExportIncludeCode")}</Typography></TableCell>
                <TableCell align="right">
                  <ActiveSwitch
                    checked={settings.exportIncludeModelCode !== "false"}
                    onChange={() => toggle("exportIncludeModelCode")}
                    activeLabel={t(language, "adminUserActive")}
                    inactiveLabel={t(language, "adminUserInactive")}
                  />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell><Typography>{t(language, "settingsExportIncludeDescription")}</Typography></TableCell>
                <TableCell align="right">
                  <ActiveSwitch
                    checked={settings.exportIncludeModelDescription !== "false"}
                    onChange={() => toggle("exportIncludeModelDescription")}
                    activeLabel={t(language, "adminUserActive")}
                    inactiveLabel={t(language, "adminUserInactive")}
                  />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell><Typography>{t(language, "settingsExportIncludeEmail")}</Typography></TableCell>
                <TableCell align="right">
                  <ActiveSwitch
                    checked={settings.exportIncludeParticipantEmail !== "false"}
                    onChange={() => toggle("exportIncludeParticipantEmail")}
                    activeLabel={t(language, "adminUserActive")}
                    inactiveLabel={t(language, "adminUserInactive")}
                  />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell><Typography>{t(language, "settingsExcelSheetName")}</Typography></TableCell>
                <TableCell align="right">
                  <TextField
                    size="small"
                    value={sheetNameDraft}
                    onChange={(event) => setSheetNameDraft(event.target.value)}
                    sx={{ minWidth: 220 }}
                  />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell><Typography>{t(language, "settingsExcelFilePrefix")}</Typography></TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <TextField
                      size="small"
                      value={filePrefixDraft}
                      onChange={(event) => setFilePrefixDraft(event.target.value)}
                      sx={{ minWidth: 220 }}
                    />
                    <Button
                      variant="contained"
                      onClick={saveExcelLayout}
                      disabled={savingExcelLayout || !sheetNameDraft.trim() || !filePrefixDraft.trim()}
                    >
                      {savingExcelLayout ? "..." : t(language, "profileSaveButton")}
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
    </Container>
  );
}
