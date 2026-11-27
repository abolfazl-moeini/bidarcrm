/**
 * BidarCRM Jalali Datepicker Initializer for Admin Panel
 */
(function () {
    'use strict';

    function initPicker() {
        if (typeof jalaliDatepicker !== 'undefined' && jalaliDatepicker.startWatch) {
            jalaliDatepicker.startWatch({
                minDate: 'attr',
                maxDate: 'attr',
                time: true,
                hasSecond: false,
                autoHide: true,
                hideAfterChange: true
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPicker);
    } else {
        initPicker();
    }
})();
