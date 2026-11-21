# Didar CRM WordPress Plugin

A full-featured WordPress CRM plugin modeled after Didar CRM (دیدار), providing visual deal Kanban pipelines, contacts and companies management, activity and task tracking, sales analytics, lead capture forms, Iranian SMS gateway integration, workflow automation, and granular role-based access control.

## Product identity (from wpdev.json — single source of truth)

| key | value |
|---|---|
| slug | `wpdev-didar-crm` |
| npmScope | `@wpdev-didar-crm` |
| globalName | `WpdevDidarCrm` |
| localizeVar | `WpdevDidarCrmLoc` |
| textDomain | `wpdev-didar-crm` |
| hookPrefix | `wpdev-didar-crm` |
| depsBundle | `wpdev-didar-crm-deps.js` |
| phpFunctionPrefix | `wpdev_didar_crm_` |
| uiFramework | `preact` |
| phpSourceVersion | `8.4` |

## Verification gates

| gate | command | stage |
|---|---|---|
| phpunit | `composer ...` | fast |
| jest | `npm ...` | fast |
| phpstan | `composer ...` | full |
| phpcs | `composer ...` | full |
| typecheck | `npm ...` | full |
| rector-dry | `vendor/bin/rector ...` | full |
| wp-env | `npx ...` | acceptance |
| e2e | `sh ...` | acceptance |
| dist | `composer ...` | package |
| php74-lint | `docker ...` | package |
| zip-install | `npx ...` | package |

## TDD rules (mechanically enforced)

- RED: write failing tests only under `tests/**`; production code untouched; tests must FAIL.
- GREEN: never edit `tests/**` or locked configs; smallest change that makes tests pass.
- Gate-0 violations are reverted automatically; repeated identical failures block the task.

## WordPress house rules (non-negotiable)

- Two-Gate security: `CapabilityPolicy::can()` AND `AccessManager::can_access()` for every
  user/admin action; strict `permission_callback` on all REST routes; nonce != capability.
- Hook callbacks use array syntax `[ClassName::class, 'method']` — never raw function strings.
- `load_plugin_textdomain` on `init` priority 1; zero gettext calls before `init`; English source strings.
- Never store serialized PHP objects in options/transients; primitive JSON arrays, `autoload=false`.
- Author PHP 8.1+, ship PHP 7.4 (Rector downgrade + PHP 7.4 lint gate).
- Tests extend `PluginBaseTestCase`; no `TRUNCATE`; no hard-coded IDs.
- Identity (slugs, namespaces, prefixes) comes from `wpdev.json` only — never hard-code.

## wpdev ecosystem doctrine (Plan 10)

- Naming: this plugin is a wpdev-family project module — slug `wpdev-didar-crm`; identity
  (slugs, namespaces, prefixes) comes from `wpdev.json` only, never hard-coded.
- Framework bugs are fixed at the ROOT: a defect in the wpdev framework is fixed in
  `wpdev-core` (github.com/abolfazl-moeini/wpdev-core), never patched inside the plugin.
- GitHub: the project repo (github.com/abolfazl-moeini/wpdev-didar-crm) receives EVERY
  step — commit after each completed step and `git push` immediately; never batch.
- Standalone/reusable modules: built from the brand-agnostic module boilerplate
  (github.com/abolfazl-moeini/module-boilerplate), deployed as git submodules under
  `src/Modules/{PascalCase}`, repo named `module-{name}`. BEFORE building a feature,
  check `gh repo view abolfazl-moeini/module-{feature}` for an existing module and
  prefer reuse.
- AI features: use the `wpdev/wpdev-system-one` decision-engine SDK (composer
  `wpdev/wpdev-system-one`; drivers `jev` / `openai-compatible`), never raw provider calls.
- Tests: functional/e2e live in the sibling `wpdev-didar-crm-monitoring` project
  (wp-env + Playwright); unit tests stay in this plugin.
- Workflow: plan first, review the plan with `harness-review` (adversarial), implement,
  then run `harness-review` on each implemented part; use the agent-harness tools
  (harness-triage/harness-debug) for defect hunting; admin UI follows the design
  language in `wpdev/skills` (wpdev-panel-builder + wpdev-admin-design).

## Features in scope

- Deals Pipeline & Kanban Board (core)
- Contacts & Companies Management (core)
- Activity & Task Tracking (core)
- Sales Reporting & Analytics (core)
- WordPress Lead Capture Forms (important)
- SMS Gateway & Email Notifications (important)
- Deal Automation & Workflow Triggers (important)
- Role-Based Access Control & Team Management (important)

## Skill routing

| task type | open skill |
|---|---|
| admin UI | wpdev-panel-builder (+ wpdev-admin-design, wpdev-list-ux, wpdev-edit-ux, wpdev-settings-dashboard) |
| PHP module | wpdev-php-modules |
| JS entry | wpdev-js-modules |
| PHP tests | wordpress-plugin-unit-tests |
| JS tests | wordpress-js-unit-tests |
| E2E | wordpress-e2e-tests |
| standards | wp-dev-standards |
| REST | wp-rest-api |
