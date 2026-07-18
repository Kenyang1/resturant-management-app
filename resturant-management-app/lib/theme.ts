/**
 * Soft restaurant-operations palette: warm white canvas, leafy greens,
 * and restrained status accents. Token names stay stable across the app.
 */
export const colors = {
  // Primary action green
  primary: "#247A50",
  primaryDark: "#185C3C",
  secondary: "#6D9D80",

  // Canvas & surfaces
  background: "#FAFAF7",
  // Warmer cream used for the marketing/landing surface, distinct from the in-app canvas above.
  canvasWarm: "#F6F3EC",
  surface: "#FFFFFF",
  surfaceWarm: "#EEF7F0",
  // Pale sage used for soft highlight cards (e.g. the More/Profile finance shortcut).
  softSage: "#E8F2EB",

  // Navigation
  navBackground: "#FFFFFF",
  navActive: "#247A50",
  navInactive: "#737872",

  // Text
  textPrimary: "#17211C",
  textSecondary: "#68706B",
  textMuted: "#90968F",

  // Status
  success: "#2F8058",
  error: "#C95A52",
  warning: "#F5B94C",
  lowStock: "#E58B18",
  // Apricot emphasis accent for standout CTAs/badges distinct from the primary green.
  apricotEmphasis: "#F49345",

  // Feature accents remain distinct within the muted palette.
  management: "#D9952D",
  managementDark: "#B8791C",
  inventory: "#3D8665",
  inventoryDark: "#286C4D",
  settings: "#78917E",
  settingsDark: "#5D7463",
  errorDark: "#A9433D",

  // Hairlines & shadows
  border: "#E5E1DA",
  shadow: "rgba(31, 55, 40, 0.10)",

  // Stat / highlight tiles
  statLogsBg: "#FFF7E8",
  statLogsBorder: "rgba(217, 149, 45, 0.30)",
  statItemsBg: "#EEF6F1",
  statItemsBorder: "rgba(61, 134, 101, 0.28)",
  statStockBg: "#EAF5ED",
  statStockBorder: "rgba(47, 128, 88, 0.30)",

  // Finance tab (warm gold)
  finance: "#C98D2E",
  financeDark: "#A66F1D",
  statFinanceBg: "#FFF8EA",
  statFinanceBorder: "rgba(201, 141, 46, 0.32)",

  // Tasks tab
  tasks: "#2F8058",
  tasksDark: "#216641",
}

/** Disciplined corner-radius scale — pick one of these per surface, don't invent one-offs. */
export const radii = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
}
