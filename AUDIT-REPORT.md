# WorldNet Service Portal — UI/UX & HCI Audit

**Author:** UI/UX design audit (HCI/UX review discipline)
**Scope:** Public site, admin console, worker portal, auth flows
(`src/public/*`, `src/public/admin/*`, `src/public/js/*`, `src/public/css/*`, `src/server.js`).
**Reviewed against:** master HCI/UX prompt (mental models, affordances, Norman cycle,
gulfs of execution/evaluation, Shneiderman's rules, consistency, IA, error prevention/recovery,
feedback, emotional design, accessibility, visual design, design system) and frontend-design guidance.

Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low · ⚪ Nit.

---

## Top issues (fix first)

1. 🔴 **Destructive actions without confirmation, inconsistently.** On the dashboard, delete
   Worker / Service / Portfolio fire straight `DELETE` with zero confirm (`admin.js:1031-1057`),
   while the Workers page uses `window.confirm` (`admin.js:1739`) and reports use confirm
   (`admin.js:1911`). One dashboard click wipes a record permanently — no undo anywhere in the
   system. Biggest gulf-of-evaluation + error-recovery violation.
2. 🟠 **Unhandled promise rejections = silent UI failure.** Dashboard event handlers
   (`admin.js:1024-1078`), department assignment-save (`admin.js:1803`), and report
   toggle/delete (`admin.js:1897-1916`) `await authApi(...)` with no try/catch. On network error
   or expired token nothing happens, no toast, button unresponsive.
3. 🟠 **`records.html?type=<bad>` renders an infinite spinner.** `renderRecordsPage`
   (`admin.js:1082`) leaves the "Loading records…" placeholder for any unknown `type`.
4. 🟠 **Consultation tracker lies about 4 of 5 statuses.** `app.js:380` maps status to only
   `pending` → "Pending" and everything else → "Viewed". Confirmed, completed, cancelled and
   withdrawn all display "Viewed".
5. 🟠 **Public forms are effectively anonymous to screen readers.** Bare
   `<label>Name</label><input name="name" required />` with no `for`/`id` association
   (`consultation.html:48` etc.) — no announced field names, no label-click focus.
6. 🟠 **Dead artifacts shipped in the public root.** `worldnet-homepage (3).html` and
   `worldnet-admin-dashboard (1).html` are abandoned Tailwind/Chart.js mockups (all `href="#"`).
   `faq.html` and `worker-login.html` are invisible 0-second redirect stubs. Registration and
   Google sign-in are fully dead code with no UI.

---

## A. Accessibility (WCAG)

- 🔴 **Modals trap no focus.** `credential-overlay` / `openProfileModal` set `role="dialog"` +
  `aria-modal` (`admin.js:222`, `worker.js:203`) but: no focus moved into the modal, no focus
  trap, background not `aria-hidden`, no Escape-to-close, no `aria-labelledby`.
- 🟠 **Hidden dropdown links are keyboard-focusable (desktop).** `.nav-dropdown-menu` is
  `opacity:0; pointer-events:none` but NOT `display:none` (`styles.css:176-200`) → invisible
  links are tab targets. (Mobile variant correctly uses `display:none`, `styles.css:1306`.)
- 🟠 **Status colors are the only differentiator AND semantically abused.** Categories render
  with the status class `new` (`admin.js:880,939,1106,1262`), so "Infrastructure" shows as an
  amber "new" pill — status color attached to a non-status meaning.
- 🟠 **No `role="status"` / `aria-live` on toasts** (`styles.css:1114`, `.wn-toast`) or
  `.form-status` — transient feedback is silent to screen readers.
- 🟡 **Emoji as icons without `aria-hidden`:** `👋`/`📅`/`＋` (`admin.js:592,596,666`), theme
  glyphs `☾☀◐`. Mixed emoji + SVG iconography.
- 🟡 **No skip-link** on public pages, login, or admin shells.
- 🟡 **Login footnote contrast fails:** `rgba(154,165,184,0.55)` at `0.72rem`
  (`admin.css:2949-2955`) ≈ 2.9:1; placeholder `rgba(170,183,208,0.55)` (`admin.css:2891`)
  also weak; activity-feed time `--wn-slate-400` at `0.72rem` (`admin.js:983`).
- 🟡 **`th` cells lack `scope="col"`**; tables lack captions / `aria-label`.
- 🟡 **Initials avatars** read by SR as words ("AK") (`admin.js:182`).
- 🔵 **No custom `:focus-visible`** for `.btn-wn` / `.icon-button` / `.row-menu-trigger`
  (only `.stat-card`, `admin.css:573`).
- 🔵 **Inline SVG icons** in `ICONS` generally lack `aria-hidden="true"`; icon buttons rely on
  `title` only.

**Positives:** `prefers-reduced-motion` handled in CSS (`styles.css:444`, `admin.css:3011`) and
JS (parallax/reveal gating, `app.js:476`); scroll-snap disabled under reduce-motion;
`aria-controls`/`aria-expanded` on hamburger; autofill styling handled (`admin.css:2895`).

---

## B. Interaction, feedback, error recovery (Norman cycle / Shneiderman)

- 🔴 No user control over destructive choices + no undo (Top 1).
- 🟠 Silent failures (Top 2).
- 🟠 **Rate-limit feedback is opaque.** Login/auth limits are 12 / 15 min (`server.js:24-26`);
  the 429 body is plain text, `res.json().catch(()=>({}))` swallows the real reason, user sees
  generic "Request failed" with an enabled retry button.
- 🟠 **Row-save pattern creates a gulf.** Status applies only after a per-row "Save"
  (`admin.js:906,928`); no dirty-state cue, no saving feedback, navigation silently discards.
- 🟡 **"New service" / "New portfolio item" CTAs deep-link to `/admin/dashboard.html`**
  (`admin.js:1097,1252`) — land at top of dashboard, not the content-studio form.
- 🟡 **"Mark all read" does N sequential PUTs** (`admin.js:569-581`); mid-loop failure leaves a
  partial state.
- 🟡 **Unread bell dot is stale until first open** — `loadNotifications` (which sets the dot) only
  runs on bell click (`admin.js:524-527`); dashboard `stats-notifications` is separate, so two
  unread counters disagree.
- 🟡 **Concurrent message noise**: form error shows inline status AND toast (`app.js:337-338`).
- 🔵 Good: validation summary lists exact missing fields (`app.js:337`)… but as raw snake_case
  names ("service_type").
- 🔵 Full-page reload per sidebar navigation; stats flash from `0` before populating
  (`admin.js:855-869`).
- ⚪ Admin sidebar collapsed-pref persists into mobile (`admin.js:493-503`).

---

## C. Information architecture & navigation

- 🟠 **Admin/worker portal has zero public entry points** — no "Team sign in" link anywhere on
  the public site; reachable only by guessing `/admin/login.html`; `worker-login.html` is an
  orphan stub.
- 🟡 **Sidebar "Overview" group contains all 8 items** (`admin.js:406-414`).
- 🟡 **Two portals, one URL.** `/api/login` routes by role (`admin.js:2100`) but worker.js also
  implements `/api/worker/login`; all post-login destinations for workers are `/admin/login.html`
  (`worker.js:385,548,563`).
- 🟡 **Deep-link integrity**: `/services/` with trailing slash silently 404s
  (`app.js:239-241`).
- 🔵 `faq.html` double redirection (meta refresh + JS).
- 🔵 **Status label vocabulary inconsistent:** tracker "Pending/Viewed" vs admin
  "new/contacted/resolved" vs worker "Submitted/Read"; `.status-pill.withdrawn` styled
  (`admin.css:984`) but unselectable in any admin dropdown.

---

## D. Consistency & design system

- 🟠 **Two button systems**: public `.btn` (pill + shine, `styles.css:213-268`) vs admin
  `.btn-wn`; two card systems (`.card` vs `.admin-card/.panel`); two token namespaces
  (`--navy/--blue/--cyan` vs `--wn-*`).
- 🟠 **Thematically disjoint:** public site ignores `data-theme`; admin/worker/login honor a
  shared `worldnet_theme`.
- 🟠 **Inline `style=` is the de-facto design system.** ~15 near-identical inline copies in
  `admin.js` (`:738-739,760-761,901-922,1144-1206,1790-1844`).
- 🟡 **Avatar color logic inconsistent** — `avatarColor` palette (`admin.js:165`) vs hardcoded
  gradients (`admin.js:996,1219,1782`).
- 🟡 **Helper code duplicated 1:1** between admin.js and worker.js; already drifted
  (`worker.js:142-150` drops palette logic).
- 🔵 **Redundant inline styles against CSS** — logo `font-weight:800;font-size:1.1rem` vs
  `.nav-logo span` (`styles.css:108-111`).
- ⚪ Emoji icon set (👋 📅 ＋ ☾ ☀ ◐) colliding with lucide-style SVGs.

---

## E. Forms & error prevention

- 🟠 No `for`/`id` label association (public forms, dashboard `<details>` forms, worker forms).
- 🟠 **Double-submission possible on public forms** — `submitForm` swaps text but never sets
  `disabled` (`app.js:341-357`). Worker login/report forms disable properly.
- 🟡 **No client-side email/phone format or future-date validation** on live forms
  (the *dead mockup* had them, `worldnet-homepage (3).html:905-915`); consultation date has no
  `min`.
- 🟡 **Field-level vs summary errors:** nothing marked invalid, nothing focused.
- 🟡 **Withdraw request has no confirm** (`app.js:394-405`).
- 🔵 **Worker assignment ignores department scoping** (`admin.js:1202-1204`).

---

## F. Content & copywriting

- 🔵 Tracker copy "pending or already viewed" (`consultation.html:65`) normalizes the two-state
  lie (Top 4).
- 🔵 Raw field names leak into user-facing strings (`app.js:337`).
- ⚪ Dashboard welcome overpromises on an empty system; footer label mismatches
  ("Network & cabling" vs full service names).

---

## G. Performance & perceived quality

- 🟠 Unbounded table pages (only workers paginates, `admin.js:1524-1538`).
- 🟡 No debounce on dashboard search keystrokes (`admin.js:2007`).
- 🔵 7 API calls per dashboard render; all-or-nothing render (`admin.js:845-853`).
- ⚪ Google Fonts + 3 families (only Inter actually used).

---

## H. Dead code & cruft

- 🟠 `worldnet-homepage (3).html`, `worldnet-admin-dashboard (1).html` (public root).
- 🟠 `faq.html`, `worker-login.html` redirect stubs.
- 🟡 Dead registration & Google-sign-in code (`admin.js:2114-2242`, `server.js:933,1086`) —
  `/api/register` is callable with no UI.
- ⚪ `src/report.html` stray artifact; `JWT_SECRET` falls back to `'worldnet-dev-secret'`
  (`server.js:16`).

---

## Recommended quick wins (highest fix/effort ratio)

1. Wrap dashboard/report/assign mutations in try/catch; show error toasts; disable buttons in flight.
2. Add confirm + disable to destructive/status actions on the dashboard; where cheap, use undo/soft delete.
3. Give public forms real `for`/`id` labels and disable submit on submit.
4. Fix the tracker's status mapping (map confirmed/completed/cancelled/withdrawn).
5. Guard `records.html?type=` with a whitelist + error state.
6. Delete the two mockup files; replace `faq.html`/`worker-login.html` redirects with server-side redirects.
7. Add a small "Team sign in" link in the public footer/nav.
8. Add focus trap/Escape/`aria-labelledby` to modals; add `role="status"` to toasts.

---

**Overall:** the system is functional, thoughtfully animated, respects reduced-motion, and has
good bones (consistent shells, deterministic avatars, clean role routing, solid auth copy). But
it ships on two parallel design systems with inline-style governance, asymmetric
destructive-action safety, invisible failure modes, and publicly reachable dead artifacts.