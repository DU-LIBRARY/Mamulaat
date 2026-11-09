import type { ComponentProps, ComponentType } from 'react';
import {
  SunHorizon,
  NotePencil,
  ChartBar,
  ChatCircleText,
  UserCircle,
  SquaresFour,
  GraduationCap,
  UsersThree,
  SlidersHorizontal,
  Check,
  X,
  CircleHalf,
  Plus,
  CaretLeft,
  CaretRight,
  BellRinging,
  LockSimple,
  PencilSimple,
  Clock,
  Info,
  type IconProps,
} from '@phosphor-icons/react';

/**
 * App icons, from Phosphor (phosphor-icons/react). Phosphor's duotone weight gives the
 * nav its glazed-tile look; the active tab switches to `fill`. Names stay app-specific so
 * call sites read as meaning ("Today", "Log"), not as glyph names.
 */
type P = Omit<IconProps, 'ref'> & { size?: number };

function make(Glyph: ComponentType<IconProps>, defaultWeight: IconProps['weight'] = 'regular') {
  const Icon = ({ size = 22, weight = defaultWeight, ...rest }: P) => <Glyph size={size} weight={weight} aria-hidden {...rest} />;
  return Icon;
}

export const IconToday = make(SunHorizon, 'duotone');
export const IconLog = make(NotePencil, 'duotone');
export const IconWeek = make(ChartBar, 'duotone');
export const IconInbox = make(ChatCircleText, 'duotone');
export const IconPerson = make(UserCircle, 'duotone');
export const IconOverview = make(SquaresFour, 'duotone');
export const IconClasses = make(GraduationCap, 'duotone');
export const IconPeople = make(UsersThree, 'duotone');
export const IconSettings = make(SlidersHorizontal, 'duotone');

export const IconCheck = make(Check, 'bold');
export const IconX = make(X, 'bold');
export const IconHalf = make(CircleHalf, 'fill');
export const IconPlus = make(Plus, 'bold');
export const IconChevronLeft = make(CaretLeft, 'bold');
export const IconChevronRight = make(CaretRight, 'bold');
export const IconBell = make(BellRinging, 'duotone');
export const IconLock = make(LockSimple, 'bold');
export const IconPencil = make(PencilSimple, 'bold');
export const IconClock = make(Clock, 'duotone');
export const IconInfo = make(Info, 'duotone');

export type AppIconProps = ComponentProps<typeof IconToday>;
