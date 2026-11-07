# Mamulaat

Mamulaat is an offline-first PWA for students to track their daily **mamoolaat** (daily routines and practices), with one **admin** (the teacher) who reviews them.

- Each student types in their own list once. After that the app is a daily checklist with points, streaks and weekly summaries.
- Points and streaks are private: only the student and the admin can see them. There are no leaderboards.
- Stack: React + Vite + TypeScript, Tailwind v4, vite-plugin-pwa, Firebase JS SDK (modular), Firestore with a persistent offline cache, Google sign-in, FCM web push, and Cloud Functions (TypeScript) for reminders.
- **Access control lives entirely in `firestore.rules`.** The UI is never trusted. The rules are tested with the Emulator Suite (`tests/rules`).

```
src/                 React app (student + admin UIs)
  sw.ts              the ONE service worker: Workbox precache + FCM background messages
  firebase.ts        Firebase init (env-var config, offline cache, emulators)
  lib/               dates (timezone/Hijri), scoring, reports, db writes, messaging, sync indicator
firestore.rules      security rules (all access control)
tests/rules/         rules tests (Emulator Suite)
tests/unit/          date/scoring/report tests
functions/           Cloud Functions: scheduled reminders, user-deletion cleanup
scripts/             seed-emulator.mjs, bootstrap-admin.mjs, generate-icons.mjs
```

---

## 1. Create a NEW, dedicated Firebase project

Mamulaat must have its **own** Firebase project. Do not reuse or connect it to any existing project, including the one used by your other app.

1. Go to <https://console.firebase.google.com> and choose **Add project**. Name it something like `mamulaat-<school>`. Google Analytics is not needed.
2. **Build → Authentication → Get started → Sign-in method → Google → Enable.** Set the support email. Leave every other provider disabled.
   - Under **Authentication → Settings → Authorized domains**, add the domain you'll serve from (`<project>.web.app` is added automatically).
3. **Build → Firestore Database → Create database.** Use production mode and pick a region close to your students. The region can't be changed later.
4. **Project settings → General → Your apps → Add app → Web (</>).** Register the app and copy the config values into `.env.local` (see §2). Firebase Hosting can be set up at the same time.
5. **FCM (web push):** go to **Project settings → Cloud Messaging → Web configuration → Web Push certificates → Generate key pair**. Copy the public key into `VITE_FIREBASE_VAPID_KEY`.
6. **Blaze plan (needed for reminders):** go to **Upgrade → Blaze** and link a billing account. The scheduled function (every 15 minutes, about 2,900 runs a month) plus a few reads per student should stay **well inside the free tier** for a class-sized app. However, Cloud Scheduler and Cloud Functions both **require a billing account**. Set a budget alert (e.g. $1) under Google Cloud → Billing → Budgets. Without Blaze, everything works except push reminders. Students still see the in-app reminder banner.
7. Install the CLI (`npm i` installs it locally as `firebase-tools`) and point it at the project:
   ```bash
   npx firebase login
   cp .firebaserc.example .firebaserc     # then put your project id in it
   ```

## 2. Environment variables

Copy `.env.example` to `.env.local` and fill it in. All config comes from env vars. Nothing project-specific is committed.

| Variable | Where to find it |
|---|---|
| `VITE_FIREBASE_API_KEY` | Project settings → Your apps → SDK config |
| `VITE_FIREBASE_AUTH_DOMAIN` | same (`<project>.firebaseapp.com`). Optionally use your Hosting domain, see note below |
| `VITE_FIREBASE_PROJECT_ID` | same |
| `VITE_FIREBASE_STORAGE_BUCKET` | same |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | same |
| `VITE_FIREBASE_APP_ID` | same |
| `VITE_FIREBASE_VAPID_KEY` | Cloud Messaging → Web Push certificates (public key) |
| `VITE_USE_EMULATORS` | `true` to use the local Emulator Suite |

These are public client identifiers, not secrets. Security comes from the rules.

> **Sign-in on iOS / Safari:** when popups are blocked, the app falls back to a redirect sign-in. That works most reliably when `VITE_FIREBASE_AUTH_DOMAIN` is the same domain the app is served from (e.g. `<project>.web.app`) when hosted on Firebase Hosting.

## 3. Run locally with the emulators

Requires Node 20+ and Java 11+ (for the Firestore emulator).

```bash
npm install
npm --prefix functions install
cp .env.emulator.example .env.local      # demo project, VITE_USE_EMULATORS=true

npm run emulators        # terminal 1: Auth, Firestore, Functions emulators (UI on http://127.0.0.1:4000)
npm run seed             # terminal 2: demo class, demo students, demo admin
npm run dev              # terminal 2: http://localhost:5173
```

Click **Sign in with Google**. The Auth emulator's popup lists the seeded accounts:

| Account | Role |
|---|---|
| `admin@demo.test` | admin |
| `aisha@demo.test`, `yusuf@demo.test`, `مریم` (`maryam@demo.test`) | students, Class A |
| `bilal@demo.test` | student, Class B. Hasn't logged for days, so he shows under "needs attention" |
| `newstudent@demo.test` | pending (approve them as admin) |
| `teacher@demo.test` | approved user with no class. Use this account to try **Transfer admin** |

You can also "Add new account" in the popup to try the pending → approval flow. The seed script refuses to run against a non-`demo-` project.

When `VITE_USE_EMULATORS=true`, a `window.__emulatorGoogleSignIn(sub, email, name)` helper exists for automated browser tests. It only works against the Auth **emulator**, because real Firebase Auth rejects the unsigned token. It is compiled out of normal builds.

### Tests

```bash
npm run test:unit        # dates, scoring, reports, CSV
npm run test:rules       # starts the Firestore emulator and runs tests/rules
npm run test:functions   # reminder scheduling logic
npm test                 # all of the above
```

The rules tests show that:
- student A can't read or write student B's profile, mamoolaat, logs or comments, and can't list users;
- students can't make themselves admin, approve themselves, change their status or class, write comments, change settings or classes, or write the audit log;
- new sign-ups can only create a **pending student** profile for themselves, with their own email;
- pending and inactive users are blocked from everything except their own basic profile;
- the admin can't create a second admin or demote themselves except through a handover;
- after a handover, **the old admin loses all access**, can't take the role back, and the new admin has access;
- logs can only be written for today and the backfill window (default 2 days). Older or future days are locked, and the window follows the admin setting;
- the audit log is append-only.

## 4. Deploy

```bash
npx firebase use <your-project-id>
npm run build
npx firebase deploy --only firestore      # rules + indexes
npx firebase deploy --only hosting
npx firebase deploy --only functions      # needs Blaze
# or everything:  npm run deploy
```

## 5. Bootstrap the first admin (one-off)

Nobody is admin by default, and no email is hard-coded anywhere.

1. Open the deployed app and **sign in once** with the Google account that should be admin. You'll see "Waiting for approval".
2. On your computer, with Google Cloud credentials for the project:
   ```bash
   gcloud auth application-default login
   node scripts/bootstrap-admin.mjs --project <your-project-id> --email you@example.com --timezone Asia/Karachi
   ```
   The script uses the Admin SDK to set `users/{uid}.role = 'admin'` and `status = 'active'`. It creates `settings/app` if it's missing and writes an audit-log entry. **It refuses to run if an admin already exists.**

   *Console alternative:* in Firestore → `users/{your uid}`, set `role` to `admin` and `status` to `active` by hand, and create `settings/app` with the fields listed below.
3. Reload the app. You're now in the admin UI. Go to **Settings** and check the timezone, then **Classes**, and approve students.

`settings/app` fields: `backfillDays` (int, default 2), `weekStart` (0 = Sun … 1 = Mon, default 1), `timezone` (IANA), `utcOffsetMinutes` (int, kept in sync automatically by the admin's browser), `attentionThreshold` (%), `attentionNoLogDays`, `defaultReminderTime` ("HH:MM").

## 6. Admin handover checklist ⚠️

During testing, the project owner is the admin. Later a teacher takes over, and the owner must **no longer be able to see any student's mamoolaat**.

**In the app** (this removes your *in-app* access):
1. The teacher signs in once with their Google account (or the school's).
2. Approve them, assigning any class. They need to be an approved, active user.
3. **Admin → Settings → Transfer admin**: pick the teacher and type their email to confirm. In one atomic write, the teacher becomes `admin` and you become an inactive, non-admin user (`handedOverTo` records who). The security rules check that exactly one admin remains. The action is logged in the audit log. From then on, the rules deny you every student document. This is covered by the rules tests.

**In Google Cloud** (this removes your *console* access):
Anyone with **Owner/Editor** (or Firestore/Datastore viewer) access to the Firebase / Google Cloud project can still read all data in the Firebase console, export it, or run the Admin SDK, whatever the security rules say. To truly lose access:
4. In **Google Cloud Console → IAM & Admin → IAM** for the Mamulaat project, **add the teacher's (or the school's) Google account as Owner**. They must accept the invitation.
5. Have them confirm they can open the Firebase console for the project.
6. Move **billing** to the school: Billing → Account management, then change the billing account or add them as Billing Account Administrator.
7. **Remove yourself** from the project's IAM. Also remove yourself from the billing account and from Firebase → Project settings → Users and permissions if you're listed there.
8. Delete any service-account keys or `application-default` credentials you created (`gcloud auth application-default revoke`), and remove local `.emulator-data` or exports that contain real data.
9. Optional: in Firebase → Authentication, delete your own user. Your Firestore profile stays inactive.

Until steps 4–7 are done, you can still technically see data through the console. The in-app handover alone isn't enough.

There are **no backdoors**: no hard-coded emails or UIDs, no "if no admin exists, the first user becomes admin" rule, and no hidden roles. Admin can only be granted by the current admin (handover) or by someone with Google Cloud access to the project (the bootstrap script or the console).

## 7. Reminders (FCM)

- Students go to **Me → Daily reminder**, turn it on and pick a time. The default comes from admin settings. Times are in the project timezone.
- The browser asks for notification permission. On success, the device token is stored at `users/{uid}/fcmTokens/{token}`. Tokens are refreshed on app start, and the old one is replaced if it rotated. If permission is denied or push is unsupported, the app explains this and keeps the **in-app banner** fallback, shown whenever the app is opened and today isn't logged.
- **iPhone/iPad:** web push only works after adding the app to the Home Screen (iOS 16.4+) and enabling reminders from the Home Screen app. The app explains this on iOS.
- `functions/src/index.ts → sendDailyReminders` runs every 15 minutes. For each active student with reminders on whose time has passed (within a 3-hour window) and who hasn't been reminded today, it checks `logs/{today}`. If nothing is logged, it sends a data-only push to their devices. Dead tokens (`registration-token-not-registered`, etc.) and tokens unseen for 60 days are deleted.
- The PWA and FCM share **one** service worker (`src/sw.ts`). The page registers it via vite-plugin-pwa and passes it to `getToken({ serviceWorkerRegistration })`, so there's no separate `firebase-messaging-sw.js`.

## 8. How it works

**Data model (Firestore)**

| Path | Contents |
|---|---|
| `users/{uid}` | name, email, photoURL (from Google only), `role` (`student`\|`admin`, extensible), `status` (`pending`\|`active`\|`inactive`\|`rejected`), classId, reminderEnabled, reminderTime, onboarded |
| `users/{uid}/mamoolaat/{id}` | name, target, unit, active, order, createdBy, createdDate, removedDate, updatedBy, updatedAt |
| `users/{uid}/logs/{YYYY-MM-DD}` | `{ date, entries: { [mamoolId]: { status: done\|partial\|missed, amount, target } }, updatedAt }` |
| `users/{uid}/comments/{id}` | text, authorId, authorName, createdAt, readAt |
| `users/{uid}/changes/{id}` | record of admin edits to the student's mamoolaat (who/when/before/after, seenAt) |
| `users/{uid}/fcmTokens/{token}` | createdAt, lastSeen, userAgent |
| `classes/{id}` | name |
| `settings/app` | see §5 |
| `auditLog/{id}` | actorId, actorName, action, details, createdAt (append-only) |

**Dates.** Every day is a `YYYY-MM-DD` string in the project timezone, so weekly reports and reminders agree for everyone. The Hijri date (Umm al-Qura, via `Intl`) is shown next to the Gregorian date. The security rules can't do timezone conversion, so `settings/app.utcOffsetMinutes` (refreshed automatically by the admin's browser, e.g. after DST) is used to work out the backfill window, with 1 hour of grace.

**Offline.** The Firestore persistent multi-tab cache serves reads offline and queues writes. The header indicator shows *Offline / Syncing / Synced*. Note: a log written offline is checked by the rules **when it syncs**, so it must reach the server before that day locks. With the default 2-day window, a device has to come online within about 2 days.

**Scoring.** 10 points per mamool done (partial = proportional), +5 for completing every mamool that day. A day keeps the streak alive at ≥50% completion. If today isn't logged yet, the streak counts back from yesterday. Removing a mamool is a soft delete, so past percentages stay correct.

**Deleting a student** (Admin → student → Delete) removes their mamoolaat, logs, comments, changes and tokens, then the profile. The `cleanupDeletedUser` function also deletes any leftovers and their Firebase Auth account.

**Privacy.** Only what Google sign-in provides (name, email, photo) plus the student's mamoolaat data is stored. A "Who can see what" note is shown on sign-in, onboarding and the profile page.
