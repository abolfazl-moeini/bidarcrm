# When to propose tour / onboarding

## Propose a tour when

- Multi-step builder UI (checkout forms, complex editors)
- Page has ≥3 metaboxes with non-obvious primary actions
- User is new to a domain-specific workflow

## Do not propose a tour when

- Simple CRUD list + edit (empty state + badges are enough)
- User did not confirm in Phase 2

## Propose onboarding / wizard-like flow when

- First-run multi-step configuration for a **domain** feature
- User explicitly asks for guided setup

## Prefer instead of wizard UI

1. Short `wpdev_create_tour()` sequence
2. Multi-step `add_tabs_widget` on `Edit_Admin_Page`
3. Only if user needs step-by-step full-page flow: see [setup-wizard-constraint.md](setup-wizard-constraint.md)

## Network / first-run setup only

If the request is genuinely about **network onboarding** (adding a step to `wpdev-setup`), propose the `wpdev_setup_wizard` filter — not a new wizard page.

For domain-specific first-run flows, never suggest a standalone wizard page unless the user explicitly insists **and** you have followed the full verification + Phase 2 confirmation in [setup-wizard-constraint.md](setup-wizard-constraint.md). Prefer tour or tabs.