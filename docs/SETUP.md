# Mamulaat: setup guide (works entirely from an iPad)

You'll end up with the app live at **https://du-library.github.io/Mamulaat/**. Firebase stores the data and handles sign-in; GitHub hosts the app.
Do the parts in order. It takes about 45 minutes.

---

## Part 1: Create the Firebase project

1. Go to **console.firebase.google.com** and sign in with the Google account that should own the project. Tap **Create a project**.
   - Name it e.g. `mamulaat-school`, and accept the terms.
   - Turn **off** Google Analytics.
   - Tap **Create project**, then **Continue**.

2. **Turn on Google sign-in**
   - In the left menu: **Build → Authentication → Get started**.
   - **Sign-in method** tab → **Google** → switch it **on** → pick your support email → **Save**.
   - **Settings** tab → **Authorized domains** → **Add domain** → `du-library.github.io` → **Add**.

3. **Create the database**
   - **Build → Firestore Database → Create database**.
   - Pick the location nearest your students. It can't be changed later.
   - Choose **production mode** (not test mode) → **Create**.

4. **Register the web app**
   - Tap ⚙️ next to *Project Overview* → **Project settings**.
   - Scroll to **Your apps** and tap the **</>** icon.
   - Nickname `Mamulaat`. Leave **Firebase Hosting un-ticked**. Tap **Register app**.
   - Copy these 6 values into a note:
     `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`.

5. **Push-notification key**
   - Project settings → **Cloud Messaging** tab → **Web configuration → Web Push certificates** → **Generate key pair**.
   - Copy the long key into your note as value 7.

6. **Service-account key** (lets GitHub upload the security rules for you)
   - Project settings → **Service accounts** tab → **Generate new private key** → **Generate key**.
   - A `.json` file downloads. Keep it for Part 2, step 10.

7. *(Optional, only for push reminders)* **Upgrade to Blaze**
   - Tap **Upgrade** at the bottom of the left menu → **Blaze** → add a card.
   - Set a $1 budget alert. At school scale it should cost nothing.
   - You can skip this. Everything else works, and students still get an in-app reminder banner.

---

## Part 2: Set up GitHub

Open **github.com/du-library/mamulaat**. Do steps 8–10 **before** step 11, because creating `main` starts the deploys.

8. **Turn on Pages**
   - **Settings → Pages → Build and deployment → Source: GitHub Actions**.
   - If Pages isn't offered, the repo is private on a free plan. Make it public under **Settings → General → Danger Zone → Change visibility**. That's safe: there are no secrets in the code, and the data is protected by the Firebase rules.

9. **Add the 7 values as variables**
   - **Settings → Secrets and variables → Actions → Variables** tab → **New repository variable**, once for each:

   | Name | Value |
   |---|---|
   | `VITE_FIREBASE_API_KEY` | apiKey |
   | `VITE_FIREBASE_AUTH_DOMAIN` | authDomain |
   | `VITE_FIREBASE_PROJECT_ID` | projectId |
   | `VITE_FIREBASE_STORAGE_BUCKET` | storageBucket |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | messagingSenderId |
   | `VITE_FIREBASE_APP_ID` | appId |
   | `VITE_FIREBASE_VAPID_KEY` | the Web Push key |

10. **Add the service-account key as a secret**
    - Open the **Files** app → **Downloads** and tap the `.json` file.
    - Tap and hold the text → **Select All** → **Copy**.
    - **Settings → Secrets and variables → Actions → Secrets** tab → **New repository secret**.
      - Name: `FIREBASE_SERVICE_ACCOUNT`
      - Secret: paste the copied text → **Add secret**.
    - Then **delete the `.json` file** from Files.

11. **Create the `main` branch**
    - On the repo's **Code** page, tap the branch dropdown (it shows `claude/gracious-knuth-m252us`).
    - Type `main` → **Create branch main from claude/gracious-knuth-m252us**.
    - Then **Settings → General → Default branch** → switch it to `main`.

---

## Part 3: Deploy

12. **Upload the security rules**
    - **Actions** tab → **Deploy Firebase backend** → **Run workflow** → leave it on `rules` → **Run workflow**.
    - It takes about 4 minutes. A green ✓ means the rules are live.
    - If it fails with a *permission* error:
      1. Go to **console.cloud.google.com/iam-admin/iam** and pick your project.
      2. Find `firebase-adminsdk-…iam.gserviceaccount.com` and tap ✏️.
      3. **Add another role → Firebase Admin → Save**.
      4. Run the workflow again.

13. **Publish the app**
    - **Actions** tab → **Deploy to GitHub Pages**. Creating `main` usually started it already.
    - If it isn't green, tap **Run workflow**.
    - When it shows ✓, the app is live at **https://du-library.github.io/Mamulaat/**.

---

## Part 4: Make yourself admin

14. Open the app link and **Sign in with Google**. You'll see **"Waiting for approval"**. That's expected.

15. **Edit your user document**
    - In the Firebase console: **Firestore Database** → `users` → tap the document with your email.
    - Edit `role` → `admin`, and `status` → `active`.

16. **Set up the app**
    - Reload the app. You're now in the admin view.
    - **Settings**: set the **timezone** (e.g. `Asia/Karachi`) → **Save settings**.
    - **Classes**: create your classes.

---

## Part 5: Students

17. Send students the link.
    - On phones they should use **Share → Add to Home Screen**. On iPhone this is required for reminders (iOS 16.4+).

18. **Approve each student**
    - Each student signs in and appears as pending.
    - In **Students**, pick a class for each one → **Approve**.

---

## Optional: push reminders (needs Blaze, step 7)

1. **Add roles to the service account**
   - **console.cloud.google.com/iam-admin/iam** → `firebase-adminsdk-…` → ✏️.
   - Add the roles **Cloud Functions Admin**, **Service Account User**, **Cloud Scheduler Admin**, **Artifact Registry Administrator** and **Cloud Build Editor** → **Save**.
2. **Deploy the functions**
   - **Actions → Deploy Firebase backend → Run workflow** → choose `rules-and-functions`.
   - If the first try says an API "is disabled / has not been used", wait 2 minutes and run it again.
3. **Keep them updated automatically**
   - Once it's green, add a repository **variable** `DEPLOY_FUNCTIONS` = `true`.
4. **Each student** turns reminders on under **Me**.

---

## Handover to the teacher (later)

1. **Approve the teacher**: they sign in, and you approve them into any class.
2. **Transfer admin in the app**: **Settings → Transfer admin** → pick the teacher → type their email → confirm. You lose access in the app immediately.
3. **Give them the Google Cloud project**: in **console.cloud.google.com/iam-admin/iam**, add the teacher's (or the school's) Google account as **Owner**. Wait until they've accepted.
4. **Delete the deploy key**
   - Google Cloud → **IAM & Admin → Service accounts** → `firebase-adminsdk-…` → **Keys** → delete the key.
   - Delete the GitHub secret `FIREBASE_SERVICE_ACCOUNT`.
5. **Move billing** to the school, if you upgraded to Blaze.
6. **Remove yourself**: from the project's IAM, and from GitHub repo admin (or transfer the repo).

Until steps 3–6 are done, you can still see student data through the Firebase console.
