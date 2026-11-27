import {ACTIVITY_PANELS, el} from 'bidar-theme:bidar';

const ACTIVITY_TAB = 'activity';
const MORE_TAB = 'bidar-more';

/**
 * Main column of the Bidar record view: an Activity tab (quick actions, then the stream) and
 * one tab per relationship panel. Tabs defined by the administrator in the bottom layout
 * group their panels under their label. The panels shown are those of the bottom layout,
 * as in EspoCRM; side panels stay on the left.
 * Applies to the bottom view configured for the entity, standard or custom.
 *
 * @param {typeof import('views/record/detail-bottom').default} Base
 */
export default function bidarDetailBottom(Base) {
    return class extends Base {

        /** @private */
        bidarTab = ACTIVITY_TAB

        /** @private */
        bidarBoundViews = new Set()

        alterPanels(layoutData) {
            const data = {...(layoutData || this.layoutData || {})};

            // Tabs replace the panels' "show more".
            delete data._delimiter_;

            this.layoutData = data;

            super.alterPanels(data);
        }

        afterRender() {
            super.afterRender();

            this.bidarRenderTabs();
            this.bidarWatchResize();
        }

        /** @private */
        bidarWatchResize() {
            if (this.bidarResizeHandler) {
                return;
            }

            let timer;

            this.bidarResizeHandler = () => {
                clearTimeout(timer);
                timer = setTimeout(() => this.bidarRefresh(), 150);
            };

            window.addEventListener('resize', this.bidarResizeHandler);

            this.once('remove', () => window.removeEventListener('resize', this.bidarResizeHandler));
        }

        showPanel(...args) {
            const result = super.showPanel(...args);

            this.bidarRefresh();

            return result;
        }

        hidePanel(...args) {
            const result = super.hidePanel(...args);

            this.bidarRefresh();

            return result;
        }

        /** @private */
        bidarRefresh() {
            if (this.isRendered()) {
                this.bidarRenderTabs();
            }
        }

        /**
         * @private
         * @return {boolean}
         */
        bidarIsEnabled() {
            return this.mode === 'detail' && !!this.element;
        }

        /**
         * @private
         * @return {HTMLElement[]}
         */
        bidarGetPanels() {
            return [...this.element.querySelectorAll(':scope > .panel[data-name]')];
        }

        /**
         * @private
         * @return {{id: string, label: string, names: string[]}[]}
         */
        bidarGetTabs() {
            const panels = this.bidarGetPanels().filter(panel => !panel.classList.contains('hidden'));
            const activityNames = panels
                .map(panel => panel.dataset.name)
                .filter(name => ACTIVITY_PANELS.includes(name));

            const tabs = [];

            if (activityNames.length) {
                tabs.push({
                    id: ACTIVITY_TAB,
                    label: this.translate('Stream', 'labels', 'Global'),
                    names: activityNames,
                });
            }

            const nativeTabs = this.hasTabs ? this.getTabDataList() : [];
            const nativeGroups = new Map();

            panels
                .filter(panel => !ACTIVITY_PANELS.includes(panel.dataset.name))
                .forEach(panel => {
                    const name = panel.dataset.name;
                    const title = panel.querySelector(':scope > .panel-heading .panel-title');
                    const label = (title ? title.textContent : name).replace(/\s+/g, ' ').trim();
                    const item = this.panelList.find(panelItem => panelItem.name === name);
                    const tabNumber = this.hasTabs && item ? item.tabNumber : -1;

                    if (tabNumber === -1 || tabNumber === undefined || !nativeTabs[tabNumber]) {
                        tabs.push({id: name, label, names: [name]});

                        return;
                    }

                    if (!nativeGroups.has(tabNumber)) {
                        const group = {id: `bidar-native-${tabNumber}`, label: nativeTabs[tabNumber].label, names: []};

                        nativeGroups.set(tabNumber, group);
                        tabs.push(group);
                    }

                    nativeGroups.get(tabNumber).names.push(name);
                });

            return tabs;
        }

        /** @private */
        bidarRenderTabs() {
            if (!this.bidarIsEnabled()) {
                return;
            }

            const root = this.element;

            root.classList.add('bidar-bottom');
            root.querySelectorAll(':scope > .bidar-tabbar, :scope > .bidar-composer').forEach(item => item.remove());

            const tabs = this.bidarGetTabs();

            if (!tabs.length) {
                return;
            }

            if (!tabs.find(tab => tab.id === this.bidarTab)) {
                this.bidarTab = tabs[0].id;
            }

            const bar = this.bidarBuildTabBar(tabs, tabs.length);

            root.prepend(bar);

            this.bidarFitTabBar(tabs, bar);

            const composer = this.bidarBuildComposer();

            if (composer) {
                root.querySelector(':scope > .bidar-tabbar').after(composer);
            }

            this.bidarApplyTab(tabs);
            this.bidarBindCounts(tabs);
            this.bidarUpdateCounts();
        }

        /**
         * As many tabs as the width allows, the rest under "More". Decided once the browser has
         * laid out the bar, before it is painted: measuring earlier would force an extra layout.
         *
         * @private
         * @param {{id: string, label: string, names: string[]}[]} tabs
         * @param {HTMLElement} firstBar
         */
        bidarFitTabBar(tabs, firstBar) {
            if (this.bidarFitObserver) {
                this.bidarFitObserver.disconnect();
            }

            this.bidarFitObserver = new ResizeObserver(() => {
                this.bidarFitObserver.disconnect();

                if (!firstBar.isConnected || firstBar.scrollWidth <= firstBar.clientWidth + 1) {
                    return;
                }

                let bar = firstBar;

                for (let count = tabs.length - 1; count >= 1 && bar.scrollWidth > bar.clientWidth + 1; count--) {
                    const smaller = this.bidarBuildTabBar(tabs, count);

                    bar.replaceWith(smaller);
                    bar = smaller;
                }

                this.bidarUpdateCounts();
            });

            this.bidarFitObserver.observe(firstBar);
        }

        /**
         * @private
         * @param {{id: string, label: string, names: string[]}[]} tabs
         * @param {number} visibleCount
         * @return {HTMLElement}
         */
        bidarBuildTabBar(tabs, visibleCount) {
            const bar = el('div', 'bidar-tabbar');

            // Toggle buttons (aria-pressed) in a named group: the ARIA "tabs" pattern
            // would assume one panel per tab and arrow-key navigation.
            bar.setAttribute('role', 'group');
            bar.setAttribute('aria-label', this.translate(this.scope, 'scopeNames'));

            const visible = tabs.slice(0, visibleCount);
            const overflow = tabs.slice(visibleCount);

            visible.forEach(tab => bar.append(this.bidarBuildTab(tab)));

            if (overflow.length) {
                const group = el('div', 'btn-group bidar-tab-more');
                const toggle = el('button', 'bidar-tab dropdown-toggle');
                const current = overflow.find(tab => tab.id === this.bidarTab);

                toggle.type = 'button';
                toggle.dataset.toggle = 'dropdown';
                toggle.dataset.bidarTab = MORE_TAB;
                toggle.setAttribute('aria-haspopup', 'true');
                toggle.setAttribute('aria-expanded', 'false');
                toggle.setAttribute('aria-pressed', current ? 'true' : 'false');
                toggle.append(current ? current.label : this.translate('More', 'labels', 'Global'));
                toggle.append(el('span', 'caret'));

                const menu = el('ul', 'dropdown-menu pull-right');

                overflow.forEach(tab => {
                    const item = el('li');
                    const link = el('a', 'bidar-tab-more-item');

                    link.setAttribute('role', 'button');
                    link.tabIndex = 0;
                    link.dataset.bidarTab = tab.id;

                    if (tab.id === this.bidarTab) {
                        link.setAttribute('aria-current', 'true');
                    }

                    link.append(el('span', '', tab.label), el('span', 'bidar-tab-count', ''));
                    link.addEventListener('click', () => this.bidarSelectTab(tab.id));

                    // A link without an href doesn't react to Enter: the keyboard goes through here.
                    link.addEventListener('keydown', event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            this.bidarSelectTab(tab.id);
                        }
                    });

                    item.append(link);
                    menu.append(item);
                });

                group.append(toggle, menu);
                bar.append(group);
            }

            return bar;
        }

        /**
         * @private
         * @param {{id: string, label: string}} tab
         * @return {HTMLElement}
         */
        bidarBuildTab(tab) {
            const button = el('button', 'bidar-tab');

            button.type = 'button';
            button.dataset.bidarTab = tab.id;
            button.setAttribute('aria-pressed', tab.id === this.bidarTab ? 'true' : 'false');
            button.append(el('span', 'bidar-tab-label', tab.label));

            if (tab.id !== ACTIVITY_TAB) {
                button.append(el('span', 'bidar-tab-count', ''));
            }

            button.addEventListener('click', () => this.bidarSelectTab(tab.id));

            return button;
        }

        /**
         * @private
         * @param {string} id
         */
        bidarSelectTab(id) {
            this.bidarTab = id;
            this.bidarRenderTabs();
        }

        /**
         * @private
         * @param {{id: string, names: string[]}[]} tabs
         */
        bidarApplyTab(tabs) {
            const current = tabs.find(tab => tab.id === this.bidarTab);
            const shown = current ? current.names : [];

            this.element.classList.toggle('bidar-tab-activity', this.bidarTab === ACTIVITY_TAB);

            this.bidarGetPanels().forEach(panel => {
                const name = panel.dataset.name;
                const wasHidden = panel.classList.contains('bidar-tab-hidden') || panel.classList.contains('tab-hidden');
                const isShown = shown.includes(name);

                panel.classList.toggle('bidar-tab-hidden', !isShown);

                if (isShown) {
                    // Hidden native tab: EspoCRM only loads the panel when it is shown.
                    panel.classList.remove('tab-hidden');
                }

                if (isShown && wasHidden) {
                    const view = this.getPanelView(name);

                    if (view) {
                        view.trigger('tab-show');
                        view.propagateEvent('panel-show-propagated');
                    }
                }
            });

            if (this.bidarTab === ACTIVITY_TAB) {
                this.bidarOrderActivityPanels(shown);
            }
        }

        /**
         * The Activity tab follows the layout order; quick actions stay first.
         * The stream is split up (heading, lists): its order goes through CSS variables set
         * on the panel element, which survives re-renders of the stream view.
         *
         * @private
         * @param {string[]} names
         */
        bidarOrderActivityPanels(names) {
            let order = 2;

            this.bidarGetPanels()
                .filter(panel => names.includes(panel.dataset.name))
                .forEach(panel => {
                    if (panel.dataset.name === 'stream') {
                        panel.style.setProperty('--bidar-stream-order', String(order++));
                        panel.style.setProperty('--bidar-stream-list-order', String(order++));

                        return;
                    }

                    panel.style.order = String(order++);
                });
        }

        /**
         * Quick actions: each button triggers the native action of the matching panel,
         * which only exists if the user is allowed to create.
         *
         * @private
         * @return {HTMLElement|null}
         */
        bidarBuildComposer() {
            if (this.bidarTab !== ACTIVITY_TAB) {
                return null;
            }

            const items = [
                {
                    kind: 'note',
                    label: this.translate('Note', 'scopeNames'),
                    icon: 'fas fa-pen',
                    run: this.bidarLazy('.panel[data-name="stream"] .post-container:not(.hidden) textarea', 'focus'),
                },
                {
                    kind: 'email',
                    label: this.translate('Email', 'scopeNames'),
                    icon: 'fas fa-envelope',
                    run: this.bidarFindAction('activities', 'composeEmail'),
                },
                {
                    kind: 'call',
                    label: this.translate('Call', 'scopeNames'),
                    icon: 'fas fa-phone',
                    run: this.bidarFindActivityAction('Call'),
                },
                {
                    kind: 'meeting',
                    label: this.translate('Meeting', 'scopeNames'),
                    icon: 'fas fa-calendar-check',
                    run: this.bidarFindActivityAction('Meeting'),
                },
                {
                    kind: 'task',
                    label: this.translate('Task', 'scopeNames'),
                    icon: 'fas fa-check-square',
                    run: this.bidarFindAction('tasks', 'createTask') || this.bidarFindAction('tasks', 'createRelated'),
                },
            ].filter(item => item.run);

            if (!items.length) {
                return null;
            }

            const composer = el('div', 'bidar-composer');
            const label = this.translate('Create', 'labels', 'Global');
            const hasPost = !!this.element
                .querySelector('.panel[data-name="stream"]:not(.hidden) .post-container:not(.hidden)');

            // Without a note field below, the quick actions box closes at the bottom.
            composer.classList.toggle('bidar-composer-solo', !hasPost);

            composer.setAttribute('role', 'group');
            composer.setAttribute('aria-label', label);

            items.forEach(item => {
                const button = el('button', 'bidar-composer-button');

                button.type = 'button';
                button.dataset.kind = item.kind;
                button.append(el('span', item.icon + ' bidar-composer-icon'), el('span', '', item.label));
                button.addEventListener('click', () => item.run());

                composer.append(button);
            });

            return composer;
        }

        /**
         * @private
         * @param {string} panel
         * @param {string} action
         * @return {function(): void|null}
         */
        bidarFindAction(panel, action) {
            return this.bidarLazy(`.panel[data-name="${panel}"] [data-action="${action}"]`, 'click');
        }

        /**
         * Actions also come from side panels: the whole record is searched.
         *
         * @private
         * @return {HTMLElement}
         */
        bidarRecordRoot() {
            return this.element.closest('.bidar-record') || this.element;
        }

        /**
         * @private
         * @param {string} entityType
         * @return {function(): void|null}
         */
        bidarFindActivityAction(entityType) {
            const base = '.panel[data-name="activities"] [data-action="createActivity"]';

            const target = [...this.bidarRecordRoot().querySelectorAll(base)].find(item => {
                if (item.dataset.scope) {
                    return item.dataset.scope === entityType;
                }

                return item.dataset.link && this.model.getLinkParam(item.dataset.link, 'entity') === entityType;
            });

            if (!target) {
                return null;
            }

            const selector = target.dataset.scope ?
                `${base}[data-scope="${target.dataset.scope}"]` :
                `${base}[data-link="${target.dataset.link}"]`;

            return this.bidarLazy(selector, 'click');
        }

        /**
         * Finds the target at click time: panels are redrawn independently.
         *
         * @private
         * @param {string} selector
         * @param {'click'|'focus'} method
         * @return {function(): void|null}
         */
        bidarLazy(selector, method) {
            if (!this.bidarRecordRoot().querySelector(selector)) {
                return null;
            }

            return () => {
                const target = this.bidarRecordRoot().querySelector(selector);

                if (target) {
                    target[method]();
                }
            };
        }

        /**
         * @private
         * @param {{id: string, names: string[]}[]} tabs
         */
        bidarBindCounts(tabs) {
            tabs.filter(tab => tab.id !== ACTIVITY_TAB).forEach(tab => {
                const view = this.getPanelView(tab.id);

                if (!view || this.bidarBoundViews.has(view)) {
                    return;
                }

                this.bidarBoundViews.add(view);
                this.listenTo(view, 'after:render', () => this.bidarUpdateCounts());

                if (view.collection) {
                    this.listenTo(view.collection, 'sync reset update', () => this.bidarUpdateCounts());
                }
            });
        }

        /** @private */
        bidarUpdateCounts() {
            if (!this.element) {
                return;
            }

            this.element.querySelectorAll('.bidar-tabbar [data-bidar-tab]').forEach(item => {
                const count = item.querySelector('.bidar-tab-count');

                if (!count) {
                    return;
                }

                const view = item.dataset.bidarTab.startsWith('bidar-native-') ? null : this.getPanelView(item.dataset.bidarTab);
                const total = view && view.collection ? view.collection.total : null;

                count.textContent = typeof total === 'number' && total >= 0 ? String(total) : '';
                count.classList.toggle('bidar-tab-count-empty', total === 0);
            });
        }
    };
}
