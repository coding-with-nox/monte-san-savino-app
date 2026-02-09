import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Container,
  FormControl,
  Grid,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";

type Model = { id: string; name: string; categoryId: string; imageUrl?: string | null };

interface JudgeProps {
  language: Language;
}

export default function Judge({ language }: JudgeProps) {
  const [modelId, setModelId] = useState("");
  const [rank, setRank] = useState<number>(0);
  const [out, setOut] = useState("");
  const [eventId, setEventId] = useState("");
  const [search, setSearch] = useState("");
  const [models, setModels] = useState<Model[]>([]);
  const [modReason, setModReason] = useState("");
  const [modMessage, setModMessage] = useState("");

  async function loadModels() {
    const query = new URLSearchParams();
    if (eventId) query.set("eventId", eventId);
    if (search) query.set("search", search);
    const res = await api<Model[]>(`/judge/models?${query.toString()}`);
    setModels(res);
  }

  async function vote() {
    const res = await api<any>("/judge/vote", { method: "POST", body: JSON.stringify({ modelId, rank }) });
    setOut(JSON.stringify(res, null, 2));
  }

  async function requestModification() {
    await api("/judge/modification-requests", {
      method: "POST",
      body: JSON.stringify({ modelId, reason: modReason })
    });
    setModReason("");
    setModMessage(t(language, "judgeModRequestSent"));
  }

  useEffect(() => {
    loadModels();
  }, []);

  return (
    <Container maxWidth="lg">
      <Stack spacing={3}>
        <Typography variant="h4">{t(language, "judgeTitle")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t(language, "judgeRankHint")}
        </Typography>
        <Card>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  label={t(language, "judgeEventPlaceholder")}
                  value={eventId}
                  onChange={(event) => setEventId(event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label={t(language, "judgeSearchPlaceholder")}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Button variant="contained" onClick={loadModels} fullWidth>
                  {t(language, "judgeRefreshButton")}
                </Button>
              </Grid>
            </Grid>
            <List dense sx={{ mt: 2 }}>
              {models.map((model) => (
                <ListItemButton key={model.id} onClick={() => setModelId(model.id)}>
                  <ListItemText primary={model.name} secondary={model.categoryId} />
                </ListItemButton>
              ))}
            </List>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {t(language, "judgeVoteTitle")}
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={6}>
                <TextField
                  label={t(language, "judgeModelIdPlaceholder")}
                  value={modelId}
                  onChange={(event) => setModelId(event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel id="rank-label">Rank</InputLabel>
                  <Select
                    labelId="rank-label"
                    value={rank}
                    label="Rank"
                    onChange={(event) => setRank(Number(event.target.value))}
                  >
                    {[0, 1, 2, 3].map((value) => (
                      <MenuItem key={value} value={value}>
                        {value}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <Button variant="contained" onClick={vote} fullWidth>
                  {t(language, "judgeVoteButton")}
                </Button>
              </Grid>
            </Grid>
            {out && (
              <Typography component="pre" sx={{ mt: 2, whiteSpace: "pre-wrap" }}>
                {out}
              </Typography>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {t(language, "judgeModRequestTitle")}
            </Typography>
            {modMessage && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setModMessage("")}>{modMessage}</Alert>}
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  label={t(language, "judgeModRequestModel")}
                  value={modelId}
                  onChange={(event) => setModelId(event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={5}>
                <TextField
                  label={t(language, "judgeModRequestReason")}
                  value={modReason}
                  onChange={(event) => setModReason(event.target.value)}
                  fullWidth
                  multiline
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <Button variant="outlined" onClick={requestModification} fullWidth disabled={!modelId || !modReason}>
                  {t(language, "judgeModRequestSubmit")}
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}
