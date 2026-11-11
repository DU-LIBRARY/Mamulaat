# Mamūlāt (Mamulaat)

> **Setting up for the first time? Follow [docs/SETUP.md](docs/SETUP.md). It can all be done from an iPad.**

Mamūlāt is an offline-first PWA for students to track their daily **mamoolaat** (daily routines and practices), with one **admin** (the teacher) who reviews them.

- Each student types in their own list once. After that the app is a daily checklist with streaks, completion percentages and weekly summaries.
- Progress and streaks are private: only the student and the admin can see them.
- Signing out deletes the offline copy of the account's data from that phone or browser (it stays on the server). Deleting a student also removes their entries from class Fajr rolls and rosters. (Exception: a Fajr monitor, chosen by the admin on a class page and able to cover several classes, sees those students' Fajr status only.)
- Salah tab: each of the five prayers marked Takbir / Jamaat / Qadha / Missed, stored in `users/{uid}/salah/{day}`.
- Fajr roll: each student's Fajr status is also written to `classes/{classId}/fajrRoll/{day}` (own key only, must match their salah record). A class's Fajr monitor (any active student; one person can cover several classes) sees who missed, prayed qadha or hasn't logged, and the Notifications job pushes each monitor one summary each morning, with a line per class, at **Settings → Fajr report time**. It also keeps `classes/{classId}/meta/roster` (names of active students) current.
- **Hosting: GitHub Pages** (built and published by a GitHub Action on every push to `main`). Firebase is the backend only: sign-in, Firestore, push messaging and the reminder function.
- Stack: React + Vite + TypeScript, Tailwind v4, vite-plugin-pwa, Firebase JS SDK (modular), Firestore with a persistent offline cache, Google sign-in, standard Web Push, and a scheduled GitHub Action that sends the notifications.
- **Access control lives entirely in `firestore.rules`.** The UI is never trusted. The rules are tested with the Emulator Suite (`tests/rules`).

```
src/                 React app (student + admin UIs)
  sw.ts              the ONE service worker: Workbox precache + Web Push notifications
  firebase.ts        Firebase init (env-var config, offline cache, emulators)
  lib/               dates (timezone/Hijri), scoring, reports, db writes, messaging, sync indicator
firestore.rules      security rules (all access control)
tests/rules/         rules tests (Emulator Suite)
tests/unit/          date/scoring/report tests
functions/           old Cloud Functions version of the notifications (optional, needs Blaze); its
                     src/reminders.ts helpers are shared with tools/push/
tools/push/          the notification sender run by .github/workflows/notifications.yml
scripts/             seed-emulator.mjs, bootstrap-admin.mjs, generate-icons.mjs
```

---

## 1. Create a NEW, dedicated Firebase project

Mamulaat must have its **own** Firebase project. Do not reuse or connect it to any existing project, including the one used by your other app.

1. Go to <https://console.firebase.google.com> and choose **Add project**. Name it something like `mamulaat-<school>`. Google Analytics is not needed.
2. **Build → Authentication → Get started → Sign-in method → Google → Enable.** Set the support email. Leave every other provider disabled.
   - Under **Authentication → Settings → Authorized domains**, add **`<github-owner>.github.io`** (for this repo: `du-library.github.io`), or your custom domain. Without this, Google sign-in fails on the live site.
3. **Build → Firestore Database → Create database.** Use production mode and pick a region close to your students. The region can't be changed later.
4. **Project settings → General → Your apps → Add app → Web (</>).** Register the app and copy the config values into `.env.local` (see §2). Don't tick "Firebase Hosting"; the app is hosted on GitHub Pages.
5. **Push notifications:** no Firebase setup is needed. See §7 for the GitHub secret.
6. **Blaze plan: not needed.** Notifications are sent by a GitHub Action (§7), so the free Spark plan is enough.
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
| `VITE_FIREBASE_AUTH_DOMAIN` | same (`<project>.firebaseapp.com`). Keep this value |
| `VITE_FIREBASE_PROJECT_ID` | same |
| `VITE_FIREBASE_STORAGE_BUCKET` | same |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | same |
| `VITE_FIREBASE_APP_ID` | same |
| `VITE_FIREBASE_VAPID_KEY` | Cloud Messaging → Web Push certificates (public key) |
| `VITE_USE_EMULATORS` | `true` to use the local Emulator Suite |

These are public client identifiers, not secrets. Security comes from the rules.

For the live site, these same values are stored as GitHub **repository variables** (see §4), not in a file.

> **Email & password sign-in (optional, e.g. for a demo).** Enable **Authentication → Sign-in method → Email/Password**. Create a demo student under **Authentication → Users → Add user**; they sign in with “Sign in with email & password”, complete sign-up and you approve them as usual. The single admin account can also get a password from **Admin → Settings → Password sign-in** (remove it when no longer needed).

> **Sign-in:** the app uses a Google sign-in popup. If a browser blocks the popup, it falls back to a redirect sign-in. On GitHub Pages the redirect can be unreliable in Safari (the app's domain differs from `authDomain`), so ask students to allow the popup if sign-in doesn't complete.

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

Deploying has two parts: the **app** goes to GitHub Pages, and the **backend** (rules and functions) goes to Firebase.

### 4a. App → GitHub Pages (automatic)

`.github/workflows/deploy-pages.yml` runs on every push to `main`. It installs, runs the unit tests, builds with `VITE_BASE=/<repo-name>/`, copies `index.html` to `404.html` (so deep links like `/mamulaat/week` work, since Pages has no rewrites), and publishes `dist/`.

One-time setup on GitHub:
1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
   Pages on a **private** repo needs a paid GitHub plan (Pro/Team/Enterprise). On a free plan the repo must be public. That's fine: the code and Firebase config contain no secrets, and the security rules protect the data.
2. **Settings → Secrets and variables → Actions → Variables tab → New repository variable.** Add each of these with the values from §2:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
   Optional: `VITE_BASE` = `/` if you use a custom domain.
3. Merge to `main`, or run the workflow by hand from the **Actions** tab. The site will be at **`https://<owner>.github.io/<repo>/`** (here: `https://du-library.github.io/Mamulaat/`).
4. Add `<owner>.github.io` to Firebase **Authentication → Settings → Authorized domains** (§1, step 2).

To build the Pages version locally: `VITE_BASE=/mamulaat/ npm run build:pages`.

### 4b. Backend → Firebase from GitHub (no computer needed, works on an iPad)

`.github/workflows/deploy-firebase.yml` deploys the Firestore rules and indexes, and optionally the reminder functions. It **runs the security-rules tests first** and deploys nothing if any test fails. It runs automatically when `firestore.rules`, `firestore.indexes.json`, `firebase.json` or `functions/` change on `main`, or by hand from **Actions → Deploy Firebase backend → Run workflow**.

One-time setup:
1. Firebase console → ⚙️ **Project settings → Service accounts → Firebase Admin SDK → Generate new private key → Generate key.** A `.json` file downloads. On an iPad, open it from the Files app (Downloads) and **Select All → Copy**.
2. GitHub → **Settings → Secrets and variables → Actions → Secrets tab → New repository secret**. Name: `FIREBASE_SERVICE_ACCOUNT`. Value: paste the whole JSON. Then **delete the downloaded file** from the device.
3. `VITE_FIREBASE_PROJECT_ID` is already a repository variable from §4a.
4. **Actions → Deploy Firebase backend → Run workflow → `rules`.**

If the deploy step fails with a *permission* error, give the service account more access. Go to <https://console.cloud.google.com/iam-admin/iam>, select the project, find `firebase-adminsdk-…@<project>.iam.gserviceaccount.com`, click ✏️, and **add role → "Firebase Admin"**. Then re-run.

Reminder functions (after upgrading to **Blaze**): run the workflow with `rules-and-functions`. Deploying functions needs more permissions. On the same service account, add **Cloud Functions Admin**, **Service Account User**, **Cloud Scheduler Admin**, **Artifact Registry Administrator** and **Cloud Build Editor**. The first functions deploy can take a few minutes while Google enables the APIs; if it fails saying an API "has not been used / is disabled", wait 2 minutes and re-run. Once it works, add the repository variable `DEPLOY_FUNCTIONS` = `true` so pushes also redeploy functions.

> ⚠️ This key can read and write **all** data in the project (it bypasses the security rules). Anyone with admin access to the GitHub repo can use it through workflows. Keep repo admin access limited, and delete the key at handover (see §6).

### 4c. Backend → Firebase (alternative: from a computer)

```bash
npx firebase login
npx firebase use <your-project-id>
npm --prefix functions install
npm run deploy              # = firebase deploy --only firestore,functions  (functions need Blaze)
# rules only:  npm run deploy:rules
```

Run this once at the start, and again whenever `firestore.rules`, `firestore.indexes.json` or `functions/` change. **The app can't work until the rules are deployed.**

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
8. **Delete the GitHub deploy key.** In Google Cloud → IAM & Admin → Service accounts → `firebase-adminsdk-…` → **Keys**, delete the key you created. Then delete the `FIREBASE_SERVICE_ACCOUNT` secret in GitHub (notifications stop until the new owner adds their own). The new owner can create a new key for themselves if they want automatic deploys. Also remove yourself as a GitHub repo admin (or transfer the repo), and delete any other keys or `application-default` credentials you created (`gcloud auth application-default revoke`) and any local exports with real data.
9. Optional: in Firebase → Authentication, delete your own user. Your Firestore profile stays inactive.

Until steps 4–7 are done, you can still technically see data through the console. The in-app handover alone isn't enough.

There are **no backdoors**: no hard-coded emails or UIDs, no "if no admin exists, the first user becomes admin" rule, and no hidden roles. Admin can only be granted by the current admin (handover) or by someone with Google Cloud access to the project (the bootstrap script or the console).

## 7. Notifications (Web Push from a GitHub Action)

There's no server and no Cloud Functions, so this works on the free Spark plan. The app stores each device's standard Web Push subscription in Firestore. A GitHub Action (`.github/workflows/notifications.yml`) wakes every 15 minutes, reads Firestore and sends the notifications (`tools/push/send-notifications.mjs`).

**One-time setup:**
1. **Publish the rules** (they include `users/{uid}/pushSubs`). The *Deploy Firebase backend* workflow does this when this change reaches `main`.
2. **Service account:** the `FIREBASE_SERVICE_ACCOUNT` secret the backend deploy already uses is reused. Its role needs to be able to read and write Firestore. *Firebase Admin SDK Administrator Service Agent* or *Cloud Datastore User* both work.
3. **Push key:** add a repository secret named `VAPID_PRIVATE_KEY` containing the private key that pairs with `publicKey` in `push.config.json`. To make a new pair, run `npx web-push generate-vapid-keys`, put the public key in `push.config.json` and the private key in the secret. Everyone then has to turn notifications on again.
4. **Test it:** turn notifications on on your phone. Then go to **GitHub → Actions → Notifications → Run workflow** and choose *test: admins*.

**What gets sent:**
- **Reminders:** a general "please log your mamoolaat" message **every day at 23:00 and on Fridays at 12:00** (project timezone) to every active student who turned reminders on in **Me → Daily reminder**. The times and wording are in `push.config.json` → `reminders` (`weekday`: 0 = Sunday … 5 = Friday). Each one is sent once, by the first run within an hour of its time; `pushState/reminders` records what was sent.
- **Nudge:** when the admin taps **Remind** on Overview → *Not logged today*, the student is told on the next run, within about 15 minutes.
- **Message:** on a student's page → **Notes**, leave a note with **Also send it to their phone** ticked. The note shows in their Inbox and is pushed on the next run as "Message from <your name>" (first 300 characters). `pushMessages/{id}` holds it until it's sent.
- **New sign-up:** every admin with notifications on (**Settings → Notifications**) is told when someone finishes signing up.
- **Approved:** a student is told when they're approved, if they turned on notifications on the waiting screen.

**Notes:**
- **iPhone/iPad:** web push only works after adding the app to the Home Screen (iOS 16.4+) and turning notifications on from the Home Screen app. The app explains this on iOS.
- Without push, the **in-app banner** still shows whenever the app is opened and today isn't logged.
- Expired subscriptions (the push service answers 404/410) and devices unseen for 60 days are deleted. `pushState/notices` records which sign-ups and approvals have already been announced. No app user can read it.
- GitHub can start scheduled jobs a few minutes late. GitHub also pauses scheduled workflows in a repository with no commits for 60 days; re-enable it from the Actions tab.
- `functions/` (the old Cloud Functions version) is no longer needed. Don't deploy both, or reminders could be sent twice.

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

**Progress.** Each mamool counts as 100% when done, a proportional share when partly done, and 0% when missed. A day keeps the streak alive at ≥50% completion. If today isn't logged yet, the streak counts back from yesterday. Removing a mamool is a soft delete, so past percentages stay correct.

**Sign-up.** A new student signs in with Google, then types their **name** (this becomes their name everywhere in the app; it is never overwritten from Google) and picks their **class** from the classes the admin created. That is only a *request*: the student stays pending until the admin approves, and the admin sees the requested class pre-selected (and can change it). Because the class list must be readable before approval, **class names are readable by any signed-in user**; classes contain nothing but a name. Students can later rename themselves under **Me**, and add, edit, reorder or remove their own mamoolaat at any time (**Add a mamool** on the Log screen, or **Me → My mamoolaat**); additions apply from the day they're added and don't change past days.

**Deleting a student** (Admin → student → Delete) removes their mamoolaat, logs, comments, changes and tokens, then the profile. The `cleanupDeletedUser` function also deletes any leftovers and their Firebase Auth account. Without that Cloud Function their Google sign-in still works and would create a fresh sign-up request, so use **Deactivate** or **Reject** to keep someone out. A student who is signed in when deleted sees an "account removed" screen and is signed out.

**Admin controls.** The admin can: edit any student's log for any day (Student → *Day* tab; locked days too; the log is stamped `editedBy` and audited, and the student sees a note); rename a student, change class/status (including back to pending); hard-delete a mamool, a day's log, a comment or a change record; rename classes, move all students out of a class, or delete a class and move its students in one step (pending sign-ups that asked for it are asked to pick another); and select several people on the Students page to approve, move, deactivate, reactivate or delete in bulk. Restoring a removed mamool does not count the days it was removed as missed.

**Class mamoolaat (templates).** Admin → Classes → *Mamoolaat* sets a standard list for a class. It is **added** to each student's own list, never replacing it: automatically when a student is approved into that class, or for the whole class with *Add to all students now*. Anything a student already has with the same name is skipped; the rest are recorded as changes the student sees in their Inbox. Students keep their own items and can remove, rename or reorder anything that overlaps (likely doubles are pointed out under *My mamoolaat*).

**The admin's own mamool.** The admin's landing page (**Mine**, `/admin`) is their own mamool: today's checklist at the top to mark it, and a small **Add / edit** tab underneath to add, edit, reorder or remove items. It's stored under the admin's own `users/{uid}` like a student's. The admin's own log writes carry their `editedBy` stamp (the rules require it for every admin log write) and are not audited. The class overview moved to **Overview** (`/admin/overview`).

**Exports.** Week CSV, Month CSV and a print-friendly page are on Overview (whole madrassah), each class's week view, and each student's Weekly tab.

**Undo.** Small, reversible actions (removing a mamool, clearing an entry, *Mark all done*, deleting a comment/history entry/day log) show an Undo bar instead of an "Are you sure?" dialog. Big ones (deleting a student, deactivating, transferring admin) still ask first.

**App updates.** When a new version is deployed, installed apps show a "tap to update" bar instead of silently keeping the old version.

**Privacy.** Only what Google sign-in provides (name, email, photo) plus the student's mamoolaat data is stored. A "Who can see what" note is shown on sign-in, onboarding and the profile page.
