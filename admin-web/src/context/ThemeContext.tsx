import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';

export type ColorThemeId = 'forest' | 'ocean' | 'indigo' | 'terracotta' | 'gold' | 'rose' | 'slate' | 'sapphire';

interface Palette {
  accent: string;
  accentInk: string;
  accentSoft: string;
  mid: string;
  bright: string;
  deep: string;
}

export const COLOR_THEMES: {
  id: ColorThemeId;
  label: string;
  swatch: string;
  light: Palette;
  dark: Palette;
}[] = [
  {
    id: 'forest',
    label: 'Forêt',
    swatch: '#1f6f5c',
    light: {
      accent: '#1f6f5c',
      accentInk: '#0f4a3c',
      accentSoft: '#e1efea',
      mid: '#2a8f74',
      bright: '#57c4a4',
      deep: '#0c332c',
    },
    dark: {
      accent: '#57c4a4',
      accentInk: '#8fe0c6',
      accentSoft: '#173129',
      mid: '#3d9a7a',
      bright: '#7dcea0',
      deep: '#0b2e26',
    },
  },
  {
    id: 'ocean',
    label: 'Océan',
    swatch: '#1e5a8a',
    light: {
      accent: '#1e5a8a',
      accentInk: '#0e3a5c',
      accentSoft: '#e3eef6',
      mid: '#2d7ab0',
      bright: '#5aa8d4',
      deep: '#0c2e48',
    },
    dark: {
      accent: '#5aa8d4',
      accentInk: '#9ccbe6',
      accentSoft: '#163044',
      mid: '#3d8fc4',
      bright: '#7ebfe0',
      deep: '#0a2438',
    },
  },
  {
    id: 'indigo',
    label: 'Indigo',
    swatch: '#4a3aa7',
    light: {
      accent: '#4a3aa7',
      accentInk: '#2e2470',
      accentSoft: '#eceaf8',
      mid: '#6356c2',
      bright: '#8b7ee8',
      deep: '#1a1d4a',
    },
    dark: {
      accent: '#9085e9',
      accentInk: '#c4b8ff',
      accentSoft: '#221e45',
      mid: '#7b6fd4',
      bright: '#a99ef0',
      deep: '#12143a',
    },
  },
  {
    id: 'terracotta',
    label: 'Terracotta',
    swatch: '#c45c3e',
    light: {
      accent: '#c45c3e',
      accentInk: '#7a2e1c',
      accentSoft: '#f8e8e3',
      mid: '#d97858',
      bright: '#e8a088',
      deep: '#5c2418',
    },
    dark: {
      accent: '#e4877c',
      accentInk: '#f3c4bc',
      accentSoft: '#3a201c',
      mid: '#d07060',
      bright: '#ebab9e',
      deep: '#2a1612',
    },
  },
  {
    id: 'gold',
    label: 'Or',
    swatch: '#9a6a12',
    light: {
      accent: '#9a6a12',
      accentInk: '#63440a',
      accentSoft: '#f5ecd9',
      mid: '#c4922e',
      bright: '#e0b45c',
      deep: '#3d2c08',
    },
    dark: {
      accent: '#e0b45c',
      accentInk: '#f0d59a',
      accentSoft: '#33290f',
      mid: '#c9a24a',
      bright: '#e8c87a',
      deep: '#241c0a',
    },
  },
  {
    id: 'rose',
    label: 'Rose',
    swatch: '#a43d6a',
    light: {
      accent: '#a43d6a',
      accentInk: '#6e2848',
      accentSoft: '#f6e4ec',
      mid: '#c45d88',
      bright: '#e08aaa',
      deep: '#4a1c32',
    },
    dark: {
      accent: '#e08aaa',
      accentInk: '#f3c4d4',
      accentSoft: '#3a1c2a',
      mid: '#d07098',
      bright: '#ebb0c4',
      deep: '#28141c',
    },
  },
  {
    id: 'slate',
    label: 'Ardoise',
    swatch: '#3d4f63',
    light: {
      accent: '#3d4f63',
      accentInk: '#243140',
      accentSoft: '#e6eaee',
      mid: '#5a6e84',
      bright: '#8a9bb0',
      deep: '#1a242e',
    },
    dark: {
      accent: '#8a9bb0',
      accentInk: '#c5ced8',
      accentSoft: '#1e2832',
      mid: '#6e8298',
      bright: '#a8b6c6',
      deep: '#141c24',
    },
  },
  {
    id: 'sapphire',
    label: 'Saphir',
    swatch: '#0e7490',
    light: {
      accent: '#0e7490',
      accentInk: '#155e75',
      accentSoft: '#e0f2fe',
      mid: '#0891b2',
      bright: '#22d3ee',
      deep: '#164e63',
    },
    dark: {
      accent: '#22d3ee',
      accentInk: '#a5f3fc',
      accentSoft: '#083344',
      mid: '#06b6d4',
      bright: '#67e8f9',
      deep: '#082f49',
    },
  },
];

const THEME_KEY = 'boutique-theme';
const COLOR_KEY = 'boutique-color';

interface ThemeContextValue {
  theme: Theme;
  color: ColorThemeId;
  toggleTheme: () => void;
  setColor: (id: ColorThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemPrefersDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function initialTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return systemPrefersDark() ? 'dark' : 'light';
}

function initialColor(): ColorThemeId {
  const stored = localStorage.getItem(COLOR_KEY);
  if (COLOR_THEMES.some((item) => item.id === stored)) return stored as ColorThemeId;
  return 'forest';
}

function applyPalette(color: ColorThemeId, theme: Theme) {
  const def = COLOR_THEMES.find((item) => item.id === color) ?? COLOR_THEMES[0];
  const palette = def[theme];
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.setAttribute('data-color', color);
  root.style.setProperty('--accent', palette.accent);
  root.style.setProperty('--accent-ink', palette.accentInk);
  root.style.setProperty('--accent-soft', palette.accentSoft);
  root.style.setProperty('--accent-mid', palette.mid);
  root.style.setProperty('--accent-bright', palette.bright);
  root.style.setProperty('--accent-deep', palette.deep);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [color, setColorState] = useState<ColorThemeId>(initialColor);

  useEffect(() => {
    applyPalette(color, theme);
    localStorage.setItem(THEME_KEY, theme);
    localStorage.setItem(COLOR_KEY, color);
  }, [theme, color]);

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }

  function setColor(id: ColorThemeId) {
    setColorState(id);
  }

  return (
    <ThemeContext.Provider value={{ theme, color, toggleTheme, setColor }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
