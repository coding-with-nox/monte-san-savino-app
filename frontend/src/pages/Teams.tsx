import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  ButtonGroup,
  Chip,
  Collapse,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
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
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";
import PageContainer from "../components/PageContainer";
import SectionCard from "../components/SectionCard";
import EmptyState from "../components/EmptyState";
import useToast from "../components/useToast";

type TeamMate = { id?: string; name: string; surname: string; role: string; email?: string };
type Team = {
  id: string;
  name: string;
  displayNumber: string;
  categoryId: string;
  matesCount?: number;
  mates?: TeamMate[];
};
type Category = { id: string; eventId: string; name: string; status: string };
type MemberRole = { id: string; name: string };

interface TeamsProps {
  language: Language;
}

export default function Teams({ language }: TeamsProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [memberRoles, setMemberRoles] = useState<MemberRole[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedMates, setExpandedMates] = useState<TeamMate[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const [editName, setEditName] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [teamNameMode, setTeamNameMode] = useState<"auto" | "manual">("manual");
  const [mates, setMates] = useState<TeamMate[]>([]);

  const [newMateName, setNewMateName] = useState("");
  const [newMateSurname, setNewMateSurname] = useState("");
  const [newMateRole, setNewMateRole] = useState("");
  const [newMateEmail, setNewMateEmail] = useState("");
  const [emailError, setEmailError] = useState(false);

  async function load() {
    try {
      setTeams(await api<Team[]>("/teams"));
    } catch {
      setTeams([]);
    }
  }

  async function loadCategories() {
    try {
      setCategories(await api<Category[]>("/public/categories"));
    } catch {
      setCategories([]);
    }
  }

  async function loadMemberRoles() {
    try {
      setMemberRoles(await api<MemberRole[]>("/public/member-roles"));
    } catch {
      setMemberRoles([]);
    }
  }

  function resetForm() {
    setEditName("");
    setEditCategoryId("");
    setTeamNameMode("manual");
    setMates([]);
    setNewMateName("");
    setNewMateSurname("");
    setNewMateRole("");
    setNewMateEmail("");
    setEmailError(false);
  }

  function startCreate() {
    setExpandedId(null);
    setExpandedMates([]);
    resetForm();
    setIsCreating(true);
  }

  function closePanel() {
    setExpandedId(null);
    setExpandedMates([]);
    setIsCreating(false);
    resetForm();
  }

  async function openTeam(teamId: string) {
    if (expandedId === teamId) {
      closePanel();
      return;
    }
    try {
      const d = await api<{ team: Team; mates: TeamMate[] }>(`/teams/${teamId}`);
      setEditName(d.team.name);
      setEditCategoryId(d.team.categoryId);
      setTeamNameMode("manual");
      setMates(d.mates || []);
      setExpandedMates(d.mates || []);
      setEmailError(false);
      setExpandedId(teamId);
      setIsCreating(false);
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    }
  }

  async function createTeam() {
    setSaving(true);
    try {
      await api<{ id: string; displayNumber: string }>("/teams", {
        method: "POST",
        body: JSON.stringify({
          name: editName.trim(),
          categoryId: editCategoryId,
          mates
        })
      });
      setIsCreating(false);
      resetForm();
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  async function saveTeam() {
    if (!expandedId) return;
    setSaving(true);
    try {
      await api(`/teams/${expandedId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editName.trim(),
          categoryId: editCategoryId
        })
      });
      // Sync mates: delete removed, add new
      const originalMates = expandedMates;
      for (const orig of originalMates) {
        if (orig.id && !mates.find(m => m.id === orig.id)) {
          await api(`/teams/${expandedId}/mates/${orig.id}`, { method: "DELETE" });
        }
      }
      for (const m of mates) {
        if (!m.id) {
          await api(`/teams/${expandedId}/mates`, {
            method: "POST",
            body: JSON.stringify({ name: m.name, surname: m.surname, role: m.role, ...(m.email ? { email: m.email } : {}) })
          });
        }
      }
      closePanel();
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteTeam(teamId: string) {
    try {
      await api(`/teams/${teamId}`, { method: "DELETE" });
      if (expandedId === teamId) closePanel();
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    }
  }

  function addMate() {
    if (!newMateName.trim() || !newMateSurname.trim() || !newMateRole) return;
    if (newMateEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newMateEmail.trim())) {
      setEmailError(true);
      return;
    }
    setEmailError(false);
    setMates(prev => [...prev, {
      name: newMateName.trim(),
      surname: newMateSurname.trim(),
      role: newMateRole,
      ...(newMateEmail.trim() ? { email: newMateEmail.trim() } : {})
    }]);
    setNewMateName("");
    setNewMateSurname("");
    setNewMateRole("");
    setNewMateEmail("");
  }

  function removeMate(idx: number) {
    setMates(prev => prev.filter((_, i) => i !== idx));
  }

  useEffect(() => {
    if (teamNameMode === "auto") {
      setEditName(mates.map(m => m.surname).filter(Boolean).join(" / "));
    }
  }, [teamNameMode, mates]);

  useEffect(() => { load(); loadCategories(); loadMemberRoles(); }, []);

  const getCategoryName = (catId: string) => {
    const cat = categories.find(c => c.id === catId);
    return cat ? cat.name : catId;
  };

  const editPanel = (
    <Box sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="body2">{t(language, "teamsNameLabel")}:</Typography>
          <ButtonGroup size="small" variant="outlined">
            <Button
              onClick={() => setTeamNameMode("manual")}
              variant={teamNameMode === "manual" ? "contained" : "outlined"}
            >
              {t(language, "teamsNameManual")}
            </Button>
            <Button
              onClick={() => setTeamNameMode("auto")}
              variant={teamNameMode === "auto" ? "contained" : "outlined"}
            >
              {t(language, "teamsNameAuto")}
            </Button>
          </ButtonGroup>
        </Stack>
        <TextField
          label={t(language, "teamsNameLabel")}
          value={editName}
          onChange={e => setEditName(e.target.value)}
          fullWidth
          size="small"
          disabled={teamNameMode === "auto"}
        />
        <FormControl fullWidth size="small">
          <InputLabel>{t(language, "teamsCategoryLabel")}</InputLabel>
          <Select
            value={editCategoryId}
            label={t(language, "teamsCategoryLabel")}
            onChange={e => setEditCategoryId(e.target.value)}
          >
            {categories.map(cat => (
              <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1.5 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>{t(language, "teamsMatesSection")}</Typography>
          {mates.map((m, idx) => (
            <Stack key={idx} direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <Typography variant="body2" sx={{ flexGrow: 1 }}>
                {m.name} {m.surname} — {m.role}{m.email ? ` (${m.email})` : ""}
              </Typography>
              <IconButton size="small" color="error" onClick={() => removeMate(idx)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
          <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
            <TextField
              size="small"
              label={t(language, "modelsMemberName")}
              value={newMateName}
              onChange={e => setNewMateName(e.target.value)}
              sx={{ flex: 1, minWidth: 100 }}
            />
            <TextField
              size="small"
              label={t(language, "modelsMemberSurname")}
              value={newMateSurname}
              onChange={e => setNewMateSurname(e.target.value)}
              sx={{ flex: 1, minWidth: 100 }}
            />
            <TextField
              size="small"
              label="Email"
              value={newMateEmail}
              onChange={e => setNewMateEmail(e.target.value)}
              sx={{ flex: 1, minWidth: 140 }}
              type="email"
              error={emailError}
              helperText={emailError ? t(language, "emailValidationInvalid") : ""}
            />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>{t(language, "modelsMemberRole")}</InputLabel>
              <Select
                value={newMateRole}
                label={t(language, "modelsMemberRole")}
                onChange={e => setNewMateRole(e.target.value)}
              >
                {memberRoles.map(r => (
                  <MenuItem key={r.id} value={r.name}>{r.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              size="small"
              onClick={addMate}
              disabled={!newMateName.trim() || !newMateSurname.trim() || !newMateRole}
            >
              {t(language, "teamsAddMemberButton")}
            </Button>
          </Stack>
        </Box>

        <Button
          variant="contained"
          onClick={isCreating ? createTeam : saveTeam}
          disabled={saving || !editName.trim() || !editCategoryId}
          fullWidth
        >
          {saving ? "..." : t(language, "teamsSaveButton")}
        </Button>
      </Stack>
    </Box>
  );

  return (
    <PageContainer maxWidth="lg">
      {toast.node}
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h4">{t(language, "teamsTitle")}</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={startCreate}>
            {t(language, "teamsCreateButton")}
          </Button>
        </Stack>

        <Collapse in={isCreating}>
          <Paper variant="outlined" sx={{ mb: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, pt: 1.5 }}>
              <Typography variant="subtitle2">{t(language, "teamsCreateButton")}</Typography>
              <IconButton size="small" onClick={() => setIsCreating(false)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
            {editPanel}
          </Paper>
        </Collapse>

        <SectionCard title={t(language, "teamsTitle")}>
          {teams.length === 0 && (
            <EmptyState title={t(language, "teamsNoTeams")} description="" />
          )}
          {teams.length > 0 && (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>{t(language, "teamsNameLabel")}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{t(language, "teamsDisplayNumber")}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{t(language, "teamsCategoryLabel")}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{t(language, "teamsMatesSection")}</TableCell>
                    <TableCell align="right" sx={{ width: 100 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {teams.map(team => (
                    <React.Fragment key={team.id}>
                      <TableRow
                        hover
                        sx={{
                          cursor: "pointer",
                          "& > td": { borderBottom: expandedId === team.id ? "none" : undefined }
                        }}
                        onClick={() => openTeam(team.id)}
                        selected={expandedId === team.id}
                      >
                        <TableCell>
                          <Typography fontWeight={600}>{team.name}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            variant="outlined"
                            label={team.displayNumber || "-"}
                            sx={{ "& .MuiChip-label": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" } }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={getCategoryName(team.categoryId)} />
                        </TableCell>
                        <TableCell>
                          {team.matesCount != null ? team.matesCount : "-"}
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <IconButton
                              size="small"
                              onClick={e => { e.stopPropagation(); openTeam(team.id); }}
                              color="primary"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={e => { e.stopPropagation(); deleteTeam(team.id); }}
                              color="error"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={5} sx={{ p: 0 }}>
                          <Collapse in={expandedId === team.id} unmountOnExit>
                            <Divider />
                            {editPanel}
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </SectionCard>
      </Stack>
    </PageContainer>
  );
}
