import { StyleSheet } from "react-native";

/**
 * Design tokens mirroring packages/ui/src/styles/globals.css.
 *
 * React Native has no CSS custom properties, so the palette is duplicated here
 * as plain values. They are converted from the OKLCH originals; if the web
 * palette changes, update both.
 */

/**
 * Brand palette, matching packages/ui/src/styles/globals.css and the corporate
 * site at pioneers-egy.com:
 *
 *   maroon #7A1F23  primary      navy #1D3B5D  secondary
 *   orange #F97415  highlight    ink  #1F2937  body text
 *
 * React Native has no CSS custom properties, so these are duplicated here as
 * plain hex. If the web palette changes, change both.
 */
const palette = {
  maroon700: "#5A171A",
  maroon600: "#7a1f23",
  maroon500: "#9e3a3e",
  maroon100: "#f6e9ea",
  navy900: "#0f1729",
  navy800: "#161f33",
  navy700: "#1f2a42",
  navy600: "#2c3954",
  navy500: "#1d3b5d",
  orange500: "#f97415",
  orange100: "#fdeedf",
  ink: "#1f2937",
  slate50: "#ffffff",
  slate100: "#f1f5f9",
  slate200: "#e2e8f0",
  slate400: "#94a3b8",
  slate500: "#64748b",
  white: "#ffffff",
  success: "#15803d",
  successBg: "#e7f6ec",
  warning: "#b45309",
  warningBg: "#fdf1e3",
  danger: "#dc2626",
  dangerBg: "#fdeaea",
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
    /** Navy — dark panels and secondary emphasis. */
    secondary: string;
    /** Brand orange — stats and deliberate accents, never hover states. */
    highlight: string;
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
    background: palette.slate100,
    surface: palette.white,
    surfaceAlt: palette.slate100,
    text: palette.ink,
    textMuted: palette.slate500,
    border: palette.slate200,
    primary: palette.maroon600,
    primaryText: palette.white,
    secondary: palette.navy500,
    highlight: palette.orange500,
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
    text: "#f8fafc",
    textMuted: palette.slate400,
    border: palette.navy600,
    primary: palette.maroon500,
    primaryText: palette.white,
    secondary: "#3b5a85",
    highlight: palette.orange500,
    success: "#4ade80",
    successBg: "#12301f",
    warning: "#fbbf24",
    warningBg: "#33260d",
    danger: "#f87171",
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
