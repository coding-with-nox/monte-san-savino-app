import React from "react";
import { Card, CardContent, Grid, Stack, TextField, Typography } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import PhoneIcon from "@mui/icons-material/Phone";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import { MuiTelInput, matchIsValidTel } from "mui-tel-input";
import { Language, t } from "../lib/i18n";

export type EditableProfile = {
  email?: string;
  role?: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  city?: string | null;
  emergencyContact?: string | null;
  emergencyContactName?: string | null;
};

type ProfileEditSectionsProps = {
  language: Language;
  value: EditableProfile;
  onChange: (next: EditableProfile) => void;
  phoneError: boolean;
  emergencyPhoneError: boolean;
  onPhoneErrorChange: (next: boolean) => void;
  onEmergencyPhoneErrorChange: (next: boolean) => void;
  showIdentityFields?: boolean;
};

export default function ProfileEditSections({
  language,
  value,
  onChange,
  phoneError,
  emergencyPhoneError,
  onPhoneErrorChange,
  onEmergencyPhoneErrorChange,
  showIdentityFields = true
}: ProfileEditSectionsProps) {
  return (
    <Stack spacing={3}>
      <Card>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <PersonIcon color="primary" />
            <Typography variant="h6">{t(language, "profilePersonalSection")}</Typography>
          </Stack>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label={t(language, "profileFirstName")}
                value={value.firstName ?? ""}
                onChange={(e) => onChange({ ...value, firstName: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={t(language, "profileLastName")}
                value={value.lastName ?? ""}
                onChange={(e) => onChange({ ...value, lastName: e.target.value })}
                fullWidth
              />
            </Grid>
            {showIdentityFields && (
              <>
                <Grid item xs={12} sm={6}>
                  <TextField label="Email" value={value.email ?? ""} fullWidth disabled />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label={t(language, "profileRole")} value={value.role ?? ""} fullWidth disabled />
                </Grid>
              </>
            )}
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <PhoneIcon color="primary" />
            <Typography variant="h6">{t(language, "profileContactSection")}</Typography>
          </Stack>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <MuiTelInput
                label={t(language, "profilePhone")}
                value={value.phone ?? ""}
                onChange={(phone) => {
                  onChange({ ...value, phone });
                  onPhoneErrorChange(phone ? !matchIsValidTel(phone) : false);
                }}
                defaultCountry="IT"
                fullWidth
                error={phoneError}
                helperText={phoneError ? t(language, "profilePhoneError") : ""}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label={t(language, "profileEmergencyName")}
                value={value.emergencyContactName ?? ""}
                onChange={(e) => onChange({ ...value, emergencyContactName: e.target.value })}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <MuiTelInput
                label={t(language, "profileEmergencyContact")}
                value={value.emergencyContact ?? ""}
                onChange={(emergencyContact) => {
                  onChange({ ...value, emergencyContact });
                  onEmergencyPhoneErrorChange(emergencyContact ? !matchIsValidTel(emergencyContact) : false);
                }}
                defaultCountry="IT"
                fullWidth
                error={emergencyPhoneError}
                helperText={emergencyPhoneError ? t(language, "profilePhoneError") : ""}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <LocationOnIcon color="primary" />
            <Typography variant="h6">{t(language, "profileAddressSection")}</Typography>
          </Stack>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label={t(language, "profileCity")}
                value={value.city ?? ""}
                onChange={(e) => onChange({ ...value, city: e.target.value })}
                fullWidth
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Stack>
  );
}
