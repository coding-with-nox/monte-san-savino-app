import React, { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  Container,
  FormControl,
  Grid,
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
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";

type Model = { id: string; name: string; categoryId: string; teamId?: string | null; imageUrl?: string | null };
type ModelDetail = { model: Model; images: { id: string; url: string }[] };
type Category = { id: string; eventId: string; name: string; status: string };

interface ModelsProps {
  language: Language;
}

export default function Models({ language }: ModelsProps) {
  const [models, setModels] = useState<Model[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [selected, setSelected] = useState<ModelDetail | null>(null);
  const [image, setImage] = useState("");

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
    await api(`/models/${selected.model.id}/images`, { method: "POST", body: JSON.stringify({ url: image }) });
    setImage("");
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
                        <ListItem key={img.id} disableGutters>
                          <ListItemText primary={img.url} />
                        </ListItem>
                      ))}
                    </List>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} md={8}>
                        <TextField
                          label={t(language, "modelsAddImagePlaceholder")}
                          value={image}
                          onChange={(event) => setImage(event.target.value)}
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Button variant="outlined" onClick={addImage} fullWidth>
                          {t(language, "modelsAddImageButton")}
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
