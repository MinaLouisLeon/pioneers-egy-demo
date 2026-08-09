import { StyleSheet } from "react-native";

/**
 * Design tokens mirroring packages/ui/src/styles/globals.css.
 *
 * React Native has no CSS custom properties, so the palette is duplicated here
 * as plain values. They are converted from the OKLCH originals; if the web
 * palette changes, update both.
 */

const palette = {
  navy900: "#141a26",
  navy800: "#1b2130",
  navy700: "#252c3d",
  navy600: "#333c50",
  brand600: "#1d3a63",
  brand500: "#27508a",
  brand400: "#5b87c9",
  brand300: "#9dbbe6",
  brand100: "#e4edf9",
  slate50: "#f7f8fa",
  slate100: "#eff1f5",
  slate200: "#e0e3ea",
  slate400: "#9aa2b1",
  slate500: "#6c7688",
  slate700: "#3a4254",
  white: "#ffffff",
  success: "#1f8a5b",
  successBg: "#e6f5ee",
  warning: "#b7791f",
  warningBg: "#fdf3e2",
  danger: "#c8372d",
  dangerBg: "#fdeceb",
};

export type Theme = {
  dark: boolean;
  colors: {
    background: string;
    surface: string;
    surfaceAlt: string;
    text: string;
    textMuted: string;
    border: string;
    primary: string;
    primaryText: string;
    success: string;
    successBg: string;
    warning: string;
    warningBg: string;
    danger: string;
    dangerBg: string;
  };
};

export const lightTheme: Theme = {
  dark: false,
  colors: {
    background: palette.slate50,
    surface: palette.white,
    surfaceAlt: palette.slate100,
    text: palette.navy900,
    textMuted: palette.slate500,
    border: palette.slate200,
    primary: palette.brand600,
    primaryText: palette.white,
    success: palette.success,
    successBg: palette.successBg,
    warning: palette.warning,
    warningBg: palette.warningBg,
    danger: palette.danger,
    dangerBg: palette.dangerBg,
  },
};

export const darkTheme: Theme = {
  dark: true,
  colors: {
    background: palette.navy900,
    surface: palette.navy800,
    surfaceAlt: palette.navy700,
    text: palette.slate50,
    textMuted: palette.slate400,
    border: palette.navy600,
    primary: palette.brand400,
    primaryText: palette.navy900,
    success: "#4cc38a",
    successBg: "#12301f",
    warning: "#e0a33a",
    warningBg: "#33260d",
    danger: "#f0685c",
    dangerBg: "#3a1512",
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

export const typography = StyleSheet.create({
  title: { fontSize: 24, fontWeight: "700", letterSpacing: -0.4 },
  heading: { fontSize: 18, fontWeight: "600" },
  body: { fontSize: 15 },
  label: { fontSize: 13, fontWeight: "600" },
  caption: { fontSize: 12 },
});
