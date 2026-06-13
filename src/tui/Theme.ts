import type { Theme } from "../shared/types";

/** Built-in themes */
export const themes: Record<string, Theme> = {
  "nexus-dark": {
    name: "nexus-dark",
    primary: "#00d4ff",
    secondary: "#7c3aed",
    success: "#22c55e",
    warning: "#f59e0b",
    error: "#ef4444",
    info: "#3b82f6",
    muted: "#6b7280",
    background: "#0f172a",
    foreground: "#e2e8f0",
  },
  "nexus-light": {
    name: "nexus-light",
    primary: "#0284c7",
    secondary: "#7c3aed",
    success: "#16a34a",
    warning: "#d97706",
    error: "#dc2626",
    info: "#2563eb",
    muted: "#9ca3af",
    background: "#ffffff",
    foreground: "#1e293b",
  },
  monokai: {
    name: "monokai",
    primary: "#a6e22e",
    secondary: "#ae81ff",
    success: "#a6e22e",
    warning: "#f4bf75",
    error: "#f92672",
    info: "#66d9ef",
    muted: "#75715e",
    background: "#272822",
    foreground: "#f8f8f2",
  },
  dracula: {
    name: "dracula",
    primary: "#bd93f9",
    secondary: "#ff79c6",
    success: "#50fa7b",
    warning: "#f1fa8c",
    error: "#ff5555",
    info: "#8be9fd",
    muted: "#6272a4",
    background: "#282a36",
    foreground: "#f8f8f2",
  },
  nord: {
    name: "nord",
    primary: "#88c0d0",
    secondary: "#b48ead",
    success: "#a3be8c",
    warning: "#ebcb8b",
    error: "#bf616a",
    info: "#81a1c1",
    muted: "#4c566a",
    background: "#2e3440",
    foreground: "#eceff4",
  },
};

export const defaultTheme = themes["nexus-dark"];

/** Convert a theme object to ANSI color codes */
export function themeToAnsi(theme: Theme): Record<string, string> {
  return {
    primary: hexToAnsi(theme.primary),
    secondary: hexToAnsi(theme.secondary),
    success: hexToAnsi(theme.success),
    warning: hexToAnsi(theme.warning),
    error: hexToAnsi(theme.error),
    info: hexToAnsi(theme.info),
    muted: hexToAnsi(theme.muted),
    background: hexToAnsi(theme.background),
    foreground: hexToAnsi(theme.foreground),
  };
}

/** Convert hex color to ANSI 24-bit escape code */
function hexToAnsi(hex: string): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `\x1b[38;2;${r};${g};${b}m`;
}

/** ANSI color reset */
export const RESET = "\x1b[0m";
export const BOLD = "\x1b[1m";
export const DIM = "\x1b[2m";

/** Get a theme by name */
export function getTheme(name: string): Theme {
  return themes[name] || defaultTheme;
}
