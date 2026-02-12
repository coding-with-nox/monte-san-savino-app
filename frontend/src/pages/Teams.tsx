import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Container,
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
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
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";

type Team = { id: string; name: string; ownerId: string; role: string };
type TeamDetail = { team?: Team; members?: { teamId: string; userId: string; role: string }[] };

interface TeamsProps {
  language: Language;
}

export default function Teams({ language }: TeamsProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TeamDetail | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editName, setEditName] = useState("");
  const [memberId, setMemberId] = useState("");

  async function load() {
    setTeams(await api<Team[]>("/teams"));
  }

  async function openTeam(teamId: string) {
    if (expandedId === teamId) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    const d = await api<TeamDetail>(`/teams/${teamId}`);
    setDetail(d);
    setEditName(d.team?.name || "");
    setExpandedId(teamId);
    setIsCreating(false);
    setMemberId("");
  }

  function closePanel() {
    setExpandedId(null);
    setDetail(null);
    setIsCreating(false);
  }

  function startCreate() {
    setExpandedId(null);
    setDetail(null);
    setEditName("");
    setMemberId("");
    setIsCreating(true);
  }

  async function createTeam() {
    setSaving(true);
    try {
      await api("/teams", { method: "POST", body: JSON.stringify({ name: editName.trim() }) });
      setIsCreating(false);
      await load();
    } catch (err: any) {
      setMessage(err.message || "Unable to create team");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTeam(teamId: string) {
    await api(`/teams/${teamId}`, { method: "DELETE" });
    if (expandedId === teamId) closePanel();
    await load();
  }

  async function addMember() {
    if (!detail?.team) return;
    setSaving(true);
    try {
      await api(`/teams/${detail.team.id}/members`, { method: "POST", body: JSON.stringify({ userId: memberId.trim() }) });
      setMemberId("");
      const d = await api<TeamDetail>(`/teams/${detail.team.id}`);
      setDetail(d);
    } catch (err: any) {
      setMessage(err.message || "Unable to add member");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    load().catch((err) => setMessage(err.message));
  }, []);

  const editPanel = (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={2} alignItems="flex-start">
        <Grid item xs={12} md={isCreating ? 12 : 6}>
          <Stack spacing={1.5}>
            <Typography variant="subtitle2">
              {isCreating ? t(language, "teamsCreateButton") : t(language, "teamsDetailTitle")}
            </Typography>
            <TextField
              label={t(language, "teamsNamePlaceholder")}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              fullWidth
              size="small"
              disabled={!isCreating}
            />
            {isCreating && (
              <Button
                variant="contained"
                onClick={createTeam}
                disabled={saving || !editName.trim()}
                fullWidth
              >
                {saving ? "..." : t(language, "teamsCreateButton")}
              </Button>
            )}
          </Stack>
        </Grid>
        {!isCreating && detail && (
          <Grid item xs={12} md={6}>
            <Stack spacing={1.5}>
              <Typography variant="subtitle2">{t(language, "teamsAddMemberButton")}</Typography>
              {(detail.members && detail.members.length > 0) && (
                <List dense disablePadding>
                  {detail.members.map((member) => (
                    <ListItem key={member.userId} disableGutters>
                      <ListItemText
                        primary={member.userId}
                        secondary={member.role}
                        primaryTypographyProps={{ variant: "body2" }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
              {(!detail.members || detail.members.length === 0) && (
                <Typography variant="body2" color="text.secondary">—</Typography>
              )}
              <Divider />
              <Stack direction="row" spacing={1}>
                <TextField
                  label={t(language, "teamsMemberPlaceholder")}
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                  size="small"
                  fullWidth
                />
                <Button
                  variant="outlined"
                  onClick={addMember}
                  disabled={saving || !memberId.trim()}
                >
                  {t(language, "teamsAddMemberButton")}
                </Button>
              </Stack>
            </Stack>
          </Grid>
        )}
      </Grid>
    </Box>
  );

  return (
    <Container maxWidth="lg">
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h4">{t(language, "teamsTitle")}</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={startCreate}>
            {t(language, "teamsCreateButton")}
          </Button>
        </Stack>
        {message && <Alert severity="error" onClose={() => setMessage("")}>{message}</Alert>}
        <Collapse in={isCreating}>
          <Paper variant="outlined" sx={{ mb: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, pt: 1.5 }}>
              <Typography variant="subtitle2">{t(language, "teamsCreateButton")}</Typography>
              <IconButton size="small" onClick={() => setIsCreating(false)}><CloseIcon fontSize="small" /></IconButton>
            </Stack>
            {editPanel}
          </Paper>
        </Collapse>
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>{t(language, "teamsNamePlaceholder")}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                <TableCell align="right" sx={{ width: 100 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {teams.map((team) => (
                <React.Fragment key={team.id}>
                  <TableRow
                    hover
                    sx={{ cursor: "pointer", "& > td": { borderBottom: expandedId === team.id ? "none" : undefined } }}
                    onClick={() => openTeam(team.id)}
                    selected={expandedId === team.id}
                  >
                    <TableCell><Typography fontWeight={600}>{team.name}</Typography></TableCell>
                    <TableCell><Chip size="small" label={team.role} /></TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); openTeam(team.id); }} color="primary">
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); deleteTeam(team.id); }} color="error">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={3} sx={{ p: 0 }}>
                      <Collapse in={expandedId === team.id} unmountOnExit>
                        <Divider />
                        {editPanel}
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
              {teams.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                      {t(language, "teamsSelectHint")}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
    </Container>
  );
}
