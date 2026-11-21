---
name: harness-debug
description: >-
  WordPress debugging and bugfix under full agent-harness governance. Enforces 5-step closed-loop: Defect memory search (Step 1), MECE hypotheses H1-H5 & execution-graph bisection (Step 2), Docker-safe bounded probe instrumentation with HMAC-signed lease (Step 3), cold Socratic log evaluation & user repro gate (Step 4), and TDD Red-Green verification, Bug-to-Gate codification, 3-strike circuit breaker, and two-phase memory closure (Step 5).
---

# Harness Debug (`/harness-debug`)

WordPress debugging and bugfix workflow under full `agent-harness` governance.
Source of Truth: `/Users/moeini/Dev/wpdev-platform/agent-harness/AGENTS.md` and `implementation-plan.md`.

Note: the legacy `/harness-bugfix` alias has been removed; `scripts/sync.sh` deletes it from all CLI environments. `/harness-debug` is the sole entry point.

## 0. Core Invariants
1. **No Evidence -> No Fix:** Never apply speculative patches, blind `isset()` guards, or silent `try/catch` swallowing before empirical evidence (telemetry or failing RED test) confirms the root cause.
2. **3-Strike Circuit Breaker:** If two consecutive fix attempts fail or two probe rounds stay inconclusive, **HALT immediately**, zoom out to architecture/environment/Docker/cache boundaries, and report the divergence to the user.

## 1. Phase 0: Target Verification & Auto-Init Gate
1. Match target project from argument (e.g. `shop-core`, or any registered slug) or active workspace against `/Users/moeini/Dev/wpdev-platform/agent-harness/projects/*.md`.
   If ambiguous or multiple candidates: **STOP immediately, ask human in Persian, and wait**: "لطفاً نام پروژهٔ هدف را مشخص کنید (نام ثبت‌شده در `projects/*.md` یا مسیر دایرکتوری)."
2. **Auto-Init Gate:**
   Check if `<target-project>/.harness/manifest.json` exists.
   If missing on a valid WordPress repo:
   **Automatically initiate `/harness-init`:**
   - Run `/Users/moeini/Dev/wpdev-platform/agent-harness/bin/harness-sync --target <target-path> --plan /tmp/harness-plan.json`
   - Display the impact table + `PLAN_HASH` and obtain explicit human confirmation ("بله")
   - Apply via `bin/harness-sync --target <target-path> --apply --plan-hash <PLAN_HASH>` and verify arming with `bin/harness-doctor <target-path> --verify-arming`
   - Immediately continue with the debugging task.
3. Set task type as `bugfix` in `<target-project>/.harness/TASK.md` or export `HARNESS_TASK_TYPE=bugfix`.

## 2. The 5-Step Closed Debugging Loop

### Step 1: Defect Memory Search & Provenance Triage
1. **Defect Memory Retrieval (Primary — Unified Single DB):**
   Before spending tokens or guessing, search the unified memory database (including freshly captured `draft` cards):
   - **Via MCP:** Call `memory_search_defects(query="<symptom>", include_drafts=True)` (and `memory_get_defect` for specific cards; also check `memory_search_memos` for recent notes).
   - **Via Deterministic CLI:**
     ```bash
     /Users/moeini/Dev/wpdev-platform/agent-harness/bin/harness-memory-mcp search "<symptom or keyword>" --include-drafts
     /Users/moeini/Dev/wpdev-platform/agent-harness/bin/harness-memory-mcp get <DEF-ID>
     ```
     `bin/harness-memory-search "<query>"` is also available as a fast shorthand. If a verified patch exists, apply it and advance directly to Step 5.
2. **Code Discovery (Zero-Token AST Graph):**
   Locate responsible modules, hooks, options, and callers via `bin/harness-graph` (or optional `catalog_search_features` if Persian aliases exist in `.harness/features.json`).
3. **Provenance Triage (Mandatory Gate 0 Snapshot):**
   Always supply `--file=<suspected_file>` and/or `--stack-trace=<log_or_trace>` (plus `--allow-path=<dir_or_file>` when targeting local client code). Passing ONLY `--symptom` yields `INSUFFICIENT` (which locks production writes to repro tests & log collection until a concrete file/stack is identified):
   ```bash
   /Users/moeini/Dev/wpdev-platform/agent-harness/bin/harness-triage \
     --symptom="<error_message_or_symptom>" \
     --file="<target-project>/src/Path/SuspectedFile.php" \
     --allow-path="<target-project>/src/Path" \
     --output="<target-project>/.harness/triage.json"
   ```
   Inspect `<target-project>/.harness/triage.json`:
   - `UPSTREAM_T1` (Boilerplate) / `UPSTREAM_T2` (Framework): Deny consumer patch; open upstream issue/task.
   - `LOCAL_T3` (Client Code): Unlocks only `allowed_paths`.
   - `INSUFFICIENT`: Write a failing reproducer test and/or collect logs first, then re-run `bin/harness-triage` with the stack trace or concrete `--file`.

### Step 2: MECE Hypotheses (H1–H5) & Execution-Graph Bisection
Formulate 3 to 5 mutually exclusive, collectively exhaustive hypotheses partitioned along the execution path (`Entry -> Validation -> State Mutation -> Storage/Cache -> Output`) before modifying any code:
- **H1 (Cache / State Persistence):** Stale option cache, APCu/Redis desync, or OPcache serving stale bytecode/minified assets.
- **H2 (Hook Priority / Short-Circuit):** Filter order collision (e.g. `get_post_metadata` overwriting `0` with default `1`).
- **H3 (Frontend / UI Reactivity & DOM):** Vue/JS handler failure, unhandled promise, detached DOM, or modal backdrop deadlock.
- **H4 (Database & Serialization):** Type mismatch during `update_post_meta`, `$wpdb` error, strict comparison (`===`), or missing index.
- **H5 (Upstream Contract Violation):** Consumer code violating upstream method signatures or hook arguments.

**Bisection Rule ($M = \lceil n/2 \rceil$):** Place the first probe at the mathematical midpoint of the execution path so one reproduction run eliminates 50% of the search space ($O(\log n)$ convergence). Document hypotheses in `<target-project>/.harness/LOG.md`.

### Step 3: Bounded Dynamic Instrumentation (Docker-Safe Probes)
For silent failures, race conditions, or ambiguous runtime state:
1. **Acquire HMAC-Signed Lease (creates `.orig` backups in `.harness/state/backups/`):**
   ```bash
   /Users/moeini/Dev/wpdev-platform/agent-harness/bin/harness-debug-lease --project-dir "<target-project>" grant \
     --files "<target-project>/src/Path/TargetFile.php" \
     --contradiction "<expected vs observed behavior>" \
     --ruled-out "<environment and routing checks already ruled out>" \
     --question "<exact unknown question being probed>" \
     --discriminant "<observation splitting hypotheses>"
   ```
2. **Inject Safe PHP Probe (`bin/harness-probe-engine inject`):**
   ```bash
   /Users/moeini/Dev/wpdev-platform/agent-harness/bin/harness-probe-engine inject \
     --file "<target-project>/src/Path/TargetFile.php" \
     --line 42 \
     --probe-id "H2-midpoint" \
     --expressions '{"hook":"current_filter()","post_id":"$post->ID","is_ajax":"wp_doing_ajax()","val":"$value"}'
   ```
   - **Allowed safe observations:** scalar variables, read-only property access (`$post->ID`, `$user->ID`), and whitelisted read-only PHP/WP functions (`current_filter()`, `current_action()`, `is_admin()`, `wp_doing_ajax()`, `get_current_blog_id()`, `get_current_user_id()`, `is_wp_error()`, `get_class()`, `array_keys()`, `count()`, `gettype()`, etc.). Method calls (`->foo()`), assignments, DB queries, and control flow remain strictly blocked.
   - **Automatic redaction:** Sensitive keys/variables matching `/(pass|token|secret|auth|nonce|cookie|key)/i` are automatically hashed via `md5(strval(...))`.
   - **Docker-Safe Shared Telemetry:** By default the injected helper writes per-request NDJSON files via `__DIR__`-relative path directly into `<target-project>/.harness/state/telemetry/req_<uuid>.ndjson`, which is visible on BOTH the Docker container and the macOS host simultaneously (and is gitignored and scrubbed on cleanup).
   - **Loop bounding:** `static $__harness_cnt = 0; if (++$__harness_cnt > 100) return;`.
3. **Frontend JS / Playwright Probes (when bug is UI/browser-side):**
   Wrap temporary browser/JS instrumentation inside `// __HARNESS_DBG_PROBE_START:<id>__` ... `// __HARNESS_DBG_PROBE_END:<id>__` (or `__ANTIGRAVITY_DBG_PROBE_START:<id>__` ... `__ANTIGRAVITY_DBG_PROBE_END:<id>__`). `bin/harness-release-check` verifies zero residual markers before release.

### Step 4: Reproduction, Cold Socratic Log Evaluation & Root Cause
1. **Invalidate PHP OPcache (Docker-Aware):**
   ```bash
   # For Docker WordPress (reloads PHP-FPM/Apache OPcache, not just CLI):
   /Users/moeini/Dev/wpdev-platform/agent-harness/bin/harness-probe-engine opcache-invalidate \
     --file "<target-project>/src/Path/TargetFile.php" \
     --container "<docker-wp-container>" \
     --container-path "/var/www/html/wp-content/plugins/<slug>/src/Path/TargetFile.php"
   ```
2. **Trigger Reproduction:**
   - **Automated first:** Run the isolated PHPUnit/Playwright repro command once.
   - **User Repro Gate (if manual UI reproduction is needed):** Pause and ask in Persian:
     > «پروب‌های موقت در مسیر اجرا قرار گرفتند. لطفاً سناریوی باگ را یک‌بار در مرورگر اجرا کنید و خبر بدهید تا لاگ‌ها را تحلیل کنم.»
   - Quiesce 500ms, then read telemetry objectively:
     ```bash
     /Users/moeini/Dev/wpdev-platform/agent-harness/bin/harness-probe-engine read-telemetry \
       --dir "<target-project>/.harness/state/telemetry"
     ```
3. **Cold Socratic Judge Evaluation:**
   Evaluate raw NDJSON events objectively against H1–H5 (without confirmation bias):
   - **Uniqueness:** Does telemetry uniquely confirm one hypothesis and refute the rest?
   - **Anti-Silencing:** Fix where the bad state is *produced*, never with a blind null-check where it is consumed.
   - If ambiguous, bisect again (`M'`) within task quota (max 4 probes, max 3 runs); after 2 failed attempts trigger the **3-Strike Circuit Breaker**.

### Step 5: Full Probe Cleanup, TDD Fix & Durable Memory Ingestion
1. **Mandatory Probe Cleanup (restores `.orig` backups + deletes `.harness/state/telemetry/`):**
   ```bash
   /Users/moeini/Dev/wpdev-platform/agent-harness/bin/harness-debug-lease --project-dir "<target-project>" cleanup
   /Users/moeini/Dev/wpdev-platform/agent-harness/bin/harness-release-check
   ```
   Invalidate OPcache again if running in Docker.
2. **Clean RED Failure:**
   Verify reproduction test fails on clean, uninstrumented code for the exact predicted reason. Record RED evidence in `LOG.md`.
3. **GREEN Patch:**
   Apply minimal surgical fix. Enforce locate-then-slice (`<=80` lines, `<=2` files per step). Confirm test passes (GREEN).
4. **Adaptive Gate Codification:**
   Author a permanent PHPUnit/Playwright regression test or Semgrep/Deptrac rule (`bin/harness-guard-verify`).
5. **Adversarial Review:**
   Reviewer model != author model. Ship strictly blocked on pending review unless explicit `human-skip` in `LOG.md`.
6. **Durable Defect Memory Registration (Two-Phase Closure):**
   Set `<target>/.harness/TASK.md` status to `Closing` and ingest defect into the unified memory database:
   ```bash
   python3 /Users/moeini/Dev/wpdev-platform/agent-harness/bin/harness-memory-ingest --close-task="<target>/.harness/TASK.md"
   ```
   This validates Gate 0 triage, writes `knowledge/defects/DEF-YYYY-NNNN.md` (`record_type: defect`), refreshes `~/.harness/cache/global-knowledge.sqlite`, and moves `TASK.md` to `Complete`.

## 3. Opt-in Ship & Live Verification Gate (Outer Loop)

Once local TDD is GREEN, adaptive gate is codified, adversarial review is satisfied, and memory is ingested:

### Step 3.1 — Opt-in Live Outer Loop Prompt
Prompt the human lead in Persian:
> «باگ در محیط محلی با تست و گیت رگرسیون برطرف و در بانک حافظه عیوب (Defect Memory) ثبت شد. آیا مایلید بیلد پکیج (`dist/`) و راستی‌آزمایی زنده روی پروداکشن (Live Smoke / Monitor) انجام شود؟ (پیش‌فرض: خیر)»

> **Default-Off / Fail-Closed Policy:**  
> پاسخ پیش‌فرض منحصراً **«خیر» (خاموش / فقط لوکال)** است. اگر کاربر «خیر» گفت یا تایید صریح نداد، کار در همین نقطه به پایان رسیده است.

### Step 3.2 — Optional Live Build & Deploy (اگر کاربر صریحاً «بله» گفت)
1. **SemVer Version Bump (Mandatory Pre-Build Gate):**
   - **`patch` (پیش‌فرض در `harness-debug`):** رفع باگ‌ها، اصلاحات منطقی و هات‌فیکس‌های بدون شکست سازگاری (مثلاً `1.4.2` -> `1.4.3`).
   - به‌روزرسانی هدر فایل اصلی پلاگین (`Version: x.y.z`)، ثابت نسخه، `readme.txt`، `composer.json` و `package.json`.
2. **Package Build (`dist/`):**
   `npm run release` (or `composer release:dist`) -> `<package_root>/dist/<slug>.zip`.
3. **Human Deploy Gate:**
   STOP and wait. Output clickable `file://` link to zip in `dist/`.
   Prompt human: *«بسته با نسخه جدید در مسیر فوق ساخته شد. لطفاً پس از بارگذاری و فعال‌سازی روی سرور پروداکشن اعلام کنید تا راستی‌آزمایی لایو اجرا شود.»*
4. **Live Server Retest:**
   - **With dedicated monitor (`<product>-monitor`):** `cd <monitor-repo> && npm run start:prod -- --scenario=<id>`.
   - **Without dedicated monitor:** Ask human for manual production smoke confirmation. Never execute local mutating E2E tests against live production databases.
