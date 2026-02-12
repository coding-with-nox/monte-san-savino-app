import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
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
import EditIcon from "@mui/icons-material/Edit";
import LockResetIcon from "@mui/icons-material/LockReset";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { matchIsValidTel } from "mui-tel-input";
import { api, ApiError } from "../lib/api";
import { Language, t } from "../lib/i18n";
import ActiveSwitch from "../lib/ActiveSwitch";
import ProfileEditSections from "../components/ProfileEditSections";

type User = { id: string; email: string; role: string; isActive: boolean };

type UserProfile = {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  city?: string | null;
  address?: string | null;
  emergencyContact?: string | null;
  emergencyContactName?: string | null;
};

interface UsersProps {
  language: Language;
}

const roles = ["user", "staff", "judge", "manager", "admin"];

export default function Users({ language }: UsersProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [message, setMessage] = useState("");

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState("user");
  const [saving, setSaving] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editProfile, setEditProfile] = useState<UserProfile | null>(null);
  const [editingFields, setEditingFields] = useState(false);
  const [profileForm, setProfileForm] = useState<Partial<UserProfile>>({});
  const [phoneError, setPhoneError] = useState(false);
  const [emergencyPhoneError, setEmergencyPhoneError] = useState(false);

  async function load() {
    setUsers(await api<User[]>("/admin/users"));
  }

  useEffect(() => {
    load().catch((err) => setMessage(err.message));
  }, []);

  // --- Create dialog ---
  function openCreateDialog() {
    setCreateEmail("");
    setCreatePassword("");
    setCreateRole("user");
    setCreateOpen(true);
  }

  async function createUser() {
    setSaving(true);
    try {
      await api("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: createEmail.trim(),
          password: createPassword,
          role: createRole
        })
      });
      setCreateOpen(false);
      await load();
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 409) {
        setMessage(t(language, "usersEmailExists"));
      } else {
        setMessage(err.message || "Unable to create user");
      }
    } finally {
      setSaving(false);
    }
  }

  // --- Edit dialog ---
  async function openEditDialog(userId: string) {
    const profile = await api<UserProfile>(`/admin/users/${userId}/profile`);
    setEditProfile(profile);
    setProfileForm({
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
      city: profile.city,
      address: profile.address,
      emergencyContact: profile.emergencyContact,
      emergencyContactName: profile.emergencyContactName
    });
    setEditingFields(false);
    setPhoneError(false);
    setEmergencyPhoneError(false);
    setEditOpen(true);
  }

  function closeEditDialog() {
    setEditOpen(false);
    setEditProfile(null);
    setEditingFields(false);
    setPhoneError(false);
    setEmergencyPhoneError(false);
  }

  async function updateRole(role: string) {
    if (!editProfile) return;
    await api(`/admin/users/${editProfile.id}`, { method: "PATCH", body: JSON.stringify({ role }) });
    setEditProfile({ ...editProfile, role });
    await load();
  }

  async function toggleActive() {
    if (!editProfile) return;
    await toggleUserActive(editProfile.id, editProfile.isActive);
  }

  async function toggleUserActive(userId: string, currentActive: boolean) {
    const newActive = !currentActive;
    await api(`/admin/users/${userId}`, { method: "PATCH", body: JSON.stringify({ isActive: newActive }) });
    if (editProfile && editProfile.id === userId) {
      setEditProfile({ ...editProfile, isActive: newActive });
    }
    await load();
  }

  async function resetPassword() {
    if (!editProfile) return;
    const res = await api<{ temporaryPassword: string; emailSent: boolean }>(`/admin/users/${editProfile.id}/reset-password`, { method: "POST" });
    let msg = `${t(language, "adminTempPassword")}: ${res.temporaryPassword}`;
    if (res.emailSent) {
      msg += ` — ${t(language, "adminEmailSent")}`;
    } else {
      msg += ` — ${t(language, "adminEmailNotSent")}`;
    }
    setMessage(msg);
  }

  async function saveProfile() {
    if (!editProfile) return;
    if (profileForm.phone && !matchIsValidTel(profileForm.phone)) {
      setPhoneError(true);
      return;
    }
    if (profileForm.emergencyContact && !matchIsValidTel(profileForm.emergencyContact)) {
      setEmergencyPhoneError(true);
      return;
    }
    await api(`/admin/users/${editProfile.id}/profile`, {
      method: "PUT",
      body: JSON.stringify(profileForm)
    });
    setEditingFields(false);
    const updated = await api<UserProfile>(`/admin/users/${editProfile.id}/profile`);
    setEditProfile(updated);
    setMessage(t(language, "adminProfileSaved"));
  }

  return (
    <Container maxWidth="lg">
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h4">{t(language, "usersTitle")}</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
            {t(language, "usersCreateButton")}
          </Button>
        </Stack>
        {message && <Alert severity="info" onClose={() => setMessage("")}>{message}</Alert>}
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t(language, "usersRolePlaceholder")}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell align="right" sx={{ width: 80 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} hover sx={{ cursor: "pointer" }} onClick={() => openEditDialog(user.id)}>
                  <TableCell><Typography fontWeight={600}>{user.email}</Typography></TableCell>
                  <TableCell><Chip size="small" label={user.role} /></TableCell>
                  <TableCell>
                    <Box onClick={(e) => e.stopPropagation()}>
                      <ActiveSwitch
                        checked={user.isActive}
                        onChange={() => toggleUserActive(user.id, user.isActive)}
                        activeLabel={t(language, "adminUserActive")}
                        inactiveLabel={t(language, "adminUserInactive")}
                      />
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEditDialog(user.id); }} color="secondary">
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEditDialog(user.id); }} color="primary">
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                      {t(language, "usersNoUsers")}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>

      {/* Create User Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t(language, "usersCreateButton")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t(language, "usersEmailPlaceholder")}
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              fullWidth
              type="email"
            />
            <TextField
              label={t(language, "usersPasswordPlaceholder")}
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
              fullWidth
              type="password"
            />
            <FormControl fullWidth>
              <InputLabel>{t(language, "usersRolePlaceholder")}</InputLabel>
              <Select value={createRole} label={t(language, "usersRolePlaceholder")} onChange={(e) => setCreateRole(e.target.value)}>
                {roles.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>{t(language, "profileCancelButton")}</Button>
          <Button
            variant="contained"
            onClick={createUser}
            disabled={saving || !createEmail.trim() || createPassword.length < 8}
          >
            {saving ? "..." : t(language, "usersCreateButton")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit User Dialog */}
  <Dialog
    open={editOpen}
    onClose={closeEditDialog}
    maxWidth="lg"
    fullWidth
    PaperProps={{ sx: { width: "min(1100px, 95vw)" } }}
  >
        {editProfile && (
          <>
            <DialogTitle>{editProfile.email} — {t(language, "usersEditTitle")}</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                {/* Role, status, reset password */}
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel>{t(language, "usersRolePlaceholder")}</InputLabel>
                    <Select
                      value={editProfile.role}
                      label={t(language, "usersRolePlaceholder")}
                      onChange={(e) => updateRole(e.target.value)}
                    >
                      {roles.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <ActiveSwitch
                    checked={editProfile.isActive}
                    onChange={toggleActive}
                    activeLabel={t(language, "adminUserActive")}
                    inactiveLabel={t(language, "adminUserInactive")}
                  />
                  <Button variant="outlined" size="small" startIcon={<LockResetIcon />} onClick={resetPassword}>
                    {t(language, "adminResetPasswordButton")}
                  </Button>
                </Stack>

                <Divider />

                {/* Profile fields — view mode */}
                {!editingFields && (
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">{t(language, "profileFirstName")}</Typography>
                      <Typography>{editProfile.firstName || "—"}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">{t(language, "profileLastName")}</Typography>
                      <Typography>{editProfile.lastName || "—"}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">{t(language, "profilePhone")}</Typography>
                      <Typography>{editProfile.phone || "—"}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">{t(language, "profileEmergencyContact")}</Typography>
                      <Typography>{editProfile.emergencyContact || "—"}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">{t(language, "profileCity")}</Typography>
                      <Typography>{editProfile.city || "—"}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">{t(language, "profileAddress")}</Typography>
                      <Typography>{editProfile.address || "—"}</Typography>
                    </Grid>
                  </Grid>
                )}

                {/* Profile fields — edit mode */}
                {editingFields && (
                  <ProfileEditSections
                    language={language}
                    value={profileForm}
                    onChange={(next) => setProfileForm(next)}
                    phoneError={phoneError}
                    emergencyPhoneError={emergencyPhoneError}
                    onPhoneErrorChange={setPhoneError}
                    onEmergencyPhoneErrorChange={setEmergencyPhoneError}
                    showIdentityFields={false}
                  />
                )}
              </Stack>
            </DialogContent>
            <DialogActions>
              {!editingFields ? (
                <>
                  <Button onClick={() => {
                    setEditingFields(true);
                    setPhoneError(false);
                    setEmergencyPhoneError(false);
                    setProfileForm({
                      firstName: editProfile.firstName,
                      lastName: editProfile.lastName,
                      phone: editProfile.phone,
                      city: editProfile.city,
                      address: editProfile.address,
                      emergencyContact: editProfile.emergencyContact,
                      emergencyContactName: editProfile.emergencyContactName
                    });
                  }}>
                    {t(language, "profileEditButton")}
                  </Button>
                  <Button onClick={closeEditDialog}>{t(language, "adminDialogClose")}</Button>
                </>
              ) : (
                <>
                  <Button onClick={saveProfile} variant="contained">{t(language, "profileSaveButton")}</Button>
                  <Button onClick={() => setEditingFields(false)}>{t(language, "profileCancelButton")}</Button>
                </>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
}
