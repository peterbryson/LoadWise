# Decision Log

Every significant technical or process decision and every spike outcome, newest first.
This is the source for dissertation Ch1 (project progression), Ch4 (technical justification)
and Ch5 (challenges), and for answering "why?" in the live Q&A.

Template:

```
## DL-NNN: <title>
- Date:
- Status: Proposed | Accepted | Superseded by DL-NNN
- Context: what problem or question forced a decision
- Options considered: each with pros and cons, numbers where possible (cost, latency, effort, energy)
- Decision:
- Consequences: what this makes easier or harder; requirements affected
```

---

## DL-010: First app UI: Expo web on localhost, with labelled sample-data previews

- Date: 3 Nov 2026
- Status: Accepted (approach proposed by Claude Code; Peter chose the preview, squad and consent options on 3 Nov)
- Context: Peter wanted to see every Figma V1 screen on localhost and try real Firebase sign-in
  against the API. Most screens (Today metrics, wellness, sessions, flags, trends) have no API yet.
- Options considered:
  - **Where to build it:** *the real Expo app in Expo's web mode* (the same code later runs on a
    phone, so the work is not thrown away; chosen) versus *a separate web prototype* (quicker to
    style, but rebuilt later) versus *Figma's own prototype view* (no code, but no real sign-in).
  - **Screens without an API:** *sample data with a visible "Preview" banner* (chosen) versus
    *only build real features now* versus *sample data with no label* (rejected: in a demo or video
    it would look as if #4, #5, #7 and #9 work).
  - **Squad API, which has no Figma screen:** *a plain Squads section in Profile* (chosen) versus
    *leaving it out until #2 and #10 are designed*.
  - **Setup consent, which cannot be stored yet:** *UI only, marked as not saved* (chosen) versus
    *building the consent API now* (rejected: it mixes a consent rule, which is core logic, into a
    UI branch).
- Decision: an Expo Router app in `apps/mobile`. Sign-in, create account, password reset and the
  squad actions are real. Every sample-data screen shows a Preview banner whose chips switch between
  the Figma states. Forms validate with the shared Zod schemas and show session load from
  `@loadwise/analytics`, but save nothing. Icons are the Figma exports, one coloured set per theme.
  The API allows browser calls only from origins listed in `CORS_ORIGINS`.
- Consequences:
  - Part of Sprint 2 week 3 (the Expo app and #1 sign-in in the app) is done early. #4, #5, #7 and
    #9 are **not** done: their screens exist but save or compute nothing.
  - On a phone, sign-in does not survive an app restart yet (`getAuth` is persistent on web only).
  - Not checked against WCAG 2.2 AA and not user tested.
  - Squads in Profile and the Preview tools are not in the Figma design and need designing with #2 and #10.

## DL-009: Verify Firebase ID tokens with firebase-admin

- Date: 3 Nov 2026
- Status: Accepted (Peter chose firebase-admin over jose on 3 Nov)
- Context: #1 replaces `RejectAllTokenVerifier` with a verifier for Firebase ID tokens (DL-004).
  Checking a token means verifying its signature against Google's rotating public keys, plus its
  expiry, issuer, audience and subject (NFR 2).
- Options considered:
  - **firebase-admin (Google's SDK):** `verifyIdToken` does every check and handles key rotation.
    Needs only the project ID, with no service account. A large dependency.
  - **jose with Google's public keys:** small, but every claim check is hand-written
    security code to own and test.
- Decision: firebase-admin 14 behind the existing `TokenVerifier` interface. `createTokenVerifier`
  uses it when `FIREBASE_PROJECT_ID` is set and falls back to `RejectAllTokenVerifier` otherwise,
  so a missing setting fails closed.
- Consequences:
  - Token revocation is not checked (that needs a service account); ID tokens expire after an hour.
  - firebase-admin reports a failed key download with the same code as a bad token, so a Google
    outage shows as 401, not 503. Failing closed was preferred to parsing error messages.
  - firebase-admin 14 depends on `jose`, which is ES-module only. Node 22 loads it at runtime, but
    Jest cannot, so `apps/api/jest.config.js` compiles `jose` for tests. Staying on firebase-admin 13
    (CommonJS) was rejected because it has had no release since May 2026.
  - Email verification is not required yet. Because accounts are never linked by email (409), an
    unverified sign-up cannot take over an account, but it could block the real owner's email.
    Revisit with the app sign-in screens in Sprint 2.

## DL-008: Explicit health-data consent at first-time setup

- Date: 3 Nov 2026
- Status: Accepted (decided by Claude Code at Peter's request, 3 Nov 2026; Peter to review)
- Context: the first-time setup design asks the athlete to agree to LoadWise processing their
  health data, but the schema only stores consent per squad membership (DL-002). Health data is
  special category data under UK GDPR Art. 9, so processing needs a condition such as explicit
  consent, and Art. 7(1) requires being able to show it was given. Per-squad consent (#3) only
  covers sharing with staff, not processing in the first place, and says nothing about an athlete
  who is in no squad.
- Options considered:
  - **Treat sign-up or terms acceptance as consent.** No schema change, but it is not a separate,
    explicit consent and leaves nothing to show when it was given.
  - **Rely on per-squad consent only, and drop the setup checkbox.** No change, but personal
    logging outside any squad has no consent at all.
  - **A user-level health-data consent with history**, using the same pattern as DL-002: an
    append-only event log plus a cached current state, written in one transaction through one
    tested service method. Chosen.
- Decision: record explicit health-data consent per user at first-time setup, separately from
  per-squad sharing consent. Agreeing to processing shares nothing with any squad. The API rejects
  health-data writes (#4, #5) with 403 until it is given. It is added with #1 in Sprint 2 week 3
  through a new migration; the exact fields are decided in that merge request and the ERD updated.
- Consequences: one more step at first sign-in (NFR 1's 60 s target is for the daily log, not
  onboarding). In the MVP, withdrawing this consent is done by deleting the account (#14, Sprint 4),
  which removes all data. Until #14 exists there is no withdrawal route, which is acceptable only
  because no real athlete data is used before the pilot (Sprint 8). Whether a softer "pause
  processing" option is needed is revisited with #14.

## DL-007: Metric definitions: usual week, baseline length and when metrics first appear

- Date: 3 Nov 2026
- Status: Accepted (decided by Claude Code at Peter's request, 3 Nov 2026; Peter to review). Thresholds and windows are configurable hypotheses until the Sprint 4 flag spike.
- Context: #7 and #9 need fixed definitions before their hand-calculated fixtures are written.
  The Figma V1 screens show a "usual week", a 28-day baseline progress bar and a 1.5 guide as
  placeholders.
- Options considered:
  - **Usual week:** *mean of the last 4 completed weeks* (easy to explain and to check by hand);
    *chronic EWMA load × 7* (consistent with ACWR, but hard to explain); *median of recent weeks*
    (robust to one big week, but less familiar).
  - **Baseline length:** *21 days* (faster to first flag, noisier); *28 days* (matches the usual
    chronic ACWR window); *42 days* (more stable, six weeks without flags).
  - **When metrics first appear:** *immediately* (numbers from sparse data, so false alarms);
    *after the baseline window* (no flags while it builds); *after a minimum number of entries*.
- Decision:
  - Session load and this week's load (Monday to Sunday) are shown from the first session.
  - **Usual week** = mean weekly load of the last 4 completed Monday-to-Sunday weeks, shown once 4
    completed weeks have passed since the athlete's first entry. A day with no session counts as
    zero load.
  - **ACWR** = EWMA as in FR 2: acute 7 days, chronic 28 days, decay 2 / (N + 1)
    (Williams et al., 2017). Shown, and used for flags, only once 28 days have passed since the
    first logged session.
  - **Wellness baseline** = mean and SD of each item over the previous 28 days, excluding today.
    It needs at least 14 check-ins in that window; days without a check-in are skipped, not zero.
  - A flag (#9) can only fire once its metric is shown. The ACWR above 1.5 and the wellness more
    than 1.5 SD below baseline rules stay configurable.
  - The "Day N of 28" progress on Today and Trends counts calendar days since the first entry.
  - All of these are inputs to pure functions in `packages/analytics`; "today" is passed in, never read from a clock.
- Consequences:
  - New athletes see no flags for their first 4 weeks: no false alarms from sparse data, but no
    flags either. The Today and Trends "building your baseline" states cover this.
  - Because ACWR uses EWMA and the usual week is a simple mean, ACWR is **not** this week divided
    by the usual week. The Figma sample figures (3,240 / 2,000 = 1.62) imply that it is, so the flag
    detail screen must not present it that way.
  - Counting a day with no session as zero load means a forgotten log lowers chronic load and can
    raise ACWR. This is a known limitation, reduced by offline sync (#6) and reminders.

## DL-006: Athlete app design V1: three tabs and a status-first Today screen

- Date: 3 Nov 2026
- Status: Accepted (decided by Claude Code at Peter's request, 3 Nov 2026; Peter to review)
- Context: Sprint 2 builds the first athlete screens (#1, #4, #5, #6), and Sprint 3 adds metrics,
  trends and flags (#7, #9). The app needs a navigation structure before the Expo app is generated.
  NFR 1 asks for a daily log under 60 s and WCAG 2.2 AA. Flags must show their reason, value and
  threshold, and must not read as a diagnosis. Design: [Figma LoadWise V1](https://www.figma.com/design/TqJIKbFrsCVRNd4aZx1Tnd/LoadWise-V1).
  The options and trade-offs below are analysis written by Claude Code at Peter's request, not
  results from user research.
- Options considered:
  - **Navigation:**
    - *Three tabs (Today, Trends, Profile).* Few choices for quick pitch-side use; logging starts
      from buttons on Today rather than a tab of its own.
    - *Separate tabs for logging, metrics, flags and assistant.* Each feature is one tap away, but
      more tabs to scan and a tab for a feature (the assistant) that does not exist until Sprint 5.
  - **Today screen:**
    - *Status first:* one plain-language line ("in your usual range" or a flag) above the numbers.
    - *Numbers first:* ACWR, monotony and strain shown directly. More detail, but asks the
      athlete to interpret ratios themselves.
  - **Flags:**
    - *Plain-language title with the value and guide underneath, and a "See why" detail screen.*
    - *Raw metric and threshold only.* Meets "reason, value and threshold" with less design work,
      but is harder for an amateur athlete to read.
  - **AI assistant entry point:**
    - *A fixed button at the bottom right on every tab, with no chat screen in this version.*
      Reserves the place without building #12, #13 or #15 early.
    - *Build a chat screen now.* Nothing safe to show until the engine tools and guardrails exist (Sprint 5).
    - *No entry point until Sprint 5.* Simplest, but the layout may need changing later.
- Decision (proposed): three tabs, status-first Today, plain-language flags with a detail screen,
  and a placeholder AI button at the bottom right. Light and dark themes are both designed.
- Consequences:
  - The design has not been user tested or checked against WCAG 2.2 AA. NFR 1 and accessibility
    claims need measuring on the built screens.
  - The sample figures, the 28-day baseline and the 1.5 guide in the screens are placeholders,
    not engine outputs or clinical thresholds. They depend on the open definitions of "usual week"
    and baseline length, and on the Sprint 4 flag spike.
  - The first-time setup screen asks for general consent to process health data, which the data
    model does not store yet (see `requirements-changes.md`).
  - The flag detail screen keeps its "What you can do" section, but its text may only suggest
    talking the next sessions through with a coach, or a physio or GP for pain or injury. It never
    tells the athlete to raise or lower load, rest, or return to play.
  - Session history (part of #4) and the staff view (#10) still need adding to the design.

## DL-005: Athlete-first delivery, one complete feature at a time

- Date: 3 Nov 2026
- Status: Accepted (decided by Claude Code at Peter's request, 3 Nov 2026; Peter to review)
- Context: the 26 Oct plan built the API stories first (#1 and #2 in Sprint 1), then athlete
  logging (Sprint 2), then analytics and staff views (Sprint 3). As of 3 Nov, the repo has no Firebase verifier for #1
  (the API still uses `RejectAllTokenVerifier`), #2 is partly done, and no app screens exist.
  All 11 MVP stories must run on staging by 13 Dec for the interim video (18 Jan).
  The order is Peter's planning decision of 3 Nov; the comparison below was written by Claude
  Code at his request.
- Options considered:
  - **Backend first (the 26 Oct plan):** permissions and data model settled before any screens,
    but nothing usable on a phone until late in Sprint 2, and screens built last get the least
    testing.
  - **Athlete-first vertical slices:** each story is finished through API, database and app
    before the next starts, so there is a working, demonstrable product from Sprint 2. The cost
    is that consent, role-based access and the staff view all land in Sprint 3 week 7, which is
    also the CSC3067 and CSC3045 submission week.
  - **Staff-first:** builds the squad overview early, but with no athlete data to show.
- Decision (proposed): athlete-first vertical slices in this order: #1 in the API by 8 Nov;
  Sprint 2 week 3: Expo app, #1 in the app, #5; week 4: #4, session history, #6; Sprint 3 week 5:
  #7, player trends, #9; week 7: finish #2, then #3, #8, #11 and a basic #10. Squad and staff
  stories stay Must; only the order changes. Azure staging moves to Sprint 2.
- Consequences:
  - The Must scope and all deadlines are unchanged.
  - Week 7 is the highest-risk week. If time runs short, #10 becomes a simple list of consenting
    athletes with flags and reasons. Consent (#3) and role-based access (#11) are not cut.
  - Until #3 and #11 exist, no staff route may return athlete health data. Athlete-facing routes
    must only return the signed-in athlete's own data.
  - #9 flags are built before #8 combined load, so flag tests at that point cover single-squad
    and personal data; they need re-running once #8 combines load across squads.
  - Staging is an outstanding Definition of Done item until Sprint 2.
  - The offline-sync spike moves to the end of Sprint 2 week 3, after #5 writes through the API,
    because week 4 is short and #6 depends on it. Wellness's one-entry-per-day constraint gives the
    spike a real duplicate case to test against.

## DL-004: Authentication on by default, with a swappable token verifier

- Date: 2 Nov 2026
- Status: Accepted
- Context: #2 (create a squad and invite) needs to know who is signed in, but Firebase sign-in
  (#1) is not set up yet. Every endpoint must enforce identity in the API, never only in the app (NFR 2).
- Options considered:
  - **Guard per controller (`@UseGuards`):** explicit, but a new endpoint is unprotected if the
    decorator is forgotten.
  - **Global guard with a `@Public()` opt-out:** every route is locked unless marked public, so
    the safe option is the default. Chosen.
  - **For the token check before #1:**
    - *A dev login that trusts a user ID header.* Quick to demo, but it is a backdoor that could
      reach production by mistake.
    - *A `TokenVerifier` interface.* Tests use a fake, the real app uses a verifier that rejects
      every token until the Firebase one replaces it in #1. Chosen: the API fails closed.
- Decision: a global `AuthGuard` (`APP_GUARD`) with `@Public()` for `/health` only, calling a
  `TokenVerifier` behind an injection token. A LoadWise user record is created on the first
  signed-in request. Invite codes only ever grant the ATHLETE role; staff joining an existing
  squad is left to #11, because a shared code that could grant staff roles would expose athlete data.
- Consequences: the API cannot be called by a real user until #1 lands; until then the HTTP
  tests are the demo. Adding Firebase is one new class and one line in `AuthModule`. The tests
  fake the database, so real-constraint integration tests (Postgres in CI) are a follow-up.

## DL-003: Self-hosted GitLab runner in Docker

- Date: 2 Nov 2026
- Status: Accepted
- Context: no shared or instance runners are available on gitlab.eeecs.qub.ac.uk, so every
  pipeline stayed pending. The Definition of Done needs a green pipeline, the requirements
  traceability matrix is built from CI's JUnit reports, and NFR 4 needs the AI evaluation suite to
  run in CI on every commit.
- Options considered:
  - **Self-hosted runner in Docker on my laptop:** free, set up in about 10 minutes, and the Docker
    executor gives every job a clean `node:22` container. Only runs while my laptop and Docker
    Desktop are on.
  - **Mirror to GitHub and use GitHub Actions:** always-on hosted runners, but the CI config would
    need rewriting and maintaining in two places, and the code would live in two places.
  - **Run checks locally only:** no setup, but leaves no verifiable record, so it is not real
    evidence of testing.
- Decision: self-hosted GitLab Runner (Docker executor) in a Docker container on my laptop, set to
  restart with Docker. First pipeline (lint, typecheck, test) passed on 2 Nov.
- Consequences: every merge request now has CI evidence. Pipelines queue while my laptop is off,
  so Docker Desktop is set to start at sign-in. Revisit if the university provides a runner, or
  when the Azure staging deploy (Sprint 2) needs reliable runs.

## DL-002: Data model v1: athlete-owned health data and per-squad consent with history

- Date: 2 Nov 2026
- Status: Proposed (to discuss at the supervisor meeting on 4 Nov)
- Context: athletes play for several squads, and staff in each squad may only see data from
  athletes who consent, limited to what their role needs (FR 2, FR 4, NFR 2). Consent must be
  provable under UK GDPR Art. 7(1), and withdrawal must take effect on the next request.
- Options considered:
  - **Where health data lives:**
    - *Owned by the squad* (a session belongs to one squad). Simple squad queries, but an athlete's
      load would be split across squads, which defeats multi-team load (#8), and data logged
      outside a team has nowhere to go.
    - *Owned by the athlete*, with an optional `squadId` on sessions. One query gives total load
      across every team; squad views join through Membership. Chosen.
  - **How consent is stored:**
    - *A boolean on Membership.* Fastest to check in a guard, but overwriting it loses the history
      of when consent was given or withdrawn.
    - *Only an append-only ConsentEvent log.* Full history, but every staff request would have to
      find the latest event per athlete, which slows the squad dashboard (NFR 3: p95 under 2 s
      for 40 athletes).
    - *Both:* the event log is the record, and `Membership.consentGiven` is a cached current state
      written in the same transaction. Chosen: guards read one column, and history is kept.
  - **Granularity of consent:**
    - *Per data type* (e.g. share load but not wellness). Finest control, but adds a consent
      screen per squad per data type, which works against a quick sign-up (NFR 1).
    - *Per squad*, with role-based minimisation enforced in API guards (e.g. a coach sees load and
      flags, a physio also sees wellness and injuries). Chosen for the MVP; per-type consent can
      be added later as extra ConsentEvent fields if interviews show athletes want it.
- Decision: health data (sessions, wellness, injuries, flags) references the athlete. Consent is
  per squad membership, stored as an append-only ConsentEvent log plus a cached
  `consentGiven` flag. Computed metrics are not stored until #7 (Sprint 3); session load is always
  calculated by `@loadwise/analytics`. Flags store their value, threshold and reason so every flag
  can explain itself (#9).
- Consequences: deleting a user cascades to all their health data (#14). Two consent fields must
  be kept in step, so all consent changes go through one service method, which is tested.
  The role-to-data mapping still needs defining for #11. Offline-sync deduplication for sessions
  (#6) is left to the Sprint 2 spike; wellness is already protected by one entry per athlete per day.


## DL-001: Own NestJS + PostgreSQL backend instead of Firebase

- Date: 26 Oct 2026
- Status: Accepted
- Context: LoadWise stores special-category health data, shared across squads with
  role- and consent-based access. Athletes belong to several squads at once (club, county, college).
- Options considered:
  - **Firebase (Firestore + Cloud Functions):** fastest start and already familiar from Benchmark.
    But a document store fits many-to-many memberships badly, permissions live in security rules
    rather than tested application code, and analytics queries across squads are awkward.
  - **Next.js API routes:** one framework for the dashboard and API, but weak layering and
    the API would be tied to the web app.
  - **NestJS + PostgreSQL + Prisma:** layered modules, guards that enforce role and consent per
    request, relational joins for multi-team load, background jobs via pg-boss. More setup effort.
- Decision: NestJS REST API, PostgreSQL via Prisma, Firebase Authentication for identity only
  (no health data in Firebase).
- Consequences: more infrastructure to build and deploy (Docker, Azure). Permissions become
  unit-testable (NFR 2), and multi-team load is a straightforward relational query (FR 2).
