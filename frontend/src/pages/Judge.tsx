import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  Container,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Popover,
  Select,
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
import HowToVoteIcon from "@mui/icons-material/HowToVote";
import EditNoteIcon from "@mui/icons-material/EditNote";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";

type JudgeEvent = { eventId: string; eventName: string };
type Model = { id: string; name: string; categoryId: string; categoryName: string; imageUrl?: string | null };

interface JudgeProps {
  language: Language;
}

export default function Judge({ language }: JudgeProps) {
  const [events, setEvents] = useState<JudgeEvent[]>([]);
  const [eventId, setEventId] = useState("");
  const [search, setSearch] = useState("");
  const [models, setModels] = useState<Model[]>([]);
  const [message, setMessage] = useState("");
  const [messageSeverity, setMessageSeverity] = useState<"success" | "error">("success");

  // Vote popover
  const [voteAnchor, setVoteAnchor] = useState<HTMLElement | null>(null);
  const [voteModelId, setVoteModelId] = useState("");
  const [voteRank, setVoteRank] = useState<number>(0);

  // Modification request popover
  const [modAnchor, setModAnchor] = useState<HTMLElement | null>(null);
  const [modModelId, setModModelId] = useState("");
  const [modReason, setModReason] = useState("");

  async function loadEvents() {
    const res = await api<JudgeEvent[]>("/judge/events");
    setEvents(res);
    if (res.length === 1) {
      setEventId(res[0].eventId);
    }
  }

  async function loadModels() {
    const query = new URLSearchParams();
    if (eventId) query.set("eventId", eventId);
    if (search) query.set("search", search);
    setModels(await api<Model[]>(`/judge/models?${query.toString()}`));
  }

  useEffect(() => {
    loadEvents().catch((err) => showMessage(err.message, "error"));
  }, []);

  useEffect(() => {
    loadModels().catch((err) => showMessage(err.message, "error"));
  }, [eventId]);

  function showMessage(msg: string, severity: "success" | "error" = "success") {
    setMessage(msg);
    setMessageSeverity(severity);
  }

  // --- Vote ---
  function openVotePopover(el: HTMLElement, modelId: string) {
    setVoteModelId(modelId);
    setVoteRank(0);
    setVoteAnchor(el);
  }

  async function submitVote() {
    try {
      await api("/judge/vote", { method: "POST", body: JSON.stringify({ modelId: voteModelId, rank: voteRank }) });
      showMessage(t(language, "judgeVoteSuccess"));
    } catch (err: any) {
      showMessage(err.message || "Error", "error");
    }
    setVoteAnchor(null);
  }

  // --- Modification request ---
  function openModPopover(el: HTMLElement, modelId: string) {
    setModModelId(modelId);
    setModReason("");
    setModAnchor(el);
  }

  async function submitModRequest() {
    try {
      await api("/judge/modification-requests", {
        method: "POST",
        body: JSON.stringify({ modelId: modModelId, reason: modReason })
      });
      showMessage(t(language, "judgeModRequestSent"));
    } catch (err: any) {
      showMessage(err.message || "Error", "error");
    }
    setModAnchor(null);
  }

  return (
    <Container maxWidth="lg">
      <Stack spacing={2}>
        <Typography variant="h4">{t(language, "judgeTitle")}</Typography>
        <Typography variant="body2" color="text.secondary">{t(language, "judgeRankHint")}</Typography>

        {message && <Alert severity={messageSeverity} onClose={() => setMessage("")}>{message}</Alert>}

        {/* Filters */}
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>{t(language, "judgeSelectEvent")}</InputLabel>
            <Select
              value={eventId}
              label={t(language, "judgeSelectEvent")}
              onChange={(e) => setEventId(e.target.value)}
            >
              <MenuItem value="">{t(language, "judgeSelectEvent")}</MenuItem>
              {events.map((ev) => (
                <MenuItem key={ev.eventId} value={ev.eventId}>{ev.eventName}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label={t(language, "judgeSearchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 200 }}
          />
          <Button variant="contained" onClick={loadModels}>{t(language, "judgeRefreshButton")}</Button>
        </Stack>

        {/* Models table */}
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>{t(language, "modelsNamePlaceholder")}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t(language, "modelsCategoryPlaceholder")}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, width: 120 }}>{t(language, "judgeActionsColumn")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {models.map((model) => (
                <TableRow key={model.id} hover>
                  <TableCell><Typography fontWeight={600}>{model.name}</Typography></TableCell>
                  <TableCell><Chip size="small" label={model.categoryName} /></TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <IconButton
                        size="small"
                        color="primary"
                        title={t(language, "judgeVoteTitle")}
                        onClick={(e) => openVotePopover(e.currentTarget, model.id)}
                      >
                        <HowToVoteIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="warning"
                        title={t(language, "judgeModRequestTitle")}
                        onClick={(e) => openModPopover(e.currentTarget, model.id)}
                      >
                        <EditNoteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {models.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                      {t(language, "judgeSearchPlaceholder")}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>

      {/* Vote Popover */}
      <Popover
        open={Boolean(voteAnchor)}
        anchorEl={voteAnchor}
        onClose={() => setVoteAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Stack spacing={1.5} sx={{ p: 2, minWidth: 220 }}>
          <Typography variant="subtitle2">{t(language, "judgeVoteTitle")}</Typography>
          <FormControl size="small" fullWidth>
            <InputLabel>Rank</InputLabel>
            <Select value={voteRank} label="Rank" onChange={(e) => setVoteRank(Number(e.target.value))}>
              {[0, 1, 2, 3].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="contained" size="small" onClick={submitVote}>{t(language, "judgeVoteButton")}</Button>
        </Stack>
      </Popover>

      {/* Modification Request Popover */}
      <Popover
        open={Boolean(modAnchor)}
        anchorEl={modAnchor}
        onClose={() => setModAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Stack spacing={1.5} sx={{ p: 2, minWidth: 280 }}>
          <Typography variant="subtitle2">{t(language, "judgeModRequestTitle")}</Typography>
          <TextField
            size="small"
            label={t(language, "judgeModRequestReason")}
            value={modReason}
            onChange={(e) => setModReason(e.target.value)}
            multiline
            rows={2}
            fullWidth
          />
          <Button variant="contained" size="small" onClick={submitModRequest} disabled={!modReason.trim()}>
            {t(language, "judgeModRequestSubmit")}
          </Button>
        </Stack>
      </Popover>
    </Container>
  );
}
