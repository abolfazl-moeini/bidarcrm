/**
 * Appearance of the Bidar themes: style (Bidar, Monochrome, Brut: one per theme), palette (light,
 * dark, or the one of the operating system) and density (comfortable, compact).
 *
 * A plain script, loaded before the stylesheet, so that a page opens directly in the right style
 * and palette instead of flashing the default ones. It sets on the root element:
 * - data-bidar-style: the style, read by css/bidar-style-*.css;
 * - data-bidar-scheme="light|dark": the resolved palette, read by css/bidar-dark.css;
 * - data-bidar-density: the density, read by css/bidar-density.css.
 *
 * The style is the one of the theme: its stylesheet is css/bidar.css or css/bidar-<style>.css, and
 * EspoCRM swaps it for the user's own theme once it has loaded the preferences. The palette and the
 * density are the user's preferences; the browser remembers all three, so that they apply before
 * EspoCRM has loaded, login page included. The top bar button announces a new choice with the
 * `bidar:appearance` event. Under another theme the attributes have no effect.
 */
(() => {
    const MODES = ['light', 'dark', 'system'];
    const DENSITIES = ['comfortable', 'compact'];
    // Styles are open-ended: a value without its stylesheet simply leaves the default look.
    const STYLE_PATTERN = /^[a-z][a-z-]{0,30}$/;

    const KEYS = {
        mode: 'bidar-color-scheme',
        style: 'bidar-style',
        density: 'bidar-density',
    };

    const isValid = {
        mode: value => MODES.includes(value),
        style: value => typeof value === 'string' && STYLE_PATTERN.test(value),
        density: value => DENSITIES.includes(value),
    };

    const DEFAULTS = {
        mode: 'light',
        style: 'bidar',
        density: 'comfortable',
    };

    // The stylesheet of a Bidar theme: css/bidar.css (Bidar) or css/bidar-<style>.css.
    const STYLESHEET = /\/bidar-theme\/css\/bidar(?:-([a-z]+))?\.css(?:[?#]|$)/;

    const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    const read = name => {
        try {
            const stored = localStorage.getItem(KEYS[name]);

            return isValid[name](stored) ? stored : DEFAULTS[name];
        } catch (e) {
            return DEFAULTS[name];
        }
    };

    const store = (name, value) => {
        try {
            localStorage.setItem(KEYS[name], value);
        } catch (e) {
            // Blocked storage: the choice still applies until the next page load.
        }
    };

    const state = {
        mode: read('mode'),
        style: read('style'),
        density: read('density'),
    };

    const ensureLayoutDefaults = () => {
        const root = document.documentElement;
        const lang = root.lang || '';

        if (/^(fa|ar|he|ur)(?:[-_]|$)/i.test(lang)) {
            root.dir = 'rtl';
        }

        if (document.body && !document.body.dataset.navbar && !document.getElementById('login') && document.body.classList.contains('has-navbar')) {
            document.body.dataset.navbar = 'side';
        }
    };

    const apply = () => {
        const root = document.documentElement;
        const isDark = state.mode === 'dark' || (state.mode === 'system' && !!media && media.matches);

        root.dataset.bidarScheme = isDark ? 'dark' : 'light';
        root.dataset.bidarStyle = state.style;
        root.dataset.bidarDensity = state.density;
        ensureLayoutDefaults();
    };

    apply();

    if (!document.body && document.addEventListener) {
        document.addEventListener('DOMContentLoaded', ensureLayoutDefaults, {once: true});
    }

    // System: follows the operating system when it switches, at nightfall for instance.
    if (media && media.addEventListener) {
        media.addEventListener('change', () => {
            if (state.mode === 'system') {
                apply();
            }
        });
    }

    // The style follows the theme's stylesheet, also when EspoCRM swaps it for the user's theme.
    const followStylesheet = link => {
        const update = () => {
            const match = (link.getAttribute('href') || '').match(STYLESHEET);
            const style = match ? (match[1] || DEFAULTS.style) : null;

            if (style && isValid.style(style) && style !== state.style) {
                state.style = style;
                store('style', style);
                apply();
            }
        };

        update();

        new MutationObserver(update).observe(link, {attributes: true, attributeFilter: ['href']});
    };

    const stylesheet = document.getElementById('main-stylesheet');

    if (stylesheet) {
        followStylesheet(stylesheet);
    } else if (window.MutationObserver) {
        // The page declares the stylesheet right after the scripts.
        const observer = new MutationObserver(() => {
            const link = document.getElementById('main-stylesheet');

            if (link) {
                observer.disconnect();
                followStylesheet(link);
            }
        });

        observer.observe(document.documentElement, {childList: true, subtree: true});
    }

    document.addEventListener('bidar:appearance', event => {
        const detail = event.detail || {};

        Object.keys(KEYS).forEach(name => {
            if (name in detail && isValid[name](detail[name])) {
                state[name] = detail[name];
                store(name, detail[name]);
            }
        });

        apply();
    });
})();
