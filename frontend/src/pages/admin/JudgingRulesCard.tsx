import React, { useEffect, useState } from "react";
import { FormControlLabel, Stack, Switch, TextField, Typography } from "@mui/material";
import { api } from "../../lib/api";
import { getRole } from "../../lib/auth";
import { Language, t } from "../../lib/i18n";
import SectionCard from "../../components/SectionCard";
import useToast from "../../components/useToast";
import { ActionButton } from "../../components/ActionButton";

/** Points of one judge vote at most: the maximum total of an exhibit is votes per exhibit × this value. */
export const MAX_VOTE_POINTS = 4;
export const DEFAULT_VOTES_PER_EXHIBIT = 3;
export const DEFAULT_MAX_VOTE_DIFFERENT = 2;
export const DEFAULT_MIN_PHOTO_MEDAL_RANK = 4;

const toWhole = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value.trim()) : null);

/** Judging rules (votes per exhibit, max vote difference, front desk register, photographers medal). Only the admin can save; others see the values. */
export default function JudgingRulesCard({ language }: { language: Language }) {
  const toast = useToast();
  const canEdit = getRole() === "admin";
  const [votes, setVotes] = useState(String(DEFAULT_VOTES_PER_EXHIBIT));
  const [diff, setDiff] = useState(String(DEFAULT_MAX_VOTE_DIFFERENT));
  const [absenceRegister, setAbsenceRegister] = useState(false);
  const [minPhotoMedal, setMinPhotoMedal] = useState(String(DEFAULT_MIN_PHOTO_MEDAL_RANK));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Record<string, string>>("/settings")
      .then((s) => {
        setVotes(s.maxVotesPerExhibitor ?? String(DEFAULT_VOTES_PER_EXHIBIT));
        setDiff(s.maxVoteDifferent ?? String(DEFAULT_MAX_VOTE_DIFFERENT));
        setAbsenceRegister(s.absenceRegisterEnabled === "true");
        setMinPhotoMedal(s.minPhotoMedalRank ?? String(DEFAULT_MIN_PHOTO_MEDAL_RANK));
      })
      .catch(() => undefined);
  }, []);

  const votesN = toWhole(votes);
  const diffN = toWhole(diff);
  const minMedalN = toWhole(minPhotoMedal);
  const valid =
    votesN !== null && votesN >= 1 && votesN <= 10 &&
    diffN !== null && diffN <= 40 &&
    minMedalN !== null && minMedalN <= 10;

  async function save() {
    if (!valid) {
      toast.error(t(language, "judgingRulesError"));
      return;
    }
    setSaving(true);
    try {
      await api("/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          maxVotesPerExhibitor: String(votesN),
          maxVoteDifferent: String(diffN),
          absenceRegisterEnabled: String(absenceRegister),
          minPhotoMedalRank: String(minMedalN)
        })
      });
      toast.success(t(language, "adminSaved"));
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard tourId="admin-judging" title={t(language, "judgingRulesTitle")}>
      {toast.node}
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">{t(language, "judgingRulesHelp")}</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            type="number"
            size="small"
            label={t(language, "judgingRulesVotesLabel")}
            helperText={t(language, "judgingRulesVotesHelp")}
            value={votes}
            onChange={(event) => setVotes(event.target.value)}
            disabled={!canEdit}
            inputProps={{ min: 1, max: 10 }}
            sx={{ width: 220 }}
          />
          <TextField
            type="number"
            size="small"
            label={t(language, "judgingRulesDiffLabel")}
            helperText={t(language, "judgingRulesDiffHelp")}
            value={diff}
            onChange={(event) => setDiff(event.target.value)}
            disabled={!canEdit}
            inputProps={{ min: 0, max: 40 }}
            sx={{ width: 220 }}
          />
          <TextField
            type="number"
            size="small"
            label={t(language, "judgingMinMedalLabel")}
            helperText={t(language, "judgingMinMedalHelp")}
            value={minPhotoMedal}
            onChange={(event) => setMinPhotoMedal(event.target.value)}
            disabled={!canEdit}
            inputProps={{ min: 0, max: 10 }}
            sx={{ width: 220 }}
          />
        </Stack>
        <Stack spacing={0.5}>
          <FormControlLabel
            control={
              <Switch
                checked={absenceRegister}
                onChange={(event) => setAbsenceRegister(event.target.checked)}
                disabled={!canEdit}
              />
            }
            label={t(language, "judgingAbsenceLabel")}
          />
          <Typography variant="body2" color="text.secondary">{t(language, "judgingAbsenceHelp")}</Typography>
        </Stack>
        {valid && (
          <Stack spacing={0.5}>
            <Typography variant="body2">
              {t(language, "judgingRulesExampleCount").replace("{votes}", String(votesN)).replace("{max}", String(votesN! * MAX_VOTE_POINTS))}
            </Typography>
            <Typography variant="body2">
              {t(language, "judgingRulesExampleDiff").replace(/\{diff\}/g, String(diffN)).replace("{over}", String(diffN! + 1))}
            </Typography>
          </Stack>
        )}
        {canEdit ? (
          <Stack direction="row" justifyContent="flex-end">
            <ActionButton tip={t(language, "tipSaveJudging")} variant="contained" size="small" onClick={save} disabled={saving || !valid}>
              {t(language, "adminSave")}
            </ActionButton>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">{t(language, "judgingRulesReadOnly")}</Typography>
        )}
      </Stack>
    </SectionCard>
  );
}
