# Use case descriptions: log a session, daily wellness check

Drafted by Claude Code at Peter's request, 20 Nov 2026; Peter to check. Task #39.

These describe the behaviour built on `main` as of 20 Nov 2026 (merge requests !10, !11 and !12),
read from the code: `apps/mobile/src/app/log-session.tsx`, `sessions.tsx` and `wellness.tsx`,
`apps/api/src/sessions`, `apps/api/src/wellness`, `apps/api/src/consent` and the shared Zod
schemas in `packages/shared`. Steps that are planned but not built are marked **Not built yet**.

---

## UC-01: Log a session or match

| Field | Description |
| --- | --- |
| ID and name | UC-01 Log a session or match |
| Issue and requirements | #4; FR 1 (logging); NFR 1.1 (daily log in 60 s or less, with UC-02); NFR 1.3 (accessibility); NFR 2 (own data only, consent) |
| Primary actor | Athlete |
| Other actors | LoadWise API; Firebase Authentication (identity only) |
| Goal | Record a training session, match, gym session or other activity so its load (session-RPE × minutes) counts towards the athlete's metrics |
| Preconditions | 1. The athlete is signed in with a valid Firebase ID token. 2. The athlete has given health-data consent at first-time setup (DL-008); otherwise the app sends them to setup and the API refuses the save. 3. The device can reach the API (offline saving is **not built yet**, #6) |
| Trigger | The athlete taps "Log a session" on Today |
| Postconditions (success) | A session is stored for the signed-in athlete, dated today on the phone's calendar, with type, duration and RPE. The athlete is back on Today. The session appears first in Recent sessions (with any other session from the same day ordered by when it was logged) |
| Postconditions (failure) | Nothing is stored. The athlete stays on the form with their answers kept and an error message |

### Main success scenario

1. The athlete taps "Log a session" on Today.
2. The app shows the form with type set to Training, the date fixed to Today, duration options (30, 45, 60, 75, 90 or Other) and RPE buttons from 1 to 10.
3. The athlete chooses a type (Training, Match, Gym or Other).
4. The athlete chooses a duration.
5. The athlete chooses an RPE. The app shows the CR-10 description for that value where the scale has one (for example "7: Very hard").
6. The app checks the answers against the shared session schema and shows the session load, for example "420 AU, RPE 7 × 60 min".
7. The athlete taps Save session.
8. The app sends the session to the API (`POST /sessions`) with the athlete's ID token.
9. The API checks the token, checks that health-data consent is recorded, and validates the body against the same schema.
10. The API stores the session against the signed-in athlete (never an ID from the request) and returns it with its load.
11. The app returns to Today.

### Alternative flows

- **4a. Other duration:** the athlete chooses Other and types the minutes. Steps 5 to 11 follow.
- **6a. Form incomplete or out of range:** if no RPE is chosen, or the duration is missing or outside 1 to 600 minutes, no load is shown. If the athlete taps Save session, the app shows "Choose an RPE from 1 to 10." or "Choose a duration from 1 to 600 minutes." and sends nothing. Changing any answer clears the message.
- **11a. View recent sessions:** from the Latest session card on Today, the athlete opens Recent sessions (`GET /sessions`, 20 by default and at most 50), which lists each session newest first with its type, duration, day, RPE and load. With no sessions it shows "No sessions yet".
- **1a. Close without saving:** the athlete taps the close button; nothing is stored.

### Exceptions

- **9a. Not signed in or token expired (401):** nothing is stored; the app shows "Your sign-in has expired. Sign in again."
- **9b. No health-data consent (403):** nothing is stored; the API returns "Agree to health-data processing in first-time setup first". In normal use the app's consent gate sends the athlete to setup before they reach this screen.
- **9c. Invalid body (400):** if a request bypasses the app's checks, the API rejects it and the app shows the first validation message.
- **8a. API unreachable:** the app shows "Can't reach the LoadWise API. Check it is running and try again." and keeps the answers. **Not built yet:** saving the session on the phone and syncing it later, shown in Recent sessions as waiting to sync (#4 AC4, #6).
- **10a. Unexpected server error (500):** nothing is stored; the app shows "Something went wrong. Try again." The server logs only the method, path and error type (DL-012).

### Not covered by this version

Logging a session for an earlier day; editing or deleting a session; linking a session to a squad.

---

## UC-02: Daily wellness check

| Field | Description |
| --- | --- |
| ID and name | UC-02 Daily wellness check |
| Issue and requirements | #5; FR 1 (logging); NFR 1.1 (daily log in 60 s or less, with UC-01); NFR 1.3 (accessibility); NFR 2 (own data only, consent) |
| Primary actor | Athlete |
| Other actors | LoadWise API; Firebase Authentication |
| Goal | Record how the athlete feels today so wellness can be compared with their own baseline (DL-007) |
| Preconditions | 1. Signed in with a valid token. 2. Health-data consent recorded (DL-008). 3. The device can reach the API (offline saving **not built yet**, #6). 4. The athlete has not already checked in today |
| Trigger | The athlete taps "Start check-in" on the Morning check-in card on Today |
| Postconditions (success) | One wellness entry is stored for the athlete for today's date on the phone's calendar, with sleep, soreness, fatigue and stress each scored 1 to 5. The athlete is back on Today |
| Postconditions (failure) | Nothing new is stored. The athlete stays on the form with an error message |

### Main success scenario

1. The athlete taps "Start check-in" on Today.
2. The app shows four questions (Sleep, Soreness, Fatigue, Stress), each with buttons 1 to 5 and a plain-language label at each end (for example Sleep: Poor to Great; Soreness: Very sore to No soreness). 5 is always the best answer.
3. The app also shows "In pain or injured? Speak to a physio or GP."
4. The athlete scores all four questions.
5. The athlete taps Save check-in.
6. The app checks the answers against the shared wellness schema and sends them with today's date (`POST /wellness`).
7. The API checks the token and consent and validates the body.
8. The API stores the entry for the signed-in athlete and returns it.
9. The app returns to Today.

### Alternative flows

- **5a. A question unanswered:** the app shows "Choose a score from 1 to 5 for each question." and sends nothing.
- **1a. Close without saving:** nothing is stored.

### Exceptions

- **8a. Already checked in today (409):** the database allows one entry per athlete per day, so a second check-in, including two sent at the same moment, is refused. The app shows "You have already checked in today". Nothing is changed.
- **7a. Not signed in (401), no consent (403), invalid body (400), API unreachable, server error (500):** as in UC-01 9a to 10a. **Not built yet:** saving offline and syncing later (#6).

### Not covered by this version

Changing today's answers after saving; checking in for an earlier day; a reminder to check in.

---

## Open points

- #5 AC1 (the check takes under 60 s in user testing) and NFR 1.1 are not yet measured; they need the usability sessions now that ethics is approved.
- Recent sessions is reached from Today's Latest session card, but the card itself still shows sample text (#4 AC4).
