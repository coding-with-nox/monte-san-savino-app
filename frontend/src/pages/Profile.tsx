import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardActions,
  CardContent,
  Container,
  Grid,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";

type Profile = {
  email?: string;
  role?: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  city?: string | null;
  address?: string | null;
  emergencyContact?: string | null;
  avatarUrl?: string | null;
};

interface ProfileProps {
  language: Language;
}

export default function Profile({ language }: ProfileProps) {
  const [profile, setProfile] = useState<Profile>({});
  const [message, setMessage] = useState("");

  async function load() {
    const res = await api<Profile>("/users/profile");
    setProfile(res ?? {});
  }

  async function save() {
    await api("/users/profile", { method: "PUT", body: JSON.stringify(profile) });
    setMessage(t(language, "profileSaved"));
  }

  useEffect(() => {
    load().catch((err) => setMessage(err.message));
  }, []);

  return (
    <Container maxWidth="md">
      <Stack spacing={3}>
        <Typography variant="h4">{t(language, "profileTitle")}</Typography>
        <Card>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label={t(language, "profileFirstName")}
                  value={profile.firstName ?? ""}
                  onChange={(event) => setProfile({ ...profile, firstName: event.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label={t(language, "profileLastName")}
                  value={profile.lastName ?? ""}
                  onChange={(event) => setProfile({ ...profile, lastName: event.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label={t(language, "profilePhone")}
                  value={profile.phone ?? ""}
                  onChange={(event) => setProfile({ ...profile, phone: event.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label={t(language, "profileCity")}
                  value={profile.city ?? ""}
                  onChange={(event) => setProfile({ ...profile, city: event.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label={t(language, "profileAddress")}
                  value={profile.address ?? ""}
                  onChange={(event) => setProfile({ ...profile, address: event.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label={t(language, "profileEmergencyContact")}
                  value={profile.emergencyContact ?? ""}
                  onChange={(event) => setProfile({ ...profile, emergencyContact: event.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6} md={6}>
                <TextField
                  label={t(language, "profileAvatarUrl")}
                  value={profile.avatarUrl ?? ""}
                  onChange={(event) => setProfile({ ...profile, avatarUrl: event.target.value })}
                  fullWidth
                />
              </Grid>
            </Grid>
          </CardContent>
          <CardActions sx={{ px: 2, pb: 2 }}>
            <Button variant="contained" onClick={save}>
              {t(language, "profileSaveButton")}
            </Button>
          </CardActions>
        </Card>
        {message && <Alert severity="info">{message}</Alert>}
      </Stack>
    </Container>
  );
}
