import {el} from 'bidar-theme:bidar';

/** Collapsible blocks: layout panels and side panels (Activities, History…). */
const PANEL_SELECTOR = [
    '.bidar-inspector-card .middle > .panel[data-name]',
    '.bidar-content-card .middle > .panel[data-name]',
    '.bidar-inspector > .side > .panel[data-name]:not([data-name="default"])',
].join(', ');

/** Watched areas: panels are redrawn there after each change. */
const WATCHED_SELECTOR = '.bidar-inspector, .bidar-content-card, .bidar-main';

/** Heading elements that keep their own click behaviour. */
const INTERACTIVE_SELECTOR = 'a, button, input, select, [data-action], .dropdown-menu';

/** Reserved names for the "About" card and the bottom panels block. */
const ABOUT = 'bidarAbout';
const BOTTOM = 'bidarBottom';

const STORAGE_TYPE = 'bidarCollapsedPanels';

/**
 * Folds the record blocks like accordions. The state is remembered per user and per
 * record type, in the browser; while editing, every block stays open.
 */
export default class PanelCollapse {

    /**
     * @param {import('views/record/detail').default} view
     */
    constructor(view) {
        this.view = view;
        this.storageName = `${view.getUser().id}-${view.entityType}`;
        this.collapsed = new Set(this.load());
        this.observer = null;
        this.scheduled = false;
    }

    init() {
        this.view.listenTo(this.view, 'after:render', () => this.observe());
        this.view.once('remove', () => this.observer && this.observer.disconnect());
    }

    /** @private */
    observe() {
        const root = this.view.element;

        if (this.observer) {
            this.observer.disconnect();
        }

        if (!root) {
            return;
        }

        this.observer = new MutationObserver(() => this.schedule());

        root.querySelectorAll(WATCHED_SELECTOR).forEach(target => {
            this.observer.observe(target, {childList: true, subtree: true});
        });

        this.schedule();
    }

    /** @private */
    schedule() {
        if (this.scheduled) {
            return;
        }

        this.scheduled = true;

        requestAnimationFrame(() => {
            this.scheduled = false;
            this.update();
        });
    }

    /** @private */
    update() {
        const root = this.view.element;

        if (!root) {
            return;
        }

        root.querySelectorAll(PANEL_SELECTOR).forEach(panel => {
            const heading = panel.querySelector(':scope > .panel-heading');
            const title = heading && heading.querySelector('.panel-title');

            // A panel without a title (often the first group of fields) has nothing to collapse.
            if (title && title.textContent.trim()) {
                this.decorate(panel, heading, title.textContent.trim(), panel.dataset.name);
            }
        });

        const inspector = root.querySelector('.bidar-inspector');
        const aboutTitle = inspector && inspector.querySelector('.bidar-inspector-title');

        this.decorateTracking(inspector);

        const aboutContent = inspector && inspector.querySelector(':scope > .bidar-inspector-card > .middle, :scope > .side > .panel[data-name="default"]');

        if (aboutTitle && aboutContent) {
            this.decorate(inspector, aboutTitle, aboutTitle.textContent.replace('+', '').trim(), ABOUT);
        }

        this.decorateContentCard(root);
        this.decorateBottom(root);
    }

    /**
     * Classic layout: the fields card has the same "About" title as in the Split layout.
     *
     * @private
     * @param {HTMLElement} root
     */
    decorateContentCard(root) {
        const card = root.querySelector('.bidar-layout-classic .bidar-content-card');
        const title = card && card.querySelector(':scope > .bidar-inspector-title');

        if (title) {
            this.decorate(card, title, title.textContent.replace('+', '').trim(), ABOUT);
        }
    }

    /**
     * Bottom panels block: the tab bar is its heading. The bottom view rebuilds the bar when the
     * tab changes, so it is decorated again each time. A click on a tab opens a collapsed block.
     *
     * @private
     * @param {HTMLElement} root
     */
    decorateBottom(root) {
        const main = root.querySelector('.bidar-main');
        const bar = main && main.querySelector('.bidar-tabbar');

        if (!bar) {
            return;
        }

        if (!bar.querySelector(':scope > .bidar-collapse')) {
            bar.addEventListener('click', event => {
                if (event.target.closest('.bidar-tab') && this.collapsed.has(BOTTOM)) {
                    this.toggle(BOTTOM);
                }
            });
        }

        const activeLabel = bar.querySelector('.bidar-tab[aria-pressed="true"] .bidar-tab-label');

        this.decorate(main, bar, activeLabel ? activeLabel.textContent : bar.getAttribute('aria-label'), BOTTOM);
    }

    /**
     * Record info (assignee, teams, dates): EspoCRM gives it no title. When it forms a separate
     * card, it gets a heading so that it can be collapsed. Only the content variant joins it to
     * an "About" card without fields, whose title already covers it.
     *
     * @private
     * @param {HTMLElement|null} inspector
     */
    decorateTracking(inspector) {
        const panel = inspector && inspector.querySelector(':scope > .side > .panel[data-name="default"]');

        if (!panel || inspector.querySelector(':scope > .bidar-inspector-card:not(:has(> .middle))')) {
            return;
        }

        let heading = panel.querySelector(':scope > .panel-heading');

        if (!heading) {
            heading = el('div', 'panel-heading bidar-added-heading');
            heading.append(el('h4', 'panel-title', this.view.translate('bidarRecordInfo', 'labels', 'Global')));
            panel.prepend(heading);
        }

        const title = heading.querySelector('.panel-title');

        if (title && title.textContent.trim()) {
            this.decorate(panel, heading, title.textContent.trim(), 'default');
        }
    }

    /**
     * @private
     * @param {HTMLElement} target Element that carries the collapsed state.
     * @param {HTMLElement} heading
     * @param {string} label
     * @param {string} name
     */
    decorate(target, heading, label, name) {
        let button = heading.querySelector(':scope > .bidar-collapse');

        if (!button) {
            button = el('button', 'bidar-collapse btn btn-text btn-icon');
            button.type = 'button';
            button.append(el('span', 'fas fa-chevron-down'));
            button.addEventListener('click', () => this.toggle(name));

            heading.classList.add('bidar-collapsible');
            heading.append(button);

            heading.addEventListener('click', event => {
                if (event.target.closest(INTERACTIVE_SELECTOR) || this.isEditing()) {
                    return;
                }

                this.toggle(name);
            });
        }

        const collapsed = this.collapsed.has(name);

        target.classList.toggle('bidar-collapsed', collapsed);
        button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');

        const text = `${this.view.translate(collapsed ? 'Expand' : 'Collapse', 'labels', 'Global')} ${label}`;

        if (button.title !== text) {
            button.title = text;
            button.setAttribute('aria-label', text);
        }
    }

    /**
     * @private
     * @param {string} name
     */
    toggle(name) {
        if (this.collapsed.has(name)) {
            this.collapsed.delete(name);
        } else {
            this.collapsed.add(name);
        }

        this.save();
        this.update();
    }

    /**
     * @private
     * @return {boolean}
     */
    isEditing() {
        const editButtons = this.view.element && this.view.element.querySelector('.bidar-band .edit-buttons');

        return !!editButtons && !editButtons.classList.contains('hidden');
    }

    /**
     * @private
     * @return {string[]}
     */
    load() {
        const stored = this.view.getStorage().get(STORAGE_TYPE, this.storageName);

        return Array.isArray(stored) ? stored : [];
    }

    /** @private */
    save() {
        this.view.getStorage().set(STORAGE_TYPE, this.storageName, [...this.collapsed]);
    }
}
