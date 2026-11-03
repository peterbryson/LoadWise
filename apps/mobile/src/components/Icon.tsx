import { Image } from 'expo-image';
import { useTheme } from '@/theme/theme';

// The Figma file exports each icon already coloured for its theme, so both sets are bundled
// and picked by theme rather than recoloured in code.
const icons = {
  'alert-danger-16': {
    light: require('../../assets/icons/light/alert-danger-16.svg'),
    dark: require('../../assets/icons/dark/alert-danger-16.svg'),
  },
  'alert-danger-18': {
    light: require('../../assets/icons/light/alert-danger-18.svg'),
    dark: require('../../assets/icons/dark/alert-danger-18.svg'),
  },
  'alert-warning-24': {
    light: require('../../assets/icons/light/alert-warning-24.svg'),
    dark: require('../../assets/icons/dark/alert-warning-24.svg'),
  },
  activity: {
    light: require('../../assets/icons/light/activity.svg'),
    dark: require('../../assets/icons/dark/activity.svg'),
  },
  shield: {
    light: require('../../assets/icons/light/shield.svg'),
    dark: require('../../assets/icons/dark/shield.svg'),
  },
  'info-accent': {
    light: require('../../assets/icons/light/info-accent.svg'),
    dark: require('../../assets/icons/dark/info-accent.svg'),
  },
  'info-muted': {
    light: require('../../assets/icons/light/info-muted.svg'),
    dark: require('../../assets/icons/dark/info-muted.svg'),
  },
  'check-on-accent': {
    light: require('../../assets/icons/light/check-on-accent.svg'),
    dark: require('../../assets/icons/dark/check-on-accent.svg'),
  },
  'check-status': {
    light: require('../../assets/icons/light/check-status.svg'),
    dark: require('../../assets/icons/dark/check-status.svg'),
  },
  'check-done': {
    light: require('../../assets/icons/light/check-done.svg'),
    dark: require('../../assets/icons/dark/check-done.svg'),
  },
  'chevron-warning': {
    light: require('../../assets/icons/light/chevron-warning.svg'),
    dark: require('../../assets/icons/dark/chevron-warning.svg'),
  },
  'chevron-date': {
    light: require('../../assets/icons/light/chevron-date.svg'),
    dark: require('../../assets/icons/dark/chevron-date.svg'),
  },
  'chevron-row': {
    light: require('../../assets/icons/light/chevron-row.svg'),
    dark: require('../../assets/icons/dark/chevron-row.svg'),
  },
  close: {
    light: require('../../assets/icons/light/close.svg'),
    dark: require('../../assets/icons/dark/close.svg'),
  },
  back: {
    light: require('../../assets/icons/light/back.svg'),
    dark: require('../../assets/icons/dark/back.svg'),
  },
  cloud: {
    light: require('../../assets/icons/light/cloud.svg'),
    dark: require('../../assets/icons/dark/cloud.svg'),
  },
  'today-active': {
    light: require('../../assets/icons/light/today-active.svg'),
    dark: require('../../assets/icons/dark/today-active.svg'),
  },
  'today-inactive': {
    light: require('../../assets/icons/light/today-inactive.svg'),
    dark: require('../../assets/icons/dark/today-inactive.svg'),
  },
  'trends-active': {
    light: require('../../assets/icons/light/trends-active.svg'),
    dark: require('../../assets/icons/dark/trends-active.svg'),
  },
  'trends-inactive': {
    light: require('../../assets/icons/light/trends-inactive.svg'),
    dark: require('../../assets/icons/dark/trends-inactive.svg'),
  },
  'profile-active': {
    light: require('../../assets/icons/light/profile-active.svg'),
    dark: require('../../assets/icons/dark/profile-active.svg'),
  },
  'profile-inactive': {
    light: require('../../assets/icons/light/profile-inactive.svg'),
    dark: require('../../assets/icons/dark/profile-inactive.svg'),
  },
  ai: {
    light: require('../../assets/icons/light/ai.svg'),
    dark: require('../../assets/icons/dark/ai.svg'),
  },
  'chart-guide': {
    light: require('../../assets/icons/light/chart-guide.svg'),
    dark: require('../../assets/icons/dark/chart-guide.svg'),
  },
  'chart-line': {
    light: require('../../assets/icons/light/chart-line.svg'),
    dark: require('../../assets/icons/dark/chart-line.svg'),
  },
} as const;

export type IconName = keyof typeof icons;

interface IconProps {
  name: IconName;
  size: number;
}

/** A decorative icon: screen readers skip it, so its meaning must also be in nearby text. */
export function Icon({ name, size }: IconProps) {
  const { name: theme } = useTheme();
  return (
    <Image
      source={icons[name][theme]}
      style={{ width: size, height: size }}
      contentFit="contain"
      accessible={false}
    />
  );
}

/** For non-square artwork such as the ratio chart lines. */
export function themedArtwork(name: IconName, theme: 'light' | 'dark'): number {
  return icons[name][theme];
}
