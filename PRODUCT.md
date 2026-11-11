# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

An installable, offline-first PWA. Most use is on phones, often added to the iPhone Home Screen (iOS 16.4+ for push), so it has to feel native there: safe-area insets, a status bar that runs edge to edge, and sheets you can swipe.

## Users

- **Students (primary):** adult learners at a madrassah. Each one keeps a personal list of daily mamoolaat (routines and practices such as Quran recitation, tasbeeh and adhkar, with a target and unit) and logs it every day, usually on their own phone, often late in the evening (the main reminder goes out at 23:00 project time and there's another on Fridays at 12:00).
- **Admin (the teacher, one at a time):** reviews every student's consistency, follows up with those who slip, leaves notes, approves sign-ups, manages classes and class templates, and keeps their own mamool in the app as well.

## Product Purpose

It turns a madrassah's daily-practice commitments into a quick nightly check-in that the teacher can see. Students mark each mamool done, partly done or missed, and on the Salah tab mark each of the five prayers Takbir (in jamaat from the opening takbir), Jamaat, Qadha or Missed. Salah is kept apart from mamool percentages and streaks. The app works out completion percentages, streaks and weekly summaries. The teacher uses those numbers to spot who needs attention and step in.

Success means students log every day, and the teacher can see at a glance who is consistent and who isn't, then act on it (a reminder nudge, a note).

## Positioning

The app is about **accountability to the teacher**. The log exists so the teacher can see each student's consistency and step in, so streaks, percentages and the teacher's "needs attention" view matter. At the same time it is strictly private: only the student and the admin ever see a student's data, never other students, and there are no backdoors. The one deliberate exception is the **Fajr roll**: the admin may make one student of a class its Fajr monitor, who then sees each classmate's Fajr status only (missed, qadha, not logged, or how many prayed in jamaat), nothing else. Every student in that class is told who the monitor is.

## Operating Context

- Daily loop: open the app (it opens on the Log page) (from a reminder or by habit), mark today's checklist, close it. It has to work offline and sync later. Logs can be backfilled within a window the admin sets (default 2 days); older and future days are locked.
- Teacher loop: Overview → "Not logged today" / "Needs attention" → open a student → look at the Weekly/Day view → Remind, leave a note (with an optional push), or edit the log (edits are stamped and audited).
- Every day is a date in the project timezone, with the Hijri (Umm al-Qura) date shown next to the Gregorian one.
- Exports: week CSV, month CSV and a print-friendly page, for the whole madrassah, for a class, or for one student.
- Admin handover to a new teacher is a formal, audited, one-step action.

## Capabilities and Constraints

- Stack (already in place): React + Vite + TypeScript, Tailwind v4, Radix UI, Motion, Phosphor icons, Firebase (Auth, Firestore with a persistent offline cache), standard Web Push sent by a GitHub Action. Hosted on GitHub Pages.
- All access control lives in `firestore.rules`. The UI is never trusted.
- Sign-in with Google (optional email/password for demos). New students stay **pending** until the admin approves them.
- Scoring: done = 100%, partly done = a proportional share, missed = 0. A day keeps the streak alive at ≥50%.
- Small reversible actions use an Undo bar. Big, destructive actions (deleting a student, deactivating, transferring admin) ask for confirmation.
- Updates appear as a "tap to update" bar, never a silent update.
- Terminology: *mamool* (singular), *mamoolaat* (plural), *asaatidhah* (teachers), *madrassah*. UI copy uses "mamoolaat".

## Brand Commitments

- Name: **Mamūlāt** (with macrons in the product name and title).
- The interface is English only. There are no plans for an Urdu UI. Student-entered mamool names may still contain Arabic/Urdu words and are shown with `dir="auto"`.
- Light and dark themes are both supported, and the user picks one.

## Evidence on Hand

- No testimonials, usage statistics or screenshots of real data are on hand. Don't invent any.
- The demo seed data (`scripts/seed-emulator.mjs`) is for development only and must never be presented as real students.

## Product Principles

1. **Logging tonight is the one job.** The daily check-in must be quick, one-handed and work offline. Nothing gets in its way.
2. **Make consistency visible to the teacher.** Streaks, percentages and "needs attention" are the product's purpose, not decoration.
3. **Privacy is absolute.** Only the student and the admin ever see a student's data, and the UI says so plainly where it matters.
4. **Treat adults as adults.** Direct and respectful, never childish or gamified for show. Accountability without scolding.
5. **Reversible by default.** Prefer Undo over "Are you sure?" and confirm only what can't be undone.

## Accessibility & Inclusion

No specific requirement has been set yet. It's used late at night, often in dark mode, on small phones, so contrast and tap targets carry real weight.
