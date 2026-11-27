/**
 * Appearance of the Bidar themes (style, palette, density), shared by the top bar button.
 *
 * The appearance itself is applied by js/appearance.js, a plain script that runs before the
 * stylesheet: it sets data-bidar-style, data-bidar-scheme and data-bidar-density on the root
 * element and remembers the choices in the browser. This module asks it to apply a choice, and
 * makes EspoCRM's own theme parameters follow the palette.
 */

const EVENT = 'bidar:appearance';

/**
 * @param {{mode?: string, style?: string, density?: string}} choice
 */
export function applyAppearance(choice) {
    document.dispatchEvent(new CustomEvent(EVENT, {detail: choice}));
}

/**
 * @return {boolean}
 */
export function isDarkScheme() {
    return document.documentElement.dataset.bidarScheme === 'dark';
}

/**
 * EspoCRM reads parts of its look from theme parameters: `isDark` (e-mail bodies, code editors,
 * calendar shades), the e-mail stylesheets and the chart and calendar colours. Each Bidar theme
 * declares them for the light palette, while the dark palette is a choice of each user that can
 * follow the operating system. Each theme's `bidarDark` block holds the values to use in the dark
 * palette; they are returned while it applies. Views read them when they render, so a chart
 * already shown keeps its colours until it is displayed again.
 *
 * If a later EspoCRM version changes the theme manager, nothing is replaced: these elements then
 * keep the look of the light palette.
 *
 * @param {import('theme-manager').default} themeManager
 * @param {function(): boolean} isActive Whether a Bidar theme is in use.
 */
export function installThemeParams(themeManager, isActive) {
    if (!themeManager || typeof themeManager.getParam !== 'function' || themeManager.bidarThemeParams) {
        return;
    }

    const getParam = themeManager.getParam;

    themeManager.bidarThemeParams = true;

    // Names never taken from the dark palette; EspoCRM's getParam reads `params` and
    // `mappedParams` for every other name.
    const ownParams = ['bidarDark', 'bidarStyle', 'params', 'mappedParams'];

    // isActive() reads theme parameters too: while it runs, they come straight from the theme.
    let checking = false;

    themeManager.getParam = function (name) {
        if (!checking && !ownParams.includes(name) && isDarkScheme()) {
            checking = true;

            let active = false;

            try {
                active = isActive();
            } finally {
                checking = false;
            }

            // Read each time: the theme can change from the top bar without reloading the page.
            const darkParams = active ? asObject(getParam.call(this, 'bidarDark')) : null;

            if (darkParams && Object.prototype.hasOwnProperty.call(darkParams, name)) {
                return darkParams[name];
            }
        }

        return getParam.call(this, name);
    };
}

/**
 * @param {*} value
 * @return {Object|null}
 */
function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}
