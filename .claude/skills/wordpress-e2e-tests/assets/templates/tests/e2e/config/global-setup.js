/**
 * External dependencies
 */
import { request } from "@playwright/test";

/**
 * WordPress dependencies
 */
import { RequestUtils } from "@wordpress/e2e-test-utils-playwright";

/**
 * @param {import('@playwright/test').FullConfig} config Full Playwright config.
 * @returns {Promise<void>}
 */
async function globalSetup(config) {
  const { storageState, baseURL } = config.projects[0].use;
  const storageStatePath =
    typeof storageState === "string" ? storageState : undefined;

  const requestContext = await request.newContext({
    baseURL,
  });

  try {
    const requestUtils = new RequestUtils(requestContext, {
      storageStatePath,
    });

    await requestUtils.setupRest();

    // Guard destructive resets on shared or existing sites:
    // Only perform bulk deletion if running in disposable local wp-env
    // or explicitly authorized via WP_DISPOSABLE_ENV=true / WP_ALLOW_SHARED_RESET=true.
    const isSharedSite = Boolean(process.env.WP_BASE_URL);
    const allowSharedReset = process.env.WP_ALLOW_SHARED_RESET === "true";

    if (!isSharedSite || allowSharedReset) {
      await Promise.all([
        requestUtils.deleteAllPosts(),
        requestUtils.deleteAllBlocks(),
        requestUtils.resetPreferences(),
      ]);
    }
  } finally {
    await requestContext.dispose();
  }
}

export default globalSetup;
