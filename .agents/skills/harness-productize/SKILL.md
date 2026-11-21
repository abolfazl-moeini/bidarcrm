---
name: harness-productize
description: WordPress module/product extraction under agent-harness governance ("تیر چند نشان"). Evaluates bespoke client features against the Second Real Behavior Gate, designs seam interfaces and data-shaped catalogs (apply_filters), scaffolds standalone packages via wpdev create wpdev-<slug>, and runs double-test verification.
---

# Harness Productize (`/harness-productize`)

WordPress productization and module extraction workflow ("تیر چند نشان") under full `agent-harness` governance.
Source of Truth: `/Users/moeini/Dev/wpdev-platform/agent-harness/AGENTS.md` | `workflows/productize.md`.

## 1. Core Mission & Invariants

The goal is to turn custom client plugin work into reusable, monetizable product modules without expanding client scope or introducing brittle abstractions:

1. **Second Real Behavior Gate & Strategic Extraction:**
   - **Advisory Mode (during feature work):** If a feature is developed on client time, default to bespoke unless a second real project or client need actively requires it. Do not bloat client sprints with premature extraction.
   - **Dedicated Extraction Mode (Explicit `/harness-productize`):** When authorized by the human lead, the explicit goal is to transform bespoke features into clean, standalone, publishable plugins or packages ("تیر چند نشان"). Even if originally built for a single client, extraction must generalize all logic so it functions seamlessly across multiple independent WordPress installations without modification.
2. **De-Hardcoding & Generalization Law (Non-Negotiable):**
   - Zero client-specific hardcoding in extracted packages.
   - All client URLs, table prefixes, brand slugs, and hardcoded IDs must be converted into configurable options (`get_option`), dynamic filters (`apply_filters`), or WPDev settings panels.
3. **No Shared Composer FQCNs Across Plugins:**
   - One PHP process resolves an FQCN once; shared composer vendor trees cause silent ABI/version collision.
   - Cross-plugin contracts must be **data-shaped** via namespaced WordPress hooks:
     `$catalog = apply_filters('wpdev_ecosystem_catalog_v1', []);`
   - Internal interfaces stay private within each plugin's boundary. Use Lazy Factory closures rather than reflection DI containers.
4. **Scaffolding Source of Truth:**
   - Always use `wpdev create wpdev-<slug>` (never `generate`) via WP Starter Kit (`/Users/moeini/Dev/wpdev-platform/wp-starter-kit/`).
5. **Double-Test Invariant:**
   - Tests must pass GREEN in:
     1. The new standalone extracted package (`wpdev-<slug>`).
     2. The original client consumer codebase (confirming zero regression after consuming the extracted module).

---

## 2. Mode A: Advisory Scout (Feature Inspection & Backlog Discovery)

When invoked as an advisory check on an existing or planned feature:

1. **Interrogate the Seam:**
   - What core domain logic is generic (e.g., payment gateway adapter, SMS router, PDF generator, contest manager)?
   - What client-specific database tables, options, or hooks must be decoupled?
2. **Evaluate the Second Behavior Gate:**
   - Check registered projects in `projects/*.md`.
   - Is there an existing or queued need in another project?
   - If NO -> Record: `Decision: Bespoke only (single client). No extraction authorized.`
   - If YES -> Proceed to Seam Architecture.
3. **Draft the Seam Architecture:**
   - Define dependency inversion: replace hardcoded client tables with filterable options or hook interfaces.
   - Define data-shaped contract schema using `apply_filters`.
   - Estimate extraction complexity and target slug: `wpdev-<feature_slug>`.
4. **Record Findings in Task State:**
   - Write blueprint to Section 3 of `TASK.md` and Section 4 of `NEXT.md`.
   - **Do NOT modify client code or expand current sprint scope.**

---

## 3. Mode B: Dedicated Productize Task (Extraction Pipeline)

When an explicit extraction task is authorized by the human lead:

### Step 1: Scaffolding Standalone Package
1. Run the official starter-kit generator:
   ```bash
   node /Users/moeini/Dev/wpdev-platform/wp-starter-kit/packages/cli/bin/wpdev.js create wpdev-<slug>
   ```
2. Confirm package structure: `src/`, `tests/unit-tests/`, `composer.json`, `package.json`.

### Step 2: Seam Decoupling, De-Hardcoding & Generalization
1. **Move generic business logic** into the new package under small, verifiable checkpoints.
2. **Mechanical De-Hardcoding Scanner (MANDATORY):**
   - Execute the mechanical scanner against the package:
     ```bash
     harness-dehardcode-scan --target .
     ```
   - Must exit **0 (CLEAN)** before proceeding to release.
   - Enforces 4 mechanical ban classes:
     - **Domains & URLs:** Scans for hardcoded external URLs (replace with `home_url()`, `site_url()`, or admin settings options).
     - **Database Tables & Prefixes:** Scans for hardcoded `wp_` in SQL queries (enforce `$wpdb->prefix . 'table_name'`).
     - **Client Slugs & Branding:** Scans for customer identities from `projects/*.md` (replace with generic configurable identifiers).
     - **Unlocalized UI text:** Scans for raw Persian text outside WordPress gettext functions (`__('...', 'wpdev-<slug>')`).
3. Replace hardcoded client dependencies with filter hooks (`apply_filters`) and local configuration objects.
4. Keep PHP interfaces internal to the package namespace (`WpDev\<Slug>\...`).
5. **Honor the Build-System Supremacy law** (`skills/harness-release/SKILL.md §4`, VITAL): no build-pipeline workarounds inside the extracted package, and no project identities or per-project `if`s in any starter-kit generator/template it touches. Violation = P1 blocker.

### Step 3: Test Scaffolding & Verification (Double-Test)
1. **Isolated Package Tests:**
   - Run PHPUnit in the new plugin:
     ```bash
     bash tests/docker-phpunit/run-phpunit.sh
     ```
   - Must pass cleanly (GREEN).
2. **Consumer Regression Tests:**
   - Update client project to consume the extracted package or hook catalog.
   - Run the client project's test suite to ensure zero regression.

### Step 4: Adversarial Audit & Packaging
1. Adversarial review checks for leaked client secrets, hardcoded domain names, or residual tight coupling.
2. Build distribution zip from **inside the extracted package root**:
   ```bash
   npm run release # or composer release:dist / build-release-zip.sh
   ```
3. Record new module in `projects/` registry or `NEXT.md` for future project reuse.
