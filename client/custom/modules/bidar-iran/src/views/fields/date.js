define('bidar-iran:views/fields/date', ['views/fields/date'], function (Dep) {
    'use strict';

    return Dep.extend({
        getValueForDisplay: function () {
            var val = Dep.prototype.getValueForDisplay.call(this);
            if (val && window.BidarJalali && window.BidarJalali.gToJ) {
                return window.BidarJalali.gToJ(val);
            }
            return val;
        },

        afterRender: function () {
            Dep.prototype.afterRender.call(this);

            if ((this.mode === 'edit' || this.mode === 'search') && this.$element) {
                var self = this;
                this.$element.attr('data-jdp', '');
                this.$element.attr('autocomplete', 'off');

                var currentVal = this.model.get(this.name);
                if (currentVal && window.BidarJalali && window.BidarJalali.gToJ) {
                    this.$element.val(window.BidarJalali.gToJ(currentVal));
                }

                this.$element.off('change.bidarJalali').on('change.bidarJalali', function () {
                    var jalaliVal = $(this).val();
                    if (jalaliVal && window.BidarJalali && window.BidarJalali.jToG) {
                        var gVal = window.BidarJalali.jToG(jalaliVal);
                        self.model.set(self.name, gVal);
                    } else if (!jalaliVal) {
                        self.model.set(self.name, null);
                    }
                });
            }
        }
    });
});
