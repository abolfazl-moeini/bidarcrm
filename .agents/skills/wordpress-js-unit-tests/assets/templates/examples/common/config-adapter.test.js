/**
 * Runtime Configuration Adapter Module.
 * Safely reads PHP-localized settings injected via wp_localize_script
 * with defaults, validation, and defensive fallback.
 */
function getPluginConfig() {
  const localized = (typeof window !== 'undefined' && window.myPluginSettings) || {};

  return {
    restUrl: typeof localized.restUrl === 'string' ? localized.restUrl : '/wp-json/my-plugin/v1/',
    nonce: typeof localized.nonce === 'string' ? localized.nonce : '',
    locale: typeof localized.locale === 'string' ? localized.locale : 'en_US',
    canManage: Boolean(localized.capabilities && localized.capabilities.canManage),
  };
}

describe('Runtime Configuration Adapter: getPluginConfig', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      delete window.myPluginSettings;
    }
  });

  afterEach(() => {
    if (typeof window !== 'undefined') {
      delete window.myPluginSettings;
    }
  });

  it('returns default fallback configuration when window.myPluginSettings is missing', () => {
    const config = getPluginConfig();
    expect(config).toEqual({
      restUrl: '/wp-json/my-plugin/v1/',
      nonce: '',
      locale: 'en_US',
      canManage: false,
    });
  });

  it('reads localized configuration values accurately when defined', () => {
    if (typeof window === 'undefined') {
      global.window = {};
    }
    window.myPluginSettings = {
      restUrl: 'https://staging.example.com/wp-json/my-plugin/v1/',
      nonce: 'sec_nonce_9988',
      locale: 'fa_IR',
      capabilities: { canManage: true },
    };

    const config = getPluginConfig();
    expect(config.restUrl).toBe('https://staging.example.com/wp-json/my-plugin/v1/');
    expect(config.nonce).toBe('sec_nonce_9988');
    expect(config.locale).toBe('fa_IR');
    expect(config.canManage).toBe(true);
  });

  it('gracefully handles partially missing capability object', () => {
    if (typeof window === 'undefined') {
      global.window = {};
    }
    window.myPluginSettings = {
      restUrl: 'https://example.com/wp-json/',
      nonce: 'nonce_123',
    };

    const config = getPluginConfig();
    expect(config.canManage).toBe(false);
  });
});
