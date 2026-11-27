# BidarCRM — Cycle 3 Code Review & Remediation Plans (Weak-Agent Optimized)

> **Scope & Purpose:** Master index and execution DAG for fixing all verified P0, P1, and P2 defects uncovered during Cycle 3 line-by-line adversarial code review across the BidarCRM monorepo (`/Users/moeini/Dev/didar`).  
> **Optimization Target:** Every sub-plan is self-contained, strictly directory-scoped, ordered for Red -> Green TDD execution, and sized for low-context / weaker implementation agents (e.g., Flash, GLM-5.3-Flash, hy4-flash, Haiku).

---

## 1. Executive Audit Summary

| Section | Codebase Scope | P0 (Blocker) | P1 (Major) | P2 (Minor) | Test Gaps | Sub-Plan |
|---|---|---:|---:|---:|---:|---|
| **1** | `extensions/bidar-sales/` | 1 | 7 | 3 | Covered in tasks | [`01-backend-sales-security-and-logic.md`](./01-backend-sales-security-and-logic.md) |
| **2** | `extensions/bidar-iran/` | 0 | 5 | 2 | Covered in tasks | [`02-backend-iran-sms-voip-csv.md`](./02-backend-iran-sms-voip-csv.md) |
| **3** | `bidar-theme`, `bidar-brand`, `apply-whitelabel.php` | 0 | 1 | 3 | Covered in tasks | [`03-theme-rtl-and-whitelabel.md`](./03-theme-rtl-and-whitelabel.md) |
| **4a** | `apps/web/` (P0 Blockers + Kanban/Deal Core) | 5 | 3 | 0 | Included per task | [`04a-spa-critical-bugs-and-kanban.md`](./04a-spa-critical-bugs-and-kanban.md) |
| **4b** | `apps/web/` (Pages, UX, A11y, Hygiene & Test Gaps) | 0 | 8 | 7 | 3 test suites | [`04b-spa-pages-ux-a11y-and-tests.md`](./04b-spa-pages-ux-a11y-and-tests.md) |
| **5** | `deploy/`, `docker/`, `scripts/`, `tests/`, `packages/e2e/` | 1 | 4 | 1 | Covered in tasks | [`05-devops-deploy-packaging-and-e2e.md`](./05-devops-deploy-packaging-and-e2e.md) |
| **Total** | **Full Monorepo** | **7** | **28** | **16** | **3 suites + per-task TDD** | **6 Executable Plans** |

---

## 2. Plan Inventory & Parallelizability

| Plan File | Owned Directories | Tasks | Estimated Context | Prerequisites | Can Run In Parallel With |
|---|---|---:|---|---|---|
| [01-backend-sales-security-and-logic.md](./01-backend-sales-security-and-logic.md) | `extensions/bidar-sales/` | 7 | Small (~28 KB source touched) | None | `02`, `03`, `04a`, `05` |
| [02-backend-iran-sms-voip-csv.md](./02-backend-iran-sms-voip-csv.md) | `extensions/bidar-iran/` | 5 | Small (~16 KB source touched) | None | `01`, `03`, `04a`, `05` |
| [03-theme-rtl-and-whitelabel.md](./03-theme-rtl-and-whitelabel.md) | `extensions/bidar-theme/`, `extensions/bidar-brand/`, `client/custom/modules/bidar-theme/`, `scripts/apply-whitelabel.php` | 3 | Very Small (~12 KB source touched) | None | `01`, `02`, `04a`, `05` |
| [04a-spa-critical-bugs-and-kanban.md](./04a-spa-critical-bugs-and-kanban.md) | `apps/web/src/` (Core routing, auth, calendar, Kanban, DealCreate/Loss modals) | 8 | Medium (~35 KB source touched) | None | `01`, `02`, `03`, `05` |
| [04b-spa-pages-ux-a11y-and-tests.md](./04b-spa-pages-ux-a11y-and-tests.md) | `apps/web/src/` (Settings, Pages, Jalali/Numbers, UX, A11y, Tests) | 10 | Medium (~45 KB source touched) | **`04a` GREEN + built** | `01`, `02`, `03`, `05` (after `04a`) |
| [05-devops-deploy-packaging-and-e2e.md](./05-devops-deploy-packaging-and-e2e.md) | `deploy/`, `docker/`, `docker-compose.dev.yml`, `scripts/` (except `apply-whitelabel.php`), `tests/`, `packages/e2e/` | 5 | Small (~24 KB source touched) | None | `01`, `02`, `03`, `04a`, `04b` |

---

## 3. Execution DAG (Wave Order — `asf-v6` Rules 13–15 Aligned)

```text
Wave 1 (Launch all 5 in parallel — zero file overlap):
  ├── Worker 1 ──► 01-backend-sales-security-and-logic.md
  ├── Worker 2 ──► 02-backend-iran-sms-voip-csv.md
  ├── Worker 3 ──► 03-theme-rtl-and-whitelabel.md
  ├── Worker 4 ──► 04a-spa-critical-bugs-and-kanban.md
  └── Worker 5 ──► 05-devops-deploy-packaging-and-e2e.md
                         │
                         ▼ (Wait ONLY for Worker 4 / 04a to pass test:ci & build)
Wave 2 (Sequential on apps/web/):
  └── Worker 6 ──► 04b-spa-pages-ux-a11y-and-tests.md
                         │
                         ▼ (All Waves 1 & 2 pass Builder -> Reviewer -> Auditor gate)
Wave 3 (Post-Package Dual Verification & Closed-Loop Monitor Gate):
  1. Unified unit & static checks:
     ./vendor/bin/phpunit -c extensions/phpunit.xml \
       && npm --prefix apps/web run test:ci \
       && npm --prefix apps/web run build \
       && npm --prefix packages/e2e run test:all \
       && bash -n scripts/build-release.sh scripts/dev-setup.sh tests/installer/*.sh \
       && php -l scripts/apply-whitelabel.php scripts/seed-sample-data.php
  2. Synchronize SemVer bump (e.g., 1.0.5) across manifests and rebuild ZIP:
     bash scripts/build-release.sh \
       && bash tests/installer/verify-zip-structure.sh dist/bidar-crm-v1.0.5.zip \
       && bash tests/installer/clean-install-smoke.sh dist/bidar-crm-v1.0.5.zip
  3. Update/run `packages/e2e/` monitor & Playwright tests covering all P0/P1 fixes
     (`node packages/e2e/bin/run-browser-tests.js`) + exploratory smoke (0 console, HTTP < 400, 0 PHP errors).
  4. Repeat Fix -> Re-Test loop if ANY V1 exploratory or V2 monitor failure occurs.
```

---

## 4. `asf-v6` Infrastructure Alignment (`AGENTS.md` Rules 13–15 & `~/.asf/config.yaml`)

1. **Active ASF Executors (per `~/.asf/config.yaml` & `asf router doctor`):**
   - **Builder (`[chat, code]`):** `opencode-gemini-flash`, `opencode-gemini-hydrogen`, `codex-main` (`gpt-6-luna`), `zcode-flash`, `opencode-hy4-flash`, `autoclaw-flash`. *(Note: `agy-main`, `agy-fast`, `gemini-api-1..8` are disabled in config; `workbuddy-desktop` requires WorkBuddy running with remote debugging enabled.)*
   - **Reviewer (`role="reviewer"`):** `agy-review` (`gemini-4-hydrogen-high`, tier 4, `[chat]` only).
   - **Auditor (`role="auditor"`):** `qoder-review` (`HungerG`, port 9223 — always lock with `/tmp/asf-qoder-cdp.lock` and pass diff inline telling Qoder not to invoke terminal/file tools).
2. **Tri-Agent Gate per Sub-Plan (`AGENTS.md` Rule 14):**
   - Each plan runs **Builder** (RED test `test(scope)` -> minimal GREEN fix `feat(scope)`) -> **Reviewer (`agy-review`)** (diff + test audit) -> **Auditor (`qoder-review`)** (regression & static contract check). Rejection loops back to Builder before gate closure.
3. **Non-Destructive Supervisor Watchdog (`AGENTS.md` Rule 13):**
   - Supervisor inspects active PIDs, advancing log sizes, DB `heartbeat_at`, and git/file changes periodically.
   - Never blind-kill an active worker on timer expiry; renew the watchdog while alive, and intervene only on verified crash/stall.
4. **Post-Package Monitor Mandate (`AGENTS.md` Rule 15):**
   - Every behavioral fix in `01`–`04b` must have unit TDD tests AND live E2E/monitor verification in `packages/e2e/` during Wave 3 before closing the release.

---

## 5. Worker Prompt Template (Copy-Paste Ready)

Use this exact prompt when assigning any single plan file to a weaker worker agent (`opencode-gemini-flash`, `codex-main`, `zcode-flash`, `Flash`, etc.):

```text
You are an execution worker in `/Users/moeini/Dev/didar` following `asf-v6/AGENTS.md` rules.
Read ONLY `/Users/moeini/Dev/didar/docs/plans/cycle3/<PLAN_FILE>.md` first.

Strict execution rules:
1. Work ONLY inside the `Allowed Files` declared in the plan header and task blocks.
2. Execute tasks in exact numerical order. Do NOT skip RED -> GREEN per task.
3. For each task: Step 1 (add RED test, run it, confirm expected failure) -> Step 2 (apply exact minimal fix via ASF builder) -> Step 3 (run verify command and confirm GREEN).
4. After all tasks pass, run a post-implementation Reviewer gate (`asf router run --executor agy-review`) and Auditor check (`qoder-review` with inline diff under `/tmp/asf-qoder-cdp.lock`). Fix and re-test if rejected.
5. Keep Persian CRM term «کاریز» everywhere (NEVER «خط لوله»). Do NOT bump any `manifest.json` or `package.json` versions.
6. If ANY `Stop / Escalate If` condition is triggered, STOP immediately and report the exact command, file, and error output.

Report back with:
- Modified file paths & Task IDs completed
- Exact test/lint/build outputs after final edit
- Reviewer (`agy-review`) & Auditor (`qoder-review`) verdicts.
```
