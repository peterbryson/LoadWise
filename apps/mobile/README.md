# apps/mobile (Expo + React Native)

The athlete and staff app. It began from the [Figma LoadWise V1](https://www.figma.com/design/TqJIKbFrsCVRNd4aZx1Tnd/LoadWise-V1)
screens and was restyled in the V2 design system (#52, DL-033): zinc neutrals, one green accent,
Lucide icons, light and dark themes. It runs in a browser on localhost through Expo's web mode, and
the same code runs on a phone.

## What is real and what is not built yet (#46)

Every figure on every screen comes from the API. There is no sample data left in the app.

| Screen | State |
| --- | --- |
| Sign in, Create an account, Forgot password | **Real.** Firebase email and password (#1) |
| First-time setup | **Real.** Log my own training, support a squad as staff, or both (#48). Health-data consent is saved through `POST /me/health-consent` (DL-008); staff create their first squad |
| Today | **Real.** Sync status (#6), flags from the engine (#9), the check-in card from `GET /wellness/today`, This week from `GET /me/load` (#45), team sessions to rate (#17) and the latest session |
| Wellness check, Log session | **Real.** Saved through the API, or queued on the phone and synced later (#4, #5, #6). The session date is always today: logging a past day is not in #4's criteria |
| Recent sessions, Flag details | **Real** (#4, #9) |
| Trends | **Real.** Weekly load, usual week and EWMA ACWR (#7), wellness trend (#9) |
| Squad tab (staff) | **Real.** Squads you support, with overview, members, invite and team-session actions (#2, #17, #48, #49) |
| Squad overview, members, athlete detail | **Real.** Only athletes who share with the squad, with role-based detail (#3, #8, #10, #11, #21) |
| Invite athletes | **Real.** Copy, share or (coach only) replace the code (#49) |
| Profile | **Real:** name, email, squads you play in with a sharing switch per squad (#3), join or create a squad, Appearance (theme), Sign out, and Delete account and data (#14) |

Not built yet, and shown as not available rather than hidden:

- The **AI assistant** tab button is disabled until #12, #13 and #15.
- Profile rows **Account details, Privacy and data, About LoadWise, Connected devices and
  Reminders** have no screens behind them; screen readers announce each as "not available yet".

## Run it on localhost

From the repo root:

```bash
copy apps\mobile\.env.example apps\mobile\.env   # then fill in the Firebase web app settings
pnpm dev                                         # API on :3000 and the app on http://localhost:8081
```

`pnpm dev` runs the API and Expo together. To run only the app: `pnpm --filter @loadwise/mobile dev`.

- The API must allow the app's origin: `CORS_ORIGINS=http://localhost:8081` in `apps/api/.env`.
- The API needs `FIREBASE_PROJECT_ID` set, or every signed-in call returns 401.
- The Firebase values come from Firebase console → Project settings → General → Your apps (web app).

## Structure

```
src/
  app/          Routes (Expo Router): sign-in, setup, (tabs)/index|trends|squad|profile, wellness,
                log-session, sessions, flag, squad-*, log-team-session, delete-account
  components/   Design-system primitives (Button, Card, Badge, Avatar, Option, ListRow, TabBar, ...)
                and screen parts such as today/CheckInCard
  theme/        Colour, type, spacing and radius tokens; light and dark (#52)
  lib/          Firebase auth, API client, offline queue and sync, account deletion, formatting
  __tests__/    Screen tests
```

Never put tests (or anything that is not a screen) in `src/app/`: Expo Router loads every file
there as a route, so a test file ends up in the app bundle and crashes it ("expect is not defined").

## Commands

```bash
pnpm --filter @loadwise/mobile test        # Jest + React Native Testing Library
pnpm --filter @loadwise/mobile typecheck
pnpm --filter @loadwise/mobile lint
```

## Known gaps

- On a phone, sign-in does not survive an app restart yet: Firebase's React Native persistence is
  not exposed through `firebase/auth` types, so the app uses `getAuth` (persistent on web only).
- Not checked against WCAG 2.2 AA with real assistive technology, and not user tested. Colour pairs
  were checked by contrast ratio only (DL-033); touch targets are at least 48 px.
- Icons are Lucide (ISC licence) drawn through `react-native-svg`. Jest loads Lucide's CommonJS
  build (`jest.config.js`), because it cannot load the ES module build Metro uses.
