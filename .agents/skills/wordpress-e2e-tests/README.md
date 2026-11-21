# WordPress E2E Tests Skill

Personal Cursor agent skill for **real-browser** WordPress E2E tests using the official stack:

- [Playwright](https://playwright.dev/)
- [`@wordpress/e2e-test-utils-playwright`](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-e2e-test-utils-playwright/)
- [`@wordpress/env`](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-env/) (Docker)
- [`@wordpress/scripts`](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-scripts/) `test-playwright`

Covers **wp-admin** and the **public front end**. Complements [wordpress-plugin-unit-tests](../wordpress-plugin-unit-tests/SKILL.md).

Start with [SKILL.md](SKILL.md). Copy templates from [assets/templates/](assets/templates/) into a plugin or theme root.

## Sync with wp-starter-kit

For plugins scaffolded by `@wpdev/create-wp-project`, the **canonical** templates live in:

`wp-starter-kit/packages/create-wp-project/src/generators/templates/e2e/`

Keep this skill's `assets/templates/` aligned with that tree when either changes. Feature id: `e2eTest` (`none` | `playwright`).

## References

- [Getting started writing WordPress E2E Tests with Playwright (May 2026)](https://developer.wordpress.org/news/2026/05/getting-started-writing-wordpress-e2e-tests-with-playwright/)
- [End-to-End Testing – Block Editor Handbook](https://developer.wordpress.org/block-editor/contributors/code/testing-overview/e2e/)
- [WordPress core `tests/e2e`](https://github.com/WordPress/wordpress-develop/tree/trunk/tests/e2e)
