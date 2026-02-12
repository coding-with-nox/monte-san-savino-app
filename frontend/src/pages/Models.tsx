import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Container,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  Link,
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
  Tooltip,
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ModelDetail | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [image, setImage] = useState("");
  const [imageError, setImageError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [savingModel, setSavingModel] = useState(false);
  const [message, setMessage] = useState("");
  const [editName, setEditName] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editTeamId, setEditTeamId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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

  async function openModel(modelId: string) {
    if (expandedId === modelId) {
      setExpandedId(null);
      setDetail(null);
      setIsCreating(false);
      return;
    }
    const d = await api<ModelDetail>(`/models/${modelId}`);
    setDetail(d);
    setEditName(d.model.name);
    setEditCategoryId(d.model.categoryId);
    setEditTeamId(d.model.teamId || "");
    setExpandedId(modelId);
    setIsCreating(false);
    setImage("");
    setImageError("");
  }

  function startCreate() {
    setExpandedId(null);
    setDetail(null);
    setEditName("");
    setEditCategoryId("");
    setEditTeamId("");
    setIsCreating(true);
    setImage("");
    setImageError("");
  }

  async function createModel() {
    setSavingModel(true);
    try {
      const result = await api<{ id: string }>("/models", {
        method: "POST",
        body: JSON.stringify({
          name: editName.trim(),
          categoryId: editCategoryId,
          teamId: editTeamId.trim() || undefined
        })
      });
      await load();
      setIsCreating(false);
      await openModel(result.id);
    } catch (err: any) {
      setMessage(err.message || "Unable to create model");
    } finally {
      setSavingModel(false);
    }
  }

  async function saveModelChanges() {
    if (!detail?.model) return;
    setSavingModel(true);
    try {
      await api(`/models/${detail.model.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editName.trim(),
          categoryId: editCategoryId,
          teamId: editTeamId.trim() || undefined
        })
      });
      await load();
      const d = await api<ModelDetail>(`/models/${detail.model.id}`);
      setDetail(d);
    } catch (err: any) {
      setMessage(err.message || "Unable to save model");
    } finally {
      setSavingModel(false);
    }
  }

  async function deleteModel(modelId: string) {
    await api(`/models/${modelId}`, { method: "DELETE" });
    if (expandedId === modelId) {
      setExpandedId(null);
      setDetail(null);
    }
    await load();
  }

  async function addImage() {
    if (!detail?.model) return;
    const trimmed = image.trim();
    if (!trimmed) return;
    if (!isValidUrl(trimmed)) {
      setImageError(t(language, "modelsInvalidUrl"));
      return;
    }
    setImageError("");
    await api(`/models/${detail.model.id}/images`, { method: "POST", body: JSON.stringify({ url: trimmed }) });
    setImage("");
    const d = await api<ModelDetail>(`/models/${detail.model.id}`);
    setDetail(d);
  }

  async function resizeImageForUpload(file: File): Promise<File | Blob> {
    const maxDimension = 1920;
    const targetMaxBytes = 1.5 * 1024 * 1024;
    const outputType = file.type === "image/png" ? "image/jpeg" : (file.type || "image/jpeg");
    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) return file;

    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      return file;
    }

    let { width, height } = bitmap;
    const needsResize = width > maxDimension || height > maxDimension;
    if (needsResize) {
      const ratio = Math.min(maxDimension / width, maxDimension / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    if (!needsResize && file.size <= targetMaxBytes) return file;

    const qualities = [0.85, 0.75, 0.65, 0.55];
    let candidate: Blob | null = null;
    for (const quality of qualities) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputType, quality));
      if (!blob) continue;
      candidate = blob;
      if (blob.size <= targetMaxBytes) break;
    }
    return candidate || file;
  }

  async function uploadFile(file: File) {
    if (!detail?.model) return;
    setUploading(true);
    try {
      const optimizedFile = await resizeImageForUpload(file);
      const contentType = optimizedFile.type || file.type || "image/jpeg";
      const { uploadUrl, publicUrl } = await api<{ uploadUrl: string; publicUrl: string }>(
        `/models/${detail.model.id}/image-upload`,
        { method: "POST", body: JSON.stringify({ contentType }) }
      );
      await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: optimizedFile
      });
      await api(`/models/${detail.model.id}/images`, { method: "POST", body: JSON.stringify({ url: publicUrl }) });
      const d = await api<ModelDetail>(`/models/${detail.model.id}`);
      setDetail(d);
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
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  async function deleteImage(imageId: string) {
    if (!detail?.model) return;
    await api(`/models/${detail.model.id}/images/${imageId}`, { method: "DELETE" });
    const d = await api<ModelDetail>(`/models/${detail.model.id}`);
    setDetail(d);
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

  const detailPanel = (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2.5}>
        <Grid container spacing={2} alignItems="flex-start">
          <Grid item xs={12} md={6}>
            <Stack spacing={1.5}>
              <Typography variant="subtitle1" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <EditIcon fontSize="small" />
                {isCreating ? t(language, "modelsCreateButton") : t(language, "modelsEditSection")}
              </Typography>
              <TextField
                label={t(language, "modelsNamePlaceholder")}
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                fullWidth
                size="small"
              />
              <FormControl fullWidth size="small">
                <InputLabel>{t(language, "modelsCategoryPlaceholder")}</InputLabel>
                <Select
                  value={editCategoryId}
                  label={t(language, "modelsCategoryPlaceholder")}
                  onChange={(e) => setEditCategoryId(e.target.value)}
                >
                  {openCategories.map((cat) => (
                    <MenuItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label={t(language, "modelsTeamPlaceholder")}
                value={editTeamId}
                onChange={(event) => setEditTeamId(event.target.value)}
                fullWidth
                size="small"
              />
              <Button
                variant="contained"
                onClick={isCreating ? createModel : saveModelChanges}
                disabled={savingModel || !editName.trim() || !editCategoryId}
                fullWidth
              >
                {savingModel ? t(language, "modelsUploading") : isCreating ? t(language, "modelsCreateButton") : t(language, "modelsSaveButton")}
              </Button>
            </Stack>
          </Grid>

          {!isCreating && detail && (
            <Grid item xs={12} md={6}>
              <Stack spacing={1.5}>
                <Typography variant="subtitle1" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <UploadFileIcon fontSize="small" />
                  {t(language, "modelsImagesSection")}
                </Typography>

                {detail.images.length > 0 ? (
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)" },
                      gap: 1
                    }}
                  >
                    {detail.images.map((img) => (
                      <Box key={img.id} sx={{ minWidth: 0 }}>
                        <Box
                          sx={{
                            position: "relative",
                            borderRadius: 1,
                            overflow: "hidden",
                            border: "1px solid",
                            borderColor: "divider",
                            bgcolor: "action.hover"
                          }}
                        >
                          <Box
                            component="img"
                            src={img.url}
                            alt=""
                            sx={{ width: "100%", height: 120, objectFit: "cover", display: "block" }}
                            onError={(e: any) => {
                              e.target.style.display = "none";
                            }}
                          />
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => deleteImage(img.id)}
                            sx={{
                              position: "absolute",
                              top: 6,
                              right: 6,
                              bgcolor: "rgba(0,0,0,0.55)",
                              "&:hover": { bgcolor: "rgba(0,0,0,0.75)" }
                            }}
                          >
                            <DeleteIcon sx={{ color: "#fff" }} fontSize="small" />
                          </IconButton>
                        </Box>
                        <Tooltip title={img.url}>
                          <Typography variant="caption" noWrap sx={{ display: "block", mt: 0.5 }}>
                            <Link href={img.url} target="_blank" rel="noreferrer" underline="hover" color="inherit">
                              {img.url}
                            </Link>
                          </Typography>
                        </Tooltip>
                      </Box>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t(language, "modelsNoImages")}
                  </Typography>
                )}

                <Stack spacing={1}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "flex-start" }}>
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
                      size="small"
                    />
                    <Button
                      variant="outlined"
                      onClick={addImage}
                      disabled={!image.trim()}
                      sx={{ minWidth: { sm: 180 } }}
                    >
                      {t(language, "modelsAddImageButton")}
                    </Button>
                  </Stack>

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      style={{ display: "none" }}
                      onChange={handleFileChange}
                    />
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      ref={cameraInputRef}
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
                    <Button
                      variant="outlined"
                      startIcon={<PhotoCameraIcon />}
                      onClick={() => cameraInputRef.current?.click()}
                      fullWidth
                      disabled={uploading}
                    >
                      {t(language, "modelsCameraButton")}
                    </Button>
                  </Stack>
                </Stack>
              </Stack>
            </Grid>
          )}
        </Grid>
      </Stack>
    </Box>
  );

  return (
    <Container maxWidth="lg">
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h4">{t(language, "modelsTitle")}</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={startCreate}>
            {t(language, "modelsCreateButton")}
          </Button>
        </Stack>

        {message && <Alert severity="error" onClose={() => setMessage("")}>{message}</Alert>}

        <Collapse in={isCreating}>
          <Paper variant="outlined" sx={{ mb: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, pt: 1.5 }}>
              <Typography variant="subtitle2">{t(language, "modelsCreateButton")}</Typography>
              <IconButton size="small" onClick={() => setIsCreating(false)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
            {detailPanel}
          </Paper>
        </Collapse>

        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>{t(language, "modelsNamePlaceholder")}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t(language, "modelsCategoryPlaceholder")}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, width: 100 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {models.map((model) => (
                <React.Fragment key={model.id}>
                  <TableRow
                    hover
                    sx={{ cursor: "pointer", "& > td": { borderBottom: expandedId === model.id ? "none" : undefined } }}
                    onClick={() => openModel(model.id)}
                    selected={expandedId === model.id}
                  >
                    <TableCell>
                      <Typography fontWeight={600}>{model.name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={getCategoryName(model.categoryId)} />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            openModel(model.id);
                          }}
                          color="primary"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteModel(model.id);
                          }}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={3} sx={{ p: 0 }}>
                      <Collapse in={expandedId === model.id} unmountOnExit>
                        <Divider />
                        {detailPanel}
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
              {models.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                      {t(language, "modelsSelectHint")}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
    </Container>
  );
}
