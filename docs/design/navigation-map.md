# Athlete app navigation map

How an athlete moves between the screens of the LoadWise mobile app. Drawn from the Expo Router
routes in `apps/mobile/src/app` and the Figma V1 design, as of 10 Nov 2026. Update it whenever a
route or a link between screens changes. Evidence for Ch4 (user interface design) and NFR 1.1
(daily log in 60 s or less).

Key: solid boxes are screens; **real** screens call the API, **preview** screens show labelled
sample data until their story is built; dashed boxes and arrows are planned, not built.

## 1. Screen map

```mermaid
flowchart TD
  start([App opens]) --> auth{Signed in?}
  auth -- No --> signin[Sign in<br/>/sign-in]
  auth -- Yes --> today
  signin -- "Create an account" --> setup[First-time setup<br/>/setup<br/>consent checkbox]
  setup -- "Continue (consent ticked)" --> today
  signin -- "Sign in" --> today

  today[Today<br/>/ · tab]
  trends[Trends<br/>/trends · tab]
  profile[Profile<br/>/profile · tab]
  today <-- "tab bar" --> trends
  trends <-- "tab bar" --> profile

  today <-- "Start check-in / save or close" --> wellness[Wellness check<br/>/wellness · modal]
  today <-- "Log a session / save or close" --> logsession[Log session<br/>/log-session · modal]
  today <-- "See why (when flagged) / back" --> flag[Why this was flagged<br/>/flag]
  today -.->|"Latest session card"| history[Recent sessions<br/>#4]:::planned
  trends -.->|"AI button on every tab (disabled)"| ai[AI assistant<br/>#12, #13, #15]:::planned

  profile -- "Sign out" --> signin
  profile -- "Preview tools" --> setup

  class signin,setup,profile real
  class today,trends,wellness,logsession,flag preview
  classDef real fill:#d9ead3,stroke:#38761d,color:#000
  classDef preview fill:#fff2cc,stroke:#bf9000,color:#000
  classDef planned fill:#f3f3f3,stroke:#999,stroke-dasharray:4 3,color:#555
```

Green: real. Yellow: preview with sample data. Grey dashed: planned. The tab bar links all three tabs
(Today and Profile too); "Forgot password?" on Sign in sends a reset email and stays on the screen.

## 2. Daily logging flow

The task behind NFR 1.1: a wellness check plus one session log in 60 s or less. Both forms start from
Today and open as modals, so the athlete is never more than one tap from Today.

```mermaid
flowchart LR
  a([Open app]) --> b[Today]
  b -- "Start check-in" --> c[Wellness check<br/>4 items, 1 to 5]
  c -- "Save check-in" --> d{Valid?}
  d -- No --> c
  d -- Yes --> b2[Today]
  b2 -- "Log a session" --> e[Log session<br/>type, duration, RPE]
  e -- "Save session" --> f{Valid?}
  f -- "No: missing or<br/>out-of-range RPE" --> e
  f -- Yes --> g{Online?}
  g -- Yes --> h[Today<br/>latest session updated]
  g -. "No (#6, planned)" .-> i[Today<br/>saved offline, waiting to sync]
```

Today, the saves validate but do not store anything: saving arrives with #5 (wellness) and #4
(sessions), and the offline queue with #6.

## 3. Screens, routes and stories

| Screen | Route | Reached from | Story | Status (10 Nov) |
| --- | --- | --- | --- | --- |
| Sign in | `/sign-in` | App start when signed out; Sign out | #1 | Real (Firebase) |
| First-time setup | `/setup` | Create an account; Profile preview tools | #1 (AC4) | Screen real; consent **not stored** yet (DL-008) |
| Today | `/` (tab) | Sign in, setup, closing any form | #7, #9 | Preview: states New user, Usual range, Flagged, Saved offline |
| Trends | `/trends` (tab) | Tab bar | #7, #9 | Preview |
| Profile | `/profile` (tab) | Tab bar | #1, #2 | Real: account, squads (create and join), sign out |
| Wellness check | `/wellness` (modal) | Today: Start check-in | #5 | Preview: validates, does not save |
| Log session | `/log-session` (modal) | Today: Log a session | #4 | Preview: validates, does not save |
| Why this was flagged | `/flag` | Today: See why | #9, #12 | Preview: sample flag |
| AI assistant | none | AI button (disabled) | #12, #13, #15 | Planned |
| Recent sessions | none | Today: Latest session card | #4 | Planned |

## 4. Design choices shown by the map

- **Three tabs, logging from Today** (DL-006): the two daily tasks are one tap from the first screen.
- **Logging forms are modals:** closing or saving always returns to Today, so there is no back stack to lose.
- **Status first:** Today leads with one plain-language line, and a flag links to its explanation ("See why").
- **Signed-out users can only reach Sign in:** the tab layout redirects anyone without a session, so no
  health screen is reachable without signing in.

## 5. Gaps found while drawing the map

- **Returning users skip setup.** Only a new account sees the consent screen. Once consent is stored
  (DL-008, #1 AC4), an existing user without recorded consent must also be sent to setup before any
  health-data screen.
- **Setup can be reopened from Profile** through the preview tools. Remove this once consent is real.
- **No recent-sessions screen** yet, although #4's acceptance criteria require one.
- **Staff screens** (#10 squad overview) are not designed; they get their own map with the week 5 wireframes.
