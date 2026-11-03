# apps/mobile (Expo + React Native)

The athlete app, built from the [Figma LoadWise V1](https://www.figma.com/design/TqJIKbFrsCVRNd4aZx1Tnd/LoadWise-V1)
screens in light and dark themes. It runs in a browser on localhost through Expo's web mode, and
the same code runs on a phone later.

## What is real and what is a preview

| Screen | State |
| --- | --- |
| Sign in, Create an account, Forgot password | **Real.** Firebase email and password sign-in (#1) |
| First-time setup | UI only. The consent checkbox gates Continue, but consent is **not saved** yet (DL-008) |
| Today, Trends, Flag details | **Preview.** Figma sample figures, marked with a Preview banner whose chips switch between the design's states |
| Wellness check, Log session | **Preview.** Forms validate with the shared Zod schemas and show session load from `@loadwise/analytics`, but **nothing is saved** (#4, #5) |
| Profile | Your real Firebase name and email. The Squads section calls the **real API** (#2 create and join). Preview tools switch theme and reopen setup |

Every preview screen says so on screen, so a screenshot or demo cannot be mistaken for a working feature.

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
  app/          Routes (Expo Router): sign-in, setup, (tabs)/index|trends|profile, wellness, log-session, flag
  components/   Components from the Figma component set: Button, Option, Card, ListRow, TabBar, ...
  theme/        Colour and type tokens from the Figma variables; light and dark
  lib/          Firebase auth, API client, plain-language error messages
  preview/      The Figma sample figures, kept apart from real data
  __tests__/    Screen tests
assets/icons/   Icons exported from Figma, one coloured set per theme
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
- Not checked against WCAG 2.2 AA and not user tested. Touch targets follow the design (48 to 60 px).
- Account and "Coming later" rows in Profile have no screens behind them.
- The session date is always today; the date picker comes with #4.
