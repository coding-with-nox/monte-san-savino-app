import React from "react";
import { Box, Typography } from "@mui/material";

export function EmptyValue() {
  return (
    <Typography variant="body2" sx={{ color: "text.disabled", fontStyle: "italic" }}>
      —
    </Typography>
  );
}

interface FieldProps {
  label: string;
  value?: React.ReactNode;
}

export default function Field({ label, value }: FieldProps) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      {value !== null && value !== undefined && value !== "" ? (
        <Typography variant="body1" fontWeight={500}>
          {value}
        </Typography>
      ) : (
        <EmptyValue />
      )}
    </Box>
  );
}
