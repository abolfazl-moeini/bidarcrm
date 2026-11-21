---
name: wpdev-modal-forms
description: >-
  WPDev modal forms: wubox create modals via wpdev_register_form, custom row
  action ajax with SweetAlert2 or wubox result modals, registration lifecycle,
  capability checks, “Form not available” debugging, and stuck “Loading …”
  ajax-widget debugging (nonce 403, dead lifecycle hook, missing Vue dep). Use
  when user confirmed modal create, add-new popup, wpdev_get_form_url, wubox
  class, custom ajax row/tool-page action, missing form registry, modal authorization
  failure, or a spinner that never resolves. Open only after wpdev-panel-builder
  Phase 2 confirmation. Write to host plugin.
---

# WPDev Modal Forms

**Only open after user confirms** modal-create or a custom action modal
(including a tool-page job action) in orchestrator Phase 2.

## Paths

See [SHARED-PATHS.md](../SHARED-PATHS.md). Write to `@host`. Prefer inlined snippets in `references/`. `@examples` is optional.

## References

| Pattern | File |
|---------|------|
| Modal "Create new X" | [references/create-modal.md](references/create-modal.md) |
| Custom action → ajax → result modal | [references/custom-action-modal.md](references/custom-action-modal.md) |
| Register / render / handler lifecycle | [references/form-register-handler.md](references/form-register-handler.md) |
| Sub-entity line-item modal (`send` vs `redirect_url`) | [references/form-register-handler.md#sub-entity--line-item-modal-pattern-on-edit_admin_page](references/form-register-handler.md) |
| Bulk confirm `confirm` vs Vue `confirmed` | [../wpdev-list-ux/references/bulk-modal-context.md](../wpdev-list-ux/references/bulk-modal-context.md) |
| “Form not available” diagnosis | [references/form-not-available.md](references/form-not-available.md) |
| Stuck “Loading …” ajax widget diagnosis | [references/ajax-stuck-loading.md](references/ajax-stuck-loading.md) |

## Hard rules

- Register standalone forms on `wpdev_load`, or page-owned forms on
  `wpdev_register_forms`; attach callbacks before the selected hook fires.
- If a component boots after the hook fired, call only its idempotent registration function directly.
- Never re-hook `plugins_loaded` from code that boots on `wpdev_load` — that
  hook already fired and the callback silently never runs. `init` has not fired
  yet and can be valid for deferring host translations or non-form registration
  on normal requests. It is not valid for registries consumed by default
  light-Ajax, which can terminate during `plugins_loaded`; keep form and
  light-Ajax registry registration on the WPDev lifecycle hooks above.
- **Sub-Entity / Line-Item Modal on Edit Pages:** Never save the parent model (`$parent->save()`) and never return `redirect_url` in a modal that edits a sub-item on an `Edit_Admin_Page`. Return `send: { scope, function_name, data }` to update the parent page Vue state in-memory, listen for `wubox:load` to re-sync if the modal is re-opened, and let the parent page Save button persist atomically to MySQL.
- **SVG DOM `.className` Safety:** In admin scripts, never assign to `.className` on SVG DOM elements (`<svg>`, `<g>`, `<path>`) — modern browsers implement `SVGAnimatedString` as a read-only getter. Always use `.setAttribute('class', ...)` or `.classList`.
- Every ajax call to a `wpdev_register_ajax_handler` action must send the `nonce` field, or the handler must document `skip_nonce => true` with a capability gate (read-only only).
- Set `capability` and/or `'access'` explicitly and match the owning page/action plus handler check. `Form_Manager` enforces the **Two-Gate Defense-in-Depth Model**: Gate 1 verifies the native WP capability, and Gate 2 verifies the AccessManager domain policy via `wpdev_can( $access )`.
- Never assume “Form not available” means an absent registry entry; it also means capability or access policy denial.
- Built-in `delete_modal` defaults to phantom cap `wpdev_delete_{model}s` — host must set `wpdev_delete_modal_capability` to the page capability (or map via `user_has_cap`) or Delete always fails.
- Verify both the registry and an authenticated display request.

## Optional deeper reading

```bash
cd "{PLUGINS}"
git submodule add https://github.com/abolfazl-moeini/wpdev-examples.git wpdev-examples
```

Then (optional):

- Modal create: `@examples/domains/`
- Ajax row action: `@examples/webhooks/`

## Decision

| Create flow | List table `add_new` | Header button |
|-------------|---------------------|---------------|
| Modal | `url` = `wpdev_get_form_url()`, `classes` = `'wubox'` | `classes` = `'wubox'` |
| Full page | direct edit URL, `classes` = `''` | no `wubox` class |
