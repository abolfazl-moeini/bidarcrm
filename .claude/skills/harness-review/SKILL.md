---
name: harness-review
description: >-
  Modular chained adversarial code, UX, and architecture review pipeline for WordPress under agent-harness governance.
  Executes sequential review links including admin-design-review (7 canonical UX families, pure PHP native, Two-Gate security)
  and principal-review (L8 architecture, Hexagonal membrane, database & caching invariants, Nonce!=Capability, modern PHP).
---

# Harness Review (`/harness-review`)

**Chained Adversarial Review Pipeline for WordPress Plugins.**

This skill provides an extensible, non-destructive, multi-link code review pipeline. It executes sequential specialized review gates against target files, pull requests, or entire plugins, producing a consolidated, actionable findings report categorized by severity.

---

## 1. Governance & Dual Operation Modes

`/harness-review` operates in two distinct, specialized modes depending on the review target:

### Mode A: Plan Review & Direct Enhancement (`/harness-review plan` or `--chain=plan`)
- **Actionable & Mutative to Plan Documents:** Evaluates implementation plans (`plan.md`, `TASK.md`, or architecture proposals) before code is authored.
- **Direct Plan Enhancement:** Unlike code reviews, Plan Review **directly edits and upgrades `plan.md`** (or writes back an enhanced plan) with hardened checkpoints, Socratic edge-case defenses, Red-Green test requirements, and scope reductions derived from `/principal` rigor.
- **Invariants:** Eliminates premature abstractions, enforces Two-Gate security (`current_user_can` + nonce), verifies WooCommerce HPOS compatibility, and caps checkpoint size ($\le 2$ files, $\le 80$ lines).

### Mode B: Code Review & Quality Gate (Default: `/harness-review [target]` or `--chain=all|design|principal|frontend`)
- **Strictly Report-Only (Non-Destructive):** Source code reviews NEVER mutate application code or files automatically. It is strictly an auditing and verification engine.
- **Adversarial & Unbiased (`author != reviewer`):** Reviews source diffs or plugin files with independent, skeptical perspective, hunting for flaws, unhandled edge cases, missing security checks, and visual inconsistencies.
- **Structured Severity Triage:**
  - **P1 (Critical / Security / Contract Breakers):** Severe bugs, XSS/CSRF vectors, missing capability/access checks, fatal PHP syntax errors, or broken framework abstractions. Must block release.
  - **P2 (Design Flaws & Missing Edge Cases):** Broken UX patterns, unhandled empty/error states, missing relative dates, fragile JavaScript, or missing empty states.
  - **P3 (Minor Polish & Consistency):** Code formatting, naming discrepancies, minor documentation gaps.
- **Locate-then-Slice & Context Bounding:** Reviews focus on target diffs or identified components. Outputs exceeding 30 lines are piped to `<target-project>/.harness/refs/review-<timestamp>.md` with a concise summary in chat.

---

## 2. Chained Review Pipeline Architecture

The pipeline executes active review links sequentially. If a target is specified, only links relevant to that target run; otherwise the full chain executes.

```
/harness-review [target] [--chain=all|plan|design|principal|<link-name>]
       │
       ├──► Phase 0A: Precedent Retrieval Gate (ACTIVE)
       │    └── Bounded batch retrieval, Semgrep construct verification & waiver evaluation
       │
       ├──► Phase 0B: Defect Regression Audit (ACTIVE)
       │    └── Bounded component defect query (<80 tokens) preventing past bug reintroduction
       │
       ├──► Sub-Review 0: plan-review [alias: plan] (ACTIVE)
       │    └── Audits implementation plan (plan.md / TASK.md) vs WP constraints, HPOS, Nonce!=Cap, YAGNI
       │
       ├──► Sub-Review 1: admin-design-review [alias: design] (ACTIVE)
       │    └── Audits admin UI vs 7 canonical UX families in wpdev-admin-design
       │
       ├──► Sub-Review 2: principal-review [alias: principal] (ACTIVE)
       │    └── Audits L8 Architecture, Hexagonal isolation, Nonce!=Cap, DB & Cache invariants
       │
       ├──► Sub-Review 3: frontend-review [alias: frontend] (ACTIVE)
       │    └── Audits Frontend Standards, Root Conformance, CSS Governance & JS Budget
       │
       ├──► Future Extension: ecosystem-review (PLANNED)
       │    └── Audits Cross-plugin contracts, GEP resolution, 5-hop event bus
       │
       └──► Future Extension: i18n-review (PLANNED)
            └── Audits Gettext source strings, text domain consistency, safe escaping
```

---

## 3. Phase 0: Precedent & Defect Memory Retrieval Gates

### 3.1 Phase 0A: Precedent Retrieval Gate (`precedent-gate`)

Before evaluating target files against link rules, execute the Precedent Retrieval Gate:

1. **Target Project Inspection & Onboarding Check:**
   - Inspect `<target-project>/.harness/project.json`. If `convention_profile: "wpdev"` is missing, skip precedent enforcement.
   - Resolve framework version via the 4-step precedence chain.
   - Check architectural posture overrides (e.g. `architecture: "react-spa"` suppresses Zero-React admin convention).

2. **Single-Call Batch Retrieval:**
   - Generate unique `review_session_id` (UUID string).
   - Filter diff paths against `DIFF_IGNORE_PREFIXES` (`vendor/`, `node_modules/`, `wp-content/plugins/woocommerce/`, etc.).
   - Invoke `memory_match_precedents(paths=[...], review_session_id=SESSION_ID)` (or CLI fallback: `/Users/moeini/Dev/wpdev-platform/agent-harness/bin/harness-memory-mcp precedents "<component or keyword>"`).

3. **Deterministic 4-Outcome Semgrep Exception Matrix:**
   For each active exception matched on touched files:
   - **WAIVER_BREACH:** If target file matches ANY rule in `forbidden_constructs`, output:
     `[P1 FATAL] WAIVER_BREACH: File violates forbidden construct rule '{rule_id}'. Waiver {id} is voided mechanically.` (No suppression).
   - **WAIVER_INERT:** If target file does NOT match `allowed_constructs`, output:
     `[P2] WAIVER_INERT: File no longer matches allowed construct rule '{rule_id}'. Waiver {id} is inactive.` (No suppression).
   - **WAIVER_INDETERMINATE:** If Semgrep fails or exits non-zero (1/2/3), output:
     `[P2] WAIVER_INDETERMINATE: Semgrep verification failed with exit code {code}. Waiver {id} cannot be verified.` (Fail-closed, no suppression).
   - **WAIVER_VERIFIED:** 0 forbidden matches + >=1 allowed match + guard-verify exit 0:
     `[WAIVER VERIFIED] File matches approved exception {id}. Finding suppressed deterministically.` (Suppress finding).

4. **Finding Citation Recording via `bin/harness-memory-cite`:**
   When a review finding cites an anti-pattern or UX convention, execute:
   `bin/harness-memory-cite --precedent-id PREC-XXXX --task-id TASK-NNN --severity P2`

5. **Ratification Check for Severity Escalation:**
   - Only precedent cards with `review_status: "ratified"` can elevate findings to **P1/P2**.
   - Agent-proposed cards (`review_status: "proposed"`) cite at **P3 Advisory** level only.

6. **Asymmetric Fail-Safe Policy:**
   - Waivers and exceptions **FAIL CLOSED** (no findings suppressed without verified data).
   - UX guidance and conventions **FAIL OPEN** (degrade gracefully to baseline linters if memory unavailable).

### 3.2 Phase 0B: Defect Regression Audit (`defect-audit`)

Before evaluating target files against sub-review rules, audit proposed changes against past defects for the touched components to prevent reintroducing resolved bugs:

1. **Component Extraction & Bounded Query (P1 Token Cap Guard):**
   - Extract at most 3 unique components from touched paths (e.g. `src/Modules/Billing/...` -> `billing`, `includes/admin/table/...` -> `table-builder`).
   - For each component, invoke `memory_search_defects(query=comp, component=comp, limit=2, include_drafts=True, review_session_id=session_id)` (or CLI fallback: `/Users/moeini/Dev/wpdev-platform/agent-harness/bin/harness-memory-mcp search "<comp>" --component "<comp>" --limit 2`).
   - If matching defects exist, selectively fetch only the root cause:
     `memory_get_defect(id=..., fields=["root_cause"], review_session_id=session_id)`.
   - **Hard Token Budget Invariant:** Total token consumption across Phase 0B MUST remain strictly under 80 tokens, keeping the session ledger well below the 800-token ceiling (`SESSION_TOKEN_LIMIT = 800`).

2. **Adversarial Regression Audit Heuristic:**
   - The adversarial reviewer audits the proposed changes against each retrieved defect's `root_cause`.
   - If the defect's status is `verified` and the code re-introduces the identical flawed pattern (e.g. unescaped composite cell, un-parameterized SQL, missing custom nonce in AJAX request, unindexed meta query):
     `[P1 FATAL] REGRESSION_RISK: Changes in '{file}' re-introduce known past defect {id} ('{title}'). Root cause: '{root_cause}'. Remediation: apply verified patch pattern from {regression_test_ref}.`
   - If the defect's status is `draft` and the code matches the pattern:
     `[P2 WARNING] DRAFT_REGRESSION_HINT: Potential regression matching unverified draft defect {id} ('{title}'). Root cause hint: '{root_cause}'. Advisory review required (does NOT block ship as P1 FATAL).`
   - If clean, the reviewer records:
     `[DEFECT AUDIT GREEN] {file} verified clean against past defects for component '{component}'.`

---

## 4. Link 0: Plan Review (`plan-review`, alias `plan`)

### Target Scope:
Audits, challenges, and refines implementation plans (`plan.md`, `TASK.md`, or architecture proposals) before any code is authored. Inspired by `/principal`, customized for enterprise WordPress and WPDev architecture.

### Audit Checklist (`references/plan-review-checklist.md`):
1. **Scope & YAGNI:** Eliminates over-engineering, premature abstractions, or scope creep. Ensures small, verifiable steps ($\le 2$ files, $\le 80$ lines).
2. **WordPress Architecture:** Enforces hook lifecycle, WooCommerce HPOS (`wc_get_order`), prepared SQL queries (`$wpdb->prepare`), and cache invalidation.
3. **Two-Gate Security:** Verifies authorization (`current_user_can`) and CSRF (`check_admin_referer` / `wp_verify_nonce`) are distinct. Strict `permission_callback` on all REST routes.
4. **WPDev Admin UX:** Enforces the 7 canonical UX families, pure PHP native rendering, and checks for anti-patterns in `plugins/wpdev/skills/wpdev-panel-builder/references/anti-patterns.md`.
5. **Defect Memory Verification:** Cross-checks touched components against known defects in `knowledge/defects/` to ensure past bugs are not repeated.
6. **Output:** Directly enhances `plan.md` with concrete checkpoint lists and risk mitigations.

---

## 5. Link 1: Admin Design Review (`admin-design-review`)

### Target Scope:
Automatically scans and evaluates any WordPress admin screens, list tables (`Base_List_Table`), edit pages (`Edit_Admin_Page`), settings panels (`Top_Level_Admin_Page`), modals (`wpdev_register_form`), and metaboxes against the **7 canonical UX families** defined in `wpdev-admin-design` AND the canonical anti-patterns catalog in `plugins/wpdev/skills/wpdev-panel-builder/references/anti-patterns.md`.

### Audit Checklist:
1. **Zero-React & Pure PHP Native:**
   - Confirms admin screens render 100% server-side in PHP using native `wpdev` classes. Rejects React, Gutenberg blocks, or Polaris Stack on classic `admin.php?page=*` screens.
2. **Family 1 — List UX (Tables & Card Views):**
   - Composite first column: Avatar/identicon + bold name + muted subtext (email/slug) + human relative dates («۲ ماه پیش»).
   - Badges: Status values formatted as semantic rounded pastel pills (`.wpdev-badge`).
   - View mode switcher: For visual entities, verify table vs grid/card view mode toggle.
3. **Family 2 — Edit UX (Tabbed Forms & Metrics):**
   - Navigation: Vertical icon-badged tabs (`add_tabs_widget`).
   - Top KPI Strip: Single-row "At a Glance" metric strip (Total, Reference ID with copy button, Status badge).
   - Relational data: Child records rendered as embedded sub-tables (`add_list_table_widget`).
4. **Family 3 — Sidebar UX (Identity & Modular Actions):**
   - Profile: User identity card with avatar and quick action buttons (`→ Switch To`, `→ Visit Profile`).
   - Save widget: Dedicated Save card in shaded footer; adjacent Active/Inactive toggle switch card.
   - Danger Zone: Destructive action card at bottom with irreversible warning and outline delete button.
5. **Family 4 — Modal & Wizard UX:**
   - Quick Add: Dimmed-backdrop wubox modal (`wpdev_register_form`) instead of full-page redirect.
   - Step Wizard: Step 1 uses large clickable choice cards with icons and active checkmarks; Step 2 uses autocomplete inputs.
   - Onboarding: Full-page setup wizard has vertical step list on right and welcome container on left.
6. **Family 5 — Smart Fields UX:**
   - Conditionals: Instant toggle switches that reveal dependent fields inline without page reload.
   - Repeaters: Clean repeater rows with label, slug, delete button (`×`), and `+ Add [Item]`.
   - Page Pickers: Dropdown selectors include external link popout icon button (`↗`).
7. **Family 6 — Logs & Safety UX:**
   - Timeline: Internal notes feed with avatars and timestamps.
   - Terminal: Dark monospace live execution log with AJAX Refresh button.
   - Safe Deletion Modal: **MANDATORY safety toggle switch** (`Confirm Deletion`) that unlocks the delete button only when toggled ON.
8. **Security & WordPress Standards:**
   - Two-Gate defense: Validates both `current_user_can()` and `'access' => 'domain.action'`.
   - Strict late-escaping (`esc_html`, `esc_attr`, `esc_url`) in all cell and widget renders.
9. **WPDev Anti-Patterns Verification (`plugins/wpdev/skills/wpdev-panel-builder/references/anti-patterns.md`):**
   - **MANDATORY AUDIT:** Every admin screen, table, form, and widget must be audited against the 99 canonical anti-patterns in `plugins/wpdev/skills/wpdev-panel-builder/references/anti-patterns.md`.
   - **Key Enforcement Invariants:**
     - **Lifecycle & Translations:** Zero `__()` calls before `init` (e.g. during `wpdev_load`, DB checks, model boot) to prevent WP 6.7 `_load_textdomain_just_in_time` notices (#35, #36, #41, #78).
     - **Styling Isolation:** Custom CPT and WooCommerce edit screens MUST wrap the full metabox/tabs output in `<div class="wpdev-styling">` (#75). Use existing layout CSS class aliases (`wpdev-p-*`, `wpdev-m-*`) matching `admin-layout.css` (#76, #77).
     - **Modal & AJAX Safety:** Delete modals must read field `confirm` (not `confirmed` only) (#70) and never prevent default label events (#74). All `wpdev_register_ajax_handler` endpoints must pass `nonce: wpdev_ajax.nonce` and have error handlers (#26, #47, #48). Clean output buffers with `ob_clean()` and suppress display errors before `wp_send_json_*` (#90).
     - **Templates & Vue Directives:** Never wrap Vue templates or metaboxes in `wp_kses_post()` (#58); use `EscapeOutput` phpcs annotation to prevent stripping `v-show`, `v-cloak`, and `v-on`.
     - **Access Control & Two-Gate:** Never hardcode coarse capabilities (`manage_options`, `manage_network`) for domain features or customer records (#95, #96). Declare `'access' => 'domain.action'` and protected `$access` on tables (#99).
     - **Dates & Calendars:** Never pass Jalali dates into Flatpickr/datepickers; format initial values with pure Gregorian and handle Jalali fallbacks (#80). Stash `_sale_price_dates_*` from `$_POST` at priority 1 during `woocommerce_process_product_meta` to prevent WooCommerce core time truncation (#81).
     - **Multi-Plugin Collisions:** Wrap shared functions in `function_exists()` (#83), place framework closure first in Composer `autoload.files` (#84), and eagerly require `Base_Admin_Page` (#85).
     - **WAF & Wordfence HTML Compatibility (P1 FATAL):** Any metabox, settings panel, or repeater field that accepts raw HTML or media embed codes (e.g. Aparat/YouTube `<iframe>` snippets in product details or demo tabs) must NOT be submitted unencoded in standard HTTP POST bodies. Security firewalls (specifically **Wordfence**, ModSecurity, Cloudflare WAF) inspect `$_POST` and flag raw `<iframe>`, `<script>`, or markup as potential XSS / Code Injection, triggering false-positive HTTP 403 Forbidden blocks on save. Fields must either accept clean media URLs/IDs (rendered server-side via `wpdev_render_video()`) or encode the payload client-side prior to POST (e.g. Base64 encoding decoded server-side via `base64_decode()` before `wp_kses()` / `wpdev_sanitize_embed_html()` sanitization) (#116).
   - **Resolution Invariant:** Any detected anti-pattern violation from `plugins/wpdev/skills/wpdev-panel-builder/references/anti-patterns.md` MUST be flagged as **P1 FATAL** or **P2** and must be fixed before review completion.

---

## 5. Sub-Review 2: Principal Engineering Review (`principal-review`)

### Target Scope:
Scans all PHP classes, domain models, controllers, endpoints, and database queries against L8 Principal Engineer architectural, security, and performance invariants defined in `references/principal-checklist.md` and `principal` (`OPINIONS.md`).

### Audit Checklist:
1. **Architecture & Hexagonal Membrane (P1 / P2):**
   - Core domain logic in `Domain/` and `Application/` decoupled from WordPress functions (`get_option`, `wp_remote_get`, `$wpdb`).
   - Third-party Composer dependencies prefixed using Strauss (`BrianHenryIE/strauss`) to prevent class collisions.
   - Zero reflection container boot tax on cold requests.
2. **Security Invariants & Two-Gate Defense (P1 FATAL):**
   - Nonce check is NEVER used as authorization (`wp_verify_nonce` proves origin, not privilege; `current_user_can()` is mandatory).
   - SQL queries parameterized with `$wpdb->prepare()`. Zero string concatenation.
   - Dynamic outputs strictly late-escaped (`esc_html`, `esc_attr`, `esc_url`).
   - Multi-tenant IDOR protection verified for object IDs.
3. **Database & Scale Invariants (P1 / P2):**
   - Transactional/operational entities persisted in typed custom tables, not unindexed `wp_postmeta`.
   - **Storage Engine Integrity (P1 FATAL):** Transactional custom tables, queues, ledgers, and WooCommerce HPOS tables MUST specify `ENGINE=InnoDB`. MyISAM is strictly banned in transactional flows due to table-level locking and lack of transaction rollback (ACID/MVCC).
   - **Unbounded Queries Ban (P1 FATAL):** `posts_per_page => -1` or `numberposts => -1` is strictly forbidden. Always require explicit bounds and pagination.
   - **`post__not_in` on Large Datasets (P1 / P2):** Banned on collections > 1,000 items due to index degradation into full table scans.
   - **The Non-Existent Options Trap (P2):** High-frequency options must be pre-seeded with default values and `autoload = 'yes'`. Calling `get_option()` on missing keys bypasses `alloptions` and fires 70–160 redundant `SELECT option_value ... LIMIT 1` queries per page load.
   - **Frontend Database Writes Ban (P1 FATAL):** `update_option()`, `add_option()`, and `wp_update_post()` must never execute on non-administrative frontend GET requests.
   - `WP_Meta_Query` with multiple clauses forbidden on datasets > 10,000 records.
   - Autoload options bloat prevented (`autoload = 'no'` for large or infrequently read options, keeping total autoload < 512 KB).
4. **Cache & Concurrency Defense (P1 / P2):**
   - Calling `wp_cache_flush()` in production paths is strictly prohibited (triggers instant 100% MySQL CPU spike).
   - **Page Cache Session Leak Ban (P1 FATAL):** `session_start()` and persistent cookie writing (`setcookie()`) are banned on public frontend GET requests to prevent invalidating Nginx FastCGI, Varnish, and Cloudflare page caches.
   - **Dynamic Transient Key Anti-Pattern (P2):** Dynamic transient keys (`set_transient("prefix_{$id}", ...)`) without persistent object cache drop-in are banned due to multi-megabyte `wp_options` table bloat.
   - Cache Stampede prevented via Soft/Hard TTL, versioned group keys, or atomic leases.
5. **Modern PHP, Result Contract & Evidence (P1 / P2):**
   - **The Result Contract Invariant (P1 FATAL):** Every performance optimization or query refactoring MUST preserve the EXACT Result Contract (sort order, filters, pagination, visibility, multisite scope). A faster query that changes results is a bug.
   - **Evidence-Based Baseline & Budget (P2):** Read-only audit first; performance claims require empirical before/after measurements (cURL TTFB, query count, memory).
   - `declare(strict_types=1);` and modern PHP 8.2+ typing with automated Rector downgrade compatibility (`DOWN_TO_PHP_74`).
   - Zero speculative error suppression (no silent `isset()` or empty `try/catch` hiding bugs).
   - Non-trivial code accompanied by reproducible test receipts (Unit tests or `WP_UnitTestCase`).
6. **Mechanical Regex Quick-Scan Suite (`references/principal-checklist.md`):**
   - The reviewer executes mechanical ripgrep scans for `posts_per_page => -1`, `session_start()`, frontend `update_option`, dynamic transients, and polling loops before qualitative evaluation.

---

## 6. Sub-Review 3: Frontend Standards & Mechanical Review (`frontend-review`)

### Target Scope:
Scans all frontend files (`*.css`, `*.ts`, `*.tsx`, `*.js`, `*.php` view templates, and `*.html` fixtures) against standards defined in `standards/frontend/`.

### Automated Inputs:
Consumes JSON evidence from mechanical verification gates:
- `governance-css.mjs` (PS-COLOR, PS-RADIUS, PS-SHADOW, PS-IMPORTANT, PS-MOTION, PS-CLASS)
- `check-budget.mjs` (Hard cap ≤ 10,240B gzip, WP core handles ledger)
- `semgrep/frontend.yml` (Anti-tailwind, Anti-inline-styles, Anti-raw-http, Unescaped echo)
- `stylelint` (Flow-relative logical properties)
- In browser suites: DOM parity and Axe accessibility reports.

### Automated P1 Fatal Conditions:
Any of the following causes an immediate `[P1 FATAL] SHIP BLOCKED`:
1. Any non-zero exit from mechanical gates (`governance-css`, `check-budget`, `semgrep`).
2. Missing or multiple `.ps-root[data-archetype]` enclosing roots on a rendered screen.
3. Bundle size breach exceeding the 10,240B gzip hard cap.
4. Tailwind classes, raw fetch/axios, unescaped short echo `<?= $var ?>`, or banned `@wordpress/components`.

### LLM Visual & Architectural Rubric:
Evaluates remaining qualitative aspects against the 6-dimension rubric in `standards/frontend/REVIEW.md`:
- **Root Conformance**: Single enclosing `.ps-root`.
- **Zero-Waste Delivery**: Zero assets loaded when components are not active.
- **Accessibility & RTL**: Focus rings, logical properties, ZWNJ compliance.
- **Design Contract**: Fidelity to `DESIGN.md`.
- **IMPORTANT**: LLMs CANNOT waive mechanical gate failures. Only humans can approve exceptions in `exceptions.yaml`.

---

## 7. Execution Workflow

1. **Identify Target:** Parse target path, plugin, or active working tree diff.
   - If ambiguous, prompt human in Persian: `"لطفاً مسیر فایل، پوشه، یا نام پلاگین هدف برای بازبینی را مشخص کنید."`
2. **Execute Active Sub-Reviews:**
   - Automatically route target files: admin UI files trigger `admin-design-review`; PHP classes, endpoints, and database queries trigger `principal-review`.
   - Or filter explicitly via `--chain=all`, `--chain=design`, `--chain=principal`, `--chain=frontend`.
3. **Generate Unified Findings Table:**
   Format all findings into the standard review table with Sub-Review attribution:
   ```markdown
   | Severity | Sub-Review | File | Line | Issue Description | Recommended Remediation |
   |---|---|---|---|---|---|
   | P1 | admin-design | `.../Customer_Table.php` | 42 | Missing late-escaping on `$item['name']` in composite cell | Wrap in `esc_html()` |
   | P1 | principal | `.../OrderController.php` | 87 | Nonce verified without capability check for order mutation | Add `current_user_can('edit_order', $id)` |
   | P2 | principal | `.../TelemetryRepository.php` | 34 | Transactional telemetry stored in postmeta with multi-meta query | Migrate to typed custom table |
   | P2 | admin-design | `.../Delete_Modal.php` | 18 | Delete button is clickable without confirmation toggle | Add safety toggle lock |
   ```
4. **Log Review Summary:**
   - Record audit status and executed sub-reviews in `<target-project>/.harness/LOG.md`.
   - Never auto-patch code. Present findings and await human direction.

---

## 8. Silent Review Learning Protocol at Task Closure

Learning from mistakes must be frictionless and non-intrusive. The agent NEVER interrupts active development with confirmation modals or prompts asking whether to save rules.

### 1. In-Flow Action (Zero Friction):
- When feedback or direction is provided by the human lead, the agent implements the fix immediately without confirmation prompts.
- Any review finding (P1/P2) that was resolved during the task is recorded in the `LOG.md` review table with its verification test.

### 2. Silent Ingestion at Task Closure (Two-Phase Closure):
- When closing the task via `bin/harness-memory-ingest --close-task=<target>/.harness/TASK.md`, the ingest engine automatically scans `LOG.md`.
- **Qualification Filter (Anti-Noise Gate):** An entry qualifies for automated defect card creation only if:
  - A failing test was converted to passing (RED $\rightarrow$ GREEN TDD evidence), OR
  - A P1 or P2 review finding was resolved with a verifiable code patch.
  - Trivial whitespace, spelling, or README changes are discarded.
- Qualified findings are written to `knowledge/defects/` with `origin: review_closure` and immediately indexed into SQLite FTS5.

### 3. Explicit Manual Thought Capture (`harness-remember`):
- If the human lead explicitly wants to log a specific architectural observation or note, they use `harness-remember note "..."` or `bug "..."` in the terminal (sub-80ms, zero tokens, zero ceremony).

