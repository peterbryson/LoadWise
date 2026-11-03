import type { TextStyle } from 'react-native';

export type ThemeName = 'light' | 'dark';

/** Colour tokens from the Figma LoadWise V1 variables (Screens - Light and Screens - Dark). */
export interface Palette {
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  onAccent: string;
  accentTint: string;
  warning: string;
  warningTint: string;
  danger: string;
  /** Cards are outlined in the light design and borderless in the dark one. */
  cardBorderWidth: number;
}

export const palettes: Record<ThemeName, Palette> = {
  light: {
    bg: '#f3f8f5',
    surface: '#ffffff',
    surfaceRaised: '#e7f1ec',
    border: '#cbd9d1',
    text: '#10201a',
    textMuted: '#4a5c54',
    accent: '#007a58',
    onAccent: '#ffffff',
    accentTint: '#ddf5ea',
    warning: '#855700',
    warningTint: '#fff3d1',
    danger: '#b42318',
    cardBorderWidth: 1,
  },
  dark: {
    bg: '#0e1116',
    surface: '#181d25',
    surfaceRaised: '#232a34',
    border: '#39424e',
    text: '#f4f6f8',
    textMuted: '#a9b3c0',
    accent: '#39d3a6',
    onAccent: '#06251c',
    accentTint: '#103029',
    warning: '#f5b83d',
    warningTint: '#33280f',
    danger: '#ff8a80',
    cardBorderWidth: 0,
  },
};

export type ColorToken = Exclude<keyof Palette, 'cardBorderWidth'>;

/** Inter font files loaded in the root layout, one per weight used in the design. */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/** Text styles from the Figma "LoadWise/*" styles. */
export const typography = {
  display: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34 },
  title: { fontFamily: fonts.semiBold, fontSize: 20, lineHeight: 26 },
  metric: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30 },
  heading: { fontFamily: fonts.semiBold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
