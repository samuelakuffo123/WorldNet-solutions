# 🤖 AI Usage Log

> *Transparency requirement per the team Definition of Done (DoD), item 7: all AI
> productivity tool usage is disclosed in the PR and logged chronologically here.
> We understand and review every AI suggestion, never expose client data, and
> treat AI as a collaborator, not a replacement.*

This log was reconstructed from repository metadata (git history on `main`, README
disclosures, and `scripts/README.md`). PRs and feature branches add new rows as work
is merged.

---

## 🔧 Tools & Primary Purposes

| Tool | Purpose |
|------|---------|
| ChatGPT | Learning, debugging, documentation |
| GitHub Copilot | Code assistance |
| Gemini | Idea generation |
| Claude | Documentation refinement |
| AI coding agent (CLI) | Full-feature implementation, refactoring, test writing, audit fixes |

---

## 📅 Chronological Log

| Date | Tool | Task / Feature | File(s) affected | Review & status |
|------|------|-----------------|------------------|-----------------|
| 2026-06-24 | ChatGPT / Gemini / Claude | Drafted team README banner, project story, backlog/structure docs | `README.md`, `scripts/README.md` | Reviewed by team before use |
| 2026-08-21 | AI coding agent | Hover-overlay bug fix on Contact/Consultation form inputs (`::before` swallowing clicks, `pointer-events: none`) | `src/public/css/styles.css` (via `70fc23b`) | Human-reviewed, merged |
| 2026-09-12 | AI coding agent | Audit fixes & report — hardened admin mutations, modal/a11y fixes, tracker status display, dead-file cleanup, team portal entry | `src/public/**`, `src/server.js` (via `ababbb2`) | Human-reviewed, merged |
| 2026-09-12 | AI coding agent | Security/production baseline — config/logger/validation/security modules, cookie+CSRF auth, first-run setup, audit logging, report file storage/retention | `src/*.js`, `src/public/**`, `tests/*.js` (via `b77608c`) | Human-reviewed, merged |
| 2026-09-12 | AI coding agent | 10-point production roadmap — a11y, record search/pagination, status history, report drafts, bulk status, demo-state persistence, QA scaffolding | `src/server.js`, `src/database.js`, `src/public/js/*`, `tests/*` (via `b77608c`) | Human-reviewed, merged |
| 2026-09-12 | AI coding agent | CI workflow drafted (push deferred until token gains `workflow` scope) | `.github/workflows/ci.yml` (local only, `725f08f` dropped it from push) | Pending token fix, then re-push |

---

*Logging convention: add a row whenever a PR merges AI-assisted changes. Keep the
file closed as academic coursework for WorldNet ICT Solutions Ltd.*