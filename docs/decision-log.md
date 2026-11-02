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

## DL-002: Data model v1: athlete-owned health data and per-squad consent with history

- Date: 2 Nov 2026
- Status: Proposed (to discuss at the supervisor meeting on 4 Nov)
- Context: athletes play for several squads, and staff in each squad may only see data from
  athletes who consent, limited to what their role needs (FR 2, FR 4, NFR 2). Consent must be
  provable under UK GDPR Art. 7(1), and withdrawal must take effect on the next request.
- Options considered:
  - **Where health data lives:**
    - *Owned by the squad* (a session belongs to one squad). Simple squad queries, but an athlete's
      load would be split across squads, which defeats multi-team load (#8), and data logged
      outside a team has nowhere to go.
    - *Owned by the athlete*, with an optional `squadId` on sessions. One query gives total load
      across every team; squad views join through Membership. Chosen.
  - **How consent is stored:**
    - *A boolean on Membership.* Fastest to check in a guard, but overwriting it loses the history
      of when consent was given or withdrawn.
    - *Only an append-only ConsentEvent log.* Full history, but every staff request would have to
      find the latest event per athlete, which slows the squad dashboard (NFR 3: p95 under 2 s
      for 40 athletes).
    - *Both:* the event log is the record, and `Membership.consentGiven` is a cached current state
      written in the same transaction. Chosen: guards read one column, and history is kept.
  - **Granularity of consent:**
    - *Per data type* (e.g. share load but not wellness). Finest control, but adds a consent
      screen per squad per data type, which works against a quick sign-up (NFR 1).
    - *Per squad*, with role-based minimisation enforced in API guards (e.g. a coach sees load and
      flags, a physio also sees wellness and injuries). Chosen for the MVP; per-type consent can
      be added later as extra ConsentEvent fields if interviews show athletes want it.
- Decision: health data (sessions, wellness, injuries, flags) references the athlete. Consent is
  per squad membership, stored as an append-only ConsentEvent log plus a cached
  `consentGiven` flag. Computed metrics are not stored until #7 (Sprint 3); session load is always
  calculated by `@loadwise/analytics`. Flags store their value, threshold and reason so every flag
  can explain itself (#9).
- Consequences: deleting a user cascades to all their health data (#14). Two consent fields must
  be kept in step, so all consent changes go through one service method, which is tested.
  The role-to-data mapping still needs defining for #11. Offline-sync deduplication for sessions
  (#6) is left to the Sprint 2 spike; wellness is already protected by one entry per athlete per day.


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
