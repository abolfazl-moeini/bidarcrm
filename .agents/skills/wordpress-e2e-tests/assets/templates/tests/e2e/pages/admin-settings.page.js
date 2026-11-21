/**
 * Page Object Model for WordPress Plugin Admin Settings Page.
 */
export class AdminSettingsPage {
  /**
   * @param {import("@playwright/test").Page} page
   * @param {import("@wordpress/e2e-test-utils-playwright").Admin} admin
   */
  constructor(page, admin) {
    this.page = page;
    this.admin = admin;

    // Web-first accessible locators
    this.heading = page.getByRole("heading", { name: "Plugin Settings", level: 1 });
    this.apiKeyInput = page.getByRole("textbox", { name: "API Key" });
    this.enableFeatureCheckbox = page.getByRole("checkbox", { name: "Enable Feature" });
    this.saveButton = page.getByRole("button", { name: "Save Changes" });
    this.successNotice = page.getByRole("status").filter({ hasText: "Settings saved" });
  }

  /**
   * Navigate to the plugin settings page via admin helper.
   */
  async goto() {
    await this.admin.visitAdminPage("options-general.php", "page=my-plugin-settings");
    await this.heading.waitFor({ state: "visible" });
  }

  /**
   * Update plugin settings with auto-waiting and proper persistence verification.
   * Uses fill() as default; uses setChecked() for checkbox controls.
   */
  async updateSettings({ apiKey, enableFeature }) {
    if (apiKey !== undefined) {
      await this.apiKeyInput.fill(apiKey);
    }
    if (enableFeature !== undefined) {
      await this.enableFeatureCheckbox.setChecked(enableFeature);
    }
    await this.saveButton.click();
    await this.successNotice.waitFor({ state: "visible" });
  }

  /**
   * Verifies that settings persist across page reloads.
   */
  async verifyPersistedSettings({ apiKey, enableFeature }) {
    await this.page.reload({ waitUntil: "domcontentloaded" });
    await this.heading.waitFor({ state: "visible" });

    if (apiKey !== undefined) {
      const value = await this.apiKeyInput.inputValue();
      if (value !== apiKey) {
        throw new Error(`Persisted apiKey mismatch: expected "${apiKey}", got "${value}"`);
      }
    }
    if (enableFeature !== undefined) {
      const checked = await this.enableFeatureCheckbox.isChecked();
      if (checked !== enableFeature) {
        throw new Error(`Persisted enableFeature mismatch: expected ${enableFeature}, got ${checked}`);
      }
    }
  }
}
