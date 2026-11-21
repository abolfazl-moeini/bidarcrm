---
name: wpdev-onboarding-ux
description: >-
  WPDev tours and constrained onboarding flows. wpdev_create_tour for guided
  admin UI; setup wizard constraint (no wpdev_register_wizard). Use when user
  confirmed tour, guide, onboarding, first-run help, or network setup step.
  Open only after wpdev-panel-builder Phase 2 confirmation. Read setup-wizard-
  constraint before any wizard-like flow.
---

# WPDev Onboarding UX

**Only open after user confirms** tour or onboarding flow in orchestrator Phase 2.

## Paths

See [SHARED-PATHS.md](../SHARED-PATHS.md). Write to `@host`. Prefer inlined snippets in `references/`. `@examples` is optional.

## References

| Pattern | File |
|---------|------|
| Tour guide | [references/tours.md](references/tours.md) |
| When to propose | [references/when-to-propose.md](references/when-to-propose.md) |
| Setup wizard constraint | [references/setup-wizard-constraint.md](references/setup-wizard-constraint.md) |

## Preferred ordering for guided UX

1. **`wpdev_create_tour()`** — short guided intro ([references/tours.md](references/tours.md))
2. **Edit-page tabs** (`add_tabs_widget`) — multi-section config without wizard chrome
3. **Domain `Wizard_Admin_Page`** with a **unique `$id`** — only if full multi-step chrome is still required
4. **`wpdev_setup_wizard` filter** — only for genuine network/first-run setup on fixed `wpdev-setup`

## Hard rules

- Multi-step wizards = `wpdev_register_wizard()` or subclass `Wizard_Admin_Page` with a **unique `$id`** (e.g. `my-plugin-setup`) — see [setup-wizard-constraint.md](references/setup-wizard-constraint.md).
- **Never** subclass `Setup_Wizard_Admin_Page` for a domain feature (it is the fixed network installer in `@examples/system/`).
- `process_save()` is **final** — use section `handler`s.
- Tour `attachTo` selectors must be real — do not invent CSS selectors.
