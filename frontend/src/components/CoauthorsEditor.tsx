import React from "react";
import { Box, Button, IconButton, MenuItem, Stack, TextField, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { Language, t } from "../lib/i18n";
import { formatCents, MemberRole } from "../lib/pricing";

export type Coauthor = {
  name: string;
  surname: string;
  email: string;
  roleId: string;
  /** Legacy free-text role, kept for members saved without a roleId. */
  role?: string;
};

export const emptyCoauthor = (): Coauthor => ({ name: "", surname: "", email: "", roleId: "" });

export const isCoauthorValid = (c: Coauthor) =>
  !!c.name.trim() && !!c.surname.trim() && !!(c.roleId || c.role) && (!c.email.trim() || /^\S+@\S+\.\S+$/.test(c.email.trim()));

/** Request shape of POST/PUT /models teamMembers: an empty email is omitted. */
export function coauthorPayload(c: Coauthor) {
  return {
    name: c.name.trim(),
    surname: c.surname.trim(),
    ...(c.email.trim() ? { email: c.email.trim() } : {}),
    ...(c.roleId ? { roleId: c.roleId } : { role: c.role })
  };
}

interface CoauthorsEditorProps {
  language: Language;
  members: Coauthor[];
  roles: MemberRole[];
  onChange: (members: Coauthor[]) => void;
}

export default function CoauthorsEditor({ language, members, roles, onChange }: CoauthorsEditorProps) {
  const update = (index: number, patch: Partial<Coauthor>) =>
    onChange(members.map((m, i) => (i === index ? { ...m, ...patch } : m)));

  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">{t(language, "coauthorsHint")}</Typography>
      {members.map((member, index) => (
        <Box
          key={index}
          role="group"
          aria-label={`${t(language, "coauthorLabel")} ${index + 1}`}
          sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1.4fr 1.4fr auto" }, gap: 1, alignItems: "start" }}
        >
          <TextField size="small" required label={t(language, "coauthorName")} value={member.name} onChange={(e) => update(index, { name: e.target.value })} />
          <TextField size="small" required label={t(language, "coauthorSurname")} value={member.surname} onChange={(e) => update(index, { surname: e.target.value })} />
          <TextField size="small" type="email" label={t(language, "coauthorEmail")} value={member.email} onChange={(e) => update(index, { email: e.target.value })} />
          <TextField
            select
            size="small"
            required
            label={t(language, "coauthorRole")}
            value={member.roleId}
            helperText={!member.roleId && member.role ? member.role : undefined}
            onChange={(e) => update(index, { roleId: e.target.value })}
          >
            {roles.map((r) => (
              <MenuItem key={r.id} value={r.id}>
                {r.price != null ? `${r.name} (${formatCents(r.price, language)})` : r.name}
              </MenuItem>
            ))}
          </TextField>
          <IconButton
            size="small"
            color="error"
            aria-label={`${t(language, "coauthorRemove")} ${index + 1}`}
            onClick={() => onChange(members.filter((_, i) => i !== index))}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => onChange([...members, emptyCoauthor()])} sx={{ alignSelf: "flex-start" }}>
        {t(language, "coauthorAdd")}
      </Button>
    </Stack>
  );
}
