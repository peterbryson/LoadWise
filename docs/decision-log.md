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
