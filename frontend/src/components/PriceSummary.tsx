import React from "react";
import { Box, Divider, Stack, Typography } from "@mui/material";
import { Language, t } from "../lib/i18n";
import { EventPricing, coauthorModelsLabel, formatCents } from "../lib/pricing";

export function PriceLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography variant={strong ? "subtitle1" : "body2"} fontWeight={strong ? 700 : 400}>{label}</Typography>
      <Typography variant={strong ? "subtitle1" : "body2"} fontWeight={strong ? 700 : 500} sx={{ whiteSpace: "nowrap" }}>{value}</Typography>
    </Stack>
  );
}

/** Renders the breakdown exactly as received from the backend: no client-side totals. */
export default function PriceSummary({ language, pricing }: { language: Language; pricing: EventPricing }) {
  return (
    <Box data-testid="price-summary">
      <Stack spacing={0.75}>
        <PriceLine
          label={`${t(language, "priceBaseFee")} (${t(language, "pricePaidModels")}: ${pricing.paidModelCount})`}
          value={formatCents(pricing.baseFeeCents, language)}
        />
        {pricing.coauthorLines.map((line, i) => (
          <PriceLine
            key={`${line.modelId}-${i}`}
            label={`${line.name} ${line.surname}${line.roleName ? `, ${line.roleName}` : ""} (${coauthorModelsLabel(line)})`}
            value={formatCents(line.priceCents, language)}
          />
        ))}
        {pricing.freeModels.map((m) => (
          <PriceLine key={m.modelId} label={m.modelName || m.modelCode || "-"} value={t(language, "priceFree")} />
        ))}
        <Divider />
        <PriceLine label={t(language, "priceTotal")} value={formatCents(pricing.totalCents, language)} strong />
      </Stack>
    </Box>
  );
}
