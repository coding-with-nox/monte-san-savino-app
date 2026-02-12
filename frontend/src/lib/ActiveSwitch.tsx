import React from "react";
import { Stack, Switch, Typography } from "@mui/material";

interface ActiveSwitchProps {
  checked: boolean;
  onChange: () => void;
  activeLabel: string;
  inactiveLabel: string;
  disabled?: boolean;
}

export default function ActiveSwitch({ checked, onChange, activeLabel, inactiveLabel, disabled }: ActiveSwitchProps) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography
        variant="caption"
        sx={{ color: checked ? "success.main" : "error.main", fontWeight: 700, minWidth: 80 }}
      >
        {checked ? activeLabel : inactiveLabel}
      </Typography>
      <Switch
        checked={checked}
        onChange={() => onChange()}
        disabled={disabled}
        size="small"
        sx={{
          "& .MuiSwitch-switchBase + .MuiSwitch-track": {
            backgroundColor: "error.main",
            opacity: 1
          },
          "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
            backgroundColor: "success.main",
            opacity: 1
          }
        }}
      />
    </Stack>
  );
}
