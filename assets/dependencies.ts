/**
 * DidarCRM — dependencies bundle entry (TypeScript).
 */

import { createHooks } from '@wordpress/hooks';
import domReady from '@wordpress/dom-ready';

export const hooks = createHooks();

export const table = { Tabulator: (window as Window & { Tabulator?: unknown }).Tabulator };

domReady(() => {
  hooks.addAction(
    'didar-request-ajax-start',
    'theme',
    (_endpoint: string, options: { disableLoading?: boolean } = {}) => {
      if (!options?.disableLoading) {
        document.body.classList.add('is-loading');
      }
    }
  );
  hooks.addAction(
    'didar-request-ajax-done',
    'theme',
    (_endpoint: string, options: { disableLoading?: boolean } = {}) => {
      if (!options?.disableLoading) {
        document.body.classList.remove('is-loading');
      }
    }
  );
});
