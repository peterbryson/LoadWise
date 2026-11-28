import type { TextStyle } from 'react-native';

export type ThemeName = 'light' | 'dark';

/**
 * Colour tokens for the V2 design system (#52, DL-033): zinc neutrals in the style of shadcn/ui,
 * with one green accent kept from the Figma V1 brand. Status colours are used only for flags and
 * pills, always beside an icon or words, so colour is never the only cue (WCAG 1.4.1).
 *
 * Contrast (WCAG 2.2 ratios computed for these pairs on 28 Nov 2026; screens not yet checked):
 * text on surface 19.9:1 light, 17.8:1 dark; textMuted 7.0:1 or more on every light fill and
 * 6.1:1 or more in dark; accent on its tint 4.8:1 light, 8.1:1 dark; warning and danger 5.3:1
 * or more on their tints; `input` borders 3.2:1 or more against their surface (1.4.11
 * non-text contrast). `border` hairlines are decorative only.
 */
export interface Palette {
  bg: string;
  surface: string;
  /** Muted fill: segmented-control tracks, unselected options, secondary buttons. */
  surfaceRaised: string;
  /** Decorative hairlines between and around cards. */
  border: string;
  /** Borders that identify a control (inputs, unselected score buttons). At least 3:1. */
  input: string;
  text: string;
  textMuted: string;
  accent: string;
  onAccent: string;
  accentTint: string;
  warning: string;
  warningTint: string;
  danger: string;
  dangerTint: string;
  /** Cards are outlined with a hairline in both themes. */
  cardBorderWidth: number;
}

export const palettes: Record<ThemeName, Palette> = {
  light: {
    bg: '#fafafa',
    surface: '#ffffff',
    surfaceRaised: '#f4f4f5',
    border: '#e4e4e7',
    input: '#8b8b94',
    text: '#09090b',
    textMuted: '#52525b',
    accent: '#007a58',
    onAccent: '#ffffff',
    accentTint: '#e6f5ee',
    warning: '#92400e',
    warningTint: '#fef3c7',
    danger: '#b91c1c',
    dangerTint: '#fee2e2',
    cardBorderWidth: 1,
  },
  dark: {
    bg: '#09090b',
    surface: '#131316',
    surfaceRaised: '#232328',
    border: '#27272a',
    input: '#71717a',
    text: '#fafafa',
    textMuted: '#a1a1aa',
    accent: '#39d3a6',
    onAccent: '#06251c',
    accentTint: '#0d2a22',
    warning: '#fbbf24',
    warningTint: '#2b2108',
    danger: '#f87171',
    dangerTint: '#2c1215',
    cardBorderWidth: 1,
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

/**
 * Type scale. Headings are tracked slightly tighter, as shadcn/ui does; numbers use tabular
 * figures so values line up in lists and do not jump as they change.
 */
export const typography = {
  /** The one big number on a card, e.g. this week's load. */
  hero: {
    fontFamily: fonts.semiBold,
    fontSize: 44,
    lineHeight: 50,
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
  },
  display: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 36, letterSpacing: -0.8 },
  title: { fontFamily: fonts.semiBold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  metric: {
    fontFamily: fonts.semiBold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  heading: { fontFamily: fonts.semiBold, fontSize: 16, lineHeight: 22, letterSpacing: -0.1 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  /** Small uppercase labels above sections and metrics. */
  overline: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

/** Spacing on a 4 pt grid. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

/** Corner radii: inputs and chips, buttons and options, cards and sheets, pills. */
export const radius = { sm: 8, md: 12, lg: 16, full: 999 } as const;

/** Minimum touch target (WCAG 2.5.8 asks for 24; Apple and Android guidance is 44 to 48). */
export const TOUCH_TARGET = 48;
