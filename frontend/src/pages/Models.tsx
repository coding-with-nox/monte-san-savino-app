import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";

type Model = { id: string; name: string; categoryId: string; teamId?: string | null; imageUrl?: string | null };
type ModelDetail = { model: Model; images: { id: string; url: string }[] };
type Category = { id: string; eventId: string; name: string; status: string };

interface ModelsProps {
  language: Language;
}

function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

export default function Models({ language }: ModelsProps) {
  const [models, setModels] = useState<Model[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [selected, setSelected] = useState<ModelDetail | null>(null);
  const [image, setImage] = useState("");
  const [imageError, setImageError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setModels(await api<Model[]>("/models"));
  }

  async function loadCategories() {
    try {
      setCategories(await api<Category[]>("/public/categories"));
    } catch {
      setCategories([]);
    }
  }

  async function create() {
    await api("/models", {
      method: "POST",
      body: JSON.stringify({
        name,
        categoryId,
        teamId: teamId || undefined
      })
    });
    setName("");
    setCategoryId("");
    setTeamId("");
    await load();
  }

  async function openModel(modelId: string) {
    const detail = await api<ModelDetail>(`/models/${modelId}`);
    setSelected(detail);
  }

  async function addImage() {
    if (!selected?.model) return;
    const trimmed = image.trim();
    if (!trimmed) return;
    if (!isValidUrl(trimmed)) {
      setImageError(t(language, "modelsInvalidUrl"));
      return;
    }
    setImageError("");
    await api(`/models/${selected.model.id}/images`, { method: "POST", body: JSON.stringify({ url: trimmed }) });
    setImage("");
    await openModel(selected.model.id);
  }

  async function uploadFile(file: File) {
    if (!selected?.model) return;
    setUploading(true);
    try {
      const { uploadUrl, publicUrl } = await api<{ uploadUrl: string; publicUrl: string }>(
        `/models/${selected.model.id}/image-upload`,
        { method: "POST", body: JSON.stringify({ contentType: file.type }) }
      );
      await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file
      });
      await api(`/models/${selected.model.id}/images`, { method: "POST", body: JSON.stringify({ url: publicUrl }) });
      await openModel(selected.model.id);
    } catch (err: any) {
      setMessage(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function deleteImage(imageId: string) {
    if (!selected?.model) return;
    await api(`/models/${selected.model.id}/images/${imageId}`, { method: "DELETE" });
    await openModel(selected.model.id);
  }

  useEffect(() => {
    load();
    loadCategories();
  }, []);

  const openCategories = categories.filter((c) => c.status === "open");

  const getCategoryName = (catId: string) => {
    const cat = categories.find((c) => c.id === catId);
    return cat ? cat.name : catId;
  };

  return (
    <Container maxWidth="lg">
      <Stack spacing={3}>
        <Typography variant="h4">{t(language, "modelsTitle")}</Typography>
        {message && <Alert severity="error" onClose={() => setMessage("")}>{message}</Alert>}
        <Card>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}>
                <TextField
                  label={t(language, "modelsNamePlaceholder")}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>{t(language, "modelsCategoryPlaceholder")}</InputLabel>
                  <Select
                    value={categoryId}
                    label={t(language, "modelsCategoryPlaceholder")}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    {openCategories.map((cat) => (
                      <MenuItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  label={t(language, "modelsTeamPlaceholder")}
                  value={teamId}
                  onChange={(event) => setTeamId(event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <Button variant="contained" onClick={create} fullWidth disabled={!name || !categoryId}>
                  {t(language, "modelsCreateButton")}
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
                  {t(language, "modelsListTitle")}
                </Typography>
                <List dense>
                  {models.map((model) => (
                    <ListItemButton key={model.id} onClick={() => openModel(model.id)}>
                      <ListItemText primary={model.name} secondary={getCategoryName(model.categoryId)} />
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
                  {t(language, "modelsDetailTitle")}
                </Typography>
                {selected?.model ? (
                  <Stack spacing={2}>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {selected.model.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t(language, "modelsCategoryPlaceholder")}: {getCategoryName(selected.model.categoryId)}
                    </Typography>
                    <List dense>
                      {selected.images.map((img) => (
                        <ListItem key={img.id} disableGutters secondaryAction={
                          <IconButton size="small" color="error" onClick={() => deleteImage(img.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        }>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Box
                              component="img"
                              src={img.url}
                              alt=""
                              sx={{ width: 48, height: 48, objectFit: "cover", borderRadius: 1 }}
                              onError={(e: any) => { e.target.style.display = "none"; }}
                            />
                            <ListItemText
                              primary={img.url}
                              primaryTypographyProps={{ variant: "body2", noWrap: true, sx: { maxWidth: 200 } }}
                            />
                          </Stack>
                        </ListItem>
                      ))}
                    </List>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} md={6}>
                        <TextField
                          label={t(language, "modelsAddImagePlaceholder")}
                          value={image}
                          onChange={(event) => {
                            setImage(event.target.value);
                            setImageError("");
                          }}
                          error={!!imageError}
                          helperText={imageError}
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <Button variant="outlined" onClick={addImage} fullWidth disabled={!image.trim()}>
                          {t(language, "modelsAddImageButton")}
                        </Button>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <input
                          type="file"
                          accept="image/*"
                          ref={fileInputRef}
                          style={{ display: "none" }}
                          onChange={handleFileChange}
                        />
                        <Button
                          variant="outlined"
                          startIcon={uploading ? <CircularProgress size={16} /> : <UploadFileIcon />}
                          onClick={() => fileInputRef.current?.click()}
                          fullWidth
                          disabled={uploading}
                        >
                          {uploading ? t(language, "modelsUploading") : t(language, "modelsUploadButton")}
                        </Button>
                      </Grid>
                    </Grid>
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t(language, "modelsSelectHint")}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Stack>
    </Container>
  );
}
