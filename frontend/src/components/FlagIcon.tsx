import React from "react";
import type { Language } from "../lib/i18n";

/**
 * Language flags as SVG: emoji flags are not drawn on Windows (it shows the letters "IT"), so the
 * selector draws them itself. 3:2 ratio, rounded corners.
 */
const FLAGS: Record<Language, React.ReactNode> = {
  it: (
    <>
      <rect width="1" height="2" fill="#009246" />
      <rect x="1" width="1" height="2" fill="#fff" />
      <rect x="2" width="1" height="2" fill="#ce2b37" />
    </>
  ),
  fr: (
    <>
      <rect width="1" height="2" fill="#002395" />
      <rect x="1" width="1" height="2" fill="#fff" />
      <rect x="2" width="1" height="2" fill="#ed2939" />
    </>
  ),
  de: (
    <>
      <rect width="3" height="0.667" fill="#000" />
      <rect y="0.667" width="3" height="0.667" fill="#dd0000" />
      <rect y="1.333" width="3" height="0.667" fill="#ffce00" />
    </>
  ),
  es: (
    <>
      <rect width="3" height="2" fill="#aa151b" />
      <rect y="0.5" width="3" height="1" fill="#f1bf00" />
    </>
  ),
  en: (
    <>
      <rect width="3" height="2" fill="#012169" />
      <path d="M0,0 L3,2 M3,0 L0,2" stroke="#fff" strokeWidth="0.4" />
      <path d="M0,0 L3,2 M3,0 L0,2" stroke="#c8102e" strokeWidth="0.15" />
      <path d="M1.5,0 V2 M0,1 H3" stroke="#fff" strokeWidth="0.6" />
      <path d="M1.5,0 V2 M0,1 H3" stroke="#c8102e" strokeWidth="0.36" />
    </>
  )
};

export default function FlagIcon({ code, size = 20 }: { code: Language; size?: number }) {
  return (
    <svg
      viewBox="0 0 3 2"
      width={size}
      height={(size * 2) / 3}
      role="img"
      aria-hidden="true"
      preserveAspectRatio="none"
      style={{ display: "block", borderRadius: 2, boxShadow: "0 0 0 1px rgba(0,0,0,0.15)", flexShrink: 0 }}
    >
      {FLAGS[code]}
    </svg>
  );
}
