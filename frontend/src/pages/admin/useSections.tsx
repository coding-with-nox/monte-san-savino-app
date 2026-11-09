import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button } from "@mui/material";
import { Language, t } from "../../lib/i18n";

export type Section = { titleKey: Parameters<typeof t>[1]; run: () => Promise<unknown> };

/**
 * Runs a tab's own requests once, when the tab mounts (Admin mounts a tab only the first time it
 * is opened). Requests are independent (allSettled): a failing section is reported by name and
 * does not blank the others. `reload` re-runs them after a mutation or a retry.
 */
export function useSections(language: Language, getSections: () => Section[]) {
  const ref = useRef(getSections);
  ref.current = getSections;
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  const reload = useCallback(async () => {
    const sections = ref.current();
    const results = await Promise.allSettled(sections.map((section) => section.run()));
    setErrors(results.flatMap((r, i) => (r.status === "rejected" ? [t(language, sections[i].titleKey)] : [])));
    setLoading(false);
  }, [language]);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { loading, errors, reload };
}

export function SectionErrors({ language, errors, onRetry }: { language: Language; errors: string[]; onRetry: () => void }) {
  return (
    <>
      {errors.map((section) => (
        <Alert
          key={section}
          severity="error"
          action={<Button color="inherit" size="small" onClick={onRetry}>{t(language, "retryButton")}</Button>}
        >
          {t(language, "adminLoadSectionError")}: {section}
        </Alert>
      ))}
    </>
  );
}
