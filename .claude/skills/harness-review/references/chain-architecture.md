# Harness Review: Chained Review Pipeline Architecture

This document defines the technical architecture of the extensible Chained Review Pipeline in `agent-harness`.

---

## 1. Pipeline Principles

1. **Modular Sub-Reviews (Chained Pipeline):** Reviews execute through modular sub-reviews. Each sub-review focuses on an orthogonal concern (e.g. Admin UX/Design, L8 Principal Architecture & Security, Ecosystem, Performance).
2. **Selective & Automated Execution:**
   - `--chain=all`: Runs all registered and active sub-reviews sequentially.
   - `--chain=<name>`: Runs only the specified sub-review (e.g. `--chain=design` or `--chain=principal`).
   - Default: Automatically routes target files to matching active sub-reviews (e.g. admin UI files trigger `admin-design`, PHP domain/endpoints/database trigger `principal`).
3. **Immutability & Report-Only Invariant:** A sub-review CANNOT modify code files. It strictly audits AST, data shapes, contracts, and security rules, emitting a structured P1/P2/P3 findings table.

---

## 2. Sub-Review Specification Contract

Every review link/sub-review must implement:
- **Identifier:** Unique kebab-case slug (e.g. `admin-design-review` / alias `design`, `principal-review` / alias `principal`).
- **Target Filter:** File globs or AST criteria defining eligible files.
- **Audit Rules & Checklist:** Concrete markdown checklist in `skills/harness-review/references/<slug>-checklist.md`.
- **Output Schema:** Unified findings array adhering to the P1/P2/P3 severity taxonomy with clear Sub-Review attribution.

---

## 3. Sub-Review Registry

| Sub-Review Identifier | Alias | Status | Primary Invariant Audited | Target Scope |
|---|---|---|---|---|
| `plan-review` | `plan` | **ACTIVE** | Scope & YAGNI, hook lifecycle, WooCommerce HPOS, prepared SQL, Two-Gate security, WPDev UX standards, defect memory alignment (`references/plan-review-checklist.md`) | `plan.md`, `TASK.md`, architecture proposals prior to code authoring |
| `admin-design-review` | `design` | **ACTIVE** | Compliance with 7 canonical UX families, pure PHP (Zero React on classic admin), Two-Gate security, safe deletion modals | Admin pages, tables, metaboxes, settings panels, wubox modals |
| `principal-review` | `principal` | **ACTIVE** | L8 Principal Engineering: Hexagonal domain decoupling, Strauss prefixing, Nonce != Capability, SQL `$wpdb->prepare`, late escaping, cache stampede prevention, no `wp_cache_flush`, typed PHP 8.4/7.4 | All PHP files, Domain/Application models, REST/AJAX endpoints, database queries & migrations |
| `ecosystem-review` | `ecosystem` | *PLANNED* | Cross-plugin contracts, `wpdev-ecosystem.json`, GEP 6-status resolution, 5-hop event bus | Ecosystem manifests, cross-plugin hooks |
| `i18n-review` | `i18n` | *PLANNED* | Gettext English sources, text domain consistency, safe translation escaping (`esc_html__`) | All localized strings |

---

## 4. How to Register a Future Sub-Review

To add a new sub-review (e.g. `ecosystem-review` or `i18n-review`):
1. **Create Checklist:** Author `skills/harness-review/references/<slug>-checklist.md` with explicit P1/P2/P3 rules.
2. **Register in SKILL.md:** Add the identifier and alias to the pipeline registry in `skills/harness-review/SKILL.md`.
3. **Update Dispatcher:** Define target file globs in `slash-workflows/harness-review.md`.
4. **Add Test Coverage:** Verify registry parsing and non-regression in `tests/test_slash_commands.py`.
