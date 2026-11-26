import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Box, Paper, Popper, Portal, Stack, Typography } from "@mui/material";
import FocusTrap from "@mui/material/Unstable_TrapFocus";
import { Language, t } from "../lib/i18n";
import { ActionButton } from "./ActionButton";

export type GuidedStep = {
  /** Value of the data-tour attribute to highlight; without it the bubble is centred. */
  target?: string;
  title: string;
  text: string;
};

export function isElementVisible(element: Element) {
  for (let node: Element | null = element; node; node = node.parentElement) {
    if ((node as HTMLElement).hidden) return false;
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") return false;
  }
  return true;
}

export function findTourTarget(name: string): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`);
  return Array.from(all).find(isElementVisible) ?? null;
}

interface GuidedTourProps {
  language: Language;
  open: boolean;
  steps: GuidedStep[];
  onClose: () => void;
}

/** Step-by-step guide: highlights the target of each step and explains it. Esc closes, arrows move. */
export default function GuidedTour({ open, ...props }: GuidedTourProps) {
  return open ? <Portal><TourOverlay {...props} /></Portal> : null;
}

type Rect = { top: number; left: number; width: number; height: number };

function TourOverlay({ language, steps, onClose }: Omit<GuidedTourProps, "open">) {
  // Steps whose target is not on screen are skipped; the list is fixed when the tour starts.
  const [visible] = useState(() => steps.filter((s) => !s.target || findTourTarget(s.target)));
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  // undefined until the target is resolved, so the bubble is not mounted twice.
  const [anchor, setAnchor] = useState<HTMLElement | null | undefined>(undefined);
  const [dialog, setDialog] = useState<HTMLElement | null>(null);
  const opener = useRef<Element | null>(document.activeElement);
  const titleId = useId();
  const textId = useId();
  const step = visible[index];
  const last = index === visible.length - 1;

  const next = useCallback(() => (last ? onClose() : setIndex((i) => i + 1)), [last, onClose]);
  const back = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  useEffect(() => {
    if (visible.length === 0) onClose();
  }, [visible, onClose]);

  // Give the focus back to whatever started the tour.
  useEffect(() => () => {
    const previous = opener.current as HTMLElement | null;
    if (previous && previous.isConnected) previous.focus?.();
  }, []);

  useLayoutEffect(() => {
    const target = step?.target ? findTourTarget(step.target) : null;
    setAnchor(target);
    if (!target) {
      setRect(null);
      return;
    }
    target.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    const measure = () => {
      const r = target.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step]);

  // Move the focus to the dialog on every step, so screen readers announce the new content.
  useEffect(() => { dialog?.focus({ preventScroll: true }); }, [dialog, index]);

  // Capture phase: while the tour is open, the page shortcuts (e.g. the ceremony) stay inactive.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
      else {
        // Tab is left to the focus trap; Enter / Space keep their native effect on the buttons.
        if (e.key !== "Tab") e.stopImmediatePropagation();
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [next, back, onClose]);

  if (!step || anchor === undefined) return null;

  const bubble = (
    <FocusTrap open disableRestoreFocus>
      <Paper
        ref={setDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
        tabIndex={-1}
        elevation={8}
        sx={{ p: 2, width: "min(360px, calc(100vw - 32px))", m: 1.5 }}
      >
        <Stack spacing={1}>
          <Typography variant="caption" color="text.secondary" aria-live="polite">
            {t(language, "tourCounter").replace("{n}", String(index + 1)).replace("{total}", String(visible.length))}
          </Typography>
          <Typography id={titleId} variant="h6" component="h2">{step.title}</Typography>
          <Typography id={textId} variant="body2">{step.text}</Typography>
          <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ pt: 1 }}>
            <ActionButton tip={t(language, "tipTourSkip")} onClick={onClose}>{t(language, "tourSkip")}</ActionButton>
            <Stack direction="row" spacing={1}>
              <ActionButton tip={t(language, "tipTourBack")} onClick={back} disabled={index === 0}>{t(language, "tourBack")}</ActionButton>
              <ActionButton tip={t(language, last ? "tipTourFinish" : "tipTourNext")} variant="contained" onClick={next}>
                {t(language, last ? "tourFinish" : "tourNext")}
              </ActionButton>
            </Stack>
          </Stack>
        </Stack>
      </Paper>
    </FocusTrap>
  );

  // Below the tooltips, above dialogs and full-screen views.
  const zIndex = (offset: number) => (theme: { zIndex: { tooltip: number } }) => theme.zIndex.tooltip - offset;

  return (
    <>
      <Box data-testid="tour-backdrop" sx={{ position: "fixed", inset: 0, zIndex: zIndex(3), bgcolor: anchor ? "transparent" : "rgba(0,0,0,0.6)" }} />
      {anchor && rect && (
        <Box
          aria-hidden="true"
          data-testid="tour-spotlight"
          sx={{
            position: "fixed",
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            borderRadius: 1,
            border: "2px solid",
            borderColor: "primary.main",
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
            pointerEvents: "none",
            zIndex: zIndex(2)
          }}
        />
      )}
      {anchor ? (
        <Popper
          open
          role="presentation"
          disablePortal
          anchorEl={anchor}
          placement="bottom"
          modifiers={[{ name: "preventOverflow", options: { altAxis: true, tether: false, padding: 8 } }]}
          sx={{ zIndex: zIndex(1) }}
        >
          {bubble}
        </Popper>
      ) : (
        <Box sx={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: zIndex(1) }}>
          {bubble}
        </Box>
      )}
    </>
  );
}
