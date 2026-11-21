---
name: harness-release
description: Standalone build verification, multi-persona defect hunting, and pre-delivery release qualification under agent-harness governance.
---

# Harness Release (`/harness-release`)

Project-agnostic pre-delivery verification, adversarial defect hunting, and standalone release qualification pipeline under full `agent-harness` governance.
Source of Truth: `/Users/moeini/Dev/wpdev-platform/agent-harness/AGENTS.md` (Team E: Verify & Ship) | `bin/harness-release-check`.

---

## 1. Core Principles & Architectural Invariants

1. **Strict Production Parity:**
   Testing must occur against standalone built artifacts, never raw development checkouts with uncompiled Composer autoloaders, debug comments, or unbundled assets.
2. **The Desert Island Invariant:**
   Every built standalone plugin (`Profile S`) must operate autonomously without runtime dependency on `{plugin}-dev` or the shared framework (`wpdev`). If deactivating `wpdev` triggers an undefined function or class collision, the build fails.
3. **Fail-Closed Red Gate:**
   No code is modified until a reproducible synthetic scenario is authored in `{monitorDir}/scenarios/` and its failure (`RED`) is verified against the current build.
4. **Never Edit Dist Artifacts:**
   Source fixes occur strictly in `{wpContent}/plugins/{pluginSlug}-dev/` with TDD. Standalone artifacts are rebuilt mechanically via the central pipeline.
5. **Human-in-the-Loop Release Gate:**
   AI agents never deploy to production autonomously. Release requires an all-green test run, zero PHP notices/errors, clean packaging audit, and explicit human consent.
6. **Mandatory Pre-Build SemVer Bump Gate:**
   Building standalone plugins without an explicit SemVer version bump is strictly prohibited. Before triggering any rebuild pipeline or packaging, the version must be incremented in the source development tree based on change volume:
   - **`patch` (Small to Moderate / Bugfix):** Bugfixes, hardening, edge-case corrections, or minimal logic changes without compatibility breakage (e.g. `1.4.2` $\to$ `1.4.3`).
   - **`minor` (Substantive / Feature / Structural Refactor):** New feature capabilities, modular architectural additions, extensive refactoring, or substantive diff payloads (e.g. `1.4.2` $\to$ `1.5.0`).
   The target version must be synchronized across the main plugin header (`Version: x.y.z`), `composer.json`, and `package.json` (if present), and recorded in `CHANGELOG.md` before compilation begins.
7. **Build-System Supremacy (VITAL LAW — see §4):**
   No build-system workarounds in plugin code, ever; no project identities or per-project conditionals in starter-kit, ever. Violation blocks ship.
8. **The Triple-Gate Mutation Law (Anti-Read-Only Illusion):**
   For any administrative panel, settings page, or data-entry mutation, qualification testing must never rely on read-only (GET) HTTP 200 checks. Every admin settings test MUST execute a closed-loop 3-gate roundtrip:
   - **Gate A (Active Mutation):** Fill input with new value and submit real HTTP POST via browser automation.
   - **Gate B (Storage Receipt):** Query database directly (`wp option get` or SQL) to prove the new value persisted without wiping other tabs/fields.
   - **Gate C (Consumer Impact):** Load the frontend/consumer page in the browser and assert the DOM renders the newly updated state.
9. **Strict OPcache Invalidation:**
   Whenever standalone obfuscated plugins or new bytecode are deployed or switched, OPcache must be explicitly cleared (`opcache_reset()`) and verified, preventing stale bytecode execution or silent fatal crashes from mangled symbol discrepancies.
10. **Mandatory WPDev Anti-Pattern Cleanliness (`plugins/wpdev/skills/wpdev-panel-builder/references/anti-patterns.md`):**
    All candidate plugins and admin panels must be audited against the 99 canonical anti-patterns in `plugins/wpdev/skills/wpdev-panel-builder/references/anti-patterns.md`. Any violation (such as WP 6.7 JIT translation notices on `wpdev_load`/`plugins_loaded`, raw POST leaks, missing `<div class="wpdev-styling">` wrappers on CPT tabs, broken modal bindings, or coarse capability bypasses) is a P1 ship blocker and must be remediated in the `-dev` source before release qualification.
11. **Mandatory Database & Performance Baseline Gate:**
    Candidate release must never introduce:
    - Tables with `ENGINE=MyISAM` in transactional, order, or queue paths (must be `InnoDB`).
    - Unbounded queries (`posts_per_page => -1` or `numberposts => -1`).
    - `session_start()` or cookie writing on public frontend GET requests (bypassing Page Cache).
    - Unseeded options that trigger the Non-Existent Options Trap (`get_option()` query spikes).
    - Mechanical ripgrep scan suite from `harness-review` must be 100% clean.

---

## 2. Project Topology & Environment Mapping

The pipeline is project-agnostic and resolves these variables from the target workspace:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `{projectName}` | Project identifier | `my-project`, `shop-core` |
| `{pluginSlug}` | Plugin slug | `theme-panel`, `lms-portal` |
| `{siteUrl}` | Local testing URL | `https://{projectName}new.local` |
| `{monitorDir}` | Dedicated E2E monitor directory (optional) | `~/Dev/{projectName}-monitor` (or Docker WP-CLI fallback) |
| `{wpContent}` | WordPress content directory | `wordpress/wp-content` |
| `{container}` | Docker WordPress container | `{projectName}wp` |

---

## 3. The 8-Step Release Qualification Lifecycle

### Step 0: Pre-Flight Integrity & Leak Audit
Execute packaging gate:
```bash
/Users/moeini/Dev/wpdev-platform/agent-harness/bin/harness-release-check
```
Ensures zero active debug leases, no orphan manifests, and zero residual probe markers (`__HARNESS_DBG_PROBE_` or `_harness_probe`).

### Step 1: Environment Quarantine & Desert Island Activation
Isolate the runtime by shutting down development dependencies and activating standalone builds:
```bash
# Deactivate development source trees and shared framework
wp plugin deactivate {plugin-a}-dev {plugin-b}-dev wpdev --allow-root

# Activate standalone built plugins
wp plugin activate {plugin-a} {plugin-b} --allow-root

# Clear object cache and OPcache bytecode
wp cache flush --allow-root
wp eval "if (function_exists('opcache_reset')) { opcache_reset(); } echo 'OPcache flushed. System operational: ' . (defined('WPINC') ? 'YES' : 'NO');" --allow-root
```

### Step 2: Multi-Persona Adversarial Defect Hunting
Audit the system systematically across 4 distinct user personas:

1. **Admin & Backoffice Auditor:**
   - Screen IDs, List_Admin_Page table filters, Settings API tabs.
   - Cross-tab option wipe prevention, nonce validation (`check_admin_referer`), capability checks (`current_user_can`), and CSV export isolation.
   - **Form & Settings Mutation (The Triple-Gate Law):** Never certify an admin panel with GET-only page loads. Every settings/form flow must be tested via live submission (`POST`), database storage validation (`wp option get`), and frontend consumer rendering.
   - **WPDev Anti-Pattern Compliance:** Audit all modified admin screens and hooks against `plugins/wpdev/skills/wpdev-panel-builder/references/anti-patterns.md`. Verify zero translation calls before `init`, proper styling wraps, valid AJAX nonces and error handlers, `ob_clean()` payload hygiene, and correct deletion modal fields.
2. **Guest Storefront Auditor:**
   - Catalog browsing, cart pricing calculation, sale vs regular price consistency.
   - SEO metadata / schema tags, silent PHP warnings hidden in rendered HTML, blocking web checkout on app-only products.
3. **Customer Portal Auditor:**
   - Account dashboard, support tickets, wallet balance, Persian/Gregorian date conversions.
   - DRM / media player streaming access, IDOR protection on downloads and profile data.
4. **Auth & Security Gatekeeper:**
   - OTP replay attack mitigation (instant transient deletion upon successful verification).
   - Fixed-window rate limiting on login/registration, REST endpoint authorization (strict 401/403 for unauthenticated consumers).

**Defect Dossier Output Format:**
```markdown
### [DOMAIN-XX] Defect Title
- **File:** `src/Modules/Path/File.php:line`
- **Severity:** Critical | High | Medium
- **Root Cause:** Technical explanation of defect mechanism.
- **Expected Behavior:** Standard compliant behavior.
```

### Step 3 & 4: Monitor Scenario Codification & Clean Red Gate
For each confirmed defect, author an automated scenario in `{monitorDir}/scenarios/`:
```javascript
import { ok, fail, assert, assertNoPhpErrors } from '../lib/scenario.js';
export const name = 'XX-domain-feature: Scenario Title';
export async function run(page, ctx) {
  const startTime = Date.now();
  try {
    const res = await page.request.get(`${ctx.config.siteUrl}/wp-json/endpoint`);
    assert(res.status() === 403, `Expected 403, got ${res.status()}`);
    return ok(name, startTime, 'Access properly blocked');
  } catch (err) {
    return fail(name, startTime, err);
  }
}
```
**Execute Red Gate:**
```bash
# Option A: Dedicated Monitor Suite
cd {monitorDir} && npm run start:local

# Option B: Standalone Plugin Fallback (when no monitor directory exists)
docker exec -i {container} bash -c "cd /var/www/html/wp-content/plugins/{pluginSlug} && composer test"
```
**Mandatory Invariant:** All newly added reproducer scenarios or tests MUST FAIL (`RED`). Any test passing before source changes is invalid and rejected.

### Step 5: TDD Source Remediation in Development Tree
1. Edit code strictly in `{wpContent}/plugins/{pluginSlug}-dev/src/`. Never edit built or dist files.
2. Follow TDD: write unit test (`run-phpunit.sh`), apply minimal surgical patch, verify lint syntax:
   ```bash
   php -l {wpContent}/plugins/{pluginSlug}-dev/src/Modules/TargetFile.php
   ```

### Step 6: Pre-Build Version Bump, Central Rebuild Pipeline & Quality Probes

#### 6.1 Mandatory Pre-Build SemVer Bump Gate
**NON-NEGOTIABLE:** Never invoke the rebuild script or package artifacts with an unbumped version. Evaluate the change volume and bump the version in the source development tree (`{pluginSlug}-dev`) before compilation:
- **`patch` (حجم تغییرات کم تا متوسط / رفع باگ و پایداری):**
  - Use when changes are limited to bugfixes, regression patches, hardening, or minor logic corrections without backwards-incompatible shifts (e.g., `1.4.2` $\to$ `1.4.3`).
- **`minor` (حجم تغییرات عمده / قابلیت‌های جدید / ریفکتور ماژولار):**
  - Use when substantive features are added, new REST endpoints/admin screens are introduced, major architectural refactoring occurs, or significant code volume is modified (e.g., `1.4.2` $\to$ `1.5.0`).

**Manifest Synchronization Checklist:**
1. Main plugin header (`{pluginSlug}-dev/{pluginSlug}.php`):
   ```php
   /**
    * Plugin Name: ...
    * Version:     1.5.0
    */
   ```
2. `composer.json` (if present):
   ```json
   {
     "version": "1.5.0"
   }
   ```
3. `package.json` (if present):
   ```json
   {
     "version": "1.5.0"
   }
   ```
4. Record version bump and itemized changes in `CHANGELOG.md` or `TASK.md`.

#### 6.2 Standalone Compilation & Quality Probes
Recompile standalone plugins via project build pipeline:
```bash
node /Users/moeini/Dev/wpdev-platform/wp-starter-kit/packages/standalone-build/build-all-standalone-plugins.mjs \
  --config=build.config.json \
  --content-root=./wordpress/wp-content \
  --force --deploy
```
Assert all 7 quality probes pass (PHP syntax lint, obfuscation mangling, zero dev docs, framework closure isolation, manifest version synchronization).

### Step 7: Clean Green Gate & Zero Regression
Switch local environment back to the refreshed standalone build and re-run monitoring:
```bash
wp plugin deactivate {plugin-a}-dev {plugin-b}-dev wpdev --allow-root
wp plugin activate {plugin-a} {plugin-b} --allow-root
wp cache flush --allow-root
wp eval "if (function_exists('opcache_reset')) { opcache_reset(); }" --allow-root

cd {monitorDir} && npm run start:local
```
**Acceptance Criteria:**
- 100% of scenarios GREEN.
- **Triple-Gate Mutation Passed:** Any modified admin panel, settings tab, or form flow has completed the 3-gate cycle (Browser POST &rarr; Database Receipt &rarr; Frontend Consumer DOM).
- **OPcache Clean:** Zero stale bytecode or symbol collisions from mangled classes.
- Zero regressions in existing baseline tests.
- WordPress `debug.log` completely clean (`assertNoPhpErrors()`).
- Browser console free of unhandled exceptions.

### Step 8: Release Candidate Dossier & Human Deploy Gate
Compile and present the Release Candidate Dossier:
1. Itemized list of remediated defects.
2. Numeric test pass metric (e.g. `57/57 Passed in 42.8s`).
3. SHA-256 checksums of distribution ZIP packages.
4. Documented rollback plan.
5. Explicit confirmation prompt: *"Do you authorize deployment to the live/production environment?"*

---

## 4. VITAL LAW — Build-System Supremacy & Project-Agnostic Invariant

> **Status: NON-NEGOTIABLE. Violation = P1 ship blocker.** This law outranks convenience, deadlines, and "temporary" workarounds. There are no temporary workarounds — a workaround committed is a workaround shipped.

**Layer order (one-way dependency):** `starter-kit` (build system: scaffolder, generators, transformers, asset pipeline, release scripts, test scaffolding) is the **highest** layer. Plugins/themes (`-dev` trees included) are **implementation detail** — the lower layer.

**Direction 1 — No build-system workarounds in implementation layers:**
Plugin/theme/mu-plugin code MUST NOT contain shims, adapters, path assumptions, or conditional branches whose purpose is to compensate for a build-system defect or limitation. Detection test: *"Would this code be deletable if the build system were fixed?"* If yes, it lives in the wrong layer — delete it from the plugin and fix `starter-kit` instead.

**Direction 2 — The build system is project-agnostic (blind to its lower layers):**
`starter-kit` MUST NOT reference project identities — no project names, no plugin slugs, no client paths — and MUST NOT contain per-project `if`/special-cases in any build script, generator, transformer, or test scaffold. All variability flows exclusively through generic, schema-validated manifests (e.g., `build.config.json`), never through name-matched branches. The highest layer must not know its lower layers; a single custom `if` forks the pipeline per client and collapses maintainability and testability.

**Mechanical detection (Step 6 rebuild + adversarial review):**
```bash
# Inside starter-kit build/scaffold/transform paths: project identifiers must be absent.
rg -l -i 'tavangary|nikamooz|multisite|saltino' packages/ scripts/ bin/ 2>/dev/null
# Expected: no output. Any hit is a P1 violation.
```
Reviewers additionally flag any `if <project> ==` shape in the pipeline and any plugin-side shim compensating for pipeline behavior. A flagged violation returns the task to the correct layer; **ship stays blocked until the fix lands where it belongs.**

---

## 5. Operational Invariants

- **Zero Live Financial Transactions:** Never hit real payment gateways in production scenarios.
- **Zero Test Skips:** Never use `.only()` or `.skip()` in test scenarios.
- **Zero Hardcoded IDs:** IDs and tokens must be dynamically seeded or queried.
- **Zero Read-Only Settings Tests:** Testing an admin setting or form change by simply asserting HTTP 200 without executing the 3-gate mutation roundtrip (POST -> DB -> Frontend) is strictly classified as a test failure.
- **Mandatory OPcache Hygiene:** Standalone obfuscated plugin switches must always include an explicit OPcache reset before executing release gates.
- **Mandatory Clean Log:** Every test asserting HTTP 200 must also assert absence of PHP warnings or notices.
- **Mandatory Pre-Build SemVer Bump:** Never compile or package standalone plugins or distribution artifacts without incrementing the version in source manifests (`patch` for bugfixes/minor tweaks; `minor` for substantive/feature payloads). Built artifacts must reflect the new version across all headers and configuration files.
- **Build Isolation:** Build transformers and compilers execute on local machines only, never inside production containers.
