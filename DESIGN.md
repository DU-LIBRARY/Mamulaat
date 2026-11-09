---
name: Mamūlāt
description: A nightly register of daily mamoolaat, on warm paper by day and olive night after dark.
colors:
  clay: "#d2a88f"
  clay-strong: "#c49a80"
  on-clay: "#252c21"
  clay-ink: "#774f3a"
  clay-line: "#a5735a"
  clay-tint: "#efe5dc"
  teacher-gold: "#9c7c38"
  teacher-gold-tint: "#eee5d2"
  teacher-gold-ink: "#55421a"
  partial-amber: "#b78c3a"
  partial-amber-tint: "#f1e8d4"
  missed-red: "#c27766"
  missed-red-tint: "#efdcd5"
  danger: "#9f3a2c"
  paper: "#e9e5dd"
  paper-raised: "#f1eee8"
  hairline: "#d5d1c6"
  olive-ink: "#20251d"
  olive-body: "#30372e"
  olive-muted: "#5f6559"
  night: "#191b16"
  night-raised: "#22261e"
  night-hairline: "#31372c"
  night-ink: "#f1eee4"
  night-muted: "#a3a99b"
  night-clay: "#dab49d"
typography:
  display:
    fontFamily: "Prata, IBM Plex Sans Arabic, Georgia, serif"
    fontSize: "36px"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Prata, IBM Plex Sans Arabic, Georgia, serif"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 1.25
  title:
    fontFamily: "Prata, IBM Plex Sans Arabic, Georgia, serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.25
  body:
    fontFamily: "Archivo Variable, IBM Plex Sans Arabic, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  body-row:
    fontFamily: "Archivo Variable, IBM Plex Sans Arabic, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.375
  figure:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 300
    lineHeight: 1.25
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
  label:
    fontFamily: "Archivo Variable, IBM Plex Sans Arabic, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.4
  caption:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.33
  nav:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.2
  caption-strong:
    fontFamily: "Archivo Variable, IBM Plex Sans Arabic, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
  input:
    fontFamily: "Archivo Variable, IBM Plex Sans Arabic, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  figure-large:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 300
    lineHeight: 1.2
    fontFeature: "tnum"
  figure-hero:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 300
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
rounded:
  xs: "4px"
  md: "6px"
  lg: "8px"
  xl: "10px"
  2xl: "12px"
  full: "9999px"
spacing:
  page-x: "20px"
  section-top: "20px"
  row: "12px"
  tap: "44px"
  nav: "56px"
components:
  button-primary:
    backgroundColor: "{colors.clay}"
    textColor: "{colors.on-clay}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "44px"
    typography: "{typography.body}"
  button-primary-hover:
    backgroundColor: "{colors.clay-strong}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.olive-body}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.olive-muted}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "44px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "44px"
  input:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.olive-body}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "44px"
  chip:
    rounded: "{rounded.xs}"
    padding: "2px 8px"
    typography: "{typography.caption}"
  status-done-circle:
    backgroundColor: "{colors.clay}"
    textColor: "{colors.on-clay}"
    rounded: "{rounded.full}"
    size: "44px"
  notice-teacher:
    backgroundColor: "{colors.teacher-gold-tint}"
    textColor: "{colors.teacher-gold-ink}"
    rounded: "{rounded.xl}"
    padding: "12px 16px"
  dialog-sheet:
    backgroundColor: "{colors.paper-raised}"
    rounded: "{rounded.2xl}"
    padding: "24px"
---

# Design System: Mamūlāt

## Overview

**Creative North Star: "Paper and Night Sky"**

Mamūlāt is built from two materials. By day it is warm, slightly grey paper. After dark it is an olive-black night. A soft sky wash sits at the top of every screen and follows the time of prayer: a blue dawn at Fajr, pale through the day, warmer at Asr, rose-clay at Maghrib, deep night at Isha with a faint drift of stars. The sky fades into the page within the first screenful, so content always sits on plain paper or plain night.

Everything else stays quiet. There are no cards with shadows. Sections sit directly on the page, divided by hairlines, the way lines divide a register. Large regular-weight Prata headlines carry the voice, and Archivo carries the work. One soft clay accent marks what matters: the action, "done", the active tab. Gold is kept for the teacher's voice alone.

The controls are calm but tactile. Buttons have a faint inset fill and shrink slightly under the finger, the main "Done" control is a circle you tick, and sheets glide on springs with no bounce. Restraint is the default. Feedback through touch is the one thing the system adds.

**Key Characteristics:**
- Two themes, paper and night, are equal citizens; both are designed, neither is derived.
- A prayer-time sky at the top of every screen; flat page below it.
- Hairlines instead of boxes; no card shadows.
- One clay accent; gold only for the teacher.
- Prata display at regular weight, Archivo for UI; IBM Plex Sans Arabic for Arabic/Urdu entries.
- 44px tap targets, springs without bounce, Undo instead of confirmation.

## Colors

A warm, low-saturation palette of paper, olive and clay, with a matching night set in which tint and ink swap ends so every "light tint + dark text" pairing becomes "dark tint + light text".

### Primary
- **Soft Clay** (clay): the single accent fill. Primary buttons, the ticked "Done" circle, fully completed cells in the week grid. It always carries dark olive text (on-clay), never white.
- **Fired Clay** (clay-ink): clay as ink and line. Links, the active-tab rule, the progress ring, segment-bar fills for done, the left-edge mark on a done row, unread badges.
- **Clay Line** (clay-line): focus outlines and hover borders on status controls and inputs.

### Secondary
- **Teacher's Gold** (teacher-gold, with its tint and ink): reserved for the teacher's voice. Notes and messages from the admin, the teacher notice tone. Nothing else is gold.

### Tertiary
- **Partial Amber** (partial-amber, partial-amber-tint): partly done. Segment fills, row edge marks, the chosen "Partly" state.
- **Missed Red** (missed-red, missed-red-tint): missed. Row edge marks and the chosen "Missed" state. Muted so a missed day reads as a fact, not an alarm.
- **Danger** (danger): destructive buttons only (delete, deactivate, transfer).

### Neutral
- **Paper** (paper): the page ground in light mode. Also the status-bar colour, so the strip behind the clock and the screen are one surface.
- **Raised Paper** (paper-raised): sheets, dialogs, inputs, neutral notices.
- **Hairline** (hairline): every divider, section rule and list border.
- **Olive Ink** (olive-ink): headings and strongest text. **Olive Body** (olive-body) for body text. **Olive Muted** (olive-muted) for secondary text; it is the lightest neutral that passes WCAG AA on paper.
- **Night** (night, night-raised, night-hairline, night-ink, night-muted, night-clay): the dark-mode counterparts, an olive-black ground with warm off-white ink and sage-grey secondary text.

### Named Rules
**The One Clay Rule.** Clay is the only accent. If a screen needs a second emphasis, use weight or size, not a new hue.

**The Gold Belongs to the Teacher Rule.** Gold appears only where the teacher is speaking. Never use it for achievements, streaks or decoration.

**The Dark Text on Clay Rule.** Clay fills always carry on-clay (#252c21) text. White on clay fails contrast and breaks the look.

## Typography

**Display Font:** Prata (with IBM Plex Sans Arabic, Georgia)
**Body Font:** Archivo Variable (with IBM Plex Sans Arabic, system-ui)
**Script Font:** IBM Plex Sans Arabic for Arabic and Urdu entries (Noto Nastaliq Urdu, Geeza Pro as fallbacks)

**Character:** A calm, high-contrast serif set large at regular weight, over a sturdy, slightly wide grotesk. The serif gives the dignity of a printed register; the grotesk keeps the daily task plain and fast.

### Hierarchy
- **Display** (Prata 400, 32–36px, 1.25): page titles such as Today and Week. Tracked in slightly (-0.01em).
- **Headline** (Prata 400, 24px, 1.25): dialog and sheet titles.
- **Title** (Prata 400, 22px, 1.25): section headings, in sentence case.
- **Body** (Archivo 400, 15px, 1.5): default UI text and buttons.
- **Row** (Archivo 400–500, 15–17px, 1.375): mamool names in the checklist; names clamp to two lines.
- **Figure** (Archivo 300, 26px, tabular): stat values in a stat row. Large figures (up to 44px) for the day's percentage.
- **Label** (Archivo 500, 14px): form labels.
- **Caption** (Archivo 400, 12–13px): stat labels, targets, secondary status text.
- **Nav** (Archivo 400, 11px): bottom-tab labels.

### Named Rules
**The Regular Weight Rule.** Prata is only ever set at 400. Hierarchy comes from size, not bold.

**The No Shouting Rule.** No tracked all-caps labels. Headings are sentence case.

**The Tabular Figures Rule.** Every number that can change (percentages, streaks, counts, dates in grids) uses tabular figures (`num`).

**The Script Respect Rule.** Student-entered text always gets `dir="auto"`. Right-to-left runs switch to IBM Plex Sans Arabic at line-height 1.7 with no letter-spacing.

## Layout

One centred column, at most 768px wide (max-w-3xl), with 20px side padding. It is laid out phone-first and stays a single column on larger screens.

- **Header:** 56px tall, below the top safe-area inset. It scrolls away with the page rather than sticking, so content slides under the status bar the way native iOS apps do.
- **Bottom navigation:** fixed tab bar, 56px rows plus the home-indicator inset, frosted paper (90% opacity, large backdrop blur), with a hairline above. Main content leaves 112px at the bottom to clear it.
- **Sections:** separated by a hairline with 20px above the content (`card`). Lists and settings groups are a single surface with hairlines between rows (`sheet`).
- **Stat rows:** figures in one row, divided by vertical hairlines rather than a grid of tiles.
- **Overlays:** toasts and the Undo bar sit just above the bottom nav. The update prompt sits above that. Top toasts clear the status bar.
- **Safe areas:** edge to edge (`viewport-fit=cover`). Top padding uses `--safe-top`, with an estimated fallback for iOS builds that report a zero inset.
- **Print:** registers and reports print on paper colours with the sky, nav and toasts hidden, and rows kept unbroken.

## Elevation & Depth

The system is flat. Depth comes from the sky wash, from tone (paper vs raised paper, night vs raised night) and from hairlines, not from shadows. There are only two lifted things. Dialogs and sheets float over a 50% black scrim with a deep shadow. The bottom nav is frosted glass over the content. Primary buttons carry a faint inset highlight so they feel pressable, but nothing casts a shadow at rest.

### Shadow Vocabulary
- **Pressable inset** (`box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.33), inset 0 -1px 0 rgb(64 46 34 / 0.16)`): primary clay buttons only.
- **Sheet lift** (`shadow-2xl` over a `bg-black/50` scrim): dialogs and bottom sheets.

### Named Rules
**The Hairline, Not Box Rule.** Group content with a hairline and space. Never wrap a section in a shadowed card.

## Shapes

Gently rounded, never pill-shaped except where a circle carries meaning. Buttons and inputs use a 6px radius (md). Notices use 10px (xl). Dialogs and sheets use 12px (2xl), with a small grab handle on phones. Chips use 4px. Circles are kept for the "Done" tick, compact status buttons, the progress ring and badges. Progress is drawn as thin 3px segments, one per mamool, rather than a single bar. Rows carry a narrow left-edge mark showing their state.

## Components

### Buttons
Calm but tactile: flat colour, a faint inset on the primary, and a slight shrink when pressed.
- **Shape:** gently rounded (6px), at least 44px tall, 16px horizontal padding, 15px medium text.
- **Primary:** soft clay fill with dark olive text and the pressable inset; hover deepens to clay-strong.
- **Secondary:** transparent with a hairline-plus border (slate-300) and olive text; hover darkens the border and adds a faint paper tint.
- **Ghost:** text only in olive-muted; hover adds a faint tint.
- **Danger:** brick-red fill, white text. Only for destructive actions.
- **Press / Focus / Disabled:** shrink to 97% on press (200ms, calm easing); 2px clay-line focus outline offset by 2px; disabled at 50% opacity with no shrink.

### Status controls (signature)
The heart of the app: how a mamool is marked.
- **Done circle:** a 44px circle. Unticked, it has a hairline border and muted icon; hover turns border and icon clay. Ticked, it fills with clay and the tick draws in (a short spring, no bounce).
- **Partly / Missed:** quiet 13px text buttons beside the circle; chosen, they take amber or red ink. In compact one-line rows they become 44px circular icon buttons that widen to labelled pills on larger screens.
- **Row edge mark:** a thin left-edge stripe in clay (done), amber (partly), red (missed) or nothing (not logged).
- **Counted mamoolaat** (target > 1, e.g. 100 tasbeeh) get a +1 tap counter.

### Segment bar (signature)
One 3px segment per mamool, 4px apart, filled clay when done and amber when partly done, animating width over 700ms. It reads like ticks in a register, not a generic progress bar.

### Week grid
Completion cells on a scale: no log is a faint neutral; 100% is solid clay with dark text; 75% and 50% are lighter clay tints; anything above zero is amber; zero is a faint red. The first column (mamool names) is sticky.

### Inputs / Fields
- **Style:** raised paper (night-raised in dark mode), hairline-plus border, 6px radius, 44px tall, 16px text (so iOS doesn't zoom).
- **Focus:** border turns clay-line with a soft 2px clay-tint ring.
- **Labels:** 14px medium, 6px above the field.

### Notices
Inline, 10px radius, 12px × 16px padding, a small icon at 80% opacity. Tones: neutral (raised paper), info (clay tint), warn (amber tint), teacher (gold tint).

### Navigation
A bottom tab bar on frosted paper. Tabs are icon over an 11px label, muted when inactive and olive ink when active; the active icon switches weight, and a short 16px clay rule under the active tab slides between tabs (shared layout, snap spring). Unread counts are small clay badges.

### Dialogs and sheets
Bottom sheets on phones (with a grab handle, swipeable), centred dialogs from `sm` up. Raised paper, 12px radius, 24px padding, a Prata 24px title. Actions stack full-width on phones, primary last.

### Undo bar
Small reversible actions show an Undo bar above the nav instead of asking "Are you sure?".

## Do's and Don'ts

### Do:
- **Do** design every screen in both paper and night; check the night version late in the evening at low brightness.
- **Do** keep tap targets at 44px minimum (`min-h-11`, `h-11 w-11`).
- **Do** use the shared springs in `src/lib/motion.ts` (glide 0.38s, snap 0.26s, bounce 0) and the `ease-calm` curve (`cubic-bezier(0.22, 0.8, 0.25, 1)`) for CSS transitions.
- **Do** honour reduced motion; the global rule collapses every transition and animation.
- **Do** use hairlines (`card`, `sheet`, `StatRow`) to group content.
- **Do** put `dir="auto"` on every student-entered string.

### Don't:
- **Don't** add drop shadows to sections or list items; only sheets and dialogs lift.
- **Don't** introduce a second accent colour or use gold outside the teacher's voice.
- **Don't** put white text on clay.
- **Don't** set Prata bold or use tracked all-caps headings.
- **Don't** let the sky carry content or contrast; it is decorative and fades out within the first screenful.
- **Don't** add bounce or overshoot to any motion.
