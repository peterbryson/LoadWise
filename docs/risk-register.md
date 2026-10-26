# Risk Register

Reviewed at every sprint review. Initial risks from the Problem Specification (Section 2.3).
Status: Open / Mitigating / Closed / Occurred.

| # | Risk | Likelihood | Impact | Mitigation | Status | Last reviewed |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | Users act on guidance and suffer injury or other health harm | Medium | High | Decision support only, no diagnostic claims; reasoning shown for every suggestion; refer pain or injury to physio or GP; thresholds tested (NFR 4); ethics approval before user testing | Open | 26 Oct 2026 |
| R2 | AI assistant gives inaccurate or unsafe output | Medium | High | Assistant states only engine tool values; no diagnosis; referral for pain or injury; flags from deterministic engine only; evaluation suite in CI; responses logged | Open | 26 Oct 2026 |
| R3 | Smart features overrun, leaving product incomplete | Medium | High | Rule-based engine and flags finished first (MVP); AI layered on top; no trained prediction model | Open | 26 Oct 2026 |
| R4 | Lack of real athlete data for testing | Medium | High | Synthetic data generator early; pilot with club squad after ethics approval | Open | 26 Oct 2026 |
| R5 | Health data is GDPR special category data | Low | High | Data minimisation, encryption, consent-based access, pseudonymised LLM data with UK/EU processing | Open | 26 Oct 2026 |
| R6 | Low logging compliance | High | Medium | Logging UX target (NFR 1), reminders, early user feedback | Open | 26 Oct 2026 |
| R7 | Competing time demands (modules, part-time work) | Medium | Medium | Two-week sprints with buffers around exams; MoSCoW; dashboard after mobile MVP | Open | 26 Oct 2026 |
| R8 | Illness or personal circumstances | Medium | Medium | Buffers; Should items dropped first; tell supervisor early | Open | 26 Oct 2026 |
| R9 | Wearable data unavailable | High | Medium | CSV import baseline; adapter layer; wearables optional | Open | 26 Oct 2026 |
| R10 | Ethics approval delayed, blocking pilot and SUS | Medium | High | Submit w/c 26 Oct; agree fallback (peer testing, synthetic evaluation) with supervisor; decide by 18 Jan | Open | 26 Oct 2026 |
| R11 | Sprint 3 overlaps CSC3067 and CSC3045 deadlines (7 and 8 Dec) | High | Medium | Sprint 3 extended to 13 Dec; scope fallback for #10 and #6 agreed in advance | Mitigating | 26 Oct 2026 |
