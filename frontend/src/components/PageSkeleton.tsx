import React from "react";
import { Box, Skeleton, Stack } from "@mui/material";

interface PageSkeletonProps {
  variant?: "table" | "cards" | "form";
  rows?: number;
}

/** MUI skeleton placeholder shown while a page loads its first data. */
export default function PageSkeleton({ variant = "table", rows = 5 }: PageSkeletonProps) {
  return (
    <Box data-testid="page-skeleton" aria-busy="true" aria-live="polite">
      <Stack spacing={2}>
        <Skeleton variant="text" width="30%" height={48} />
        {variant === "cards" && (
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            {Array.from({ length: Math.max(rows, 1) }).map((_, i) => (
              <Skeleton key={i} variant="rounded" width={160} height={96} />
            ))}
          </Stack>
        )}
        {variant === "form" && (
          <Stack spacing={2}>
            {Array.from({ length: Math.max(rows, 1) }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={44} />
            ))}
          </Stack>
        )}
        {variant === "table" && (
          <Stack spacing={1}>
            <Skeleton variant="rounded" height={40} />
            {Array.from({ length: rows }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={52} />
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
