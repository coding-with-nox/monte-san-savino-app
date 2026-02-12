import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
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
import CloseIcon from "@mui/icons-material/Close";
import VisibilityIcon from "@mui/icons-material/Visibility";
import LockResetIcon from "@mui/icons-material/LockReset";
import { api, ApiError } from "../lib/api";
import { Language, t } from "../lib/i18n";

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
};

interface UsersProps {
  language: Language;
}

const roles = ["user", "staff", "judge", "manager", "admin"];

export default function Users({ language }: UsersProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserProfile | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Create form
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState("user");

  // Profile dialog
  const [profileDialog, setProfileDialog] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<Partial<UserProfile>>({});

  async function load() {
    setUsers(await api<User[]>("/admin/users"));
  }

  async function openUser(userId: string) {
    if (expandedId === userId) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    const d = await api<UserProfile>(`/admin/users/${userId}/profile`);
    setDetail(d);
    setExpandedId(userId);
    setIsCreating(false);
  }

  function closePanel() {
    setExpandedId(null);
    setDetail(null);
    setIsCreating(false);
  }

  function startCreate() {
    setExpandedId(null);
    setDetail(null);
    setCreateEmail("");
    setCreatePassword("");
    setCreateRole("user");
    setIsCreating(true);
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
      setIsCreating(false);
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

  async function updateUserRole(userId: string, role: string) {
    await api(`/admin/users/${userId}`, { method: "PATCH", body: JSON.stringify({ role }) });
    await load();
  }

  async function toggleUserActive(userId: string, isActive: boolean) {
    await api(`/admin/users/${userId}`, { method: "PATCH", body: JSON.stringify({ isActive: !isActive }) });
    await load();
  }

  async function resetPassword(userId: string) {
    const res = await api<{ temporaryPassword: string }>(`/admin/users/${userId}/reset-password`, { method: "POST" });
    setMessage(`${t(language, "adminTempPassword")}: ${res.temporaryPassword}`);
  }

  async function openUserProfile(userId: string) {
    const profile = await api<UserProfile>(`/admin/users/${userId}/profile`);
    setSelectedProfile(profile);
    setProfileForm({
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
      city: profile.city,
      address: profile.address,
      emergencyContact: profile.emergencyContact
    });
    setEditingProfile(false);
    setProfileDialog(true);
  }

  async function saveUserProfile() {
    if (!selectedProfile) return;
    await api(`/admin/users/${selectedProfile.id}/profile`, {
      method: "PUT",
      body: JSON.stringify(profileForm)
    });
    setEditingProfile(false);
    await openUserProfile(selectedProfile.id);
    setMessage(t(language, "adminProfileSaved"));
  }

  useEffect(() => {
    load().catch((err) => setMessage(err.message));
  }, []);

  const editPanel = (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={2} alignItems="flex-start">
        {isCreating ? (
          <>
            <Grid item xs={12} md={4}>
              <TextField
                label={t(language, "usersEmailPlaceholder")}
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                fullWidth
                size="small"
                type="email"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label={t(language, "usersPasswordPlaceholder")}
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                fullWidth
                size="small"
                type="password"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>{t(language, "usersRolePlaceholder")}</InputLabel>
                <Select value={createRole} label={t(language, "usersRolePlaceholder")} onChange={(e) => setCreateRole(e.target.value)}>
                  {roles.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                variant="contained"
                onClick={createUser}
                disabled={saving || !createEmail.trim() || createPassword.length < 8}
                fullWidth
              >
                {saving ? "..." : t(language, "usersCreateButton")}
              </Button>
            </Grid>
          </>
        ) : detail && (
          <>
            <Grid item xs={12} md={6}>
              <Stack spacing={1.5}>
                <Typography variant="subtitle2">{detail.email}</Typography>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">{t(language, "profileFirstName")}</Typography>
                    <Typography variant="body2">{detail.firstName || "—"}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">{t(language, "profileLastName")}</Typography>
                    <Typography variant="body2">{detail.lastName || "—"}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">{t(language, "profilePhone")}</Typography>
                    <Typography variant="body2">{detail.phone || "—"}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">{t(language, "profileCity")}</Typography>
                    <Typography variant="body2">{detail.city || "—"}</Typography>
                  </Grid>
                </Grid>
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Stack spacing={1.5}>
                <Typography variant="subtitle2">{t(language, "adminUsersTitle")}</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Button variant="outlined" size="small" startIcon={<VisibilityIcon />} onClick={() => openUserProfile(detail.id)}>
                    {t(language, "adminProfileTitle")}
                  </Button>
                  <Button variant="outlined" size="small" startIcon={<LockResetIcon />} onClick={() => resetPassword(detail.id)}>
                    {t(language, "adminResetPasswordButton")}
                  </Button>
                </Stack>
                <Divider />
                <Stack direction="row" spacing={1} alignItems="center">
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>{t(language, "usersRolePlaceholder")}</InputLabel>
                    <Select
                      value={detail.role}
                      label={t(language, "usersRolePlaceholder")}
                      onChange={(e) => updateUserRole(detail.id, e.target.value)}
                      size="small"
                    >
                      {roles.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <Chip
                    label={detail.isActive ? t(language, "adminUserActive") : t(language, "adminUserInactive")}
                    color={detail.isActive ? "success" : "default"}
                    size="small"
                    onClick={() => toggleUserActive(detail.id, detail.isActive)}
                  />
                </Stack>
              </Stack>
            </Grid>
          </>
        )}
      </Grid>
    </Box>
  );

  return (
    <Container maxWidth="lg">
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h4">{t(language, "usersTitle")}</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={startCreate}>
            {t(language, "usersCreateButton")}
          </Button>
        </Stack>
        {message && <Alert severity="info" onClose={() => setMessage("")}>{message}</Alert>}
        <Collapse in={isCreating}>
          <Paper variant="outlined" sx={{ mb: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, pt: 1.5 }}>
              <Typography variant="subtitle2">{t(language, "usersCreateButton")}</Typography>
              <IconButton size="small" onClick={() => setIsCreating(false)}><CloseIcon fontSize="small" /></IconButton>
            </Stack>
            {editPanel}
          </Paper>
        </Collapse>
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
                <React.Fragment key={user.id}>
                  <TableRow
                    hover
                    sx={{ cursor: "pointer", "& > td": { borderBottom: expandedId === user.id ? "none" : undefined } }}
                    onClick={() => openUser(user.id)}
                    selected={expandedId === user.id}
                  >
                    <TableCell><Typography fontWeight={600}>{user.email}</Typography></TableCell>
                    <TableCell><Chip size="small" label={user.role} /></TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={user.isActive ? t(language, "adminUserActive") : t(language, "adminUserInactive")}
                        color={user.isActive ? "success" : "default"}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); openUser(user.id); }} color="primary">
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={4} sx={{ p: 0 }}>
                      <Collapse in={expandedId === user.id} unmountOnExit>
                        <Divider />
                        {editPanel}
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
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

      {/* User Profile Dialog */}
      <Dialog open={profileDialog} onClose={() => setProfileDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedProfile?.email ?? ""} — {t(language, "adminProfileTitle")}
        </DialogTitle>
        <DialogContent>
          {selectedProfile && !editingProfile && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">{t(language, "profileFirstName")}</Typography>
                  <Typography>{selectedProfile.firstName || "—"}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">{t(language, "profileLastName")}</Typography>
                  <Typography>{selectedProfile.lastName || "—"}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">{t(language, "profilePhone")}</Typography>
                  <Typography>{selectedProfile.phone || "—"}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">{t(language, "profileEmergencyContact")}</Typography>
                  <Typography>{selectedProfile.emergencyContact || "—"}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">{t(language, "profileCity")}</Typography>
                  <Typography>{selectedProfile.city || "—"}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">{t(language, "profileAddress")}</Typography>
                  <Typography>{selectedProfile.address || "—"}</Typography>
                </Grid>
              </Grid>
            </Stack>
          )}
          {selectedProfile && editingProfile && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField label={t(language, "profileFirstName")} value={profileForm.firstName ?? ""} onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })} fullWidth />
                </Grid>
                <Grid item xs={6}>
                  <TextField label={t(language, "profileLastName")} value={profileForm.lastName ?? ""} onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })} fullWidth />
                </Grid>
                <Grid item xs={6}>
                  <TextField label={t(language, "profilePhone")} value={profileForm.phone ?? ""} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} fullWidth />
                </Grid>
                <Grid item xs={6}>
                  <TextField label={t(language, "profileEmergencyContact")} value={profileForm.emergencyContact ?? ""} onChange={(e) => setProfileForm({ ...profileForm, emergencyContact: e.target.value })} fullWidth />
                </Grid>
                <Grid item xs={6}>
                  <TextField label={t(language, "profileCity")} value={profileForm.city ?? ""} onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })} fullWidth />
                </Grid>
                <Grid item xs={6}>
                  <TextField label={t(language, "profileAddress")} value={profileForm.address ?? ""} onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })} fullWidth />
                </Grid>
              </Grid>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {!editingProfile ? (
            <>
              <Button onClick={() => setEditingProfile(true)}>{t(language, "profileEditButton")}</Button>
              <Button onClick={() => setProfileDialog(false)}>{t(language, "adminDialogClose")}</Button>
            </>
          ) : (
            <>
              <Button onClick={saveUserProfile} variant="contained">{t(language, "profileSaveButton")}</Button>
              <Button onClick={() => setEditingProfile(false)}>{t(language, "profileCancelButton")}</Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
}
