import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  Stack,
  Typography
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import PersonIcon from "@mui/icons-material/Person";
import PhoneIcon from "@mui/icons-material/Phone";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import { matchIsValidTel } from "mui-tel-input";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";
import ProfileEditSections from "../components/ProfileEditSections";

type Profile = {
  email?: string;
  role?: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  city?: string | null;
  address?: string | null;
  emergencyContact?: string | null;
  emergencyContactName?: string | null;
};

interface ProfileProps {
  language: Language;
}

export default function Profile({ language }: ProfileProps) {
  const [profile, setProfile] = useState<Profile>({});
  const [editProfile, setEditProfile] = useState<Profile>({});
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [phoneError, setPhoneError] = useState(false);
  const [emergencyPhoneError, setEmergencyPhoneError] = useState(false);

  async function load() {
    const res = await api<Profile>("/users/profile");
    setProfile(res ?? {});
  }

  async function save() {
    if (editProfile.phone && !matchIsValidTel(editProfile.phone)) {
      setPhoneError(true);
      return;
    }
    if (editProfile.emergencyContact && !matchIsValidTel(editProfile.emergencyContact)) {
      setEmergencyPhoneError(true);
      return;
    }

    const { email, role, ...body } = editProfile;
    await api("/users/profile", { method: "PUT", body: JSON.stringify(body) });
    setMessage(t(language, "profileSaved"));
    setProfile(editProfile);
    setEditing(false);
  }

  function startEdit() {
    setEditProfile({ ...profile });
    setPhoneError(false);
    setEmergencyPhoneError(false);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setPhoneError(false);
    setEmergencyPhoneError(false);
  }

  useEffect(() => {
    load().catch((err) => setMessage(err.message));
  }, []);

  const fieldValue = (val: string | null | undefined) => val || "—";

  if (!editing) {
    return (
      <Container maxWidth="md">
        <Stack spacing={3}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h4">{t(language, "profileTitle")}</Typography>
            <Button variant="outlined" startIcon={<EditIcon />} onClick={startEdit}>
              {t(language, "profileEditButton")}
            </Button>
          </Stack>

          {/* Personal Data */}
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <PersonIcon color="primary" />
                <Typography variant="h6">{t(language, "profilePersonalSection")}</Typography>
              </Stack>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">{t(language, "profileFirstName")}</Typography>
                  <Typography variant="body1">{fieldValue(profile.firstName)}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">{t(language, "profileLastName")}</Typography>
                  <Typography variant="body1">{fieldValue(profile.lastName)}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">Email</Typography>
                  <Typography variant="body1">{fieldValue(profile.email)}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">{t(language, "profileRole")}</Typography>
                  <Chip label={profile.role ?? "—"} size="small" color="primary" variant="outlined" />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Contact Data */}
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <PhoneIcon color="primary" />
                <Typography variant="h6">{t(language, "profileContactSection")}</Typography>
              </Stack>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">{t(language, "profilePhone")}</Typography>
                  <Typography variant="body1">{fieldValue(profile.phone)}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">{t(language, "profileEmergencyContact")}</Typography>
                  <Typography variant="body1">
                    {profile.emergencyContactName
                      ? `${profile.emergencyContactName} — ${fieldValue(profile.emergencyContact)}`
                      : fieldValue(profile.emergencyContact)}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Address Data */}
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <LocationOnIcon color="primary" />
                <Typography variant="h6">{t(language, "profileAddressSection")}</Typography>
              </Stack>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">{t(language, "profileCity")}</Typography>
                  <Typography variant="body1">{fieldValue(profile.city)}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">{t(language, "profileAddress")}</Typography>
                  <Typography variant="body1">{fieldValue(profile.address)}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {message && <Alert severity="info" onClose={() => setMessage("")}>{message}</Alert>}
        </Stack>
      </Container>
    );
  }

  // Edit mode
  return (
    <Container maxWidth="md">
      <Stack spacing={3}>
        <Typography variant="h4">{t(language, "profileTitle")}</Typography>

        {/* Personal Data */}
        <ProfileEditSections
          language={language}
          value={editProfile}
          onChange={(next) => setEditProfile(next)}
          phoneError={phoneError}
          emergencyPhoneError={emergencyPhoneError}
          onPhoneErrorChange={setPhoneError}
          onEmergencyPhoneErrorChange={setEmergencyPhoneError}
          showIdentityFields
        />

        <Stack direction="row" spacing={2}>
          <Button variant="contained" onClick={save}>
            {t(language, "profileSaveButton")}
          </Button>
          <Button variant="outlined" onClick={cancelEdit}>
            {t(language, "profileCancelButton")}
          </Button>
        </Stack>

        {message && <Alert severity="info" onClose={() => setMessage("")}>{message}</Alert>}
      </Stack>
    </Container>
  );
}

