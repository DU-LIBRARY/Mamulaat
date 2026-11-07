import type { SVGProps } from 'react';

/** Small hand-drawn line icon set (24px grid, 1.6 stroke). Replaces emoji in the UI. */
type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 22, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Today: a sun rising over a horizon line. */
export const IconToday = (p: P) => (
  <Svg {...p}>
    <path d="M3 18h18" />
    <path d="M7 18a5 5 0 0 1 10 0" />
    <path d="M12 6v3M5.6 9.6l1.8 1.8M18.4 9.6l-1.8 1.8" />
  </Svg>
);

/** Log: a ruled page with a tick. */
export const IconLog = (p: P) => (
  <Svg {...p}>
    <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
    <path d="M8.5 8h7M8.5 12h7" />
    <path d="m8.5 16 1.5 1.5 3-3" />
  </Svg>
);

/** Week: seven bars of varying height. */
export const IconWeek = (p: P) => (
  <Svg {...p}>
    <path d="M4 19V13M7.3 19v-8M10.6 19v-5M13.9 19V9M17.2 19v-6M20.5 19v-4" />
    <path d="M3 19h18.5" />
  </Svg>
);

export const IconInbox = (p: P) => (
  <Svg {...p}>
    <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4 3.5V16h-.5A1.5 1.5 0 0 1 4 14.5z" />
  </Svg>
);

export const IconPerson = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20c.8-3.4 3.6-5.5 7-5.5s6.2 2.1 7 5.5" />
  </Svg>
);

export const IconOverview = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="4" width="7" height="7" rx="1" />
    <rect x="13" y="4" width="7" height="4" rx="1" />
    <rect x="13" y="10" width="7" height="10" rx="1" />
    <rect x="4" y="13" width="7" height="7" rx="1" />
  </Svg>
);

export const IconClasses = (p: P) => (
  <Svg {...p}>
    <path d="M3 9.5 12 5l9 4.5-9 4.5z" />
    <path d="M7 11.5V16c1.4 1.3 3 2 5 2s3.6-.7 5-2v-4.5" />
  </Svg>
);

export const IconPeople = (p: P) => (
  <Svg {...p}>
    <circle cx="9" cy="9" r="3" />
    <path d="M3.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8" />
    <path d="M15 6.3a3 3 0 0 1 0 5.4M17 14.6c1.8.6 3 2.1 3.5 4.4" />
  </Svg>
);

export const IconSettings = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </Svg>
);

export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);

export const IconX = (p: P) => (
  <Svg {...p}>
    <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
  </Svg>
);

/** Partly: a half-filled circle. */
export const IconHalf = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="7" />
    <path d="M12 5a7 7 0 0 1 0 14z" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5.5v13M5.5 12h13" />
  </Svg>
);

export const IconChevronLeft = (p: P) => (
  <Svg {...p}>
    <path d="m14.5 6-6 6 6 6" />
  </Svg>
);

export const IconChevronRight = (p: P) => (
  <Svg {...p}>
    <path d="m9.5 6 6 6-6 6" />
  </Svg>
);

export const IconBell = (p: P) => (
  <Svg {...p}>
    <path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </Svg>
);

export const IconLock = (p: P) => (
  <Svg {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="1.5" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </Svg>
);

export const IconPencil = (p: P) => (
  <Svg {...p}>
    <path d="M5 19l1-4 9.5-9.5a2.1 2.1 0 0 1 3 3L9 18z" />
  </Svg>
);

export const IconClock = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

export const IconInfo = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 11v5M12 8h.01" />
  </Svg>
);
