import {
  Activity,
  Bandage,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleUser,
  Clock,
  CloudUpload,
  Copy,
  Dumbbell,
  Flag,
  House,
  Info,
  LucideIcon,
  Plus,
  RefreshCw,
  Share2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  UserPlus,
  Users,
  X,
} from 'lucide-react-native';
import { useTheme } from '@/theme/theme';
import { ColorToken } from '@/theme/tokens';

/**
 * Icons from Lucide (#52, DL-033), drawn with react-native-svg in the theme's colours. Each name
 * has a default colour token, so call sites read the same in both themes. The V1 names
 * (`alert-danger-16`, `chevron-row`, ...) are kept so screens did not change when the Figma SVG
 * exports were replaced.
 */
const icons = {
  'alert-danger-16': { icon: CircleAlert, color: 'danger' },
  'alert-danger-18': { icon: CircleAlert, color: 'danger' },
  'alert-warning-24': { icon: TriangleAlert, color: 'warning' },
  activity: { icon: Activity, color: 'accent' },
  shield: { icon: ShieldCheck, color: 'accent' },
  'info-accent': { icon: Info, color: 'accent' },
  'info-muted': { icon: Info, color: 'textMuted' },
  'check-on-accent': { icon: Check, color: 'onAccent' },
  'check-status': { icon: CircleCheck, color: 'accent' },
  'check-done': { icon: CircleCheck, color: 'accent' },
  'chevron-warning': { icon: ChevronRight, color: 'warning' },
  'chevron-date': { icon: ChevronDown, color: 'textMuted' },
  'chevron-row': { icon: ChevronRight, color: 'textMuted' },
  close: { icon: X, color: 'text' },
  back: { icon: ChevronLeft, color: 'text' },
  cloud: { icon: CloudUpload, color: 'textMuted' },
  today: { icon: House, color: 'textMuted' },
  trends: { icon: TrendingUp, color: 'textMuted' },
  profile: { icon: CircleUser, color: 'textMuted' },
  squad: { icon: Users, color: 'textMuted' },
  ai: { icon: Sparkles, color: 'accent' },
  plus: { icon: Plus, color: 'text' },
  copy: { icon: Copy, color: 'text' },
  share: { icon: Share2, color: 'text' },
  refresh: { icon: RefreshCw, color: 'text' },
  calendar: { icon: Calendar, color: 'textMuted' },
  clock: { icon: Clock, color: 'textMuted' },
  gym: { icon: Dumbbell, color: 'textMuted' },
  flag: { icon: Flag, color: 'warning' },
  invite: { icon: UserPlus, color: 'text' },
  injury: { icon: Bandage, color: 'textMuted' },
} satisfies Record<string, { icon: LucideIcon; color: ColorToken }>;

export type IconName = keyof typeof icons;

interface IconProps {
  name: IconName;
  size: number;
  /** Overrides the icon's default colour, e.g. the active tab. */
  color?: ColorToken;
  strokeWidth?: number;
}

/** A decorative icon: screen readers skip it, so its meaning must also be in nearby text. */
export function Icon({ name, size, color, strokeWidth = 2 }: IconProps) {
  const { colors } = useTheme();
  const { icon: Glyph, color: defaultColor } = icons[name];
  return (
    <Glyph
      size={size}
      color={colors[color ?? defaultColor]}
      strokeWidth={strokeWidth}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    />
  );
}
