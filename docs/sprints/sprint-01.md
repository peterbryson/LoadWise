# Sprint 1: monorepo, API, data model, auth, CI

- Dates: 26 Oct to 8 Nov 2026
- Sprint goal: a deployed, tested API skeleton with sign-in and squads, and the project management backbone in place.
- Committed stories: #1 sign in (3), #2 create a squad and invite (5), plus estimated setup tasks.

## Planning

| Item | Points | Notes |
| --- | --- | --- |
| #1 Sign in | 3 | |
| #2 Create a squad and invite | 5 | |
| Setup: GitLab, CI, monorepo, staging | | estimate these too |

## Progress note (updated 4 Nov, for the review)

Facts from the repository and GitLab on 4 Nov. Review results and the retrospective are Peter's to write.

Merged to `main`:

- Monorepo skeleton (pnpm, Turborepo), `/health` endpoint, `packages/analytics` session load, shared Zod schemas.
- Data model v1 and the init migration (DL-002, Proposed), with the ERD in `docs/design/erd.md`.
- GitLab CI (lint, typecheck, tests with coverage and JUnit) on a self-hosted runner (DL-003).
- #2, partly: create a squad and join by invite code, global auth guard with a swappable token verifier (DL-004).
- #1 in the API: Firebase ID-token verifier with valid, invalid and expired token tests (DL-009), and the fix
  for concurrent first sign-in and email conflicts.
- Expo app started early (DL-010): Firebase sign-in in the app, three-tab layout and all Figma V1 screens,
  most as labelled previews.
- CI on `main` (pipeline for `05a1537`, 3 Nov): 76 tests passing, 0 failed.

Project management, set up 4 Nov:

- GitLab issues #1 to #26 for the backlog, labelled by MoSCoW, requirement and story points (also set as
  issue weight). Completed acceptance criteria are ticked on #1 and #2.
- Milestones for Sprints 1 to 8 with stories assigned. The issues were created on 4 Nov, so the Sprint 1
  burndown starts on 4 Nov, not 26 Oct.

Not done:

- #1: explicit health-data consent at first-time setup (DL-008) and keeping the sign-in on the phone.
- #2: no squad member list yet.
- Azure staging: moved to Sprint 2.
- Issue board columns.
- Real PostgreSQL integration tests: the API tests fake the database, so constraints,
  transactions and real queries are not yet tested.

Design work: athlete app screens V1 in Figma, light and dark (see `docs/design/README.md`). Not user tested.

Known issues to log:

- `SessionType` is uppercase in Prisma (`TRAINING`) and lowercase in Zod (`training`). Fix
  decided: make `SessionTypeSchema` uppercase, matching Prisma and `StaffRoleSchema`, so no
  mapping or migration is needed. Do it at the start of #4; nothing uses the schema yet.

Fixed since the 3 Nov note: `AuthService.authenticate` returning a 500 on a concurrent first sign-in or
an email already linked to another Firebase ID (now returns the existing user or 409; regression tests added).

Planning change: the remaining MVP work is reordered athlete-first (DL-005; see
`requirements-changes.md`).

## Review (Fri 6 Nov)

- Delivered vs committed:
- Measured velocity:
- Burndown: (screenshot)

## Retrospective

- What went well:
- What didn't:
- One change for Sprint 2:
