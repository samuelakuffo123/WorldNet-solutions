# 🤖 AI Usage — Final Audit Summary

**Team:** SEG26-76-1 WorldNet Solutions
**Project:** WorldNet Enterprise B2B Corporate Web Portal
**Status:** Final (D10 repository freeze, 28 August 2026)

This is the final AI usage audit for the project. The full chronological log lives in
[`AI_USAGE_LOG.md`](AI_USAGE_LOG.md) with a dated entry for every significant AI interaction
(21 entries, June 24 → August 21, 2026). This page summarises the project-wide picture.

---

## 1. How AI was used

AI tooling was used strictly as a **development and documentation assistant**. It never
replaced human understanding, client conversations, design decisions or review.

| Tool | Role in this project |
|---|---|
| ChatGPT | Research, documentation structure, security-audit checklist scaffolding, D8 templates |
| GitHub Copilot | Code suggestions, boilerplate generation, test-pattern suggestions |
| Claude / OpenCode | Report and presentation drafting, D9 handoff pack, IA9 analysis, CSS bug diagnosis |
| Gemini | Ideation and concept exploration (documented early in project policy) |

## 2. AI-assisted deliverables and PRs (highlights)

| Deliverable | AI involvement | Human verification |
|---|---|---|
| D1–D4 proposals, requirements, backlog | Structure/skeleton drafting | Team review; content from client interview |
| Sprint 1–4 implementation (D5–D8) | Copilot route/test scaffolding | PR reviews, CI, live testing, QA lead sign-off |
| D6 quality report | Template structure | Rebuilt with actual implementation evidence |
| D7 security audit | Checklist framework | Findings mapped to real code (bcrypt, JWT, rate-limit) |
| D8 release-candidate docs | Template structure | Cross-referenced with running app |
| D9 handoff pack (user manual, ops, install) | Full drafting assistant | All code references verified (server.js lines, test assertions) |
| IA9 security review | Section structure | Every claim verified against source (middleware, tests, commits) |
| CSS bug fix (Aug 21) | Diagnosis + one-line fix | Reproduced + verified via headless browser probe |
| Presentation deck | Slide-generation script | Facts drawn from git history and docs |

## 3. Human verification evidence

- **Automated tests:** `node --test tests/api.test.js` — coverage across auth, inquiries,
  consultations, workers, temp-password lifecycle, reports (23+ assertions validated).
- **CI pipeline:** `.github/workflows/ci.yml` gates merges (install → lint → build → test).
- **Code reviews:** branch-and-PR workflow mandated by Definition of Done; every PR merged via
  review (5+ merged PRs; all contributors' commits visible in history).
- **Manual checks:** browser walkthroughs of every role (visitor, worker, head, admin),
  deployment test on Render, UAT plan executed for the sprint-4 feature set.
- **Bug verification example:** the form click-blocking bug was reproduced with a headless
  Edge probe (`elementFromPoint` returned the overlay card), fixed with
  `pointer-events: none` on `.card::before`, then re-probed to confirm the input is hit-testable.

## 4. AI limitations / hallucinations encountered

- **Documentation placeholders:** early AI drafts contained generic text (e.g. "Java JDK
  prerequisite", "Team Elite") that did not match the real Express/Node stack or team name —
  these were caught in human review and corrected.
- **Code suggestions needing correction:** Copilot occasionally produced plausible-but-wrong
  route or test patterns; each was reviewed, corrected and verified before commit.
- **Known gaps flagged honestly:** AI was never used for requirements decisions, client
  conversations, or acceptance wording — those remain wholly the team's and the client's.

## 5. What is NOT in this repo

- No real client/staff records (synthetic seed data only).
- No passwords, tokens, API keys or `.env` files committed.
- No client private data was ever pasted into an AI tool.

---

*Signed by team ownership: all members listed in [`AI_USAGE_LOG.md`](AI_USAGE_LOG.md). Last audit: 28 August 2026.*