# AI Usage Log

Becomes the dissertation's "AI Usage Log" appendix. Update weekly. The aim is full
transparency: show what AI produced **and what you changed, rejected or verified**, since
that is the evidence of your own understanding.

| Date | Tool | Purpose (e.g. planning, debugging, boilerplate) | What it produced | What I changed / rejected / verified, and why |
| --- | --- | --- | --- | --- |
| 26 Oct 2026 | Claude | Planning: review of module rubric and guidelines against my Problem Specification | Gap analysis against the rubric; week-by-week delivery plan (`docs/design-plan.md`) | Gave it my Google Calendar so the plan reflects real constraints (CSC3067/CSC3045 deadlines on 7–8 Dec, 17 Dec exam, Thursday freelancing); corrected its reading of my calendar ("work"/"library" blocks are project time, not my part-time job); asked for a critical review of the plan, which added rolling dissertation drafts, UI/UX design work, a sustainability NFR and an ethics fallback. |
| 26 Oct 2026 | Claude | Boilerplate: initial monorepo skeleton and project documentation | pnpm/Turborepo config, NestJS API with `/health` endpoint and test, `packages/analytics` session-load function and FR2 tests, `packages/shared` Zod schemas, Prisma schema v0, GitLab CI, issue and MR templates, README, `docs/` templates (decision log with DL-001, risk register, etc.) | Ran `pnpm install`, `pnpm test` (11 tests passing, 100% analytics coverage), `pnpm lint` and `pnpm typecheck` locally; started the API and verified `GET /health` in the browser. Resolved the README merge conflict with GitLab's initial commit, keeping the project README. GitLab pipeline is stuck (no runner available), tracked as an issue rather than worked around. |
| 26 Oct 2026 | Claude | Tooling: local instructions file for Claude Code | `CLAUDE.md` with project conventions, safety rules and requirements summary | Decided to keep it local only (added to `.gitignore`). Spotted that the first `.gitignore` update had not actually been applied, and had it corrected before committing. |
