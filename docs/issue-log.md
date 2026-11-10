# Issue Log

Problems, bugs, known gaps and follow-up actions as they come up, newest first.
Peter reviews this list and decides what happens to each item. Raising a GitLab issue for an
entry is optional: if you do, put its number in the GitLab column.

Status: Open / Planned / Done / Won't fix.

| # | Found | Source | Issue | Status | GitLab |
| --- | --- | --- | --- | --- | --- |
| I-8 | 10 Nov 2026 | Ethics application (#33) | Ethics request sent to the supervisor on 10 Nov; approval not yet received. No interviews, usability testing or pilot until written approval is saved in the `Ethics` folder and noted in the meeting notes. If approval is delayed, agree the fallback (peer testing, synthetic evaluation) with the supervisor (R10). | Open | #33 |
| I-7 | 10 Nov 2026 | Navigation map (#29) | First-time setup (with the consent checkbox) is only shown after creating an account, so a returning user never sees it. When consent is stored (DL-008, #1 AC4), users without recorded consent must also be sent to setup. The Profile "Preview tools" link to setup should then be removed. | Open | |
| I-6 | 4 Nov 2026 | Supervisor meeting | Action: keep `docs/ai-usage-log.md` complete for all AI use. | Open | |
| I-5 | 4 Nov 2026 | Supervisor meeting | No weekly meeting slot agreed, and the ethics turnaround question from the plan is not recorded as asked. | Open | |
| I-4 | 4 Nov 2026 | Repository check | `docs/ai-usage-log.md` repeats five rows (2 Nov CI fix, the Figma row and the three 3 Nov rows). | Open | |
| I-3 | 4 Nov 2026 | Repository check | The Zod validation pipe is applied per route, not globally, and the API has no shared error response format. | Planned (Sprint 1 task) | #27 |
| I-2 | 3 Nov 2026 | Repository check | API tests fake the database, so constraints, transactions, cascades and real queries are untested until real PostgreSQL integration tests exist. | Open | |
| I-1 | 3 Nov 2026 | Code reading | `SessionType` is uppercase in Prisma (`TRAINING`) and lowercase in Zod (`training`). Decided fix: make `SessionTypeSchema` uppercase at the start of #4. | Planned (Sprint 2) | #36 |
