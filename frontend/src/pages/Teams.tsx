import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";

type Team = { id: string; name: string; ownerId: string; role: string };
type TeamDetail = { team?: Team; members?: { teamId: string; userId: string; role: string }[] };

interface TeamsProps {
  language: Language;
}

export default function Teams({ language }: TeamsProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<TeamDetail | null>(null);
  const [memberId, setMemberId] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setTeams(await api<Team[]>("/teams"));
  }

  async function createTeam() {
    await api("/teams", { method: "POST", body: JSON.stringify({ name }) });
    setName("");
    await load();
  }

  async function openTeam(teamId: string) {
    const detail = await api<TeamDetail>(`/teams/${teamId}`);
    setSelected(detail);
  }

  async function addMember() {
    if (!selected?.team) return;
    await api(`/teams/${selected.team.id}/members`, { method: "POST", body: JSON.stringify({ userId: memberId }) });
    setMemberId("");
    await openTeam(selected.team.id);
  }

  useEffect(() => {
    load().catch((err) => setMessage(err.message));
  }, []);

  return (
    <Container maxWidth="lg">
      <Stack spacing={3}>
        <Typography variant="h4">{t(language, "teamsTitle")}</Typography>
        <Card>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={8}>
                <TextField
                  label={t(language, "teamsNamePlaceholder")}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Button variant="contained" onClick={createTeam} fullWidth>
                  {t(language, "teamsCreateButton")}
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t(language, "teamsListTitle")}
                </Typography>
                <List dense>
                  {teams.map((team) => (
                    <ListItemButton key={team.id} onClick={() => openTeam(team.id)}>
                      <ListItemText primary={team.name} secondary={team.role} />
                    </ListItemButton>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t(language, "teamsDetailTitle")}
                </Typography>
                {selected?.team ? (
                  <Stack spacing={2}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {selected.team.name}
                    </Typography>
                    <List dense>
                      {selected.members?.map((member) => (
                        <ListItem key={member.userId} disableGutters>
                          <ListItemText primary={member.userId} secondary={member.role} />
                        </ListItem>
                      ))}
                    </List>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} md={7}>
                        <TextField
                          label={t(language, "teamsMemberPlaceholder")}
                          value={memberId}
                          onChange={(event) => setMemberId(event.target.value)}
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} md={5}>
                        <Button variant="outlined" onClick={addMember} fullWidth>
                          {t(language, "teamsAddMemberButton")}
                        </Button>
                      </Grid>
                    </Grid>
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t(language, "teamsSelectHint")}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        {message && <Alert severity="info">{message}</Alert>}
      </Stack>
    </Container>
  );
}
