# LoadWise: Delivery Plan

> CSC3032 Software Engineering Project · Peter Bryson (40405392)
> Last updated: 3 Nov 2026 · Source of truth for weekly delivery. Update it at every sprint review.

There are 25 working weeks from 26 Oct to the **19 Apr 2027** submission. Each week lists what ships, what gets set up and which dissertation section gets written, so every rubric line has evidence by April. Work follows two-week Scrum sprints. Tick items off, and move anything that slips into the next week with a note in the sprint review.

---

## 1. Key dates

| Deadline | Date | Weight | Notes |
| --- | --- | --- | --- |
| Ethics application | Submit w/c 26 Oct | Gate | Blocks interviews, pilot and SUS testing |
| CSC3032 supervisor meeting | Wed 4 Nov, 14:00 | None | Agree a weekly slot; ask about ethics turnaround |
| CSC3067 baseline system demo | Mon 16 Nov | 10% of CSC3067 | Other module |
| CSC3067 final report and code | Mon 7 Dec | 40% of CSC3067 | Other module, clashes with Sprint 3 |
| CSC3045 assignment | Tue 8 Dec | 40% of CSC3045 | Other module, clashes with Sprint 3 |
| CSC3067 exam | Thu 17 Dec | 40% of CSC3067 | Only December exam |
| **Interim demo video** | **Mon 18 Jan 2027** | **20%** | Process and risk 5%, working system 10%, code and testing 5% |
| Full dissertation draft to supervisor | Fri 19 Mar 2027 | None | Leaves time for feedback before Easter |
| **Dissertation** | **Mon 19 Apr 2027** | **40%** | Ch1 10%, Ch2 to Ch6 15% each, Ch7 5%, presentation 10% |
| **Final system, repo and demo video** | **Mon 19 Apr 2027** | **40%** | Functionality 30%, product 30%, code quality 30%, live Q&A 10% |
| Live demo and Q&A | TBC, after 19 Apr | Part of system mark | 25 min with supervisor and second assessor |

**Capacity:** Thursdays are freelancing through May, so there are four project days a week at most. Re-measure velocity at every sprint review and re-plan against it.

---

## 2. Standing routines

### Every week

- [ ] Commit small and often through a feature branch and merge request (this matches the Definition of Done)
- [ ] Update the AI usage log: purpose, output, **what was changed or rejected, and why**
- [ ] Record any decision or spike outcome in `docs/decision-log.md`
- [ ] Write supervisor meeting notes in `docs/meetings/` on the same day, including actions taken on feedback
- [ ] Name every new test with its requirement ID (for example `describe('FR2: EWMA ACWR', …)`)
- [ ] Spend 30 minutes on dissertation notes in `docs/dissertation-notes.md`: what was built, why, and roadblocks hit

### Every sprint (two weeks)

- [ ] **Monday of week 1:** sprint planning. Pull stories into the milestone, estimate them, and write the sprint goal in `docs/sprints/sprint-N.md`
- [ ] **Friday of week 2:** sprint review (goal vs delivered, burndown screenshot, measured velocity) and a retrospective (one process change)
- [ ] Update the risk register (likelihood, impact, new risks)
- [ ] Attend a study group or get peer input, and record one piece of feedback and what it changed (Ch2 asks for this explicitly)
- [ ] Re-baseline the remaining plan against measured velocity

### Repository layout

```
apps/mobile          Expo + React Native
apps/api             NestJS REST API
apps/web             Next.js staff dashboard (Sprint 7)
packages/analytics   Pure load-metric functions
packages/shared      Zod schemas and types
docs/
  decision-log.md
  requirements-changes.md
  risk-register.md
  ai-usage-log.md
  dissertation-notes.md
  meetings/
  sprints/
  design/            wireframes, user flows, UML, ERD (diagrams as code)
```

---

## 3. Phase 1: Foundations and MVP (26 Oct to 13 Dec)

**Goal:** by 13 Dec, the 11 MVP stories (#1 to #11) run on staging with CI green. This is the system the interim video demonstrates.
**Delivery order (3 Nov, DL-005):** build athlete-first, one complete feature at a time (API, PostgreSQL and app screen together), instead of finishing the whole backend before the screens. The squad and staff stories (#2, #3, #8, #10, #11) are still Must stories for the MVP; only their order changes. See `requirements-changes.md`.
**Fallback, decided now:** if you are behind on 6 Dec, #10 ships as a simple list of consenting athletes with their flags and reasons (no trend charts), and #6 uses a simplified queue. Consent (#3) and role-based access (#11) are never cut. Record any cut in the decision log.

### Sprint 1: monorepo, API, data model, auth, CI (26 Oct to 8 Nov)

#### Week 1 (w/c 26 Oct): set up the backbone

About 25 hours of work and library blocks this week. Do these in order:

- [ ] Submit the ethics application, covering interviews (Nov), the pilot and SUS (Sprint 8), and peer usability testing
- [ ] Create GitLab issues for all 26 stories, with labels for MoSCoW, requirement (FR/NFR) and story points, plus an issue template with an acceptance criteria section *(issue template done)*
- [ ] Create milestones for Sprints 1 to 8 and set up the issue board columns
- [ ] Protect `main` (merge via merge request only) and add a merge request template with a self-review checklist *(MR template done)*
- [x] Scaffold the monorepo with pnpm and Turborepo (layout above)
- [x] Create the `docs/` folder and all the log files
- [x] Decision log entry 1: Firebase vs your own NestJS and Postgres backend (Ch4 tech justification)
- [ ] Set up the dissertation template now (Calibri 11pt, 1.5 spacing, 2.5 cm margins, 50-page limit for Ch1 to Ch7) and a reference manager (Zotero) loaded with the spec's references
- [x] README v1: purpose, architecture sketch, how to run, status
- [ ] Sprint 1 planning notes *(goal and story points done; setup tasks still need estimates)*

#### Week 2 (w/c 2 Nov): auth, data model, pipeline, staging

- [ ] **Supervisor meeting, Wed 4 Nov:** show the board and decision log. Ask about ethics turnaround and what testing is allowed without approval. Agree a weekly slot
- [x] Prisma schema v1: users, squads, memberships with roles, consent, sessions, wellness, injuries, flags. Get the many-to-many membership and consent model right
- [ ] Docker Compose for Postgres and the API
- [ ] NestJS Firebase ID-token guard, global Zod validation pipe and a consistent error response format
- [x] GitLab CI: lint, typecheck, Jest, coverage report and JUnit export
- [ ] ~~Deploy a health endpoint to Azure staging, automatically from `main`~~ *moved to Sprint 2, week 3 (see `requirements-changes.md`)*
- [ ] Ship **#1 sign in** in the API, as much as is realistic by 8 Nov: a Firebase `TokenVerifier` replacing `RejectAllTokenVerifier`, with valid and invalid token tests *(no Firebase verifier in the repo as of 3 Nov)*
- [ ] **#2 create a squad and invite**, with valid and invalid input tests *(create and join by invite code merged; the squad member list moves to Sprint 3, week 7)*
- [ ] Rewrite the NFRs with measurable targets, and **add a sustainability or wider-impact NFR** (for example LLM tokens per athlete per week, or data per sync)
- [ ] Wireframes and a navigation map for the athlete flows (log session, wellness check), in `docs/design/` (Ch4 UI/UX) *(Figma V1 screens in light and dark themes, linked from `docs/design/README.md`; navigation map not yet written)*
- [ ] Sprint 1 review: burndown, **measured velocity**, retrospective, and re-plan Sprints 2 and 3 if needed

### Sprint 2: athlete app, logging and offline sync (9 to 22 Nov)

#### Week 3 (w/c 9 Nov): Expo app, sign-in and wellness

- [ ] Generate the Expo app in `apps/mobile` (see its README) with the three-tab layout from the Figma V1 design (Today, Trends, Profile) *(started early on 3 Nov, DL-010: all V1 screens on localhost, most as labelled previews)*
- [ ] Finish **#1 sign in** end to end: Firebase sign-in in the app, token verified by the API, and explicit health-data consent at first-time setup recorded with its history (DL-008, new migration) *(app sign-in done on 3 Nov; consent storage and phone persistence still to do)*
- [ ] Ship **#5 wellness check**, saved through the API to PostgreSQL, timed under 60 seconds
- [ ] Deploy the API (health endpoint first) to Azure staging, automatically from `main` *(moved from Sprint 1; until it exists, "deployed to staging" stays an outstanding Definition of Done item)*
- [ ] 2-day time-boxed offline-sync spike at the end of the week, once #5 writes through the API (expo-sqlite queue vs alternatives). Write it up in the decision log (interim video material)
- [ ] Draft interview questions for coaches, physios and athletes
- [ ] Competitor table with pros and cons: Catapult, STATSports, Kitman Labs, Actimet, PlayerPulse, YouCoach, WHOOP, Strava (Ch1)

#### Week 4 (w/c 16 Nov): short week (CSC3067 demo Monday, London Friday to Sunday)

- [ ] CSC3067 baseline demo on Mon 16 Nov comes first
- [ ] Ship **#4 log session** (RPE 1 to 10, rejecting out-of-range values). First make `SessionTypeSchema` uppercase to match Prisma and `StaffRoleSchema`
- [ ] Session history as part of #4: a recent-sessions list opened from the "Latest session" card on Today
- [ ] Ship **#6 offline sync**, with no duplicates and sync within 1 minute, tested
- [ ] Use case descriptions: log session, wellness check (Ch3)
- [ ] Ch5 notes: offline sync design, roadblocks and the fix
- [ ] Book 3 to 5 interviews for w/c 23 Nov if ethics is approved
- [ ] Sprint 2 review and retrospective before Friday

### Sprint 3: analytics engine and staff views (23 Nov to 13 Dec, extended for coursework)

#### Week 5 (w/c 23 Nov): analytics engine, trends and flags

- [ ] `packages/analytics` as pure functions, test-first against hand-calculated fixtures: session load, weekly load, EWMA ACWR, monotony, strain
- [ ] Strategy pattern so rolling vs EWMA ACWR are swappable models (Ch4 and Ch5 design-pattern evidence)
- [ ] Write the #7 and #9 fixtures against the metric definitions in DL-007 ("usual week", 28-day baseline, when metrics first appear)
- [ ] Ship **#7 load metrics**, shown to the athlete, including a simple Trends tab: weekly load for the last 6 weeks and ACWR
- [ ] Ship **#9 flags**, each with its reason, value and threshold, shown to the athlete in plain language. Wellness 7-day averages against baseline on the Trends tab come with this story
- [ ] pg-boss metric recomputation when new data arrives
- [ ] Run user interviews and log every requirement they change
- [ ] Wireframes for the staff squad overview, informed by the interviews

#### Week 6 (w/c 30 Nov): coursework week

- [ ] CSC3067 report and code (Mon 7 Dec) and CSC3045 assignment (Tue 8 Dec) come first
- [ ] Weekly routines only
- [ ] If you get a spare evening: finish anything left over from week 5 in `packages/analytics` only

---

## 4. Phase 2: Finish the MVP, exam and interim video (7 Dec to 17 Jan)

#### Week 7 (w/c 7 Dec): submit coursework, then close Sprint 3

- [ ] Submit CSC3067 on Monday and CSC3045 on Tuesday
- [ ] Wednesday to Sunday, in this order:
  - Finish **#2**: the squad member list
  - Ship **#3 multi-squad membership and consent**, with consent-withdrawal tests
  - Ship **#8 combined multi-team load**
  - Ship **#11 role-based access** (a test for every role)
  - Ship a basic **#10 squad overview** (under 2 seconds for 40 athletes). Fallback: a simple list of consenting athletes with their flags and reasons
- [ ] Synthetic data generator (40 athletes, full season) for the demo and load tests
- [ ] Architecture diagram and ERD v1 from what is built; use cases for flag raised, staff review and consent
- [ ] Ch5 notes: analytics engine design, strategy pattern, test fixtures
- [ ] Sprint 3 review and retrospective, and tag `v0.1-mvp` by Sun 13 Dec

#### Effect of the 3 Nov reorder on later sprints

- No deadline and no Must story changes. The 13 Dec MVP goal and the interim video plan stay as they are.
- Week 7 now holds five Must stories (#2 finish, #3, #8, #10, #11) in the same week as the CSC3067 and CSC3045 submissions. The #10 fallback above is the first lever; consent and role-based access are not cut.
- Staff wireframes (week 5) still come before the staff work in week 7.
- The Sprint 4 flag spike (week 13) is where the placeholder 28-day baseline and 1.5 guide shown in the Figma designs get tested.

#### Week 8 (w/c 14 Dec): exam, then MVP review

- [ ] Revise for the CSC3067 exam on Thu 17 Dec
- [ ] MVP review with your supervisor (demo `v0.1-mvp`) on 14, 15 or 18 Dec. Minute it, and open an issue for each piece of feedback
- [ ] Fri 18 to Wed 23 Dec: fix bugs, and log known bugs as `bug` issues

#### Week 9 (w/c 21 Dec): Christmas

- [ ] Rest after 23 Dec

#### Week 10 (w/c 28 Dec): break

- [ ] Rest. Optional: draft the video script outline

#### Week 11 (w/c 4 Jan): stabilise and script

- [ ] Fix bugs only. Staging runs the exact build you will demo
- [ ] Load the synthetic squad data
- [ ] Write the video script, timed to the rubric:
  - **Part 1 (about 5 min):** aims, backlog and board, burndowns, risk register changes, GitLab tour (commits, merge requests, CI, README)
  - **Part 2 (about 10 min):** a perfect run of #1 to #11 cross-referenced to backlog IDs, plus the offline-sync spike result
  - **Part 3 (about 5 min):** analytics engine walkthrough (strategy pattern, pure functions), tests in CI, unhappy-path handling, known issues and how you will fix them
- [ ] Title slide: project title, name, student number

#### Week 12 (w/c 11 Jan): record and submit

- [ ] Record by Wednesday so there is time for a second take
- [ ] Check legibility, audio and that it runs 18 to 22 minutes
- [ ] Check the MP4 plays in VLC on a CSB lab machine
- [ ] **Submit by Mon 18 Jan**

---

## 5. Phase 3: Intelligence, Should items and pilot (18 Jan to 28 Mar)

**Goal:** by 28 Mar, Must stories #12 to #14 are done, the AI assistant passes its evaluation suite in CI, the chosen Should items are in, and real users have tested the system. **Feature freeze is 28 Mar.**
**Scope:** at the week 13 re-plan, commit to the Should items your measured velocity supports. Expect about half of the 52 points. Suggested order: #16 summary, #15 Q&A, #19 GPS CSV, #21 injuries and return to play, #23 web dashboard, then #18, #17, #22, #20 WHOOP. Record everything cut in `requirements-changes.md`.

### Sprint 4: flag spike and privacy (18 to 31 Jan)

#### Week 13 (w/c 18 Jan)

- [ ] Retrospective on the interim video and its feedback, logged as issues
- [ ] **January re-plan:** velocity so far, fix the Should list (above), re-baseline Sprints 4 to 8
- [ ] **Ethics check:** if not approved by now, switch to the fallback agreed with your supervisor (for example peer usability testing with the study group, plus synthetic-data evaluation) and record it as a risk response
- [ ] Flag spike: fixed thresholds vs personal-baseline z-scores on synthetic data. Record false-alarm and miss rates in the decision log
- [ ] Tune the #9 thresholds from the spike result
- [ ] **Dissertation: draft Ch1** (adapt the spec, add the competitor table, interview findings and project progression)

#### Week 14 (w/c 25 Jan)

- [ ] Ship **#14 delete account and data**, with a test proving the data is gone from the database
- [ ] Privacy hardening: encryption at rest confirmed, LLM pseudonymisation layer, data-minimisation review
- [ ] Security test suite: auth bypass, cross-squad access, withdrawn consent (NFR 2)
- [ ] **Dissertation: draft Ch3** (final backlog, MoSCoW, use case descriptions, measurable NFRs, requirements evolution)
- [ ] Sprint 4 review and retrospective

### Sprint 5: LLM spike, AI assistant and guardrails (1 to 14 Feb)

#### Week 15 (w/c 1 Feb)

- [ ] LLM provider spike: compare two or three providers with UK or EU processing on cost, latency, tool-calling quality and data terms. Record the decision with numbers
- [ ] Engine tools for the LLM (get metrics, get flags, get trends), so it can only state values the engine returns

#### Week 16 (w/c 8 Feb)

- [ ] Ship **#12 explain why I was flagged**, grounded in tool outputs only
- [ ] Ship **#13 pain or injury goes to a physio or GP referral**, 100% in evaluation scenarios
- [ ] System prompt guardrails (no diagnostic language) and logging of every response
- [ ] AI-insight use case, and Ch5 notes on the guardrail design
- [ ] Send Ch1 and Ch3 drafts to your supervisor for early feedback
- [ ] Sprint 5 review and retrospective

### Sprint 6: AI evaluation suite and summaries (15 to 28 Feb)

#### Week 17 (w/c 15 Feb)

- [ ] AI evaluation suite in CI: grounding checks, refusal checks, adversarial prompts (NFR 4)
- [ ] Ship **#15 ask the assistant questions** (if kept at the re-plan)
- [ ] **Dissertation: draft Ch4** (architecture, ERD with normalisation, class and sequence diagrams, UI/UX with wireframes and navigation map, tech justification)

#### Week 18 (w/c 22 Feb)

- [ ] Ship **#16 weekly squad summary**, cached rather than regenerated on each view
- [ ] Analytics coverage at least 80%, with CI failing below that
- [ ] Book the pilot squad for Sprint 8
- [ ] **Dissertation: draft Ch5** (strategy, modularisation, design patterns, 2 to 3 core features with snippets, roadblocks, refactoring)
- [ ] Sprint 6 review and retrospective

### Sprint 7: wearables, imports and dashboard (1 to 14 Mar)

#### Week 19 (w/c 1 Mar)

- [ ] Wearable spike: WHOOP OAuth, Catapult and STATSports CSV formats. Record the decision
- [ ] Ship **#19 GPS CSV import**, rejecting malformed files with a clear error, behind an adapter interface
- [ ] **Dissertation: draft Ch2** (process justification, GitLab practices, spikes, risk management, collaboration reflection)

#### Week 20 (w/c 8 Mar)

- [ ] Ship the remaining Should items committed at the re-plan, in priority order. Cut anything not started by Friday
- [ ] k6 load test scripts (40 athletes, full season, p95 under 2 seconds)
- [ ] Ch6 testing strategy section (can be written before the results)
- [ ] Sprint 7 review and retrospective, with the cut list recorded

### Sprint 8: pilot, SUS, load tests and feature freeze (15 to 28 Mar)

#### Week 21 (w/c 15 Mar)

- [ ] Pilot with the club squad (or the ethics fallback): real logging for at least a week
- [ ] Run k6 load tests and an OWASP ZAP scan. Record exact numbers against each NFR
- [ ] WCAG 2.2 AA check on the main screens
- [ ] **Send the full draft (Ch1 to Ch5, plus the Ch6 strategy) to your supervisor by Fri 19 Mar**

#### Week 22 (w/c 22 Mar)

- [ ] SUS questionnaires (target 70 or above) and timing of the 60-second logging target with pilot users
- [ ] Fix pilot bugs, and log what changed because of feedback
- [ ] **Feature freeze on 28 Mar.** Tag `v1.0-rc`
- [ ] Sprint 8 review and final retrospective

---

## 6. Phase 4: Evaluation, finishing and submission (29 Mar to 19 Apr)

Code changes are bug fixes only. Chapters 1 to 5 already exist as drafts, so these weeks go on evaluation, revision and the final video.

#### Week 23 (w/c 29 Mar, Easter)

- [ ] Generate the traceability matrix from the JUnit output: each FR and NFR mapped to its tests and results
- [ ] **Write Ch6:** results by level, NFR measurements (k6, ZAP, WCAG, SUS, sustainability metric), pilot findings, honest limitations, trade-offs and wider impacts
- [ ] **Write Ch7:** achievements against aims, critical reflection, future work as a strategic roadmap
- [ ] Apply the supervisor's feedback to Ch1 to Ch5

#### Week 24 (w/c 5 Apr)

- [ ] Final README: setup, architecture, test commands, deployed URL
- [ ] Record the final 20-minute video: intro (1 min), walkthrough cross-referenced to requirements (10 min), code and robustness (5 to 9 min)
- [ ] Full read-through. Check the 50-page limit for Ch1 to Ch7, and move extra use cases and tests to the appendices

#### Week 25 (w/c 12 Apr)

- [ ] Presentation pass: diagram resolution, captions, consistent Harvard or IEEE references, code attribution, AI Usage Log appendix
- [ ] Final proofread and PDF export
- [ ] Clean repository, tag the final commit `v1.0`, confirm the supervisor has access
- [ ] **Submit the dissertation, system and video by Mon 19 Apr**

#### After submission: live demo

- [ ] Two slides: the problem and users, and the architecture diagram
- [ ] Rehearse a 15-minute live run plus unhappy paths (bad CSV, out-of-range RPE, offline entry, withdrawn consent)
- [ ] Prepare answers: why EWMA, why not Firebase, how the AI is stopped from giving medical advice, what you would do with more time

---

## 7. Rubric evidence tracker

Check this at every sprint review. An empty artefact column in March means a capped mark.

| Rubric line | Top band asks for | Artefact that proves it | Started |
| --- | --- | --- | --- |
| Ch1 Context (10%) | Deep user analysis, critical comparison, direction changes explained | Competitor table, interview notes, decision log | Wk 3 |
| Ch2 Process (15%) | Process adapted to the project, CI/CD and branching, others improved the system | Sprint notes, burndowns, merge requests, meeting notes, study group log, feedback issues | Wk 1 |
| Ch3 Requirements (15%) | Measurable acceptance criteria, use cases, NFRs with numbers (including wider impact), justified scope changes | GitLab issues, use case docs, NFR targets, `requirements-changes.md` | Wk 2 |
| Ch4 Design (15%) | Patterns used correctly, professional UML and ERD, UX logic, choices linked to NFRs | Architecture diagram, class and sequence diagrams, ERD, wireframes and navigation map, decision log | Wk 2 |
| Ch5 Implementation (15%) | Design patterns, 2 to 3 complex features, roadblocks solved systematically | Strategy and adapter patterns, spike write-ups, refactor merge requests, dissertation notes | Wk 4 |
| Ch6 Testing (15%) | Every requirement traced to a result, measured security and performance, honest limitations | Requirement-ID tests, traceability matrix, k6, ZAP, WCAG, SUS, AI evaluation suite | Wk 2 |
| Ch7 Conclusion (5%) | Strategic roadmap, professional growth | Retrospectives, venture roadmap | Wk 2 |
| Presentation (10%) | High-resolution standard diagrams, precise writing, transparent AI log | AI log updated weekly, diagrams as code, template from week 1 | Wk 1 |
| System: Functionality (30%) | Achieves goals, advanced methods, major challenges overcome | Must and Should stories done, AI assistant, multi-team load | Wk 2 |
| System: Product (30%) | Usable as it is by the target community | Pilot results, SUS of 70 or above, WCAG, staging uptime | Wk 21 |
| System: Code quality (30%) | Exceptional implementation competency | Modular monorepo, lint rules, coverage of 80% or more, clean merge request history | Wk 1 |
| System: Live Q&A (10%) | Very high insight | Decision log rationale, rehearsed unhappy paths | Post 19 Apr |

---

## 8. Open questions

- [ ] Live demo date
- [ ] Any May exams
- [ ] Ethics approval turnaround and the no-approval testing route (ask on 4 Nov)
- [ ] Startup hours per week from November
- [x] What "usual week" means, how long the baseline is, and when metrics first appear to a new athlete: DL-007
- [x] General health-data consent at first-time setup: DL-008
- [x] Wellness scale: 1 to 5 with 5 as best and plain-language labels at each end (`requirements-changes.md`, 3 Nov)
