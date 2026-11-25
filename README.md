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
| MVP stories | All 11 built (25 Nov): #1 sign-in, #2 squads, #3 consent, #4 sessions, #5 wellness, #6 offline sync, #7 load metrics, #8 combined load, #9 flags, #10 squad overview, #11 role-based access. Not yet deployed to staging (I-19) |
| API | NestJS with `/health` and a global auth guard. `GET /me`, `POST /me/health-consent`, `POST`/`GET /sessions` and `POST /wellness` (idempotent by `clientId`), `GET /me/load`, `GET /me/flags`, `GET /me/wellness-trend`, squads (create, join, list, members), `PUT /squads/:squadId/consent`, and role-based staff access to one athlete's wellness and injuries (DL-022) |
| Sign-in (#1) | Firebase email and password in the app; the API verifies Firebase ID tokens. Health-data consent is recorded at setup and required for every health-data route (DL-008) |
| Database | PostgreSQL with three migrations (init, health-data consent, offline-sync `clientId`) ([`docs/design/erd.md`](docs/design/erd.md)) |
| Analytics | Session load, weekly load, usual week, EWMA ACWR (rolling ACWR as a swappable alternative, DL-018), monotony, strain, wellness baselines and flag rules (DL-007, DL-020). Calculated on each request, never stored (DL-019) |
| Mobile app | Expo app on localhost (web). Real: sign-in, setup consent, wellness check, session logging with an offline queue, Recent sessions, the Latest session card and flags on Today, Trends (weekly load, ACWR, wellness trend), the flag screen, My squads with per-squad sharing, and the squad members list. Today's load figures are still sample data (I-23) |
| Staff views | In the mobile app: squad overview (#10), squad members, and an athlete's combined load (#8). The separate web dashboard is a later Should |
| CI | Lint, typecheck and tests on a self-hosted GitLab runner on the laptop. The API image builds only when an image input changes. Tests can time out when the laptop is busy (I-18) |
| Staging | Azure Container Apps, Norway East (DL-014). Still runs the 20 Nov build; the 25 Nov work, including a migration, is not deployed yet (I-19) |
| Tests | 659 passing on `main` on 25 Nov (pipeline 8167: 133 analytics, 344 API, 182 mobile). API tests fake the database; real PostgreSQL integration tests are still to do (I-2) |

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
│   │       ├── access/       #11 role-to-data policy and StaffAccessService (squad, role and consent checks)
│   │       ├── squad-athletes/ #11 staff views of one athlete: wellness scores, injuries
│   │       └── squads/       #2 create, join and list squads; #3 per-squad consent
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
| Mobile app | Expo + React Native (TypeScript), Expo Router, Firebase JS SDK; AsyncStorage offline queue with a client UUID per entry as the idempotency key (#6) |
| Staff dashboard | Next.js (Sprint 7) |
| API | NestJS (TypeScript). pg-boss background jobs are planned but not used: metrics are calculated on request (DL-019) |
| Database | PostgreSQL + Prisma |
| Auth | Firebase Authentication (identity only) |
| Validation | Zod (shared) |
| Testing | Jest, Supertest, React Native Testing Library, k6 |
| CI/CD | GitLab CI, Docker, Docker Hub, Azure Container Apps (Norway East) |

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
| `pnpm --filter @loadwise/api perf:overview` | NFR 3.1: times the squad overview for 40 synthetic athletes with a full season, against the local database (`docker compose up -d db`, migrations applied). Opt-in, not part of `pnpm test` or CI; removes its own data afterwards |

Check it works: `curl http://localhost:3000/health` should return `{"status":"ok", ...}`, and
http://localhost:8081 should show the sign-in screen. Every other API route needs a Firebase ID token.

### Run the API in Docker

The API also builds as a container image (`apps/api/Dockerfile`), the same image the Azure staging
deploy will use (#34, DL-014). Stop `pnpm dev` first, because both use port 3000.

```bash
docker compose --profile api up --build   # builds the image, starts Postgres and the API
curl http://localhost:3000/health         # should return {"status":"ok", ...}
```

The container applies committed migrations on start (`prisma migrate deploy`), reads its settings
from `apps/api/.env`, and reaches Postgres as `db`.

### Deploy to staging

Staging runs this image on Azure Container Apps in Norway East (DL-014):
https://loadwise-api.ashygrass-5399f68d.norwayeast.azurecontainerapps.io/health

Every pipeline on `main` builds the image and pushes it to Docker Hub as
`peterbryson/loadwise-api:<short commit hash>` (the `api-image` job). Deploying it is one command
in Azure Cloud Shell, because the university's Microsoft tenant does not allow a CI login for Azure
(DL-015):

```bash
az account set --subscription "Azure for Students"
TAG=<short commit hash from the pipeline>
az containerapp update -g loadwise-staging -n loadwise-api \
  --image docker.io/peterbryson/loadwise-api:$TAG --set-env-vars DEPLOYED_IMAGE=$TAG -o none
curl -s https://loadwise-api.ashygrass-5399f68d.norwayeast.azurecontainerapps.io/health
```

The first request after an idle period takes a few seconds, because staging scales to zero.
The container applies any new migrations to the staging database when it starts.

---

## How we work

This project follows the process in [`docs/design-plan.md`](docs/design-plan.md). In short:

- **Scrum, two-week sprints.** Backlog = GitLab issues (MoSCoW, story points, one milestone per sprint).
- **Definition of Done:** merged through a merge request from a feature branch, CI green (including
  coverage and error-handling tests), deployed to staging (see "Deploy to staging").
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
| [`docs/non-functional-requirements.md`](docs/non-functional-requirements.md) | Measurable NFR targets and how each is verified |
| [`docs/issue-log.md`](docs/issue-log.md) | Bugs, known gaps and follow-up actions, reviewed by Peter (GitLab issue optional) |
| [`docs/ai-usage-log.md`](docs/ai-usage-log.md) | AI usage log (dissertation appendix) |
| [`docs/sprints/`](docs/sprints/) | Sprint plans, reviews, retrospectives |
| [`docs/meetings/`](docs/meetings/) | Supervisor, study group, interview notes |
| [`docs/research/interview-guide.md`](docs/research/interview-guide.md) | Interview goals, method and guides for athletes, coaches and physios |
| [`docs/design/`](docs/design/) | Architecture, ERD, UML, wireframes |

## Disclaimer

LoadWise provides training-load decision support. It is not a medical device and does not
diagnose or predict injury. Pain or injury should always be referred to a physiotherapist or GP.
