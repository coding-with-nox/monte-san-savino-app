import React, { useEffect, useState, useCallback } from "react";
import {
  Alert,
  Autocomplete,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Grid,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import PersonIcon from "@mui/icons-material/Person";
import PhoneIcon from "@mui/icons-material/Phone";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import { MuiTelInput, matchIsValidTel } from "mui-tel-input";
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
  emergencyContactName?: string | null;
};

type CityOption = {
  displayName: string;
  city: string;
  country: string;
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

  // City autocomplete state
  const [cityOptions, setCityOptions] = useState<CityOption[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [cityInputValue, setCityInputValue] = useState("");

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
    setCityInputValue(profile.city ?? "");
    setPhoneError(false);
    setEmergencyPhoneError(false);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setPhoneError(false);
    setEmergencyPhoneError(false);
  }

  // Debounced city search via Photon API (Komoot / OpenStreetMap)
  const searchCities = useCallback(
    debounce(async (query: string) => {
      if (query.length < 2) {
        setCityOptions([]);
        return;
      }
      setCityLoading(true);
      try {
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=10&lang=${language}`
        );
        const data = await res.json();
        const seen = new Set<string>();
        const options: CityOption[] = [];
        for (const feature of data.features || []) {
          const p = feature.properties || {};
          const city = p.city || p.name || "";
          const country = p.country || "";
          const key = `${city}|${country}`;
          if (city && !seen.has(key)) {
            seen.add(key);
            options.push({ displayName: `${city}, ${country}`, city, country });
          }
        }
        setCityOptions(options);
      } catch {
        setCityOptions([]);
      } finally {
        setCityLoading(false);
      }
    }, 300),
    [language]
  );

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
                  value={editProfile.firstName ?? ""}
                  onChange={(e) => setEditProfile({ ...editProfile, firstName: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t(language, "profileLastName")}
                  value={editProfile.lastName ?? ""}
                  onChange={(e) => setEditProfile({ ...editProfile, lastName: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Email" value={editProfile.email ?? ""} fullWidth disabled />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label={t(language, "profileRole")} value={editProfile.role ?? ""} fullWidth disabled />
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
                <MuiTelInput
                  label={t(language, "profilePhone")}
                  value={editProfile.phone ?? ""}
                  onChange={(value) => {
                    setEditProfile({ ...editProfile, phone: value });
                    setPhoneError(value ? !matchIsValidTel(value) : false);
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
                  value={editProfile.emergencyContactName ?? ""}
                  onChange={(e) => setEditProfile({ ...editProfile, emergencyContactName: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <MuiTelInput
                  label={t(language, "profileEmergencyContact")}
                  value={editProfile.emergencyContact ?? ""}
                  onChange={(value) => {
                    setEditProfile({ ...editProfile, emergencyContact: value });
                    setEmergencyPhoneError(value ? !matchIsValidTel(value) : false);
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

        {/* Address Data */}
        <Card>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <LocationOnIcon color="primary" />
              <Typography variant="h6">{t(language, "profileAddressSection")}</Typography>
            </Stack>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Autocomplete
                  freeSolo
                  options={cityOptions}
                  getOptionLabel={(opt) =>
                    typeof opt === "string" ? opt : opt.displayName
                  }
                  inputValue={cityInputValue}
                  onInputChange={(_e, value) => {
                    setCityInputValue(value);
                    searchCities(value);
                  }}
                  onChange={(_e, value) => {
                    if (typeof value === "string") {
                      setEditProfile({ ...editProfile, city: value });
                    } else if (value) {
                      setEditProfile({ ...editProfile, city: value.displayName });
                      setCityInputValue(value.displayName);
                    }
                  }}
                  loading={cityLoading}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t(language, "profileCity")}
                      fullWidth
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {cityLoading ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        )
                      }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t(language, "profileAddress")}
                  value={editProfile.address ?? ""}
                  onChange={(e) => setEditProfile({ ...editProfile, address: e.target.value })}
                  fullWidth
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

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

// Simple debounce utility
function debounce<T extends (...args: any[]) => any>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
