import React, { useState } from "react";
import { Button, FormControl, Grid, IconButton, InputLabel, List, ListItem, ListItemText, MenuItem, Select, TextField } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { api } from "../../lib/api";
import { Language, t } from "../../lib/i18n";
import SectionCard from "../../components/SectionCard";
import PageSkeleton from "../../components/PageSkeleton";
import { useConfirm } from "../../components/ConfirmDialog";
import { SectionErrors, useSections } from "./useSections";
import type { AdminData } from "./useAdminData";

type EventCampaign = { id: string; eventId: string; name: string; enrollmentOpenDate?: string | null; enrollmentCloseDate?: string | null };

export default function CampaignsCard({ language, data }: { language: Language; data: AdminData }) {
  const { events, eventName } = data;
  const { confirm, node: confirmNode } = useConfirm(language);
  const [campaigns, setCampaigns] = useState<EventCampaign[]>([]);
  const [form, setForm] = useState({ eventId: "", name: "", enrollmentOpenDate: "", enrollmentCloseDate: "" });
  const { loading, errors, reload } = useSections(language, () => [
    { titleKey: "adminEventCampaignsTitle", run: async () => setCampaigns(await api<EventCampaign[]>("/admin/event-campaigns")) }
  ]);

  async function createCampaign() {
    if (!form.eventId || !form.name.trim()) return;
    await api("/admin/event-campaigns", {
      method: "POST",
      body: JSON.stringify({
        eventId: form.eventId,
        name: form.name.trim(),
        enrollmentOpenDate: form.enrollmentOpenDate || undefined,
        enrollmentCloseDate: form.enrollmentCloseDate || undefined
      })
    });
    setForm({ eventId: "", name: "", enrollmentOpenDate: "", enrollmentCloseDate: "" });
    await reload();
  }

  async function deleteCampaign(id: string) {
    if (!(await confirm(t(language, "confirmDelete")))) return;
    await api(`/admin/event-campaigns/${id}`, { method: "DELETE" });
    await reload();
  }

  return (
    <>
      <SectionErrors language={language} errors={errors} onRetry={() => void reload()} />
      <SectionCard title={t(language, "adminEventCampaignsTitle")}>
        <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>{t(language, "adminJudgeEventPlaceholder")}</InputLabel>
              <Select
                value={form.eventId}
                label={t(language, "adminJudgeEventPlaceholder")}
                onChange={(e) => setForm({ ...form, eventId: e.target.value })}
              >
                {events.map((ev) => <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              label={t(language, "adminCampaignNamePlaceholder")}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              size="small"
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              label={t(language, "adminCampaignOpenDate")}
              value={form.enrollmentOpenDate}
              onChange={(e) => setForm({ ...form, enrollmentOpenDate: e.target.value })}
              size="small"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              label={t(language, "adminCampaignCloseDate")}
              value={form.enrollmentCloseDate}
              onChange={(e) => setForm({ ...form, enrollmentCloseDate: e.target.value })}
              size="small"
              type="date"
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button variant="contained" onClick={createCampaign} disabled={!form.eventId || !form.name.trim()} fullWidth>
              {t(language, "adminCreateButton")}
            </Button>
          </Grid>
        </Grid>
        {loading ? (
          <PageSkeleton variant="table" rows={2} />
        ) : (
          <List dense>
            {campaigns.map((c) => (
              <ListItem key={c.id} disableGutters secondaryAction={
                <IconButton size="small" color="error" onClick={() => deleteCampaign(c.id)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              }>
                <ListItemText
                  primary={`${c.name} — ${eventName(c.eventId)}`}
                  secondary={`${c.enrollmentOpenDate ?? "—"} → ${c.enrollmentCloseDate ?? "—"}`}
                />
              </ListItem>
            ))}
            {campaigns.length === 0 && (
              <ListItem><ListItemText secondary={t(language, "adminNoData")} /></ListItem>
            )}
          </List>
        )}
      </SectionCard>
      {confirmNode}
    </>
  );
}
