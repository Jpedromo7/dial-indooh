/** Identidade D Player: único lugar para nome, textos e cores da marca no painel. */
export const BRAND = {
  name: "D Player",
  tagline: "Controle de telas",
  description: "Gerenciamento de mídia indoor para TVs e players Android",
  colors: {
    background: "#080D18",
    navy: "#050B1C",
    purple: "#8918E8",
    blue: "#1468F5",
    cyan: "#00D9EC",
    white: "#FFFFFF"
  },
  assets: {
    symbol: "/brand/d-player-symbol.png",
    icon: "/brand/d-player-icon.png"
  }
} as const;

export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "dplayer-theme";
