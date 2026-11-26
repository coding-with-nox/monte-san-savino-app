import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { api } from "../../lib/api";
import { Language, t } from "../../lib/i18n";
import SectionCard from "../../components/SectionCard";
import CsvImportCard from "../../components/CsvImportCard";
import ModelMoveCard from "../../components/ModelMoveCard";
import { useConfirm } from "../../components/ConfirmDialog";
import useToast from "../../components/useToast";
import { MemberRole, parseEuros } from "../../lib/pricing";
import type { AdminData } from "./useAdminData";
import { ActionButton, TipIconButton } from "../../components/ActionButton";

type Level = { id: string; name: string; sortOrder?: number | null };

export default function CatalogTab({ language, data }: { language: Language; data: AdminData }) {
  const { events, categories, models, eventName, ensureModels, refreshModels, refresh } = data;
  const { confirm, node: confirmNode } = useConfirm(language);
  const [levels, setLevels] = useState<Level[]>([]);
  const [newLevelName, setNewLevelName] = useState("");
  const [newLevelSortOrder, setNewLevelSortOrder] = useState("");
  const [memberRoles, setMemberRoles] = useState<MemberRole[]>([]);
  const [newMemberRoleName, setNewMemberRoleName] = useState("");
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const toast = useToast();

  // Lookup tables load only when the catalog tab is first opened. Failures degrade to an empty list.
  async function loadLevels() {
    try { setLevels(await api<Level[]>("/admin/levels")); } catch { setLevels([]); }
  }
  async function loadMemberRoles() {
    try { setMemberRoles(await api<MemberRole[]>("/admin/member-roles")); } catch { setMemberRoles([]); }
  }
  useEffect(() => {
    ensureModels();
    void loadLevels();
    void loadMemberRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moveTargets = useMemo(
    () => categories.map((c) => ({ id: c.id, name: `${c.name} (${eventName(c.eventId)})` })),
    [categories, eventName]
  );

  async function createLevel() {
    if (!newLevelName.trim()) return;
    await api("/admin/levels", {
      method: "POST",
      body: JSON.stringify({ name: newLevelName.trim(), sortOrder: newLevelSortOrder ? Number(newLevelSortOrder) : undefined })
    });
    setNewLevelName(""); setNewLevelSortOrder("");
    await loadLevels();
  }
  async function deleteLevel(id: string) {
    if (!(await confirm(t(language, "confirmDelete")))) return;
    await api(`/admin/levels/${id}`, { method: "DELETE" });
    await loadLevels();
  }
  async function savePrice(role: MemberRole) {
    const price = parseEuros(priceDrafts[role.id] ?? "");
    if (price === null) {
      toast.error(t(language, "adminPriceInvalid"));
      return;
    }
    try {
      await api(`/admin/member-roles/${role.id}`, { method: "PUT", body: JSON.stringify({ price }) });
      setPriceDrafts(({ [role.id]: _saved, ...rest }) => rest);
      await loadMemberRoles();
      toast.success(t(language, "adminSaved"));
    } catch (err: any) {
      toast.error(err?.message ?? String(err));
    }
  }
  async function createMemberRole() {
    if (!newMemberRoleName.trim()) return;
    await api("/admin/member-roles", { method: "POST", body: JSON.stringify({ name: newMemberRoleName.trim() }) });
    setNewMemberRoleName("");
    await loadMemberRoles();
  }
  async function deleteMemberRole(id: string) {
    if (!(await confirm(t(language, "confirmDelete")))) return;
    await api(`/admin/member-roles/${id}`, { method: "DELETE" });
    await loadMemberRoles();
  }

  return (
    <Stack spacing={2}>
      <Box data-tour="admin-move">
      <ModelMoveCard
        language={language}
        models={models}
        categories={moveTargets}
        onMoved={() => { void refreshModels(); }}
      />
      </Box>
      <Box data-tour="admin-import" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <CsvImportCard
        language={language}
        title={`${t(language, "importTitle")}: ${t(language, "importLevels")}`}
        help={t(language, "importHelpLevels")}
        endpoint="/admin/import/levels"
        onImported={loadLevels}
      />
      <CsvImportCard
        language={language}
        title={`${t(language, "importTitle")}: ${t(language, "importClasses")}`}
        help={t(language, "importHelpClasses")}
        endpoint="/admin/import/classes"
        events={events}
        onImported={() => { void refresh(); }}
      />
      </Box>
      <SectionCard tourId="admin-levels" title={t(language, "adminLevelsTitle")}>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }} alignItems="center" flexWrap="wrap" useFlexGap>
          <TextField size="small" label={t(language, "adminLevelName")} value={newLevelName} onChange={(e) => setNewLevelName(e.target.value)} />
          <TextField size="small" label={t(language, "adminLevelSortOrder")} type="number" value={newLevelSortOrder} onChange={(e) => setNewLevelSortOrder(e.target.value)} sx={{ width: 120 }} />
          <ActionButton tip={t(language, "tipLevelAdd")} variant="contained" size="small" onClick={createLevel} disabled={!newLevelName.trim()}>
            {t(language, "adminLevelsAddButton")}
          </ActionButton>
        </Stack>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>{t(language, "adminLevelName")}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t(language, "adminLevelSortOrder")}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {levels.map((lvl) => (
                <TableRow key={lvl.id}>
                  <TableCell>{lvl.name}</TableCell>
                  <TableCell>{lvl.sortOrder ?? "-"}</TableCell>
                  <TableCell align="right">
                    <TipIconButton tip={t(language, "tipLevelDelete")} aria-label={`${t(language, "actionDelete")} ${lvl.name}`} size="small" color="error" onClick={() => deleteLevel(lvl.id)}>
                      <DeleteIcon fontSize="small" />
                    </TipIconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>

      <SectionCard tourId="admin-roles" title={t(language, "adminMemberRolesTitle")}>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }} alignItems="center">
          <TextField size="small" label={t(language, "adminMemberRoleName")} value={newMemberRoleName} onChange={(e) => setNewMemberRoleName(e.target.value)} />
          <ActionButton tip={t(language, "tipMemberRoleAdd")} variant="contained" size="small" onClick={createMemberRole} disabled={!newMemberRoleName.trim()}>
            {t(language, "adminMemberRolesAddButton")}
          </ActionButton>
        </Stack>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>{t(language, "adminMemberRoleName")}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t(language, "adminMemberRolePrice")}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {memberRoles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell>{role.name}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TextField
                        size="small"
                        sx={{ width: 110 }}
                        value={priceDrafts[role.id] ?? (role.price != null ? String(role.price / 100) : "")}
                        onChange={(e) => setPriceDrafts((d) => ({ ...d, [role.id]: e.target.value }))}
                        inputProps={{ inputMode: "decimal", "aria-label": `${t(language, "adminMemberRolePrice")}: ${role.name}` }}
                        InputProps={{ startAdornment: <InputAdornment position="start">€</InputAdornment> }}
                      />
                      <ActionButton tip={t(language, "tipMemberRolePrice")} size="small" onClick={() => savePrice(role)} disabled={priceDrafts[role.id] === undefined}>
                        {t(language, "adminSave")}
                      </ActionButton>
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <TipIconButton tip={t(language, "tipMemberRoleDelete")} aria-label={`${t(language, "actionDelete")} ${role.name}`} size="small" color="error" onClick={() => deleteMemberRole(role.id)}>
                      <DeleteIcon fontSize="small" />
                    </TipIconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </SectionCard>
      {confirmNode}
      {toast.node}
    </Stack>
  );
}
