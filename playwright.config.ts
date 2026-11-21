import { createRequire } from "node:module";
import { defineConfig } from "@playwright/test";
import baseConfig from "@wordpress/e2e-test-utils-playwright/config/base.config";

const require = createRequire(import.meta.url);

export default defineConfig({
  ...baseConfig,
  globalSetup: require.resolve("./tests/e2e/global-setup"),
  testDir: "./tests/e2e/specs",
  timeout: 60_000,
});
