import React, { useState } from "react";
import {
  Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, Grid, IconButton,
  InputLabel, List, ListItem, ListItemText, MenuItem, Select, TextField
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { api, ApiError } from "../../lib/api";
import { Language, t } from "../../lib/i18n";
import SectionCard from "../../components/SectionCard";
import PrintActions from "../../components/PrintActions";
import ClassPrintActions from "../../components/ClassPrintActions";
import { useConfirm } from "../../components/ConfirmDialog";
import useToast from "../../components/useToast";
import type { AdminCategory } from "./types";
import type { AdminData } from "./useAdminData";

export default function CategoriesCard({ language, data }: { language: Language; data: AdminData }) {
  const { events, categories, refresh, eventName } = data;
  const { confirm, node: confirmNode } = useConfirm(language);
  const toast = useToast();
  const [categoryForm, setCategoryForm] = useState({ eventId: "", name: "" });
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [editName, setEditName] = useState("");

  async function createCategory() {
    try {
      await api("/categories", { method: "POST", body: JSON.stringify(categoryForm) });
      setCategoryForm({ eventId: "", name: "" });
      await refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error(t(language, "adminCategoryDuplicate"));
      } else {
        throw err;
      }
    }
  }

  async function deleteCategory(categoryId: string) {
    if (!(await confirm(t(language, "confirmDelete")))) return;
    await api(`/categories/${categoryId}`, { method: "DELETE" });
    await refresh();
  }

  function openEdit(cat: AdminCategory) {
    setEditing(cat);
    setEditName(cat.name);
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editing) return;
    await api(`/categories/${editing.id}`, { method: "PUT", body: JSON.stringify({ name: editName }) });
    setEditOpen(false);
    setEditing(null);
    await refresh();
  }

  async function toggleStatus(cat: AdminCategory) {
    const newStatus = cat.status === "open" ? "closed" : "open";
    try {
      await api(`/categories/${cat.id}/status`, { method: "PATCH", body: JSON.stringify({ status: newStatus }) });
      await refresh();
    } catch {
      toast.error(t(language, "adminCategoryCloseError"));
    }
  }

  return (
    <>
      {toast.node}
      <SectionCard title={t(language, "adminCategoriesTitle")}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>{t(language, "adminCategoryEventPlaceholder")}</InputLabel>
              <Select
                value={categoryForm.eventId}
                label={t(language, "adminCategoryEventPlaceholder")}
                onChange={(e) => setCategoryForm({ ...categoryForm, eventId: e.target.value })}
              >
                {events.map((ev) => (
                  <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              label={t(language, "adminCategoryNamePlaceholder")}
              value={categoryForm.name}
              onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Button variant="contained" onClick={createCategory} fullWidth disabled={!categoryForm.eventId || !categoryForm.name}>
              {t(language, "adminCategoryCreateButton")}
            </Button>
          </Grid>
        </Grid>
        <List dense sx={{ mt: 2 }}>
          {categories.map((category) => (
            <ListItem key={category.id} disableGutters>
              <ListItemText primary={category.name} secondary={eventName(category.eventId)} />
              <Chip
                label={category.status === "open" ? t(language, "adminCategoryOpen") : t(language, "adminCategoryClosed")}
                color={category.status === "open" ? "success" : "default"}
                size="small"
                sx={{ mr: 1 }}
              />
              <Button variant="outlined" size="small" onClick={() => toggleStatus(category)} sx={{ mr: 1 }}>
                {category.status === "open" ? t(language, "adminCategoryClose") : t(language, "adminCategoryReopen")}
              </Button>
              <ClassPrintActions language={language} categoryId={category.id} />
              <PrintActions language={language} params={{ eventId: category.eventId, categoryId: category.id }} />
              <IconButton size="small" onClick={() => openEdit(category)}>
                <EditIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" color="error" onClick={() => deleteCategory(category.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </ListItem>
          ))}
        </List>
      </SectionCard>

      {confirmNode}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t(language, "adminCategoryEditTitle")}</DialogTitle>
        <DialogContent>
          <TextField
            label={t(language, "adminCategoryNamePlaceholder")}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={saveEdit} variant="contained">{t(language, "profileSaveButton")}</Button>
          <Button onClick={() => setEditOpen(false)}>{t(language, "profileCancelButton")}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
