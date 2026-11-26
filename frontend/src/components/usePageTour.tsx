import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Language, t, TranslationKey } from "../lib/i18n";
import {
  canSeeTour, isTourSeen, markTourSeen, resetTours, TourContext, TourDef, TOURS, toursAutoStartDisabled, tourSteps
} from "../lib/tours";
import GuidedTour, { findTourTarget, GuidedStep, isElementVisible } from "./GuidedTour";

/** Time the page must stay unchanged before a tour starts by itself (data loading, transitions). */
export const TOUR_SETTLE_MS = 500;

/** Tour of what is on screen: the visible tab/panel wins over the page itself. */
export function activeTour(pathname: string, ctx: TourContext): TourDef | null {
  const candidates = TOURS.filter((tour) => tour.path === pathname && canSeeTour(tour, ctx));
  const scoped = candidates.find((tour) => {
    if (!tour.scope) return false;
    const element = document.querySelector(`[data-tour-scope="${tour.scope}"]`);
    return !!element && isElementVisible(element);
  });
  return scoped ?? candidates.find((tour) => !tour.scope) ?? null;
}

function resolveSteps(tour: TourDef, ctx: TourContext, language: Language): GuidedStep[] {
  return tourSteps(tour, ctx).map((s) => ({
    target: s.target,
    title: t(language, `${s.key}Title` as TranslationKey),
    text: t(language, `${s.key}Text` as TranslationKey)
  }));
}

const onScreen = (steps: GuidedStep[]) => steps.filter((s) => s.target && findTourTarget(s.target));

/**
 * Tour of the current page, same pattern as useConfirm/useToast: `start` for the "?" button,
 * `replayAll` to forget what was already shown, `node` to render. Each tour also starts by itself
 * the first time its page is opened.
 */
export default function usePageTour(language: Language, ctx: TourContext) {
  const location = useLocation();
  const [running, setRunning] = useState<{ id: string; steps: GuidedStep[] } | null>(null);
  const [epoch, setEpoch] = useState(0);
  const runningRef = useRef(false);
  runningRef.current = running !== null;
  const handledRequest = useRef("");

  useEffect(() => { setRunning(null); }, [location.pathname]);

  const open = useCallback((tour: TourDef, steps: GuidedStep[]) => {
    markTourSeen(tour.id);
    runningRef.current = true;
    setRunning({ id: tour.id, steps });
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    // Set by the help page ("start the tour").
    const requested = (location.state as { startTour?: string } | null)?.startTour;
    const attempt = () => {
      // Never start over a dialog, menu or drawer: they own the focus.
      if (runningRef.current || document.querySelector(".MuiModal-root")) return;
      const tour = activeTour(location.pathname, ctx);
      if (!tour) return;
      const asked = requested === tour.id && handledRequest.current !== location.key;
      if (!asked && (toursAutoStartDisabled() || isTourSeen(tour.id))) return;
      const steps = onScreen(resolveSteps(tour, ctx, language));
      if (steps.length === 0) return;
      if (asked) handledRequest.current = location.key;
      open(tour, steps);
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(attempt, TOUR_SETTLE_MS);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    schedule();
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [location.pathname, location.key, location.state, ctx, language, epoch, open]);

  const start = useCallback(() => {
    const tour = activeTour(location.pathname, ctx);
    if (!tour) return;
    const steps = onScreen(resolveSteps(tour, ctx, language));
    // Nothing to point at (e.g. page still empty): explain the page in a single bubble.
    open(tour, steps.length ? steps : [{
      title: t(language, `${tour.key}Name` as TranslationKey),
      text: t(language, `${tour.key}Desc` as TranslationKey)
    }]);
  }, [location.pathname, ctx, language, open]);

  const replayAll = useCallback(() => {
    resetTours();
    setEpoch((e) => e + 1);
  }, []);

  const close = useCallback(() => setRunning(null), []);

  const node = running ? (
    <GuidedTour key={running.id} language={language} open steps={running.steps} onClose={close} />
  ) : null;

  return { start, replayAll, node };
}
