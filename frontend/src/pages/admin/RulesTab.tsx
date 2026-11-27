import React, { useEffect, useState } from "react";
import {
  Alert,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputAdornment,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import { api } from "../../lib/api";
import { Language, t, TranslationKey } from "../../lib/i18n";
import { parseEuros } from "../../lib/pricing";
import { DEFAULT_PRIZE_ORDER } from "../../lib/podium";
import { roleLabel } from "../../lib/roles";
import SectionCard from "../../components/SectionCard";
import useToast from "../../components/useToast";
import { ActionButton, TipIconButton } from "../../components/ActionButton";

type Visibility = {
  sections: string[];
  roles: string[];
  visibility: Record<string, string[]>;
  permissions?: Record<string, string[]>;
  availablePermissions?: string[];
};

const PERMISSION_KEYS: Record<string, TranslationKey> = {
  enrollOnBehalf: "permissionEnrollOnBehalf"
};

type RegistrationStatus = "open" | "openday" | "closed";
type RegistrationSettings = { status: RegistrationStatus; defaultPage: "login" | "register"; lockLevel: boolean; levelUpWarning: boolean };

const REGISTRATION_OPTIONS: Record<RegistrationStatus, { label: TranslationKey; help: TranslationKey }> = {
  open: { label: "rulesRegistrationOpen", help: "rulesRegistrationOpenHelp" },
  openday: { label: "rulesRegistrationOpenDay", help: "rulesRegistrationOpenDayHelp" },
  closed: { label: "rulesRegistrationClosed", help: "rulesRegistrationClosedHelp" }
};

const SECTION_KEYS: Record<string, TranslationKey> = {
  dashboard: "sectionDashboard",
  stats: "sectionStats",
  judge: "sectionJudge",
  podium: "sectionPodium",
  enrollments: "sectionEnrollments",
  models: "sectionModels",
  labels: "sectionLabels",
  checkin: "sectionCheckin",
  users: "sectionUsers",
  teams: "sectionTeams",
  settings: "sectionSettings",
  admin: "sectionAdmin"
};

/** Admin-only rules: base fee, role/section visibility matrix and prize presentation order. */
export default function RulesTab({ language }: { language: Language }) {
  const toast = useToast();
  const [fee, setFee] = useState("");
  const [matrix, setMatrix] = useState<Visibility | null>(null);
  const [matrixError, setMatrixError] = useState(false);
  const [order, setOrder] = useState<string[]>(DEFAULT_PRIZE_ORDER);
  const [registration, setRegistration] = useState<RegistrationSettings>({ status: "open", defaultPage: "login", lockLevel: false, levelUpWarning: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Record<string, string>>("/settings")
      .then((s) => {
        const cents = Number.parseInt(s?.baseFeeCents ?? "", 10);
        if (Number.isFinite(cents)) setFee(String(cents / 100));
        setRegistration({
          status: s?.registrationStatus === "openday" || s?.registrationStatus === "closed" ? s.registrationStatus : "open",
          defaultPage: s?.defaultPublicPage === "register" ? "register" : "login",
          lockLevel: s?.lockLevelToFirstSelection === "true",
          levelUpWarning: s?.levelUpWarning === "true"
        });
      })
      .catch(() => undefined);
    api<Visibility>("/admin/settings/section-visibility")
      .then((res) => {
        if (res?.roles && res.sections) setMatrix(res);
        else setMatrixError(true);
      })
      .catch(() => setMatrixError(true));
    api<{ order?: string[] }>("/settings/prize-order")
      .then((res) => { if (res?.order?.length) setOrder(res.order); })
      .catch(() => undefined);
  }, []);

  async function save(path: string, body: unknown) {
    setSaving(true);
    try {
      await api(path, { method: "PUT", body: JSON.stringify(body) });
      toast.success(t(language, "adminSaved"));
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  function saveFee() {
    const cents = parseEuros(fee);
    if (cents === null) {
      toast.error(t(language, "adminPriceInvalid"));
      return;
    }
    void save("/admin/settings", { baseFeeCents: String(cents) });
  }

  function toggle(role: string, section: string) {
    setMatrix((m) => {
      if (!m) return m;
      const current = m.visibility[role] ?? [];
      const next = current.includes(section) ? current.filter((s) => s !== section) : [...current, section];
      return { ...m, visibility: { ...m.visibility, [role]: next } };
    });
  }

  function togglePermission(role: string, permission: string) {
    setMatrix((m) => {
      if (!m) return m;
      const current = m.permissions?.[role] ?? [];
      const next = current.includes(permission) ? current.filter((p) => p !== permission) : [...current, permission];
      return { ...m, permissions: { ...m.permissions, [role]: next } };
    });
  }

  function saveMatrix() {
    if (!matrix) return;
    const pick = (source: Record<string, string[]> | undefined) =>
      Object.fromEntries(editableRoles.map((r) => [r, source?.[r] ?? []]));
    void save("/admin/settings/section-visibility", {
      visibility: pick(matrix.visibility),
      ...(matrix.availablePermissions ? { permissions: pick(matrix.permissions) } : {})
    });
  }

  function saveRegistration() {
    void save("/admin/settings", {
      registrationStatus: registration.status,
      defaultPublicPage: registration.defaultPage,
      lockLevelToFirstSelection: String(registration.lockLevel),
      levelUpWarning: String(registration.levelUpWarning)
    });
  }

  function move(index: number, delta: -1 | 1) {
    setOrder((current) => {
      const next = [...current];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
  }

  const sectionName = (key: string) => (SECTION_KEYS[key] ? t(language, SECTION_KEYS[key]) : key);
  const editableRoles = matrix?.roles.filter((r) => r !== "admin") ?? [];
  // Admin is shown among the permissions as always granted.
  const permissionRoles = [...editableRoles, "admin"];
  const permissionName = (key: string) => (PERMISSION_KEYS[key] ? t(language, PERMISSION_KEYS[key]) : key);

  return (
    <Stack spacing={2}>
      {toast.node}
      <SectionCard tourId="rules-fee" title={t(language, "rulesFeeTitle")}>
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">{t(language, "rulesFeeHelp")}</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              size="small"
              label={t(language, "rulesFeeLabel")}
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              inputProps={{ inputMode: "decimal" }}
              InputProps={{ startAdornment: <InputAdornment position="start">€</InputAdornment> }}
            />
            <ActionButton tip={t(language, "tipRulesSaveFee")} variant="contained" size="small" onClick={saveFee} disabled={saving || !fee.trim()}>
              {t(language, "adminSave")}
            </ActionButton>
          </Stack>
        </Stack>
      </SectionCard>

      <SectionCard tourId="rules-visibility" title={t(language, "rulesVisibilityTitle")}>
        {matrixError && <Alert severity="warning">{t(language, "rulesLoadError")}</Alert>}
        {matrix && (
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">{t(language, "rulesVisibilityHelp")}</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>{t(language, "rulesSection")}</TableCell>
                    {editableRoles.map((role) => (
                      <TableCell key={role} align="center" sx={{ fontWeight: 700 }}>{roleLabel(language, role)}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {matrix.sections.map((section) => (
                    <TableRow key={section}>
                      <TableCell component="th" scope="row">{sectionName(section)}</TableCell>
                      {editableRoles.map((role) => (
                        <TableCell key={role} align="center">
                          <Checkbox
                            size="small"
                            checked={(matrix.visibility[role] ?? []).includes(section)}
                            onChange={() => toggle(role, section)}
                            inputProps={{ "aria-label": `${roleLabel(language, role)}: ${sectionName(section)}` }}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {!!matrix.availablePermissions?.length && (
              <Stack spacing={1} data-tour="rules-permissions">
                <Typography variant="subtitle1" component="h3">{t(language, "rulesPermissionsTitle")}</Typography>
                <Typography variant="body2" color="text.secondary">{t(language, "rulesPermissionsHelp")}</Typography>
                <TableContainer>
                  <Table size="small" aria-label={t(language, "rulesPermissionsTitle")}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>{t(language, "rulesPermission")}</TableCell>
                        {permissionRoles.map((role) => (
                          <TableCell key={role} align="center" sx={{ fontWeight: 700 }}>{roleLabel(language, role)}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {matrix.availablePermissions.map((permission) => (
                        <TableRow key={permission}>
                          <TableCell component="th" scope="row">{permissionName(permission)}</TableCell>
                          {permissionRoles.map((role) => (
                            <TableCell key={role} align="center">
                              <Checkbox
                                size="small"
                                disabled={role === "admin"}
                                checked={role === "admin" || (matrix.permissions?.[role] ?? []).includes(permission)}
                                onChange={() => togglePermission(role, permission)}
                                inputProps={{ "aria-label": `${roleLabel(language, role)}: ${permissionName(permission)}` }}
                              />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Stack>
            )}
            <ActionButton
              tip={t(language, "tipRulesSaveMatrix")}
              variant="contained"
              size="small"
              wrapperSx={{ alignSelf: "flex-start" }}
              disabled={saving}
              onClick={saveMatrix}
            >
              {t(language, "adminSave")}
            </ActionButton>
          </Stack>
        )}
      </SectionCard>

      <SectionCard tourId="rules-prize" title={t(language, "rulesPrizeTitle")}>
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">{t(language, "rulesPrizeHelp")}</Typography>
          <List dense disablePadding data-testid="prize-order" sx={{ maxWidth: 360 }}>
            {order.map((label, i) => (
              <ListItem
                key={label}
                disableGutters
                secondaryAction={
                  <>
                    <TipIconButton tip={t(language, "tipRulesMoveUp")} size="small" aria-label={`${t(language, "rulesMoveUp")}: ${label}`} disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUpwardIcon fontSize="small" />
                    </TipIconButton>
                    <TipIconButton tip={t(language, "tipRulesMoveDown")} size="small" aria-label={`${t(language, "rulesMoveDown")}: ${label}`} disabled={i === order.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDownwardIcon fontSize="small" />
                    </TipIconButton>
                  </>
                }
              >
                <ListItemText primary={`${i + 1}. ${label}`} />
              </ListItem>
            ))}
          </List>
          <ActionButton
            tip={t(language, "tipRulesSaveOrder")}
            variant="contained"
            size="small"
            wrapperSx={{ alignSelf: "flex-start" }}
            disabled={saving}
            onClick={() => save("/admin/settings/prize-order", { order })}
          >
            {t(language, "adminSave")}
          </ActionButton>
        </Stack>
      </SectionCard>

      <SectionCard tourId="rules-registration" title={t(language, "rulesRegistrationTitle")}>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">{t(language, "rulesRegistrationHelp")}</Typography>
          <FormControl size="small" sx={{ maxWidth: 360 }}>
            <InputLabel id="rules-registration-status">{t(language, "rulesRegistrationStatusLabel")}</InputLabel>
            <Select
              labelId="rules-registration-status"
              label={t(language, "rulesRegistrationStatusLabel")}
              value={registration.status}
              onChange={(e) => setRegistration((r) => ({ ...r, status: e.target.value as RegistrationStatus }))}
            >
              {(Object.keys(REGISTRATION_OPTIONS) as RegistrationStatus[]).map((value) => (
                <MenuItem key={value} value={value}>{t(language, REGISTRATION_OPTIONS[value].label)}</MenuItem>
              ))}
            </Select>
            <FormHelperText>{t(language, REGISTRATION_OPTIONS[registration.status].help)}</FormHelperText>
          </FormControl>

          <FormControl size="small" sx={{ maxWidth: 360 }}>
            <InputLabel id="rules-default-page">{t(language, "rulesDefaultPageLabel")}</InputLabel>
            <Select
              labelId="rules-default-page"
              label={t(language, "rulesDefaultPageLabel")}
              value={registration.defaultPage}
              onChange={(e) => setRegistration((r) => ({ ...r, defaultPage: e.target.value as "login" | "register" }))}
            >
              <MenuItem value="login">{t(language, "rulesDefaultPageLogin")}</MenuItem>
              <MenuItem value="register">{t(language, "rulesDefaultPageRegister")}</MenuItem>
            </Select>
            <FormHelperText>{t(language, "rulesDefaultPageHelp")}</FormHelperText>
          </FormControl>

          <Stack spacing={0.5}>
            <FormControlLabel
              control={<Switch checked={registration.lockLevel} onChange={(e) => setRegistration((r) => ({ ...r, lockLevel: e.target.checked }))} />}
              label={t(language, "rulesLockLevelLabel")}
            />
            <Typography variant="body2" color="text.secondary">{t(language, "rulesLockLevelHelp")}</Typography>
          </Stack>

          <Stack spacing={0.5}>
            <FormControlLabel
              control={<Switch checked={registration.levelUpWarning} onChange={(e) => setRegistration((r) => ({ ...r, levelUpWarning: e.target.checked }))} />}
              label={t(language, "rulesLevelUpWarningLabel")}
            />
            <Typography variant="body2" color="text.secondary">{t(language, "rulesLevelUpWarningHelp")}</Typography>
          </Stack>

          <ActionButton
            tip={t(language, "tipRulesSaveRegistration")}
            variant="contained"
            size="small"
            wrapperSx={{ alignSelf: "flex-start" }}
            disabled={saving}
            onClick={saveRegistration}
          >
            {t(language, "adminSave")}
          </ActionButton>
        </Stack>
      </SectionCard>
    </Stack>
  );
}
