import React from "react";
import {
  Box, Button, ButtonProps, IconButton, IconButtonProps, MenuItem, MenuItemProps, SxProps, Theme, Tooltip, TooltipProps
} from "@mui/material";

/**
 * Every action of the app is rendered through these wrappers, so that it always explains what it does
 * (see __tests__/tooltipCoverage.test.ts). The tooltip describes the action; the accessible name stays
 * the label (describeChild), and the same text is exposed as accessible description.
 */
type TipProps = {
  /** What happens when the control is pressed. Not a repetition of the label. */
  tip: string;
  tipPlacement?: TooltipProps["placement"];
  /** Layout of the wrapper used when the control can be disabled (disabled elements fire no events). */
  wrapperSx?: SxProps<Theme>;
};

type LinkLike = {
  component?: React.ElementType;
  to?: string;
  href?: string;
  target?: string;
  rel?: string;
  "data-tour"?: string;
  "data-testid"?: string;
};

function withTip(
  control: React.ReactElement,
  { tip, tipPlacement, wrapperSx }: TipProps,
  canBeDisabled: boolean,
  block: boolean
) {
  // A control with a `disabled` prop is always wrapped, so toggling it never remounts the button.
  const child = canBeDisabled ? (
    <Box component="span" sx={{ display: block ? "block" : "inline-flex", "& > .MuiButtonBase-root": { flexGrow: 1 }, ...(wrapperSx as object) }}>
      {control}
    </Box>
  ) : control;
  return (
    <Tooltip title={tip} placement={tipPlacement} describeChild>
      {child}
    </Tooltip>
  );
}

export type ActionButtonProps = ButtonProps & LinkLike & TipProps;

export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(function ActionButton(
  { tip, tipPlacement, wrapperSx, ...props },
  ref
) {
  return withTip(
    <Button ref={ref} {...(props as ButtonProps)} {...{ "aria-description": tip }} />,
    { tip, tipPlacement, wrapperSx },
    "disabled" in props,
    !!props.fullWidth
  );
});

export type TipIconButtonProps = IconButtonProps & LinkLike & TipProps & {
  /** Short accessible name of the icon-only button. */
  "aria-label": string;
};

export const TipIconButton = React.forwardRef<HTMLButtonElement, TipIconButtonProps>(function TipIconButton(
  { tip, tipPlacement, wrapperSx, ...props },
  ref
) {
  return withTip(
    <IconButton ref={ref} {...(props as IconButtonProps)} {...{ "aria-description": tip }} />,
    { tip, tipPlacement, wrapperSx },
    "disabled" in props,
    false
  );
});

export type TipMenuItemProps = MenuItemProps & LinkLike & TipProps;

/** Menu entry that performs an action (not an option of a Select). */
export const TipMenuItem = React.forwardRef<HTMLLIElement, TipMenuItemProps>(function TipMenuItem(
  { tip, tipPlacement = "left", wrapperSx, ...props },
  ref
) {
  return (
    <Tooltip title={tip} placement={tipPlacement} describeChild>
      <MenuItem ref={ref} {...(props as MenuItemProps)} {...{ "aria-description": tip }} />
    </Tooltip>
  );
});
