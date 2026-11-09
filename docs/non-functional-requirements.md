# Non-Functional Requirements

Measurable targets for NFR 1 to NFR 5, each with how and when it is verified. Source for
dissertation Ch3 (non-functional specification) and Ch6 (evaluation of non-functional attributes).

- **Status:** agreed, 9 Nov 2026. Targets marked **New** were proposed by Claude Code at Peter's request
  and confirmed by Peter on 9 Nov. Targets marked **Spec** come from the Problem Specification (Oct 2026).
- **Changes:** record every change to a target in `docs/requirements-changes.md`.
- **Thresholds are not clinical facts.** These are engineering targets for the software, not claims about
  athlete health.

## Test data used by the targets

- **Full season:** 40 synthetic athletes, each with 365 days of history: one wellness entry per day and
  5 sessions per week (about 14,600 wellness entries and 10,400 sessions per squad). Synthetic only,
  never real athlete data.
- **Staff load:** 10 concurrent staff users on the squad dashboard.

## NFR 1: Usability and accessibility

| ID | Requirement | Target | How it is verified | When | Origin |
| --- | --- | --- | --- | --- | --- |
| NFR 1.1 | Daily log time | An athlete completes the wellness check plus one session log in **60 s or less** (median), with at least 80% of timed attempts under 60 s | Timed task with at least 5 participants on a phone; peers if ethics approval is not in place | Sprint 2 (#5), pilot in Sprint 8 | Spec (60 s); New (median and 80%) |
| NFR 1.2 | Perceived usability | Mean **SUS score of 70 or more** | SUS questionnaire after the pilot, at least 5 participants | Sprint 8 | Spec |
| NFR 1.3 | Accessibility | Every screen meets **WCAG 2.2 AA**: 0 serious or critical automated violations; text contrast at least 4.5:1 (3:1 for large text and controls); touch targets at least 24 × 24 px; every control has a screen-reader label | axe on the Expo web build for each screen, plus a manual VoiceOver or TalkBack pass using a checklist | Each story's merge request; full audit in Sprint 8 | Spec (WCAG 2.2 AA); New (pass criteria) |

## NFR 2: Security and privacy

| ID | Requirement | Target | How it is verified | When | Origin |
| --- | --- | --- | --- | --- | --- |
| NFR 2.1 | Encryption | All API traffic over **TLS 1.2 or higher**, plain HTTP refused or redirected; database encrypted at rest | TLS check against staging; Azure database configuration recorded | Sprint 2 (#34 staging) | Spec |
| NFR 2.2 | Role, squad and consent access | **100%** of staff data endpoints have tests for every role, for another squad's athletes and for withdrawn consent, each returning 403; withdrawing consent removes access on the **next request** | API test suite in CI; real PostgreSQL integration tests once available | #3, #11 (Sprint 3) | Spec (consent-based access); New (100% and next request) |
| NFR 2.3 | Vulnerability scan | **0 high-risk alerts** in an OWASP ZAP baseline scan of staging | ZAP baseline scan, results saved in `docs/` | Sprint 8, repeated before submission | New |
| NFR 2.4 | AI data minimisation | Requests to the AI provider contain **no name, email, Firebase ID or free-text notes**, only a pseudonymous ID and the metrics needed; provider has UK or EU processing terms | Automated test asserting on the outbound request body | Sprint 5 (#12) | Spec (pseudonymised and minimised); New (test) |
| NFR 2.5 | No sensitive data in logs | **0** health values, tokens or email addresses in API logs | Test that captures log output during the API test suite and scans it | Sprint 4 | New |
| NFR 2.6 | Right to erasure | Deleting an account removes **all** of the user's personal data from the database and their Firebase account, immediately | Integration test proving the rows are gone (#14) | Sprint 4 (#14) | Spec (GDPR); New (immediately) |

## NFR 3: Performance, scalability and reliability

| ID | Requirement | Target | How it is verified | When | Origin |
| --- | --- | --- | --- | --- | --- |
| NFR 3.1 | Squad dashboard response | **p95 of 2 s or less** for one squad of 40 athletes with a full season of data, under 10 concurrent staff users | k6 load test against staging with the full-season data set | Sprint 3 (#10), Sprint 8 | Spec (2 s, 40 athletes); New (data set and users) |
| NFR 3.2 | Logging response | Saving a session or wellness entry: **p95 of 500 ms or less** under the same load | k6 load test against staging | Sprint 8 | New |
| NFR 3.3 | Metric freshness | Load metrics and flags reflect a new entry within **60 s** (p95) | Integration test timing entry to updated metric; k6 scenario | Sprint 3 (#7, #9) | Spec |
| NFR 3.4 | Offline sync | Entries made offline sync within **60 s** of reconnecting, with **0 duplicates** | Automated tests for the sync queue, plus a manual airplane-mode test | Sprint 2 or 3 (#6) | Spec |
| NFR 3.5 | Availability | **99% or more** monthly API availability (no more than about 7 hours down per month) | Uptime monitor polling `/health` every 5 minutes during the pilot month | Sprint 8 | Spec |

## NFR 4: Maintainability and AI quality

| ID | Requirement | Target | How it is verified | When | Origin |
| --- | --- | --- | --- | --- | --- |
| NFR 4.1 | Analytics test coverage | **80% or more** line and branch coverage for `packages/analytics` | Jest coverage threshold that fails the CI pipeline | Every commit | Spec |
| NFR 4.2 | API test coverage | **70% or more** line coverage for `apps/api` | Jest coverage threshold in CI | From Sprint 3 | New |
| NFR 4.3 | AI evaluation suite | At least **40 scenarios** covering grounding, refusal, adversarial prompts and pain or injury referral. **100%** of numbers in answers appear in engine tool output; **100%** of pain or injury scenarios give a physio or GP referral with no load advice; **0** diagnostic phrases from a fixed list | Deterministic evaluation suite run in CI | Sprint 6 | Spec (suite in CI); New (counts and pass rules) |
| NFR 4.4 | Code quality gate | **0** lint and type errors under strict TypeScript, no `any` | `pnpm lint` and `pnpm typecheck` in CI | Every commit | New (already in place) |
| NFR 4.5 | Dependency health | **0** known high or critical vulnerabilities in dependencies at each release | `pnpm audit` in CI | From Sprint 4 | New |

## NFR 5: Sustainability and wider impact

| ID | Requirement | Target | How it is verified | When | Origin |
| --- | --- | --- | --- | --- | --- |
| NFR 5.1 | AI inference use | Average of **10,000 tokens or fewer per athlete per week**; weekly squad summaries generated once per squad per week and cached, never regenerated on view | API records token counts per AI request (counts only, no content); weekly average reported from the pilot | Sprint 6, pilot in Sprint 8 | New |
| NFR 5.2 | Mobile data use | A daily log (wellness plus one session) uploads **5 KB or less**; the app makes **0 background network requests** while idle, because updates are event-driven rather than polled | Network inspector on the Expo app: one daily log, then 10 minutes idle | Sprint 2 (#4, #5, #6) | New |
| NFR 5.3 | Hosting cost and energy | Staging scales to **zero replicas when idle**, and the whole project's hosting stays within the **Azure for Students credit** | Azure configuration and monthly cost report recorded at each sprint review | From Sprint 2 (#34) | New |

## Traceability

Each user story's GitLab issue names the NFRs it supports with `NFR n` labels. Chapter 6 reports a
result for every ID above, including any not met and why.
