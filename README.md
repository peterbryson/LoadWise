# LoadWise

**An intelligent training-load management platform for amateur athletes and coaches.**

Athletes log sessions (type, duration, session-RPE) and a daily wellness check in under a minute,
optionally adding wearable data. LoadWise calculates load metrics across every team an athlete
plays for, flags risky patterns against the athlete's own baseline, and an AI assistant explains the data
in plain language. Coaches, S&C coaches and physios see a squad view with role- and
consent-based access.

> CSC3032 Software Engineering Project, Queen's University Belfast · Peter Bryson (40405392)
> Status (3 Nov 2026): **Sprint 1, week 2.** See [`docs/design-plan.md`](docs/design-plan.md) for the week-by-week plan.

### Current status

| Area | State |
| --- | --- |
| API | NestJS with `/health`, a global auth guard, and #2 create a squad and join by invite code (no squad member list yet) |
| Sign-in (#1) | API verifies Firebase ID tokens when `FIREBASE_PROJECT_ID` is set (checked by hand on 3 Nov with a real token). The app signs in with Firebase email and password. Setup consent is not stored yet (DL-008) |
| Database | Data model v1 and the init migration ([`docs/design/erd.md`](docs/design/erd.md)) |
| Analytics | Session load only |
| Mobile app | Expo app running in the browser on localhost: every Figma V1 screen in light and dark. Sign-in and squads are real; Today, Trends, flags and the logging forms are **labelled previews with sample data** (see [`apps/mobile/README.md`](apps/mobile/README.md)) |
| Staff dashboard | Not started (Sprint 7, Should) |
| CI | Lint, typecheck and tests on a self-hosted GitLab runner |
| Staging | **Not deployed.** Moved to Sprint 2 |
| Tests | 76 passing on 3 Nov (9 analytics, 48 API, 19 mobile). API tests fake the database; real PostgreSQL integration tests are still to do |

Remaining MVP work is built athlete-first, one complete feature at a time (DL-005).

---

## Repository structure

This is a **pnpm + Turborepo monorepo**: several apps and packages in one repo, sharing
TypeScript types, validation schemas and the analytics engine.

```
loadwise/
├── apps/
│   ├── api/                  NestJS REST API
│   │   ├── prisma/           Database schema and migrations (PostgreSQL via Prisma)
│   │   └── src/
│   │       ├── main.ts       Entry point
│   │       ├── app.module.ts Root module; each feature is its own module
│   │       ├── auth/         Global auth guard, @Public(), swappable TokenVerifier
│   │       ├── common/       Zod validation pipe
│   │       ├── health/       GET /health liveness check
│   │       ├── prisma/       PrismaService
│   │       └── squads/       #2 create a squad and join by invite code
│   └── mobile/               Expo + React Native athlete app (Expo Router, runs on web and phone)
├── packages/
│   ├── analytics/            Pure load-metric functions: session load, EWMA ACWR, monotony, strain
│   └── shared/               Zod schemas + types used by API, app and dashboard
├── docs/                     Plan, decision log, risk register, AI log, sprint and meeting notes, design
├── .gitlab/                  Issue (user story) and merge request templates
├── .gitlab-ci.yml            CI: lint, typecheck, tests with coverage + JUnit reports
├── docker-compose.yml        Local PostgreSQL
├── turbo.json                Task pipeline (build, lint, typecheck, test, dev)
└── tsconfig.base.json        Shared TypeScript settings
```

The staff dashboard (`apps/web`, Next.js) is planned for Sprint 7 and does not exist yet.

### Why it's split this way

- **`packages/analytics` has no framework code.** Every metric is a pure function, so it is
  tested against hand-calculated fixtures and can be reused by the API, background jobs and
  AI tools alike. The AI assistant never calculates anything itself (FR 3 guardrail).
- **`packages/shared` is the single source of validation.** The same Zod schema rejects an
  out-of-range RPE on the phone and in the API.
- **`apps/api` owns all permissions.** Role and consent checks run server-side in NestJS guards,
  never only in the client (NFR 2). Firebase holds login identity only, never health data.

The reasoning behind these choices is recorded in [`docs/decision-log.md`](docs/decision-log.md).

## Tech stack

| Layer | Technology |
| --- | --- |
| Mobile app | Expo + React Native (TypeScript), Expo Router, Firebase JS SDK; expo-sqlite offline queue planned (#6) |
| Staff dashboard | Next.js (Sprint 7) |
| API | NestJS (TypeScript), pg-boss background jobs |
| Database | PostgreSQL + Prisma |
| Auth | Firebase Authentication (identity only) |
| Validation | Zod (shared) |
| Testing | Jest, Supertest, React Native Testing Library, k6 |
| CI/CD | GitLab CI, Docker, Azure UK South |

---

## Getting started

### Prerequisites

- **Node.js 22+** (`node -v`)
- **pnpm** via Corepack: run `corepack enable` once (on Windows, in an Administrator PowerShell)
- **Docker Desktop** for the local database

### First-time setup

```bash
pnpm install                       # installs every workspace and generates the Prisma client
docker compose up -d db            # starts PostgreSQL on localhost:5432
copy .env.example apps\api\.env    # Windows (macOS/Linux: cp .env.example apps/api/.env)
copy apps\mobile\.env.example apps\mobile\.env   # Firebase web app settings for the app
pnpm --filter @loadwise/api prisma:migrate   # applies the committed migrations
```

`pnpm-lock.yaml` is committed. CI installs with `--frozen-lockfile`, so update the lockfile in
the same commit as any dependency change.

### Everyday commands (from the repo root)

| Command | What it does |
| --- | --- |
| `pnpm dev` | Builds packages, then runs the API on http://localhost:3000 and the app on http://localhost:8081 |
| `pnpm test` | All tests, with coverage and JUnit reports |
| `pnpm lint` | ESLint across every workspace |
| `pnpm typecheck` | TypeScript checks across every workspace |
| `pnpm build` | Production builds |
| `pnpm --filter @loadwise/analytics test` | Run one workspace's tasks |

Check it works: `curl http://localhost:3000/health` should return `{"status":"ok", ...}`, and
http://localhost:8081 should show the sign-in screen. Every other API route needs a Firebase ID token.

---

## How we work

This project follows the process in [`docs/design-plan.md`](docs/design-plan.md). In short:

- **Scrum, two-week sprints.** Backlog = GitLab issues (MoSCoW, story points, one milestone per sprint).
- **Definition of Done:** merged through a merge request from a feature branch, CI green (including
  coverage and error-handling tests), deployed to staging. Staging does not exist yet (Sprint 2),
  so that item is outstanding for every story so far.
- **Branches:** `feat/<issue>-short-name`, `fix/...`, `refactor/...`, `docs/...`. Everything except
  documentation-only changes (files in `docs/` and README files) goes through a merge request from its branch. Documentation-only changes may be
  pushed straight to `main`. `main` is protected against force-pushes (DL-011).
- **Commit messages:** conventional style, e.g. `feat(analytics): add EWMA ACWR (#7)`,
  `refactor(api): extract consent guard`.
- **Test names start with their requirement ID**, e.g. `describe('FR2: ...')`, so CI's JUnit
  output maps directly to a requirements traceability matrix.
- **Decisions** go in [`docs/decision-log.md`](docs/decision-log.md); **scope changes** in
  [`docs/requirements-changes.md`](docs/requirements-changes.md); **AI use** in
  [`docs/ai-usage-log.md`](docs/ai-usage-log.md).

## Project documents

| Document | Purpose |
| --- | --- |
| [`docs/design-plan.md`](docs/design-plan.md) | Week-by-week delivery plan and rubric evidence tracker |
| [`docs/decision-log.md`](docs/decision-log.md) | Technical decisions and spike outcomes |
| [`docs/risk-register.md`](docs/risk-register.md) | Risks, reviewed every sprint |
| [`docs/requirements-changes.md`](docs/requirements-changes.md) | Scope and requirement changes |
| [`docs/issue-log.md`](docs/issue-log.md) | Bugs, known gaps and follow-up actions, reviewed by Peter (GitLab issue optional) |
| [`docs/ai-usage-log.md`](docs/ai-usage-log.md) | AI usage log (dissertation appendix) |
| [`docs/sprints/`](docs/sprints/) | Sprint plans, reviews, retrospectives |
| [`docs/meetings/`](docs/meetings/) | Supervisor, study group, interview notes |
| [`docs/design/`](docs/design/) | Architecture, ERD, UML, wireframes |

## Disclaimer

LoadWise provides training-load decision support. It is not a medical device and does not
diagnose or predict injury. Pain or injury should always be referred to a physiotherapist or GP.
