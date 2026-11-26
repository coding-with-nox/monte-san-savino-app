import React, { useEffect, useState } from "react";
import {
  Alert, Button, Checkbox, IconButton, InputAdornment, List, ListItem, ListItemText, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography
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

type Visibility = { sections: string[]; roles: string[]; visibility: Record<string, string[]> };

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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Record<string, string>>("/settings")
      .then((s) => {
        const cents = Number.parseInt(s?.baseFeeCents ?? "", 10);
        if (Number.isFinite(cents)) setFee(String(cents / 100));
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

  function move(index: number, delta: -1 | 1) {
    setOrder((current) => {
      const next = [...current];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
  }

  const sectionName = (key: string) => (SECTION_KEYS[key] ? t(language, SECTION_KEYS[key]) : key);
  const editableRoles = matrix?.roles.filter((r) => r !== "admin") ?? [];

  return (
    <Stack spacing={2}>
      {toast.node}
      <SectionCard title={t(language, "rulesFeeTitle")}>
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
            <Button variant="contained" size="small" onClick={saveFee} disabled={saving || !fee.trim()}>
              {t(language, "adminSave")}
            </Button>
          </Stack>
        </Stack>
      </SectionCard>

      <SectionCard title={t(language, "rulesVisibilityTitle")}>
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
            <Button
              variant="contained"
              size="small"
              sx={{ alignSelf: "flex-start" }}
              disabled={saving}
              onClick={() => save("/admin/settings/section-visibility", {
                visibility: Object.fromEntries(editableRoles.map((r) => [r, matrix.visibility[r] ?? []]))
              })}
            >
              {t(language, "adminSave")}
            </Button>
          </Stack>
        )}
      </SectionCard>

      <SectionCard title={t(language, "rulesPrizeTitle")}>
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">{t(language, "rulesPrizeHelp")}</Typography>
          <List dense disablePadding data-testid="prize-order" sx={{ maxWidth: 360 }}>
            {order.map((label, i) => (
              <ListItem
                key={label}
                disableGutters
                secondaryAction={
                  <>
                    <IconButton size="small" aria-label={`${t(language, "rulesMoveUp")}: ${label}`} disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUpwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" aria-label={`${t(language, "rulesMoveDown")}: ${label}`} disabled={i === order.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDownwardIcon fontSize="small" />
                    </IconButton>
                  </>
                }
              >
                <ListItemText primary={`${i + 1}. ${label}`} />
              </ListItem>
            ))}
          </List>
          <Button
            variant="contained"
            size="small"
            sx={{ alignSelf: "flex-start" }}
            disabled={saving}
            onClick={() => save("/admin/settings/prize-order", { order })}
          >
            {t(language, "adminSave")}
          </Button>
        </Stack>
      </SectionCard>
    </Stack>
  );
}
