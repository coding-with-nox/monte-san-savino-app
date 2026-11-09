import React, { useState } from "react";
import {
  Button, FormControl, Grid, IconButton, InputLabel, List, ListItem, ListItemText, MenuItem, Select, Stack, TextField
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { api } from "../../lib/api";
import { Language, t } from "../../lib/i18n";
import SectionCard from "../../components/SectionCard";
import PageSkeleton from "../../components/PageSkeleton";
import { useConfirm } from "../../components/ConfirmDialog";
import { SectionErrors, useSections } from "./useSections";
import type { AdminData } from "./useAdminData";

type Sponsor = { id: string; eventId: string; name: string; tier: string };

export default function SponsorsTab({ language, data }: { language: Language; data: AdminData }) {
  const { events, eventName } = data;
  const { confirm, node: confirmNode } = useConfirm(language);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [form, setForm] = useState({ eventId: "", name: "", tier: "bronze" });
  const { loading, errors, reload } = useSections(language, () => [
    { titleKey: "adminSponsorsTitle", run: async () => setSponsors(await api<Sponsor[]>("/sponsors")) }
  ]);

  async function createSponsor() {
    await api("/sponsors", { method: "POST", body: JSON.stringify(form) });
    setForm({ eventId: "", name: "", tier: "bronze" });
    await reload();
  }

  async function deleteSponsor(id: string) {
    if (!(await confirm(t(language, "confirmDelete")))) return;
    await api(`/sponsors/${id}`, { method: "DELETE" });
    await reload();
  }

  return (
    <Stack spacing={2}>
      <SectionErrors language={language} errors={errors} onRetry={() => void reload()} />
      {loading && <PageSkeleton variant="table" />}
      {!loading && (
        <SectionCard title={t(language, "adminSponsorsTitle")}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>{t(language, "adminSponsorEvent")}</InputLabel>
                <Select
                  value={form.eventId}
                  label={t(language, "adminSponsorEvent")}
                  onChange={(e) => setForm({ ...form, eventId: e.target.value })}
                >
                  {events.map((ev) => (
                    <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label={t(language, "adminSponsorName")}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Select
                value={form.tier}
                onChange={(e) => setForm({ ...form, tier: e.target.value })}
                fullWidth
                size="small"
              >
                <MenuItem value="bronze">Bronze</MenuItem>
                <MenuItem value="silver">Silver</MenuItem>
                <MenuItem value="gold">Gold</MenuItem>
                <MenuItem value="platinum">Platinum</MenuItem>
              </Select>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button variant="contained" onClick={createSponsor} fullWidth>
                {t(language, "adminSponsorCreate")}
              </Button>
            </Grid>
          </Grid>
          <List dense sx={{ mt: 2 }}>
            {sponsors.map((s) => (
              <ListItem key={s.id} disableGutters>
                <ListItemText primary={s.name} secondary={`${s.tier} - ${eventName(s.eventId)}`} />
                <IconButton size="small" color="error" onClick={() => deleteSponsor(s.id)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </ListItem>
            ))}
          </List>
        </SectionCard>
      )}
      {confirmNode}
    </Stack>
  );
}
