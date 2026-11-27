define('bidar-iran:views/fields/datetime', ['views/fields/datetime'], function (Dep) {
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
                var $dateInput = this.$element.filter('input.date');
                if (!$dateInput.length) {
                    $dateInput = this.$el.find('input.date');
                }

                if ($dateInput.length) {
                    $dateInput.attr('data-jdp', '');
                    $dateInput.attr('autocomplete', 'off');

                    var currentVal = this.model.get(this.name);
                    if (currentVal && window.BidarJalali && window.BidarJalali.gToJ) {
                        var jFull = window.BidarJalali.gToJ(currentVal);
                        $dateInput.val(jFull.split(' ')[0]);
                    }

                    $dateInput.off('change.bidarJalali').on('change.bidarJalali', function () {
                        var jalaliDate = $(this).val();
                        if (jalaliDate && window.BidarJalali && window.BidarJalali.jToG) {
                            var gDate = window.BidarJalali.jToG(jalaliDate);
                            var timePart = self.$el.find('input.time').val() || '00:00';
                            self.model.set(self.name, gDate + ' ' + timePart + ':00');
                        } else if (!jalaliDate) {
                            self.model.set(self.name, null);
                        }
                    });
                }
            }
        }
    });
});
