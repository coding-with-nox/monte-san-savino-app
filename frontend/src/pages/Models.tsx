import React, { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { api } from "../lib/api";
import { Language, t } from "../lib/i18n";

type Model = { id: string; name: string; categoryId: string; teamId?: string | null; imageUrl?: string | null };
type ModelDetail = { model: Model; images: { id: string; url: string }[] };

interface ModelsProps {
  language: Language;
}

export default function Models({ language }: ModelsProps) {
  const [models, setModels] = useState<Model[]>([]);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [selected, setSelected] = useState<ModelDetail | null>(null);
  const [image, setImage] = useState("");

  async function load() {
    setModels(await api<Model[]>("/models"));
  }

  async function create() {
    await api("/models", { method: "POST", body: JSON.stringify({ name, categoryId, teamId: teamId || undefined, imageUrl: imageUrl || undefined }) });
    setName("");
    setCategoryId("");
    setTeamId("");
    setImageUrl("");
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
  }, []);

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
                <TextField
                  label={t(language, "modelsCategoryPlaceholder")}
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  fullWidth
                />
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
                <TextField
                  label={t(language, "modelsImagePlaceholder")}
                  value={imageUrl}
                  onChange={(event) => setImageUrl(event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <Button variant="contained" onClick={create}>
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
                      <ListItemText primary={model.name} secondary={model.categoryId} />
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
                      {selected.model.id}
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
