import React, { useEffect, useState } from "react";
import {
  Button,
  ButtonGroup,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography
} from "@mui/material";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";
import ActiveSwitch from "../lib/ActiveSwitch";
import PageContainer from "../components/PageContainer";
import SectionCard from "../components/SectionCard";
import useToast from "../components/useToast";

interface SettingsProps {
  language: Language;
}

type SettingsTab = "general" | "theme" | "export" | "team";

export default function Settings({ language }: SettingsProps) {
  const toast = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<SettingsTab>("general");

  const [prefixDraft, setPrefixDraft] = useState("");
  const [digitsDraft, setDigitsDraft] = useState("5");
  const [sheetNameDraft, setSheetNameDraft] = useState("");
  const [filePrefixDraft, setFilePrefixDraft] = useState("");
  const [themeModeDraft, setThemeModeDraft] = useState<"light" | "dark">("light");
  const [themePresetDraft, setThemePresetDraft] = useState<"violet" | "ocean" | "forest" | "mss">("violet");

  const [maxModelsDraft, setMaxModelsDraft] = useState("5");

  const [teamNameMode, setTeamNameMode] = useState<"auto" | "manual">(
    () => (localStorage.getItem("teamNameMode") as "auto" | "manual") ?? "manual"
  );

  const [appNameDraft, setAppNameDraft] = useState("Miniatures Contest");
  const [savingAppName, setSavingAppName] = useState(false);

  const [savingPrefix, setSavingPrefix] = useState(false);
  const [savingDigits, setSavingDigits] = useState(false);
  const [savingMaxModels, setSavingMaxModels] = useState(false);
  const [savingExcelLayout, setSavingExcelLayout] = useState(false);
  const [savingTheme, setSavingTheme] = useState(false);

  async function load() {
    const res = await api<Record<string, string>>("/settings");
    setSettings(res);

    setAppNameDraft(res.app_name ?? "Miniatures Contest");
    setPrefixDraft(res.printCodePrefix ?? "MSS");
    setDigitsDraft(res.printCodeDigits ?? "5");
    setMaxModelsDraft(res.maxModelsPerUser ?? "5");
    setSheetNameDraft(res.excelSheetName ?? "Export");
    setFilePrefixDraft(res.excelFilePrefix ?? "contest-export");
    setThemeModeDraft(res.appTheme === "dark" ? "dark" : "light");
    setThemePresetDraft(
      res.themePreset === "ocean" || res.themePreset === "forest" || res.themePreset === "mss" ? res.themePreset : "violet"
    );
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
      toast.error(err?.message ?? String(err));
      setSettings(prev);
    }
  }

  async function saveAppName() {
    const next = appNameDraft.trim();
    if (!next) return;
    const prev = { ...settings };
    setSavingAppName(true);
    setSettings({ ...settings, app_name: next });
    try {
      await api("/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ app_name: next })
      });
      toast.success(t(language, "profileSaveButton"));
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
      setSettings(prev);
    } finally {
      setSavingAppName(false);
    }
  }

  async function savePrefix() {
    const next = prefixDraft.trim().toUpperCase();
    if (!next) {
      toast.error("Il prefisso non puo essere vuoto.");
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
      toast.success(t(language, "profileSaveButton"));
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
      setSettings(prev);
    } finally {
      setSavingPrefix(false);
    }
  }

  async function saveDigits() {
    const parsed = Number.parseInt(digitsDraft.trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 10) {
      toast.error(t(language, "settingsPrintCodeDigitsError"));
      return;
    }
    const next = String(parsed);
    const prev = { ...settings };
    setSavingDigits(true);
    setSettings({ ...settings, printCodeDigits: next });
    try {
      await api("/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ printCodeDigits: next })
      });
      toast.success(t(language, "profileSaveButton"));
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
      setSettings(prev);
    } finally {
      setSavingDigits(false);
    }
  }

  async function saveMaxModels() {
    const parsed = Number.parseInt(maxModelsDraft.trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      toast.error(t(language, "settingsMaxModelsPerUserError"));
      return;
    }
    const next = String(parsed);
    const prev = { ...settings };
    setSavingMaxModels(true);
    setSettings({ ...settings, maxModelsPerUser: next });
    try {
      await api("/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ maxModelsPerUser: next })
      });
      toast.success(t(language, "profileSaveButton"));
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
      setSettings(prev);
    } finally {
      setSavingMaxModels(false);
    }
  }

  async function saveExcelLayout() {
    const sheetName = sheetNameDraft.trim();
    const filePrefix = filePrefixDraft.trim();
    if (!sheetName || !filePrefix) {
      toast.error(t(language, "settingsExcelLayoutError"));
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
      toast.success(t(language, "profileSaveButton"));
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
      setSettings(prev);
    } finally {
      setSavingExcelLayout(false);
    }
  }

  async function saveTheme() {
    const prev = { ...settings };
    setSavingTheme(true);
    setSettings({ ...settings, appTheme: themeModeDraft, themePreset: themePresetDraft });
    try {
      await api("/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          appTheme: themeModeDraft,
          themePreset: themePresetDraft
        })
      });
      window.localStorage.setItem("theme", themeModeDraft);
      window.localStorage.setItem("themePreset", themePresetDraft);
      window.dispatchEvent(new Event("theme-settings-updated"));
      toast.success(t(language, "profileSaveButton"));
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
      setSettings(prev);
    } finally {
      setSavingTheme(false);
    }
  }

  useEffect(() => {
    load().catch((err) => toast.error(err?.message ?? String(err)));
  }, []);

  return (
    <PageContainer>
      {toast.node}
      <Stack spacing={2}>
        <Typography variant="h4">{t(language, "settingsTitle")}</Typography>

        <Paper variant="outlined">
          <Tabs value={tab} onChange={(_, value) => setTab(value)}>
            <Tab value="general" label={t(language, "settingsTabGeneral")} />
            <Tab value="theme" label={t(language, "settingsTabTheme")} />
            <Tab value="export" label={t(language, "settingsTabExport")} />
            <Tab value="team" label="Team" />
          </Tabs>
        </Paper>

        {tab === "general" && (
          <SectionCard title={t(language, "settingsTabGeneral")}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>{t(language, "settingsSettingColumn")}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, width: 300 }}>{t(language, "settingsValueColumn")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell><Typography>{t(language, "settingsAppName")}</Typography></TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <TextField
                          size="small"
                          value={appNameDraft}
                          onChange={(event) => setAppNameDraft(event.target.value)}
                          sx={{ minWidth: 220 }}
                        />
                        <Button variant="contained" onClick={saveAppName} disabled={savingAppName || !appNameDraft.trim()}>
                          {savingAppName ? "..." : t(language, "profileSaveButton")}
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
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
                    <TableCell><Typography>{t(language, "settingsPrintCodeDigits")}</Typography></TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <TextField
                          type="number"
                          size="small"
                          value={digitsDraft}
                          onChange={(event) => setDigitsDraft(event.target.value)}
                          inputProps={{ min: 1, max: 10 }}
                          sx={{ width: 120 }}
                        />
                        <Button variant="contained" onClick={saveDigits} disabled={savingDigits || !digitsDraft.trim()}>
                          {savingDigits ? "..." : t(language, "profileSaveButton")}
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><Typography>{t(language, "settingsMaxModelsPerUser")}</Typography></TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <TextField
                          type="number"
                          size="small"
                          value={maxModelsDraft}
                          onChange={(event) => setMaxModelsDraft(event.target.value)}
                          inputProps={{ min: 1 }}
                          sx={{ width: 120 }}
                        />
                        <Button variant="contained" onClick={saveMaxModels} disabled={savingMaxModels || !maxModelsDraft.trim()}>
                          {savingMaxModels ? "..." : t(language, "profileSaveButton")}
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </SectionCard>
        )}

        {tab === "theme" && (
          <SectionCard title={t(language, "settingsTabTheme")}>
            <Stack spacing={2}>
              <FormControl fullWidth>
                <InputLabel>{t(language, "settingsThemeMode")}</InputLabel>
                <Select
                  value={themeModeDraft}
                  label={t(language, "settingsThemeMode")}
                  onChange={(event) => setThemeModeDraft(event.target.value as "light" | "dark")}
                >
                  <MenuItem value="light">{t(language, "themeLight")}</MenuItem>
                  <MenuItem value="dark">{t(language, "themeDark")}</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>{t(language, "settingsThemePreset")}</InputLabel>
                <Select
                  value={themePresetDraft}
                  label={t(language, "settingsThemePreset")}
                  onChange={(event) => setThemePresetDraft(event.target.value as "violet" | "ocean" | "forest" | "mss")}
                >
                  <MenuItem value="violet">{t(language, "settingsThemePresetViolet")}</MenuItem>
                  <MenuItem value="ocean">{t(language, "settingsThemePresetOcean")}</MenuItem>
                  <MenuItem value="forest">{t(language, "settingsThemePresetForest")}</MenuItem>
                  <MenuItem value="mss">{t(language, "settingsThemePresetMss")}</MenuItem>
                </Select>
              </FormControl>

              <Stack direction="row" justifyContent="flex-end">
                <Button variant="contained" onClick={saveTheme} disabled={savingTheme}>
                  {savingTheme ? "..." : t(language, "profileSaveButton")}
                </Button>
              </Stack>
            </Stack>
          </SectionCard>
        )}

        {tab === "export" && (
          <SectionCard title={t(language, "settingsTabExport")}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>{t(language, "settingsSettingColumn")}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, width: 300 }}>{t(language, "settingsValueColumn")}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
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
          </SectionCard>
        )}

        {tab === "team" && (
          <SectionCard title="Team">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell><Typography>{t(language, "teamsNameLabel")}</Typography></TableCell>
                  <TableCell align="right">
                    <ButtonGroup size="small" variant="outlined">
                      <Button
                        onClick={() => { setTeamNameMode("manual"); localStorage.setItem("teamNameMode", "manual"); }}
                        variant={teamNameMode === "manual" ? "contained" : "outlined"}
                      >
                        {t(language, "teamsNameManual")}
                      </Button>
                      <Button
                        onClick={() => { setTeamNameMode("auto"); localStorage.setItem("teamNameMode", "auto"); }}
                        variant={teamNameMode === "auto" ? "contained" : "outlined"}
                      >
                        {t(language, "teamsNameAuto")}
                      </Button>
                    </ButtonGroup>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </SectionCard>
        )}
      </Stack>
    </PageContainer>
  );
}
