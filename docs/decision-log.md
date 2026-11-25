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

## DL-023: Offline queue and duplicate protection (#6, #35 spike outcome)

- Date: 25 Nov 2026
- Status: Proposed (Peter chose the AsyncStorage queue with a client UUID on 25 Nov; Claude Code
  chose the retry schedule and the rest of the details below. Peter to accept)
- Context: #6 needs entries made offline to be kept (AC1), synced within 1 minute of reconnecting
  (AC2) and never duplicated (AC3). The app also runs on Expo web (DL-010). DL-002 left duplicate
  protection for sessions to the offline-sync spike (#35). The spike was cut to about an hour inside
  #6 rather than two days on its own.
- Options considered:
  - **Storage.**
    - expo-sqlite: transactions and queries, but a native dependency with weak Expo web support.
    - **AsyncStorage (chosen):** already a dependency, works on web (`localStorage`) and in Jest.
  - **Duplicate protection.**
    - Match on content (same day, type, minutes and RPE): blocks two genuine identical sessions.
    - **A UUID generated in the app per entry, stored as a nullable unique `clientId` (chosen):**
      a retry returns the stored row.
  - **Noticing the signal is back.**
    - NetInfo: an event on reconnect, but one more native dependency, and "connected" does not
      mean the API is reachable.
    - **Retry when a send fails, when the app returns to the foreground, and on a timer
      (chosen):** 5, 10 and 20 s, then every 30 s, while anything is waiting. Each send gives up
      after 15 s.
- Evidence from the spike:
  - The web bundle builds and uses `localStorage` and `crypto.randomUUID`.
  - A fake-timer test reconnects just after a send has hung and syncs within 59 s. The same test
    fails if the longest wait is raised to 120 s.
  - Worst case by argument: a 15 s timeout plus a 30 s wait, about 45 s plus one send.
- Decision:
  - **Queue:** one AsyncStorage queue per user. Each entry is stored before it is sent and removed
    only after a 2xx.
  - **Retries:** 400, 403, 404 and 409 are dropped and the athlete is told why. 5xx, 401, 408,
    429, timeouts and no signal are retried.
  - **API:** `POST /sessions` and `POST /wellness` return the stored row with 200 for a replayed
    `clientId`, including after a unique-index race. Another athlete's `clientId` gives 409. The
    first write wins.
  - **Dependency and migration:** adds `expo-crypto`. Migration
    `20261125120000_offline_sync_client_id`.
- Consequences:
  - Nothing syncs while the app is in the background, because timers stop. AC2 holds only while
    LoadWise is open (see `requirements-changes.md`).
  - Queued health data sits unencrypted on the device until it syncs, and stays after sign-out
    (I-17).
  - Rows saved before #6 have a null `clientId`.
  - The unique index and the race path are not yet tested against real PostgreSQL (I-2).

---

## DL-022: Role-to-data access matrix for staff (#11) and combined load for staff (#8)

- Date: 25 Nov 2026
- Status: Proposed (Peter chose the need-to-know matrix and "combined totals only" on 25 Nov;
  Claude Code chose the enforcement design, the 404 rule and where the matrix lives. Peter to
  accept)
- Context: staff must see only consenting athletes' data, and only what their role needs (FR 4,
  NFR 2). DL-002 left the role-to-data mapping open for #11. #8 needs each squad's staff to see an
  athlete's load from all their squads.
- Options considered:
  - **Matrix.**
    - **Need-to-know (chosen by Peter):**
      - COACH: load, flags and wellness status only.
      - SC_COACH: as COACH, plus monotony and strain and individual wellness scores.
      - PHYSIO: everything, including injury records.
    - Simple split: only injury data restricted.
  - **Enforcement.**
    - Checks written into each controller.
    - A different response shape per role on each endpoint.
    - **One pure matrix with one data category per endpoint, enforced by a guard (chosen).**
  - **Combined load (#8).**
    - **Totals and metrics only (chosen by Peter).**
    - Every session the athlete logged, including other squads'.
- Decision:
  - **Matrix:** `STAFF_DATA_ACCESS` in `packages/shared`, so the app's sharing explanation shows
    the same rule the API enforces.
  - **Guard:** `@RequiresStaffAccess(category)` runs before body validation and fails closed. On
    every request it checks against the database, in this order:
    1. the viewer is staff in the squad (404 if not, so squad ids cannot be probed);
    2. the viewer's role allows the category (403);
    3. the athlete is an ATHLETE member of the same squad with `consentGiven = true` (403).
  - **Caching:** none, so a withdrawal applies on the next request.
  - **Error messages:** one shared message, with no personal data.
  - **Injuries:** belong to the athlete (DL-002). A minimal physio-only record path was added so
    AC1 and AC2 can be tested.
- Consequences:
  - Tested for 4 roles × 3 endpoints × 7 cases, against a fake Prisma only (I-2).
  - NFR 2.2 says these cases "each return 403", but a non-member gets 404 (I-16).
  - Coach wellness status will come through the flags and #10 overview endpoints.
  - Two open questions: injury notes are visible to physios in every squad the athlete shares with
    (I-14), and staff roles are self-declared (I-15).
  - #10 needs a "consenting athletes this viewer may see" list method.

---

## DL-021: Per-squad consent changes through one transactional service method (#3)

- Date: 25 Nov 2026
- Status: Proposed (drafted by Claude Code. Peter to accept)
- Context: DL-002 keeps an append-only `ConsentEvent` history and a cached
  `Membership.consentGiven`, and CLAUDE.md requires them to change together in one tested
  method. #3 AC3 requires withdrawal to remove access immediately.
- Options considered:
  - **Write an event on every request.** The history fills with repeats.
  - **Check, then write.** Open to a race between two requests.
  - **A conditional `updateMany` (`consentGiven = !share`), plus an event only if a row changed,
    in one `$transaction` (chosen).**
- Decision: `SquadConsentService.setConsent` is the only writer.
  - It reads the caller's own membership from the token: 404 if there is none, 403 if it is not an
    ATHLETE membership.
  - Granting needs health-data consent (DL-008); withdrawing never does.
  - Repeated or concurrent identical requests write one event.
  - Route: `PUT /squads/:squadId/consent` with body `{ share }`.
- Consequences:
  - The history holds only real changes.
  - Concurrency safety relies on PostgreSQL re-checking the UPDATE's condition under READ
    COMMITTED. This is not yet tested against a real database (I-2).
  - Withdrawing health-data consent or deleting an account (#14) must also withdraw every squad
    consent through this method (I-17).

---

## DL-020: Wellness flag details and how flags are shown (#9)

- Date: 25 Nov 2026
- Status: Proposed (drafted by Claude Code from DL-007 and an independent review. Peter to accept)
- Context: DL-007 fixes the thresholds (ACWR above 1.5; wellness more than 1.5 SD below a 28-day
  baseline with at least 14 check-ins) but leaves several details open. CLAUDE.md requires every
  flag to show its reason, value and threshold, with no diagnostic or advice wording.
- Options considered:
  - A combined wellness score, or **one baseline per item (chosen; DL-007 says "each item")**.
  - Population SD, or **sample SD (n−1) for the baseline (chosen; it estimates normal variation
    from a sample)**. #7's monotony uses population SD, because it describes one complete week.
  - When SD is 0: suppress the flag, or **flag any score below the mean (chosen, for now)**.
  - An empty flag list meaning "fine", or **the response saying which checks actually ran
    (chosen)**.
- Decision:
  - **Boundaries:** strict. ACWR of exactly 1.5, or a score exactly 1.5 SD below the baseline,
    does not flag.
  - **Wellness flag:** needs a check-in today and a baseline of at least 14 check-ins.
  - **`checks`:** `GET /me/flags` returns `checks: { acwr, wellness }`, and the app says "Nothing
    has been flagged today" only when both checks ran.
  - **Display:** `flagDisplay()` rounds value and threshold so they never appear to contradict
    the flag. For example, 1.504 shows as "1.504, above the 1.5 guide".
  - **ACWR flag:** reuses #7's `MetricsService`, so it always matches `GET /me/load`.
  - **Wording:** a guard test rejects advice and prediction wording.
- Consequences:
  - An athlete who always gives the same score is flagged after a one-point drop. This is a
    hypothesis for the Sprint 4 flag spike (I-20).
  - The flag reason uses "SD", which needs checking in the usability test (#44).

---

## DL-019: Load metrics and flags are calculated on request, not stored

- Date: 25 Nov 2026
- Status: Proposed (Peter chose this on 25 Nov; TODO: Peter: add your reason)
- Context: NFR 3.3 needs metrics and flags to reflect a new entry within 60 s. CLAUDE.md says
  derived values are not stored without a measured reason. The design plan mentioned pg-boss
  recalculation, and the `Flag` table already exists.
- Options considered:
  - **Calculate on each request (chosen).** Always current, no stored health data, a threshold
    change applies at once. Costs CPU on every request.
  - **pg-boss job recalculates and stores metrics and flags after each entry.** Faster reads, but
    adds a worker, a table and stale-data cases.
  - **Cache.** Same staleness questions, with no measurement yet showing it is needed.
- Decision:
  - `GET /me/load`, `GET /me/flags` and `GET /me/wellness-trend` call `@loadwise/analytics` on
    each request.
  - `GET /me/load` reads the athlete's whole session history, because every EWMA value depends on
    every day since the first session.
  - The API owns "today" as the Europe/London date through an injectable clock.
  - No pg-boss, and the `Flag` table stays unused.
- Consequences:
  - There is no flag history or acknowledgement until storing is justified.
  - #10's 40-athlete overview (NFR 3.1, p95 under 2 s) must be measured with k6 before choosing
    caching or stored values.

---

## DL-018: Swappable ACWR models (strategy pattern), EWMA by default

- Date: 25 Nov 2026
- Status: Proposed (drafted by Claude Code. Peter to accept)
- Context: FR 2 and DL-007 fix EWMA ACWR. The coupled rolling average is the common alternative,
  and the Sprint 4 flag spike may compare the two. Ch4 and Ch5 need a design pattern that solves a
  real problem.
- Options considered:
  - **EWMA in one function.** Simplest, but changing the model means changing every caller.
  - **A configuration flag with if/else.** The branching spreads across callers and tests.
  - **Strategy pattern (chosen).** An `AcwrModel` interface with `EwmaAcwr` and `RollingAcwr`,
    passed into `loadSummary`, with EWMA as the default.
- Decision:
  - **Shared null rules:** both models return null before 28 days since the first session
    (DL-007), and when chronic load is 0.
  - **EWMA:** λ = 2/(N+1), with N = 7 for acute and N = 28 for chronic. Both averages start at 0
    on the day before the first session (DL-007 does not specify this).
  - **Response:** names the model used.
- Consequences:
  - A model can be swapped or compared without touching the API or the app.
  - The zero start makes steady training read about 1.14 at day 28 rather than 1.0, moving early
    ACWR towards the 1.5 guide (I-12).
  - Monotony and strain appear from the first session, counting earlier days as zero (I-13).
  - An independent review recomputed four fixtures by hand and found them correct.

---

## DL-017: Claude Code reads and updates the GitLab backlog through the glab CLI

- Date: 25 Nov 2026
- Status: Accepted (options drafted by Claude in chat; Peter chose glab on 25 Nov)
- Context: GitLab on gitlab-se is the backlog and the assessed record of issues, milestones and
  merge requests (DL-011, DL-013). Claude Code could not read it, so issue text had to be copied in
  by hand, which slowed down story work. Peter asked whether the issues could be copied to the
  personal GitHub mirror so Claude Code could read them there.
- Options considered:
  - **Mirror the issues to GitHub.** GitHub only imports code from GitLab, not issues, so this
    needs a sync script. Two backlogs would drift apart, and the module requires gitlab-se as the
    record, so a stale read-only copy would weaken the Ch2 evidence.
  - **Copy issue text into prompts by hand.** No setup, but slow and error-prone.
  - **GitLab CLI (`glab`) on the laptop (chosen).** Claude Code in VS Code runs locally and can
    already reach gitlab-se, so it can read issues and acceptance criteria, open merge requests
    and check pipelines directly. GitLab stays the single record.
- Decision: `glab` 1.133.0 installed with winget and signed in to gitlab-se with a legacy personal
  access token (`glab-cli`, `api` scope, expires 31 Dec 2026), stored in the Windows keyring rather
  than a file. The local `CLAUDE.md` sets the rules: Claude Code reads issues, merge requests and
  pipelines freely; it opens merge requests only when Peter says so in that session; merging,
  closing or relabelling issues and changing milestones only when Peter explicitly asks; it never
  touches project settings, CI variables or the token.
- Consequences: issue context reaches Claude Code without copying, and merge requests are opened
  with `Closes #<id>`, so issue history stays accurate. The token must be renewed before
  31 Dec 2026. A broad `api` token on the laptop is a new secret to protect (R15); it was typed
  only into the `glab` prompt and never into a chat.

---

## DL-016: From two-week Scrum sprints to Kanban-style continuous flow

- Date: 25 Nov 2026
- Status: Accepted (Peter's decision, 25 Nov; written up by Claude in chat at his request)
- Context: Sprints 1 and 2 both ended in a cliff rather than a slope: in Sprint 2 there was one
  commit from 11 to 19 Nov and 35 on 20 Nov, and 9 of 14 committed points were delivered. Project
  time is irregular: Thursdays are freelancing, other modules have deadlines on 7 and 8 Dec and an
  exam on 17 Dec, and work arrives in bursts when Peter has a free afternoon. Fixed two-week
  commitments kept being missed and re-planned (Sprint 1 extended, Sprint 2 shortened, Sprint 3
  extended to 13 Dec), so the sprint dates were recording slippage rather than guiding work.
- Options considered:
  - **Keep two-week Scrum.** Matches the Problem Specification and gives clean burndowns, but the
    commitments do not fit irregular capacity, and two sprints show the same end-loaded pattern.
  - **One-week sprints.** More frequent checkpoints, but more planning overhead for the same
    irregular capacity.
  - **Kanban-style continuous flow (chosen).** Stories are pulled in priority order from the
    GitLab board when there is time, built (often with several Claude Code sessions in separate
    git worktrees), and merged only after Peter has reviewed each merge request himself.
- Decision: no sprint end dates or per-story dates from 25 Nov. Kept: the GitLab board and
  issues, the priority order (#7, #9, #2, #3, #11, #6, #8, #10, then #12 to #14), the agreed
  fallbacks (#10 as a simple list, #6 as a simplified queue; #3 and #11 never cut), the merge
  request and Definition of Done rules, and the fixed deadlines (interim video 18 Jan 2027, final
  submission 19 Apr 2027). One limit replaces the sprint commitment: merge requests are reviewed
  and merged one at a time, and Peter must be able to explain each one before merging. A short
  review (what merged, what is blocked, one process change) still happens about every two weeks.
- Consequences: Ch2 evidence moves from burndowns to the board, cycle time (issue opened to
  merged), a cumulative flow chart from GitLab data and the periodic reviews; Sprint 1 and 2
  records stay as they are, as the evidence for this change. The "Sprint 3" milestone should be
  replaced by an "MVP: interim video" milestone due 17 Jan. Without sprint deadlines the only
  forcing date before January is the interim video, so the MVP (#1 to #11 on staging) must be
  watched against it (R11). Generating several stories in parallel raises the risk that merged code
  outpaces Peter's understanding of it (R16).

---

## DL-015: CI publishes the staging image; deploying it is one manual command

- Date: 20 Nov 2026
- Status: Accepted (proposed by Claude Code; Peter allowed Claude to make the recommended decision on 20 Nov)
- Context: #34 asks for CI to deploy `main` to staging. The deploy job needs its own Azure login (a
  service principal). Creating one failed with "Insufficient privileges": the QUB Microsoft tenant
  does not let students register applications. Without it, GitLab cannot change the Container App.
- Options considered:
  - **Use my own Azure login on the laptop runner.** Fully automatic, but my personal credentials
    would sit on the runner and be usable by any job, and the login expires and has to be renewed.
  - **Ask QUB IT, through the supervisor, for a service principal scoped to `loadwise-staging`.**
    The proper fix, but out of my control and probably slow.
  - **CI builds and publishes the image on every `main` pipeline; I deploy it with one command
    (chosen for now).** Every deployed image is built and tested by CI from a known commit, and the
    only manual step is choosing to release it. It does not meet "CI deploys `main`" as written.
- Decision: the `api-image` CI job builds the image on every branch (so a broken Dockerfile fails
  the merge request) and, on `main`, pushes it to Docker Hub tagged with the commit hash and
  `main`. Deploying is `az containerapp update` with that tag in Azure Cloud Shell (README).
  The image is built with Kaniko, which needs no Docker daemon, so the runner stays unprivileged.
  Ask for a service principal at the next supervisor meeting.
- Consequences: staging can lag behind `main` until I deploy, so the Definition of Done reads
  "deployed to staging" as "the merged commit's image is running on staging", checked with the
  `DEPLOYED_IMAGE` setting. #34's "CI deploys `main`" criterion stays open until a service
  principal exists. Kaniko's original project was archived by Google in 2025; the pinned version
  still works, but if it stops working the job moves to Docker-in-Docker or a maintained fork.

---

## DL-014: Host staging on Azure Container Apps, scaling to zero

- Date: 20 Nov 2026
- Status: Accepted (options drafted by Claude Code; Peter chose Container Apps on 20 Nov)
- Context: #34 deploys the API to Azure UK South staging from `main`. The API now builds as one
  container image (`apps/api/Dockerfile`), checked locally on 20 Nov (`GET /health` returned ok).
  NFR 5.3 asks that staging scales to zero replicas when idle and that all hosting stays within the
  Azure for Students credit (USD 100 for 12 months). NFR 3.5 asks for 99% monthly availability
  during the pilot.
- Options considered:
  - **Azure Container Apps (chosen):** runs the same image and can scale to zero replicas. With
    minimum replicas 0 there is no charge while idle, and the monthly free grant (180,000
    vCPU-seconds, 360,000 GiB-seconds, 2 million requests per subscription) covers staging use.
    HTTPS is included. The cost is a cold start of a few seconds on the first request after an idle
    period, which skews the first p95 sample in a k6 run (NFR 3.1) unless the test warms it up first.
  - **Azure App Service (Linux, container):** always on, so no cold starts. The free plan allows only
    one hour of runtime a day, and the paid plans bill every hour whether used or not, which works
    against NFR 5.3 and the credit.
  - **A virtual machine running Docker Compose:** full control, but patching, TLS and uptime become my
    job, and it bills continuously.
- Decision: Azure Container Apps on the Consumption profile, minimum replicas 0 and maximum 1 for
  staging. PostgreSQL 17 on Azure Database for PostgreSQL Flexible Server, Burstable B1ms, which
  Azure for Students includes free for 12 months (750 hours a month, 32 GB storage). The image is
  pulled from a private Docker Hub repository (`peterbryson/loadwise-api`) with a read-only token.
  Azure Container Registry is not used, because its cheapest tier bills monthly against the credit.
- Implementation (20 Nov 2026): created in resource group `loadwise-staging`. Three things differed
  from the plan:
  - **Region:** the Azure for Students subscription only allows five regions (Spain Central, Italy
    North, Denmark East, Austria East, Norway East), so UK South was refused. Norway East was chosen:
    an established region with both services, in the EEA, so hosting health data there is covered by
    the UK's adequacy regulations for the EEA. Latency from Belfast is about 30 to 40 ms.
  - **Registry:** the GitLab container registry (`gitlab-se.eeecs.qub.ac.uk:5050`) is not reachable
    from outside the university, so Docker Hub is used.
  - **Environment type:** the first environment was created as a Container Apps *express*
    environment by the preview CLI extension's default. Express kept dropping the private registry
    login, so the image could not be pulled. It was replaced with a standard environment created with
    `--enable-workload-profiles` (which express does not support), with the app on the free
    Consumption profile. `GET /health` on staging first returned ok at 15:07 on 20 Nov.
- Reason (written by Claude Code at Peter's request, agreed by Peter on 20 Nov): staging gets almost no
  traffic, so paying for an always-on host would spend the student credit on idle time. Scaling to
  zero meets NFR 5.3 directly, and the one cost, a slow first request after idle, only matters for
  load tests and the pilot, where it can be handled by warming up or raising minimum replicas.
- Consequences: staging should cost close to nothing while the student offer lasts. Burstable B1ms
  slows down when its CPU credits run out, which is acceptable for staging but must be checked
  before load tests. Load tests must warm the API first. For the March pilot, minimum replicas can
  be raised to 1 so the first request is never slow; that bills a small amount while it runs, and
  the cost is recorded at each sprint review (NFR 5.3). The deploy job runs on the laptop runner
  (DL-003), so deploys only happen while it is on.

---

## DL-013: Move the repository to the EEECS Software Engineering GitLab

- Date: 14 Nov 2026
- Status: Proposed
- Context: module staff said the CSC3032 project must use the Software Engineering GitLab
  (`gitlab-se.eeecs.qub.ac.uk`), not the main school GitLab (`gitlab.eeecs.qub.ac.uk`) where the
  project was created on 26 Oct. The backlog, sprint milestones and merge request history are process
  evidence for the interim video and Ch2, so they had to move with the code.
- Options considered:
  - **Push the repository with `git push --mirror`.** Keeps all commits, but leaves behind issues,
    milestones, labels, the board and merge requests.
  - **GitLab direct transfer between instances.** Moves everything, but needs a personal access
    token for the old instance.
  - **GitLab project export and import (chosen).** Moves the repository, issues, comments, milestones,
    labels, the board and merge requests in one file. It does not carry CI variables, runners, push
    mirrors or job logs.
- Decision: exported the project from `gitlab.eeecs.qub.ac.uk/40405392/loadwise` and imported it as
  `gitlab-se.eeecs.qub.ac.uk/40405392/loadwise` (private). The import matched the old project: 47
  commits (head `f7e5144`), 42 issues (32 open, 10 closed), 8 milestones, 27 labels, 7 merged merge
  requests, 1 board and 60 issue comments. The local `origin` now points to the new project.
- Consequences: the self-hosted runner (DL-003) and the push mirror to GitHub must be set up again on
  the new project. Pipeline history and job logs before 14 Nov stay on the old project only, so it
  should be archived rather than deleted. Issue and merge request links in old notes point to the old
  instance.

## DL-012: One error shape for the API, with validation per route

- Date: 4 Nov 2026
- Status: Accepted (Peter chose option A on 4 Nov)
- Context: the Sprint 1 plan asked for a global Zod validation pipe and a consistent error response
  format (#27). Each route validates against its own schema from `@loadwise/shared`, and unexpected
  errors used Nest's default handling, with nothing tested to stop internal details reaching the client.
- Options considered:
  - **A: keep the Zod pipe per route and add a global exception filter (chosen).** The schema each
    route uses stays explicit and traceable. One filter gives every error the same shape and turns
    anything unexpected into a generic 500.
  - **B: a global pipe with Zod-backed classes** (for example the `nestjs-zod` library). It matches the
    plan's wording, but needs a new dependency and a wrapper class for every request body.
- Decision: `HttpExceptionFilter`, registered with `APP_FILTER`, returns
  `{ statusCode, error, message }` for every error, plus `issues` for validation failures. Any
  exception that is not an `HttpException` returns 500 "Something went wrong". The server logs only
  the method, path and error type, because error messages can contain request data (NFR 2).
- Consequences: clients, including the mobile API client, can rely on one error shape. A 500's
  log line has no message, so debugging a production failure needs the error type and route, or a
  reproduction. The plan item is reworded from "global Zod validation pipe" to "Zod validation on
  every route".

---

## DL-011: Branching: merge requests for all code, direct pushes allowed for documentation only

- Date: 4 Nov 2026
- Status: Accepted (Peter's decision, 4 Nov)
- Context: The Sprint 1 plan said to protect `main` so it changes only through merge requests. On
  4 Nov GitLab showed `main` protected with force-push off, but Maintainers allowed to push directly.
- Options considered:
  - **Merge requests only:** every change, including docs, is checked by CI before it reaches `main`,
    and the history shows one consistent workflow. Costs a branch and an MR for small doc edits.
  - **Merge requests for everything except documentation-only changes (files in `docs/` and README files); direct pushes allowed for those
    (chosen):** small doc and record updates stay quick. A direct push is only checked by CI after it
    lands on `main`, and the rule depends on Peter following it rather than on GitLab enforcing it.
- Decision: Peter keeps the right to push to `main`, but only for documentation-only changes. Any
  commit touching code, tests, config, CI or dependencies uses a branch and a merge request.
  Force-pushing to `main` stays disabled.
- Consequences: The Definition of Done (reviewed merge request, CI green) still applies to every story.
  If a direct push breaks CI on `main`, fix it before other work.
  Reason in Peter's words: "I should be able to push to main if I want, when working on features I will
  take a branch and have a merge request then", narrowed the same day to "only changes to docs should be
  allowed for direct pushes to main". TODO: Peter: add any further reason for Ch2.

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
- Implementation (20 Nov 2026, #1; options chosen by Peter): a `HealthConsentEvent` table (action,
  `noticeVersion`, time) plus a cached `User.healthConsentAt`, written together by
  `MeService.giveHealthConsent` in one transaction. The client must send the current notice version
  (`HEALTH_DATA_NOTICE_VERSION` in `@loadwise/shared`). Health-data controllers use
  `@RequiresHealthConsent()` at class level, which returns 403 until consent is recorded. `GET /me`
  reports consent status so the app can send any user without it to setup (issue log I-7).

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
- Update (20 Nov 2026, after DL-013): the move to `gitlab-se.eeecs.qub.ac.uk` needed the runner
  registering again. A first attempt failed: running `gitlab-runner unregister --all-runners` to
  remove the old server's entry removed every registration in the container, including the new one,
  so the runner stopped picking up jobs and the !8 test job sat pending. Fixed by recreating the
  container (`gitlab/gitlab-runner`, `--restart always`, config in the `gitlab-runner-config`
  volume) and registering a new project runner (#213, Docker executor, `node:22`). The stuck job then
  ran and passed. Lesson: `--all-runners` ignores `--url`; remove a single runner by name or token.
  Sprint 1's three runner failures (image pull, timeout, no npm access) are the same trade-off: the
  runner is only as reliable as the laptop.

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
