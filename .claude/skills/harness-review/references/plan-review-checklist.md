# Plan Review Checklist — /harness-review plan

> Used by `/harness-review plan` to review, challenge, and improve `plan.md`, `TASK.md`, or architecture specifications before any code is written. Inspired by `/principal`, customized for enterprise WordPress and the WPDev framework.

---

## 1. Scope, Pragmatism & YAGNI (Kun Chen / Karpathy Rigor)
- [ ] **Exact Problem Definition:** Does the plan address the explicit user requirement without scope creep?
- [ ] **Over-Engineering Check:** Does it introduce unnecessary classes, premature event buses, or wrappers where a direct hook or function suffices?
- [ ] **Small Verifiable Checkpoints:** Is the plan broken down into numbered, verifiable steps where each step touches $\le 2$ files and $\le 80$ lines?
- [ ] **Early Red Gate:** Does the plan mandate a reproduction test (RED) before any production code is edited?

---

## 2. WordPress Architectural Invariants (L8 / Principal)
- [ ] **Hook Lifecycle Alignment:** Are hooks registered in the correct lifecycle phase (`plugins_loaded` for bootstrap, `init` for CPTs/taxonomies, `admin_init` for settings, `rest_api_init` for endpoints)?
- [ ] **WooCommerce HPOS Invariance:** If touching orders, does the plan use `wc_get_order()` and CRUD getters/setters instead of raw `get_post_meta($order_id)`?
- [ ] **Database & Query Hygiene:**
  - Are all SQL queries using `$wpdb->prepare()` with exact type specifiers (`%d`, `%s`, `%f`)?
  - Does it avoid `SELECT *` on large tables?
  - Does it avoid table-level locks (`MyISAM`) in transactional order flows?
- [ ] **Cache & Transients Strategy:**
  - Does the plan invalidate cache keys (`wp_cache_delete`) upon write?
  - Does it avoid the "Non-Existent Options Trap" (storing empty arrays or checking options without default fallback)?

---

## 3. Security & Access Control (Two-Gate Defense)
- [ ] **Capability $\neq$ Nonce Distinction:**
  - Gate 1 (Authorization): Is `current_user_can( 'manage_options' )` (or specific capability) verified?
  - Gate 2 (Intent / CSRF): Is `check_admin_referer()` or `wp_verify_nonce()` verified independently?
- [ ] **Sanitization & Late-Escaping:**
  - Input: `sanitize_text_field()`, `absint()`, `wp_unslash()`.
  - Output: `esc_html()`, `esc_attr()`, `esc_url()`, `wp_kses_post()`.
- [ ] **REST Route Permission Callback:** Does every REST route specify a strict `permission_callback` (never `__return_true` unless publicly intended and audited)?

---

## 4. WPDev & Modularity Standards
- [ ] **Admin UX Alignment:**
  - Does the admin interface adhere to the 7 canonical UX families (`wpdev-admin-design`)?
  - Is it pure PHP native with zero heavy React bundle where server rendering works?
  - Does it check for anti-patterns in `plugins/wpdev/skills/wpdev-panel-builder/references/anti-patterns.md`?
- [ ] **Module Boundaries (`wp-starter-kit`):**
  - Is the feature packaged under `src/Modules/<ModuleName>/` implementing `ModuleInterface`?
  - Are public hooks decoupled using `apply_filters` data contracts?

---

## 5. Output: Enhanced Plan Generation
When `/harness-review plan` runs:
1. Identify all gaps, vulnerabilities, and over-engineering.
2. Produce an **Enhanced Plan (`plan.md`)** with:
   - Clear architectural diagram.
   - Exact file hints and risk assessments.
   - Concrete checkpoint list ready for single-shot execution.
