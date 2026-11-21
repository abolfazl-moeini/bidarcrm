import { setup as setupWpEnv } from "@wordpress/e2e-test-utils-playwright";

export default async function globalSetup(): Promise<void> {
  await setupWpEnv();
}
