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

## Progress note (3 Nov, for the review)

Facts from the repository on 3 Nov. Review results and the retrospective are Peter's to write.

Merged to `main`:

- Monorepo skeleton (pnpm, Turborepo), `/health` endpoint, `packages/analytics` session load, shared Zod schemas.
- Data model v1 and the init migration (DL-002, Proposed), with the ERD in `docs/design/erd.md`.
- GitLab CI (lint, typecheck, tests with coverage and JUnit) on a self-hosted runner (DL-003).
- #2, partly: create a squad and join by invite code, global auth guard with a swappable token verifier (DL-004).
- `pnpm test` on 3 Nov: 39 tests passing (9 analytics, 30 API).

Not done:

- #1 sign in: the API still uses `RejectAllTokenVerifier`, so no real user can call it yet.
- #2: no squad member list yet.
- Azure staging: moved to Sprint 2.
- Real PostgreSQL integration tests: the squad API tests fake the database, so constraints,
  transactions and real queries are not yet tested.

Design work: athlete app screens V1 in Figma, light and dark (see `docs/design/README.md`). Not user tested.

Known issues to log:

- `SessionType` is uppercase in Prisma (`TRAINING`) and lowercase in Zod (`training`). Fix
  decided: make `SessionTypeSchema` uppercase, matching Prisma and `StaffRoleSchema`, so no
  mapping or migration is needed. Do it at the start of #4; nothing uses the schema yet.
- `AuthService.authenticate` can return a 500 when two first sign-ins for the same Firebase user
  arrive together, or when the email is already linked to a different Firebase ID (unhandled
  unique-constraint error on `firebaseUid` or `email`). Found by reading the code, not by a test.
  Fix decided, with #1: on a unique violation on `firebaseUid`, read the user again and return it;
  on `email`, return 409 Conflict without the email in the message. Accounts are never linked by
  email, because that would let anyone with a matching email take over the account. Write the
  failing tests first.

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
