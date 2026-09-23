/** Chart colours (DEAL pine and lime only) and figure formatting shared by the desks. */
export const chart = {
  pine: "#24484c",
  pineSoft: "#3d6a6e",
  lime: "#c2cf30",
  limeDeep: "#8e9a12",
  grid: "#e3e6dc",
  axis: "#5e6f6d",
} as const;

/** Figures: Latin digits, thousands grouped. */
export const fmt = (n: number, digits = 0) =>
  n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
