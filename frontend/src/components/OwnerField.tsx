import React, { useEffect, useRef, useState } from "react";
import { Autocomplete, TextField } from "@mui/material";
import { api } from "../lib/api";
import { decodeJwt, getToken, getUserId } from "../lib/auth";
import { Language, t } from "../lib/i18n";

/** Row of GET /admin/users/enrollable?q= */
export type Participant = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  participantNumber?: number | string | null;
};

export const SEARCH_DELAY_MS = 250;

export function participantName(p: Participant) {
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || p.email;
}

const numberSuffix = (language: Language, p: Participant) =>
  p.participantNumber != null ? ` — ${t(language, "onBehalfNumber")} ${p.participantNumber}` : "";

export function participantLabel(language: Language, p: Participant) {
  return `${participantName(p)}${numberSuffix(language, p)}`;
}

const search = (q: string) => api<Participant[]>(`/admin/users/enrollable?q=${encodeURIComponent(q)}`);

interface OwnerFieldProps {
  language: Language;
  /** null = the current user. */
  value: Participant | null;
  onChange: (owner: Participant | null) => void;
}

/** "Enroll on behalf of": server-side search of participants, defaulting to the current user. */
export default function OwnerField({ language, value, onChange }: OwnerFieldProps) {
  const myId = getUserId() ?? "";
  const token = getToken();
  const myEmail = token ? String(decodeJwt(token).email ?? "") : "";
  const [self, setSelf] = useState<Participant>({ id: myId, email: myEmail });
  const [results, setResults] = useState<Participant[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const request = useRef(0);

  // My own participant number, shown next to "Myself".
  useEffect(() => {
    if (!myEmail) return;
    search(myEmail)
      .then((rows) => {
        const me = rows?.find((r) => r.id === myId);
        if (me) setSelf(me);
      })
      .catch(() => undefined);
  }, [myId, myEmail]);

  // Debounced search; late responses are ignored.
  useEffect(() => {
    const id = ++request.current;
    const timer = window.setTimeout(() => {
      setLoading(true);
      search(query)
        .then((rows) => { if (id === request.current) setResults(Array.isArray(rows) ? rows : []); })
        .catch(() => { if (id === request.current) setResults([]); })
        .finally(() => { if (id === request.current) setLoading(false); });
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const label = (p: Participant) =>
    p.id === self.id ? `${t(language, "onBehalfSelf")}${numberSuffix(language, self)}` : participantLabel(language, p);

  return (
    <Autocomplete
      size="small"
      fullWidth
      disableClearable
      value={value ?? self}
      options={[self, ...results.filter((r) => r.id !== self.id)]}
      loading={loading}
      loadingText={t(language, "onBehalfLoading")}
      noOptionsText={t(language, "onBehalfNoResults")}
      filterOptions={(options) => options}
      getOptionLabel={label}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      onChange={(_, next) => { onChange(next.id === self.id ? null : next); setQuery(""); }}
      onInputChange={(_, next, reason) => { if (reason === "input") setQuery(next); }}
      renderOption={(props, option) => <li {...props} key={option.id}>{label(option)}</li>}
      renderInput={(params) => (
        <TextField {...params} label={t(language, "onBehalfLabel")} helperText={t(language, "onBehalfHelp")} />
      )}
    />
  );
}
