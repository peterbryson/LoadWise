# LoadWise

**An intelligent training-load management platform for amateur athletes and coaches.**

Athletes log sessions (type, duration, session-RPE) and a daily wellness check in under a minute,
optionally adding wearable data. LoadWise calculates load metrics across every team an athlete
plays for, flags risky patterns against the athlete's own baseline, and an AI assistant explains the data
in plain language. Coaches, S&C coaches and physios see a squad view with role- and
consent-based access.

> CSC3032 Software Engineering Project, Queen's University Belfast · Peter Bryson (40405392)
> Status: **Sprint 1, project skeleton.** See [`docs/design-plan.md`](docs/design-plan.md) for the week-by-week plan.

---

## Repository structure

This is a **pnpm + Turborepo monorepo**: several apps and packages in one repo, sharing
TypeScript types, validation schemas and the analytics engine.

```
loadwise/
├── apps/
│   ├── api/                  NestJS REST API: auth guards, squads, sessions, flags, AI tools
│   │   ├── prisma/           Database schema (PostgreSQL via Prisma)
│   │   └── src/
│   │       ├── main.ts       Entry point
│   │       ├── app.module.ts Root module; each feature is its own module
│   │       └── health/       GET /health liveness check (example module + test)
│   ├── mobile/               Expo + React Native athlete app (generated in Sprint 2; see its README)
│   └── web/                  Next.js staff dashboard (Sprint 7, Should)
├── packages/
│   ├── analytics/            Pure load-metric functions: session load, EWMA ACWR, monotony, strain
│   └── shared/               Zod schemas + types used by API, app and dashboard
├── docs/                     Plan, decision log, risk register, AI log, sprint and meeting notes
├── .gitlab/                  Issue (user story) and merge request templates
├── .gitlab-ci.yml            CI: lint, typecheck, tests with coverage + JUnit reports
├── docker-compose.yml        Local PostgreSQL
├── turbo.json                Task pipeline (build, lint, typecheck, test, dev)
└── tsconfig.base.json        Shared TypeScript settings
```

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
| Mobile app | Expo + React Native (TypeScript), expo-sqlite offline queue |
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
pnpm install                       # installs every workspace; creates pnpm-lock.yaml
docker compose up -d db            # starts PostgreSQL on localhost:5432
copy .env.example apps\api\.env    # Windows (macOS/Linux: cp .env.example apps/api/.env)
pnpm --filter @loadwise/api prisma:migrate   # creates the tables (name the first migration "init")
```

Commit `pnpm-lock.yaml`. CI installs with `--frozen-lockfile` and fails without it.

### Everyday commands (from the repo root)

| Command | What it does |
| --- | --- |
| `pnpm dev` | Builds packages, then runs the API in watch mode on http://localhost:3000 |
| `pnpm test` | All tests, with coverage and JUnit reports |
| `pnpm lint` | ESLint across every workspace |
| `pnpm typecheck` | TypeScript checks across every workspace |
| `pnpm build` | Production builds |
| `pnpm --filter @loadwise/analytics test` | Run one workspace's tasks |

Check it works: `curl http://localhost:3000/health` should return `{"status":"ok", ...}`.

---

## How we work

This project follows the process in [`docs/design-plan.md`](docs/design-plan.md). In short:

- **Scrum, two-week sprints.** Backlog = GitLab issues (MoSCoW, story points, one milestone per sprint).
- **Definition of Done:** merged through a merge request from a feature branch, CI green (including
  coverage and error-handling tests), deployed to staging.
- **Branches:** `feat/<issue>-short-name`, `fix/...`, `refactor/...`, `docs/...`. `main` is protected.
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
| [`docs/ai-usage-log.md`](docs/ai-usage-log.md) | AI usage log (dissertation appendix) |
| [`docs/sprints/`](docs/sprints/) | Sprint plans, reviews, retrospectives |
| [`docs/meetings/`](docs/meetings/) | Supervisor, study group, interview notes |
| [`docs/design/`](docs/design/) | Architecture, ERD, UML, wireframes |

## Disclaimer

LoadWise provides training-load decision support. It is not a medical device and does not
diagnose or predict injury. Pain or injury should always be referred to a physiotherapist or GP.
