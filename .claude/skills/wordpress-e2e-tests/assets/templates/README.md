# Copy these templates into a plugin or theme root

**Canonical for wp-starter-kit scaffolds:**  
`wp-starter-kit/packages/create-wp-project/src/generators/templates/e2e/`  
Keep this folder in sync with that tree.

```bash
PLUGIN_ROOT=/path/to/your-plugin
SKILL=~/.agents/skills/wordpress-e2e-tests  # or path to your installed skill

cp "$SKILL/assets/templates/.wp-env.json" "$PLUGIN_ROOT/"
cp "$SKILL/assets/templates/playwright.config.js" "$PLUGIN_ROOT/"
mkdir -p "$PLUGIN_ROOT/tests/e2e"
cp -R "$SKILL/assets/templates/tests/e2e/." "$PLUGIN_ROOT/tests/e2e/"
```

Merge [`package.json.partial`](package.json.partial) scripts and devDependencies into the project's `package.json`, then:

```bash
cd "$PLUGIN_ROOT"
npm install
npx playwright install --with-deps
npx wp-env start
npm run test:e2e
```

Interactive browser: `npm run test:e2e -- --ui`

**Soft-dep WPDev:** if the plugin has `Requires Plugins: wpdev`, set
`"plugins": ["../wpdev", "."]` in `.wp-env.json` (framework first). See
[wpdev-and-admin-ui.md](../../references/wpdev-and-admin-ui.md).

See [SKILL.md](../../SKILL.md) and [references/scaffolding.md](../../references/scaffolding.md).
