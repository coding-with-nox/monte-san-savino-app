import React from "react";
import { Grid, InputAdornment, Stack, TextField } from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import PhoneIcon from "@mui/icons-material/Phone";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import ShareIcon from "@mui/icons-material/Share";
import InstagramIcon from "@mui/icons-material/Instagram";
import FacebookIcon from "@mui/icons-material/Facebook";
import LanguageIcon from "@mui/icons-material/Language";
import { MuiTelInput, matchIsValidTel } from "mui-tel-input";
import { Language, t } from "../lib/i18n";
import SectionCard from "./SectionCard";
import { safeHttpUrl } from "../lib/social";

export type EditableProfile = {
  email?: string;
  role?: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  city?: string | null;
  emergencyContact?: string | null;
  emergencyContactName?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  website?: string | null;
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
  const socialFields = [
    { key: "instagram" as const, label: t(language, "profileInstagram"), icon: <InstagramIcon /> },
    { key: "facebook" as const, label: t(language, "profileFacebook"), icon: <FacebookIcon /> },
    { key: "website" as const, label: t(language, "profileWebsite"), icon: <LanguageIcon /> }
  ];
  return (
    <Stack spacing={3}>
      <SectionCard icon={<PersonIcon />} title={t(language, "profilePersonalSection")}>
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
      </SectionCard>

      <SectionCard icon={<PhoneIcon />} title={t(language, "profileContactSection")}>
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
      </SectionCard>

      <SectionCard icon={<LocationOnIcon />} title={t(language, "profileAddressSection")}>
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
      </SectionCard>

      <SectionCard icon={<ShareIcon />} title={t(language, "profileSocialSection")}>
        <Grid container spacing={2}>
          {socialFields.map((f) => {
            const current = value[f.key] ?? "";
            const invalid = current.trim() !== "" && safeHttpUrl(current) === null;
            return (
              <Grid item xs={12} sm={6} key={f.key}>
                <TextField
                  label={f.label}
                  value={current}
                  onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
                  fullWidth
                  error={invalid}
                  helperText={invalid ? t(language, "profileSocialInvalid") : ""}
                  inputProps={{ inputMode: "url", maxLength: 300 }}
                  InputProps={{ startAdornment: <InputAdornment position="start">{f.icon}</InputAdornment> }}
                />
              </Grid>
            );
          })}
        </Grid>
      </SectionCard>
    </Stack>
  );
}
