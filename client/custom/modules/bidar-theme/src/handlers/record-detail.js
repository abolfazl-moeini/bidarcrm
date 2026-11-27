import {isClassicLayout, isBidarTheme} from 'bidar-theme:bidar';
import RecordBand from 'bidar-theme:helpers/record-band';
import EmptyFields from 'bidar-theme:helpers/empty-fields';
import LinkBreaks from 'bidar-theme:helpers/link-breaks';
import PanelCollapse from 'bidar-theme:helpers/panel-collapse';
import ColumnResizer from 'bidar-theme:helpers/column-resizer';
import bidarDetailBottom from 'bidar-theme:mixins/detail-bottom';

/** Entities whose record has a layout of its own, left to EspoCRM. */
const EXCLUDED_ENTITY_TYPES = ['Email', 'User'];

/**
 * Applies the Bidar record view to detail views, under the Bidar theme only.
 * The bottom view configured for the entity is derived, not replaced, to keep its own
 * behaviour; the side view (lead conversion…) stays EspoCRM's.
 */
export default class RecordDetailHandler {

    /**
     * @param {import('views/record/detail').default} view
     */
    constructor(view) {
        this.view = view;
    }

    async process() {
        const view = this.view;

        if (!this.isApplicable()) {
            return;
        }

        let bottomView;

        try {
            bottomView = await derive(view.bottomView, 'bottom', bidarDetailBottom);
        } catch (e) {
            // Unexpected EspoCRM version: the record keeps EspoCRM's layout rather than breaking.
            console.warn('Bidar: keeping the EspoCRM record view.', e);

            return;
        }

        view.template = this.getTemplate();
        view.bottomView = bottomView;

        // build() has already created the original bottom view without waiting for this handler;
        // rendering does wait for it, so the view is recreated before it is displayed.
        view.createBottomView();

        new RecordBand(view).init();
        new EmptyFields(view).init();
        new LinkBreaks(view).init();
        new PanelCollapse(view).init();
        new ColumnResizer(view).init();
    }

    /**
     * Static fields on the left in "About", dynamic activity on the right. An article needs width
     * for its body: its fields move to the top of the main column. The classic layout keeps fields
     * and bottom panels together on the left, side panels on the right.
     *
     * @private
     * @return {string}
     */
    getTemplate() {
        if (isClassicLayout(this.view)) {
            return 'bidar-theme:record/detail-classic';
        }

        return this.hasArticleBody() ? 'bidar-theme:record/detail-content' : 'bidar-theme:record/detail';
    }

    /**
     * Rich-text article body (knowledge base, content): a plain rich-text
     * "description" field is not enough.
     *
     * @private
     * @return {boolean}
     */
    hasArticleBody() {
        const body = this.view.getMetadata().get(['entityDefs', this.view.entityType, 'fields', 'body']);

        return !!body && body.type === 'wysiwyg' && !body.disabled;
    }

    /**
     * @private
     * @return {boolean}
     */
    isApplicable() {
        const view = this.view;

        return isBidarTheme(view) &&
            view.type === 'detail' &&
            view.template === 'record/detail' &&
            !!view.sideView &&
            !!view.bottomView &&
            !view.sideDisabled &&
            !view.bottomDisabled &&
            !EXCLUDED_ENTITY_TYPES.includes(view.entityType) &&
            !!view.getMetadata().get(['scopes', view.entityType, 'object']);
    }
}

/**
 * Defines (once) a view derived from the base view and returns its name.
 *
 * @param {string} baseName
 * @param {string} kind
 * @param {function(Function): Function} mixin
 * @return {Promise<string>}
 */
function derive(baseName, kind, mixin) {
    const name = `bidar-theme:views/record/derived/${kind}-${baseName.replace(/[^A-Za-z0-9]+/g, '-')}`;

    return new Promise((resolve, reject) => {
        Espo.loader.require(baseName, Base => {
            try {
                Espo.loader.define(name, null, () => mixin(Base));
            } catch (e) {
                reject(e);

                return;
            }

            resolve(name);
        }, reject);
    });
}
