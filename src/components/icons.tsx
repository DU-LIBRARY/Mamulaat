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
  Mosque,
  Users,
  type IconProps,
} from '@phosphor-icons/react';

/**
 * App icons, from Phosphor (phosphor-icons/react), drawn at a light weight to match the
 * thin Prata/Archivo type; the active tab steps up to regular. Names stay app-specific so
 * call sites read as meaning ("Today", "Log"), not as glyph names.
 */
type P = Omit<IconProps, 'ref'> & { size?: number };

function make(Glyph: ComponentType<IconProps>, defaultWeight: IconProps['weight'] = 'regular') {
  const Icon = ({ size = 22, weight = defaultWeight, ...rest }: P) => <Glyph size={size} weight={weight} aria-hidden {...rest} />;
  return Icon;
}

export const IconToday = make(SunHorizon, 'light');
export const IconLog = make(NotePencil, 'light');
export const IconWeek = make(ChartBar, 'light');
export const IconInbox = make(ChatCircleText, 'light');
export const IconPerson = make(UserCircle, 'light');
export const IconOverview = make(SquaresFour, 'light');
export const IconClasses = make(GraduationCap, 'light');
export const IconPeople = make(UsersThree, 'light');
export const IconSettings = make(SlidersHorizontal, 'light');

export const IconCheck = make(Check, 'regular');
export const IconX = make(X, 'regular');
export const IconHalf = make(CircleHalf, 'fill');
export const IconPlus = make(Plus, 'regular');
export const IconChevronLeft = make(CaretLeft, 'regular');
export const IconChevronRight = make(CaretRight, 'regular');
export const IconBell = make(BellRinging, 'regular');
export const IconLock = make(LockSimple, 'regular');
export const IconPencil = make(PencilSimple, 'regular');
export const IconClock = make(Clock, 'regular');
export const IconInfo = make(Info, 'regular');
export const IconSalah = make(Mosque, 'light');
export const IconUsers = make(Users, 'regular');

export type AppIconProps = ComponentProps<typeof IconToday>;
