import React, { useEffect, useState } from "react";
import { Button, Chip, Grid, Stack, Typography } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import PersonIcon from "@mui/icons-material/Person";
import PhoneIcon from "@mui/icons-material/Phone";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import { matchIsValidTel } from "mui-tel-input";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";
import ProfileEditSections from "../components/ProfileEditSections";
import PageContainer from "../components/PageContainer";
import SectionCard from "../components/SectionCard";
import Field, { EmptyValue } from "../components/Field";
import useToast from "../components/useToast";

type Profile = {
  email?: string;
  role?: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  city?: string | null;
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
  const toast = useToast();
  const [phoneError, setPhoneError] = useState(false);
  const [emergencyPhoneError, setEmergencyPhoneError] = useState(false);

  async function load() {
    try {
      const res = await api<Profile>("/users/profile");
      setProfile(res ?? {});
    } catch (err: any) {
      toast.error(err.message);
    }
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
    try {
      const { email, role, ...body } = editProfile;
      await api("/users/profile", { method: "PUT", body: JSON.stringify(body) });
      toast.success(t(language, "profileSaved"));
      setProfile(editProfile);
      setEditing(false);
    } catch (err: any) {
      toast.error(err.message);
    }
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
    load();
  }, []);

  if (!editing) {
    return (
      <PageContainer>
        {toast.node}
        <Stack spacing={3}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h4">{t(language, "profileTitle")}</Typography>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<EditIcon />}
              onClick={startEdit}
            >
              {t(language, "profileEditButton")}
            </Button>
          </Stack>

          <SectionCard icon={<PersonIcon />} title={t(language, "profilePersonalSection")}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Field label={t(language, "profileFirstName")} value={profile.firstName} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Field label={t(language, "profileLastName")} value={profile.lastName} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Field label="Email" value={profile.email} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Field
                  label={t(language, "profileRole")}
                  value={
                    profile.role
                      ? <Chip label={profile.role} size="small" color="primary" variant="outlined" />
                      : <EmptyValue />
                  }
                />
              </Grid>
            </Grid>
          </SectionCard>

          <SectionCard icon={<PhoneIcon />} title={t(language, "profileContactSection")}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Field label={t(language, "profilePhone")} value={profile.phone} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Field
                  label={t(language, "profileEmergencyContact")}
                  value={
                    profile.emergencyContactName
                      ? `${profile.emergencyContactName} — ${profile.emergencyContact ?? ""}`
                      : profile.emergencyContact ?? undefined
                  }
                />
              </Grid>
            </Grid>
          </SectionCard>

          <SectionCard icon={<LocationOnIcon />} title={t(language, "profileAddressSection")}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Field label={t(language, "profileCity")} value={profile.city} />
              </Grid>
            </Grid>
          </SectionCard>
        </Stack>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {toast.node}
      <Stack spacing={3}>
        <Typography variant="h4">{t(language, "profileTitle")}</Typography>
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
      </Stack>
    </PageContainer>
  );
}
