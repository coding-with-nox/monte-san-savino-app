import React, { useEffect, useState } from "react";
import {
  Chip,
  FormControl,
  Grid,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { api } from "../../lib/api";
import { Language, t } from "../../lib/i18n";
import SectionCard from "../../components/SectionCard";
import AwardReviewCard from "../../components/AwardReviewCard";
import PageSkeleton from "../../components/PageSkeleton";
import { useConfirm } from "../../components/ConfirmDialog";
import useToast from "../../components/useToast";
import { SectionErrors, useSections } from "./useSections";
import type { AdminData } from "./useAdminData";
import HonorsCard from "./HonorsCard";
import { ActionButton, TipIconButton } from "../../components/ActionButton";

type SpecialMention = { id: string; eventId: string; modelId: string; title: string };
type ModificationRequest = { id: string; modelId: string; judgeId: string; reason: string; status: string };

export default function AwardsTab({ language, data }: { language: Language; data: AdminData }) {
  const { events, categories, models, modelName, ensureModels } = data;
  const { confirm, node: confirmNode } = useConfirm(language);
  const toast = useToast();
  const [mentions, setMentions] = useState<SpecialMention[]>([]);
  const [modRequests, setModRequests] = useState<ModificationRequest[]>([]);
  const [mentionForm, setMentionForm] = useState({ eventId: "", modelId: "", title: "" });

  const { loading, errors, reload } = useSections(language, () => [
    { titleKey: "adminSpecialMentionsTitle", run: async () => setMentions(await api<SpecialMention[]>("/awards/mentions")) },
    { titleKey: "adminModRequestsTitle", run: async () => setModRequests(await api<ModificationRequest[]>("/admin/modification-requests")) }
  ]);

  // Model names (best effort, shared and fetched at most once) are needed only by this tab and the catalog.
  useEffect(() => { ensureModels(); }, [ensureModels]);

  async function createMention() {
    await api("/awards/mentions", {
      method: "POST",
      body: JSON.stringify({
        eventId: mentionForm.eventId,
        modelId: mentionForm.modelId.trim(),
        title: mentionForm.title.trim()
      })
    });
    setMentionForm({ eventId: "", modelId: "", title: "" });
    toast.success(t(language, "adminMentionCreate"));
    await reload();
  }

  async function deleteMention(id: string) {
    if (!(await confirm(t(language, "confirmDelete")))) return;
    await api(`/awards/mentions/${id}`, { method: "DELETE" });
    await reload();
  }

  async function updateModRequestStatus(id: string, status: string) {
    await api(`/admin/modification-requests/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
    await reload();
  }

  return (
    <Stack spacing={2}>
      {toast.node}
      <SectionErrors language={language} errors={errors} onRetry={() => void reload()} />
      {loading && <PageSkeleton variant="table" />}
      {!loading && (
        <>
          <HonorsCard language={language} events={events} categories={categories} models={models} />

          <SectionCard tourId="admin-mentions" title={t(language, "adminSpecialMentionsTitle")}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>{t(language, "adminMentionEvent")}</InputLabel>
                  <Select
                    value={mentionForm.eventId}
                    label={t(language, "adminMentionEvent")}
                    onChange={(e) => setMentionForm({ ...mentionForm, eventId: e.target.value })}
                  >
                    {events.map((ev) => (
                      <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  label={t(language, "adminMentionModel")}
                  value={mentionForm.modelId}
                  onChange={(e) => setMentionForm({ ...mentionForm, modelId: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  label={t(language, "adminMentionTitle")}
                  value={mentionForm.title}
                  onChange={(e) => setMentionForm({ ...mentionForm, title: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <ActionButton
                  tip={t(language, "tipMentionCreate")}
                  variant="contained"
                  onClick={createMention}
                  fullWidth
                  disabled={!mentionForm.eventId || !mentionForm.modelId.trim() || !mentionForm.title.trim()}
                >
                  {t(language, "adminMentionCreate")}
                </ActionButton>
              </Grid>
            </Grid>
            {mentions.length > 0 && (
              <>
                <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                  {t(language, "adminMentionsList")}
                </Typography>
                <List dense>
                  {mentions.map((m) => (
                    <ListItem key={m.id} disableGutters>
                      <ListItemText
                        primary={m.title}
                        secondary={`${data.eventName(m.eventId)} - ${t(language, "adminModelLabel")}: ${modelName(m.modelId)}`}
                      />
                      <TipIconButton tip={t(language, "tipMentionDelete")} aria-label={`${t(language, "actionDelete")} ${m.title}`} size="small" color="error" onClick={() => deleteMention(m.id)}>
                        <DeleteIcon fontSize="small" />
                      </TipIconButton>
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </SectionCard>

          <SectionCard tourId="admin-modrequests" title={t(language, "adminModRequestsTitle")}>
            <Stack spacing={1}>
              {modRequests.map((req) => (
                <Stack key={req.id} spacing={1}>
                  <Typography variant="body2">
                    {t(language, "adminModelLabel")}: {modelName(req.modelId)} - {req.reason}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Chip
                      label={req.status}
                      size="small"
                      color={req.status === "pending" ? "warning" : req.status === "resolved" ? "success" : "default"}
                    />
                    {req.status === "pending" && (
                      <>
                        <ActionButton tip={t(language, "tipModResolve")} size="small" variant="outlined" onClick={() => updateModRequestStatus(req.id, "resolved")}>
                          {t(language, "adminModRequestResolved")}
                        </ActionButton>
                        <ActionButton tip={t(language, "tipModReject")} size="small" variant="outlined" color="error" onClick={() => updateModRequestStatus(req.id, "rejected")}>
                          {t(language, "adminModRequestRejected")}
                        </ActionButton>
                      </>
                    )}
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </SectionCard>
        </>
      )}

      <SectionCard tourId="admin-corrections" title={t(language, "reviewTitle")}>
        <AwardReviewCard language={language} events={events} />
      </SectionCard>

      {confirmNode}
    </Stack>
  );
}
