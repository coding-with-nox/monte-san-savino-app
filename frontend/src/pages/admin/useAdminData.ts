import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/api";
import { Language, t } from "../../lib/i18n";
import type { AdminCategory, AdminEvent, ModelRef } from "./types";

/**
 * Data shared by more than one Admin tab: events and categories (loaded once at page open)
 * and the model catalogue (loaded lazily by the first tab that needs it).
 * Id -> name lookups are Map based and memoized instead of O(n) find() calls in render.
 */
export function useAdminData(language: Language) {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [models, setModels] = useState<ModelRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const modelsState = useRef<"idle" | "loading" | "loaded">("idle");

  // The two requests are independent: a failing one must not blank the other.
  const refresh = useCallback(async () => {
    const sections: { titleKey: Parameters<typeof t>[1]; run: () => Promise<void> }[] = [
      { titleKey: "adminEventsTitle", run: async () => setEvents(await api<AdminEvent[]>("/events")) },
      { titleKey: "adminCategoriesTitle", run: async () => setCategories(await api<AdminCategory[]>("/categories")) }
    ];
    const results = await Promise.allSettled(sections.map((section) => section.run()));
    setErrors(results.flatMap((r, i) => (r.status === "rejected" ? [t(language, sections[i].titleKey)] : [])));
    setLoading(false);
  }, [language]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Best effort and idempotent: model names fall back to short ids when this fails. */
  const ensureModels = useCallback(() => {
    if (modelsState.current !== "idle") return;
    modelsState.current = "loading";
    api<ModelRef[]>("/admin/models")
      .then((list) => {
        setModels(list);
        modelsState.current = "loaded";
      })
      .catch(() => {
        modelsState.current = "idle";
      });
  }, []);

  const refreshModels = useCallback(
    () =>
      api<ModelRef[]>("/admin/models")
        .then((list) => {
          setModels(list);
          modelsState.current = "loaded";
        })
        .catch(() => undefined),
    []
  );

  const eventsById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const modelsById = useMemo(() => new Map(models.map((m) => [m.id, m])), [models]);

  const eventName = useCallback((id: string) => eventsById.get(id)?.name ?? id.slice(0, 8), [eventsById]);
  const categoryName = useCallback((id: string) => categoriesById.get(id)?.name ?? id.slice(0, 8), [categoriesById]);
  const modelName = useCallback((id: string) => modelsById.get(id)?.name ?? id.slice(0, 8), [modelsById]);

  return {
    events,
    categories,
    models,
    loading,
    errors,
    refresh,
    ensureModels,
    refreshModels,
    eventName,
    categoryName,
    modelName
  };
}

export type AdminData = ReturnType<typeof useAdminData>;
