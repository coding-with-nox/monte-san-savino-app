import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Switch,
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
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import PrintIcon from "@mui/icons-material/Print";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import ImageIcon from "@mui/icons-material/Image";
import { api } from "../lib/api";
import { getRole, roleAtLeast } from "../lib/auth";
import { Language, t } from "../lib/i18n";
import PageContainer from "../components/PageContainer";
import SectionCard from "../components/SectionCard";
import EmptyState from "../components/EmptyState";
import PageSkeleton from "../components/PageSkeleton";
import PrintActions from "../components/PrintActions";
import { useConfirm } from "../components/ConfirmDialog";
import useToast from "../components/useToast";
import Field from "../components/Field";
import CoauthorsEditor, { Coauthor, coauthorPayload, emptyCoauthor, isCoauthorValid } from "../components/CoauthorsEditor";
import { PriceLine } from "../components/PriceSummary";
import { EventPricing, formatCents, MemberRole, PricingResponse } from "../lib/pricing";
import { ActionButton, TipIconButton } from "../components/ActionButton";
import OwnerField, { Participant, participantLabel, participantName } from "../components/OwnerField";
import { hasPermission, useAccess } from "../lib/access";

type Model = {
  id: string;
  name: string;
  description?: string | null;
  code?: string | null;
  categoryId: string;
  levelId: string;
  imageUrl?: string | null;
  isTeam: boolean;
  /** Formatted team code from the backend (e.g. 173T1). */
  teamCode?: string | null;
  displayNumber?: number | null;
  /** Visible to owner, judges and managers. */
  notes?: string | null;
};
type Level = { id: string; name: string; sortOrder?: number | null; freeToEnter?: boolean };
type TeamMember = { name: string; surname: string; email?: string | null; role?: string | null; roleId?: string | null };
type ModelDetail = {
  model: Model & { teamId?: string | null };
  images: { id: string; url: string }[];
  teamMembers?: TeamMember[];
};
type Category = { id: string; eventId: string; name: string; status: string; freeToEnter?: boolean };

interface ModelsProps {
  language: Language;
}

const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export default function Models({ language }: ModelsProps) {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const { confirm, node: confirmNode } = useConfirm(language);
  const role = getRole();
  const isManager = role ? roleAtLeast(role, "manager") : false;
  const canEnrollOnBehalf = hasPermission(role, useAccess().permissions, "enrollOnBehalf");
  /** Owner of the model being enrolled; null = myself. */
  const [owner, setOwner] = useState<Participant | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editInternalNotes, setEditInternalNotes] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ModelDetail | null>(null);
  // "?new=1" (help page) opens the wizard straight away.
  const [isCreating, setIsCreating] = useState(() => new URLSearchParams(window.location.search).get("new") === "1");
  const [uploading, setUploading] = useState(false);
  const [savingModel, setSavingModel] = useState(false);
  const toast = useToast();
  const [imagesEnabled, setImagesEnabled] = useState(false);
  const [maxModelsPerUser, setMaxModelsPerUser] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [levels, setLevels] = useState<Level[]>([]);
  const [memberRoles, setMemberRoles] = useState<MemberRole[]>([]);
  const [members, setMembers] = useState<Coauthor[]>([]);
  const [baseFeeCents, setBaseFeeCents] = useState<number | null>(null);
  const [pricing, setPricing] = useState<EventPricing | null>(null);
  const [step, setStep] = useState(0);
  const [editLevelId, setEditLevelId] = useState("");
  const [editIsTeam, setEditIsTeam] = useState(false);
  const [editTeamId, setEditTeamId] = useState("");
  const [attachName, setAttachName] = useState("");
  // Managers/admins only: internalNotes lives on GET/PUT /admin/models, never on /models.
  const adminNotesRef = useRef<Promise<Map<string, string>> | null>(null);
  const loadedInternalNotesRef = useRef("");
  // false when GET /admin/models failed at open: saving would overwrite stored notes with a blank baseline.
  const internalNotesLoadedRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      setModels(await api<Model[]>("/models"));
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  // Task 06: stampa scheda utente
  async function printScheda() {
    try {
      const html = await api<string>("/exports/model-card/pdf");
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    }
  }

  async function loadCategories() {
    try {
      setCategories(await api<Category[]>("/public/categories"));
    } catch {
      setCategories([]);
    }
  }

  async function loadLevels() {
    try { setLevels(await api<Level[]>("/public/levels")); } catch { setLevels([]); }
  }

  async function loadMemberRoles() {
    try { setMemberRoles(await api<MemberRole[]>("/public/member-roles")); } catch { setMemberRoles([]); }
  }

  /** Single GET /admin/models per mount, reused afterwards (updated in place after saves). */
  function getAdminInternalNotes(): Promise<Map<string, string>> {
    if (!adminNotesRef.current) {
      adminNotesRef.current = api<{ id: string; internalNotes?: string | null }[]>("/admin/models")
        .then((list) => new Map(list.map((m) => [m.id, m.internalNotes ?? ""] as [string, string])))
        .catch((err) => {
          adminNotesRef.current = null;
          throw err;
        });
    }
    return adminNotesRef.current;
  }

  async function saveInternalNotes(modelId: string) {
    const value = editInternalNotes.trim();
    if (!internalNotesLoadedRef.current) {
      toast.error(t(language, "modelsInternalNotesNotLoaded"));
      return;
    }
    if (value === loadedInternalNotesRef.current) return;
    try {
      await api(`/admin/models/${encodeURIComponent(modelId)}`, {
        method: "PUT",
        body: JSON.stringify({ internalNotes: value })
      });
      if (adminNotesRef.current) (await adminNotesRef.current).set(modelId, value);
    } catch {
      toast.error(t(language, "modelsInternalNotesSaveFailed"));
    }
  }

  async function openModel(modelId: string) {
    if (expandedId === modelId) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    try {
      const d = await api<ModelDetail>(`/models/${modelId}`);
      let internal = "";
      internalNotesLoadedRef.current = true;
      if (isManager) {
        try {
          internal = (await getAdminInternalNotes()).get(modelId) ?? "";
        } catch (err: any) {
          internalNotesLoadedRef.current = false;
          toast.error(err?.message ?? String(err));
        }
      }
      loadedInternalNotesRef.current = internal;
      setDetail(d);
      setEditName(d.model.name);
      setEditCategoryId(d.model.categoryId);
      setEditLevelId(d.model.levelId || "");
      setEditIsTeam(d.model.isTeam || false);
      setEditTeamId(d.model.teamId ?? "");
      setMembers((d.teamMembers ?? []).map((m) => ({
        name: m.name,
        surname: m.surname,
        email: m.email ?? "",
        roleId: m.roleId ?? "",
        role: m.role ?? undefined
      })));
      setEditNotes(d.model.notes ?? "");
      setEditInternalNotes(internal);
      setExpandedId(modelId);
      setIsCreating(false);
      setAttachName("");
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    }
  }

  function closePanel() {
    setExpandedId(null);
    setDetail(null);
    setIsCreating(false);
  }

  function startCreate() {
    setExpandedId(null);
    setDetail(null);
    setEditName("");
    setEditCategoryId("");
    setEditLevelId("");
    setEditIsTeam(false);
    setEditTeamId("");
    setEditNotes("");
    setEditInternalNotes("");
    loadedInternalNotesRef.current = "";
    internalNotesLoadedRef.current = true; // a new model has no stored notes to overwrite
    setIsCreating(true);
    setAttachName("");
  }

  // Legacy team models keep their teamId until members are entered inline.
  function teamPayload() {
    if (!editIsTeam) return { isTeam: false };
    return {
      isTeam: true,
      ...(members.length ? { teamMembers: members.map(coauthorPayload) } : { teamId: editTeamId })
    };
  }

  async function createModel() {
    setSavingModel(true);
    try {
      const created = await api<{ id: string }>("/models", {
        method: "POST",
        body: JSON.stringify({
          name: editName.trim(),
          categoryId: editCategoryId,
          levelId: editLevelId,
          isTeam: editIsTeam,
          teamId: editIsTeam ? editTeamId : null,
          notes: editNotes.trim() || null
        })
      });
      setIsCreating(false);
      if (isManager && created?.id) await saveInternalNotes(created.id);
      await load();
      const message = created?.code
        ? t(language, owner ? "onBehalfCreatedWithCode" : "modelsCreatedWithCode").replace("{code}", String(created.code))
        : t(language, owner ? "onBehalfCreated" : "modelsCreated");
      toast.success(owner ? message.replace("{name}", participantName(owner)) : message);
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    } finally {
      setSavingModel(false);
    }
  }

  async function saveModelChanges() {
    if (!detail?.model) return;
    if (editCategoryId !== detail.model.categoryId) {
      const ok = await confirm(t(language, "modelsCategoryChangeWarning"), { destructive: false });
      if (!ok) return;
    }
    setSavingModel(true);
    try {
      await api(`/models/${detail.model.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editName.trim(),
          categoryId: editCategoryId,
          levelId: editLevelId,
          isTeam: editIsTeam,
          teamId: editIsTeam ? editTeamId : null,
          notes: editNotes.trim() || null
        })
      });
      if (isManager) await saveInternalNotes(detail.model.id);
      closePanel();
      await load();
      toast.success(t(language, "modelsSaved"));
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    } finally {
      setSavingModel(false);
    }
  }

  async function deleteModel(modelId: string) {
    if (!(await confirm(t(language, "confirmDelete")))) return;
    try {
      await api(`/models/${modelId}`, { method: "DELETE" });
      if (expandedId === modelId) closePanel();
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    }
  }

  async function resizeImageForUpload(file: File): Promise<File | Blob> {
    const maxDimension = 1920;
    const targetMaxBytes = 1.5 * 1024 * 1024;
    const isAllowed = ALLOWED_UPLOAD_TYPES.includes(file.type);
    // Canvas can only encode jpeg/png/webp; "image/jpg" is not a real MIME type for toBlob.
    const outputType = file.type === "image/webp" ? "image/webp" : "image/jpeg";
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      if (isAllowed) return file;
      throw new Error(t(language, "modelImageUnsupported"));
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
      if (isAllowed) return file;
      throw new Error(t(language, "modelImageUnsupported"));
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    if (isAllowed && !needsResize && file.size <= targetMaxBytes) return file;
    const qualities = [0.85, 0.75, 0.65, 0.55];
    let candidate: Blob | null = null;
    for (const quality of qualities) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputType, quality));
      if (!blob || !ALLOWED_UPLOAD_TYPES.includes(blob.type)) continue;
      candidate = blob;
      if (blob.size <= targetMaxBytes) break;
    }
    if (candidate) return candidate;
    if (isAllowed) return file;
    throw new Error(t(language, "modelImageUnsupported"));
  }

  async function uploadFile(file: File) {
    if (!detail?.model) return;
    setUploading(true);
    try {
      const optimizedFile = await resizeImageForUpload(file);
      const contentType = optimizedFile.type;
      if (!ALLOWED_UPLOAD_TYPES.includes(contentType)) throw new Error(t(language, "modelImageUnsupported"));
      const { uploadUrl, publicUrl } = await api<{ uploadUrl: string; publicUrl: string }>(
        `/models/${detail.model.id}/image-upload`,
        { method: "POST", body: JSON.stringify({ contentType }) }
      );
      await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: optimizedFile });
      await api(`/models/${detail.model.id}/images`, { method: "POST", body: JSON.stringify({ url: publicUrl }) });
      const d = await api<ModelDetail>(`/models/${detail.model.id}`);
      setDetail(d);
      setAttachName("");
    } catch (err: any) {
      const status = err?.status;
      const fallback = status === 404 ? t(language, "modelImageNotFound") : status === 422 ? t(language, "modelImageRejected") : "";
      toast.error(err?.message || fallback || String(err));
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setAttachName(file.name);
      uploadFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  async function deleteImage(imageId: string) {
    if (!detail?.model) return;
    if (!(await confirm(t(language, "confirmDelete")))) return;
    try {
      await api(`/models/${detail.model.id}/images/${imageId}`, { method: "DELETE" });
      const d = await api<ModelDetail>(`/models/${detail.model.id}`);
      setDetail(d);
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    }
  }

  async function loadSettings() {
    try {
      const s = await api<Record<string, string>>("/settings");
      setImagesEnabled(s.modelImages === "true");
      const fee = Number.parseInt(s.baseFeeCents ?? "", 10);
      setBaseFeeCents(Number.isFinite(fee) ? fee : null);
      const max = Number.parseInt(s.maxModelsPerUser ?? "", 10);
      setMaxModelsPerUser(Number.isFinite(max) && max > 0 ? max : null);
    } catch {
      setImagesEnabled(false);
    }
  }

  useEffect(() => { load(); loadCategories(); loadSettings(); loadLevels(); loadMemberRoles(); }, []);

  const openCategories = categories.filter((c) => c.status === "open");
  const getCategoryName = (catId: string) => {
    const cat = categories.find((c) => c.id === catId);
    return cat ? cat.name : catId;
  };

  const pricingEventId = categories.find((c) => c.id === editCategoryId)?.eventId;
  const panelOpen = isCreating || expandedId !== null;

  // Current fee of the event (computed by the backend), shown next to the price preview.
  useEffect(() => {
    if (!panelOpen || !pricingEventId || (isCreating && owner)) { setPricing(null); return; }
    let cancelled = false;
    api<PricingResponse>(`/pricing/me?eventId=${encodeURIComponent(pricingEventId)}`)
      .then((res) => { if (!cancelled) setPricing(res?.events?.[0] ?? null); })
      .catch(() => { if (!cancelled) setPricing(null); });
    return () => { cancelled = true; };
  }, [panelOpen, pricingEventId, isCreating, owner]);

  const selectedLevel = levels.find((l) => l.id === editLevelId);
  const selectedCategory = categories.find((c) => c.id === editCategoryId);
  const teamValid = !editIsTeam || (members.length ? members.every(isCoauthorValid) : !!editTeamId);

  const pricePreview = (
    <Paper variant="outlined" sx={{ p: 1.5 }} data-testid="price-preview">
      <Stack spacing={0.75}>
        <Typography variant="subtitle2">{t(language, "pricePreviewTitle")}</Typography>
        {selectedCategory?.freeToEnter ? (
          <Typography variant="body2">{t(language, "priceCategoryFree")}</Typography>
        ) : (
          <>
            {pricing && pricing.baseFeeCents > 0 ? (
              <PriceLine label={t(language, "priceBaseFee")} value={t(language, "priceAlreadyApplied")} />
            ) : (
              baseFeeCents !== null && <PriceLine label={t(language, "priceBaseFeeOnce")} value={formatCents(baseFeeCents, language)} />
            )}
            {editIsTeam && members.map((m, i) => {
              const role = memberRoles.find((r) => r.id === m.roleId);
              return role?.price != null ? (
                <PriceLine
                  key={i}
                  label={`${t(language, "coauthorLabel")} ${i + 1}: ${`${m.name} ${m.surname}`.trim() || role.name}`}
                  value={formatCents(role.price, language)}
                />
              ) : null;
            })}
          </>
        )}
        {pricing && <PriceLine label={t(language, "priceCurrentTotal")} value={formatCents(pricing.totalCents, language)} />}
        {isCreating && owner && <Typography variant="body2">{t(language, "onBehalfPriceNote")}</Typography>}
        <Typography variant="body2" color="text.secondary">{t(language, "pricePreviewNote")}</Typography>
      </Stack>
    </Paper>
  );

  const showMediaPanel = !isCreating && Boolean(detail);
  const tableColumnCount = imagesEnabled ? 5 : 4;
  const atMaxModels = maxModelsPerUser !== null && models.length >= maxModelsPerUser;

  const nameField = (
      <TextField label={t(language, "modelsNamePlaceholder")} value={editName} onChange={(e) => setEditName(e.target.value)} fullWidth size="small" />
  );
  const classFields = (
    <>
      <FormControl fullWidth size="small">
        <InputLabel>{t(language, "modelsCategoryPlaceholder")}</InputLabel>
        <Select value={editCategoryId} label={t(language, "modelsCategoryPlaceholder")} onChange={(e) => setEditCategoryId(e.target.value)}>
          {openCategories.map((cat) => <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>)}
        </Select>
      </FormControl>
      {!isCreating && detail?.model && editCategoryId && editCategoryId !== detail.model.categoryId && (
        <Alert severity="warning" sx={{ py: 0.5 }}>
          {t(language, "modelsCategoryChangeWarning")}
        </Alert>
      )}
      <FormControl fullWidth size="small">
        <InputLabel>{t(language, "modelsLevelPlaceholder")}</InputLabel>
        <Select value={editLevelId} label={t(language, "modelsLevelPlaceholder")} onChange={(e) => setEditLevelId(e.target.value)}>
          {levels.map((lvl) => <MenuItem key={lvl.id} value={lvl.id}>{lvl.name}</MenuItem>)}
        </Select>
      </FormControl>
    </>
  );
  const noteFields = (
    <>
      <TextField
        label={t(language, "modelsNotesLabel")}
        value={editNotes}
        onChange={(e) => setEditNotes(e.target.value)}
        fullWidth
        multiline
        minRows={2}
        size="small"
        inputProps={{ maxLength: 2000 }}
      />
      {isManager && (
        <TextField
          label={t(language, "modelsInternalNotesLabel")}
          value={editInternalNotes}
          onChange={(e) => setEditInternalNotes(e.target.value)}
          fullWidth
          multiline
          minRows={2}
          size="small"
          color="warning"
          inputProps={{ maxLength: 2000 }}
        />
      )}
    </>
  );
  const teamFields = (
    <>
      <FormControlLabel
        control={
          <Switch
            checked={editIsTeam}
            onChange={(e) => {
              setEditIsTeam(e.target.checked);
              if (e.target.checked && members.length === 0 && !editTeamId) setMembers([emptyCoauthor()]);
            }}
          />
        }
        label={t(language, "modelsIsTeamLabel")}
      />
      {editIsTeam && <CoauthorsEditor language={language} members={members} roles={memberRoles} onChange={setMembers} />}
    </>
  );

  const stepLabels = [
    t(language, "wizardStepClass"),
    t(language, "wizardStepModel"),
    t(language, "wizardStepCoauthors"),
    t(language, "wizardStepSummary")
  ];
  const stepValid = [!!editCategoryId && !!editLevelId, !!editName.trim(), teamValid, true];

  const createPanel = (
    <Box sx={{ p: 2 }} data-tour-scope="models-wizard">
      <Stack spacing={2}>
        <Stepper data-tour="wizard-stepper" activeStep={step} alternativeLabel>
          {stepLabels.map((label) => (
            <Step key={label}><StepLabel>{label}</StepLabel></Step>
          ))}
        </Stepper>
        {step === 0 && canEnrollOnBehalf && (
          <Box data-tour="wizard-owner">
            <OwnerField language={language} value={owner} onChange={setOwner} />
          </Box>
        )}
        <Stack data-tour="wizard-fields" spacing={2}>
        {step === 0 && classFields}
        {step === 1 && <>{nameField}{noteFields}</>}
        {step === 2 && teamFields}
        {step === 3 && (
          <>
            {canEnrollOnBehalf && owner && (
              <Alert severity="info">{t(language, "onBehalfWarning").replace("{name}", participantLabel(language, owner))}</Alert>
            )}
            <Grid container spacing={2}>
              {canEnrollOnBehalf && (
                <Grid item xs={12}>
                  <Field label={t(language, "onBehalfOwner")} value={owner ? participantLabel(language, owner) : t(language, "onBehalfSelf")} />
                </Grid>
              )}
              <Grid item xs={12} sm={4}><Field label={t(language, "modelsNamePlaceholder")} value={editName.trim()} /></Grid>
              <Grid item xs={12} sm={4}><Field label={t(language, "modelsCategoryPlaceholder")} value={editCategoryId ? getCategoryName(editCategoryId) : ""} /></Grid>
              <Grid item xs={12} sm={4}><Field label={t(language, "modelsLevelPlaceholder")} value={selectedLevel?.name} /></Grid>
              {editIsTeam && (
                <Grid item xs={12}>
                  <Field label={t(language, "wizardStepCoauthors")} value={members.map((m) => `${m.name} ${m.surname}`.trim()).join(", ")} />
                </Grid>
              )}
            </Grid>
            {pricePreview}
          </>
        )}
        </Stack>
        <Stack data-tour="wizard-nav" direction="row" justifyContent="space-between" spacing={1}>
          <ActionButton tip={t(language, "tipWizardBack")} onClick={() => setStep((v) => v - 1)} disabled={step === 0}>{t(language, "wizardBack")}</ActionButton>
          {step < stepLabels.length - 1 ? (
            <ActionButton key="next" tip={t(language, "tipWizardNext")} variant="contained" onClick={() => setStep((v) => v + 1)} disabled={!stepValid[step]}>{t(language, "wizardNext")}</ActionButton>
          ) : (
            <ActionButton key="submit" tip={t(language, "tipModelsSubmit")} variant="contained" onClick={createModel} disabled={savingModel || !stepValid.every(Boolean) || (atMaxModels && !owner)}>
              {savingModel ? t(language, "modelsUploading") : t(language, "modelsCreateButton")}
            </ActionButton>
          )}
        </Stack>
      </Stack>
    </Box>
  );

  const editPanel = (
    <Box sx={{ p: 2 }}>
      <Grid container spacing={2} alignItems="flex-start">
        <Grid item xs={12} md={showMediaPanel && imagesEnabled ? 7 : 12}>
          <Stack spacing={1.5}>
            <Typography variant="subtitle2">
              {t(language, "modelsEditSection")}
            </Typography>
            {nameField}
            {classFields}
            {teamFields}
            {editIsTeam && pricePreview}
            {noteFields}
            {!isCreating && detail?.model && (
              <Stack direction="row" alignItems="center" spacing={1}>
                <PrintActions language={language} params={{ modelId: detail.model.id }} />
              </Stack>
            )}
            <ActionButton tip={t(language, "tipModelsSave")} variant="contained" onClick={saveModelChanges} disabled={savingModel || !editName.trim() || !editCategoryId || !teamValid} fullWidth>
              {savingModel ? t(language, "modelsUploading") : t(language, "modelsSaveButton")}
            </ActionButton>
          </Stack>
        </Grid>
        {showMediaPanel && imagesEnabled && (
          <Grid item xs={12} md={5}>
            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                borderStyle: "dashed",
                borderColor: "divider",
                bgcolor: "background.default"
              }}
            >
              <Stack spacing={1.5}>
                <Typography variant="subtitle2" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <AttachFileIcon fontSize="small" />
                  {t(language, "modelsImagesSection")}
                </Typography>

                {!imagesEnabled && (
                  <Alert severity="info" variant="outlined">
                    {t(language, "modelsImagesDisabledHint")}
                  </Alert>
                )}

                {imagesEnabled && (
                  <>
                    {detail?.images.length ? (
                      <List dense disablePadding>
                        {detail.images.map((img) => (
                          <ListItem key={img.id} disableGutters secondaryAction={
                            <TipIconButton tip={t(language, "tipImageDelete")} aria-label={`${t(language, "actionDelete")} ${img.url.split("/").pop() || img.url}`} size="small" color="error" onClick={() => deleteImage(img.id)}>
                              <DeleteIcon fontSize="small" />
                            </TipIconButton>
                          }>
                            <ListItemText
                              primary={img.url.split("/").pop() || img.url}
                              primaryTypographyProps={{ variant: "body2", noWrap: true }}
                            />
                          </ListItem>
                        ))}
                      </List>
                    ) : (
                      <Box
                        sx={{
                          p: 2,
                          border: "1px dashed",
                          borderColor: "divider",
                          borderRadius: 1.5,
                          textAlign: "center"
                        }}
                      >
                        <ImageIcon sx={{ mb: 0.5, color: "text.secondary" }} />
                        <Typography variant="body2" color="text.secondary">{t(language, "modelsNoImages")}</Typography>
                      </Box>
                    )}
                    <Divider />
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <input type="file" accept="image/*" ref={fileInputRef} style={{ display: "none" }} onChange={handleFileChange} />
                      <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} style={{ display: "none" }} onChange={handleFileChange} />
                      <ActionButton tip={t(language, "tipImageUpload")} variant="outlined" size="small" startIcon={uploading ? <CircularProgress size={16} /> : <UploadFileIcon />} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                        {uploading ? t(language, "modelsUploading") : t(language, "modelsUploadButton")}
                      </ActionButton>
                      <ActionButton tip={t(language, "tipImageCamera")} variant="outlined" size="small" startIcon={<PhotoCameraIcon />} onClick={() => cameraInputRef.current?.click()} disabled={uploading}>
                        {t(language, "modelsCameraButton")}
                      </ActionButton>
                    </Stack>
                    {attachName && <Typography variant="caption" color="text.secondary">{attachName}</Typography>}
                  </>
                )}
              </Stack>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );

  return (
    <PageContainer maxWidth="lg">
      {toast.node}
      {confirmNode}
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h4">{t(language, "modelsTitle")}</Typography>
          <Stack direction="row" spacing={1}>
            {/* Task 06: stampa scheda */}
            <ActionButton tip={t(language, "tipModelsPrintCard")} data-tour="models-print" variant="outlined" startIcon={<PrintIcon />} onClick={printScheda}>
              {t(language, "modelsPrintCard")}
            </ActionButton>
            <ActionButton tip={t(language, "tipModelsNew")} data-tour="models-new" variant="contained" startIcon={<AddIcon />} onClick={startCreate} disabled={atMaxModels && !canEnrollOnBehalf}>{t(language, "modelsCreateButton")}</ActionButton>
          </Stack>
        </Stack>
        <Collapse in={isCreating}>
          <Paper variant="outlined" sx={{ mb: 1 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, pt: 1.5 }}>
              <Typography variant="subtitle2">{t(language, "modelsCreateButton")}</Typography>
              <TipIconButton tip={t(language, "tipPanelClose")} size="small" aria-label={t(language, "wizardClose")} onClick={() => setIsCreating(false)}><CloseIcon fontSize="small" /></TipIconButton>
            </Stack>
            {isCreating && createPanel}
          </Paper>
        </Collapse>
        <SectionCard tourId="models-list" title={t(language, "modelsTitle")}>
          {loading && <PageSkeleton variant="table" rows={4} />}
          {!loading && models.length === 0 && (
            <EmptyState
              title={t(language, "emptyModelsTitle")}
              description={t(language, "emptyModelsDescription")}
              action={atMaxModels && !canEnrollOnBehalf ? undefined : { label: t(language, "modelsCreateButton"), tip: t(language, "tipModelsNew"), onClick: startCreate }}
            />
          )}
          {models.length > 0 && (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    {imagesEnabled && <TableCell sx={{ fontWeight: 700, width: 72 }}>{t(language, "modelsPreviewColumn")}</TableCell>}
                    <TableCell sx={{ fontWeight: 700 }}>{t(language, "modelsNamePlaceholder")}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{t(language, "modelsCodeColumn")}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{t(language, "modelsCategoryPlaceholder")}</TableCell>
                    <TableCell align="right" sx={{ width: 100 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {models.map((model) => (
                    <React.Fragment key={model.id}>
                      <TableRow
                        hover
                        sx={{
                          cursor: "pointer",
                          "& > td": { borderBottom: expandedId === model.id ? "none" : undefined }
                        }}
                        onClick={() => openModel(model.id)}
                        selected={expandedId === model.id}
                      >
                        {imagesEnabled && (
                          <TableCell sx={{ width: 72, p: 1 }}>
                            {model.imageUrl ? (
                              <Avatar variant="rounded" src={model.imageUrl} imgProps={{ loading: "lazy", decoding: "async" }} sx={{ width: 40, height: 40 }} />
                            ) : (
                              <Avatar variant="rounded" sx={{ width: 40, height: 40, bgcolor: "action.hover" }}>
                                <ImageIcon fontSize="small" color="disabled" />
                              </Avatar>
                            )}
                          </TableCell>
                        )}
                        <TableCell><Typography fontWeight={600}>{model.name}</Typography></TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            variant="outlined"
                            label={model.teamCode || model.code || "-"}
                            sx={{ "& .MuiChip-label": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" } }}
                          />
                        </TableCell>
                        <TableCell><Chip size="small" label={getCategoryName(model.categoryId)} /></TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <TipIconButton tip={t(language, "tipModelEdit")} size="small" aria-label={`${t(language, "modelsEditSection")} ${model.name}`} onClick={(e) => { e.stopPropagation(); openModel(model.id); }} color="primary"><EditIcon fontSize="small" /></TipIconButton>
                            <TipIconButton tip={t(language, "tipModelDelete")} size="small" aria-label={`${t(language, "confirmDelete")} ${model.name}`} onClick={(e) => { e.stopPropagation(); deleteModel(model.id); }} color="error"><DeleteIcon fontSize="small" /></TipIconButton>
                          </Stack>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={tableColumnCount} sx={{ p: 0 }}>
                          <Collapse in={expandedId === model.id} unmountOnExit>
                            <Divider />
                            {editPanel}
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </SectionCard>
      </Stack>
    </PageContainer>
  );
}
