import React from "react";

/**
 * Stylized logo: a miniature on its display plinth under a star (the contest award), in a rounded
 * badge. Same drawing as public/favicon.svg.
 */
export default function AppLogo({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
      <defs>
        <linearGradient id="app-logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c62828" />
          <stop offset="1" stopColor="#8e0000" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#app-logo-bg)" />
      {/* star (award) */}
      <path d="M32 7.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill="#ffd54f" />
      {/* miniature: head, shoulders, body */}
      <circle cx="32" cy="28" r="4.6" fill="#fff" />
      <path d="M24.5 46c0-7 3.2-12.6 7.5-12.6S39.5 39 39.5 46z" fill="#fff" />
      {/* plinth */}
      <path d="M20 47h24l-2.5 5.5h-19z" fill="#fff" opacity="0.92" />
      <rect x="17" y="52.5" width="30" height="3.5" rx="1.2" fill="#fff" opacity="0.75" />
    </svg>
  );
}
