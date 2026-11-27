/**
 * BidarCRM Jalali Utilities for Admin Panel
 * Pure JS Gregorian <-> Jalali Conversion Algorithms with full leap-year support
 */
(function (root) {
    'use strict';

    var BidarJalali = {};

    var gDaysInMonths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var jDaysInMonths = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];

    function isGregorianLeap(year) {
        return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    }

    function isJalaliLeap(year) {
        var breaks = [
            -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178
        ];
        var bl = breaks.length;
        var jp = breaks[0];
        var jm, jump, leap, n, i;

        if (year < jp || year >= breaks[bl - 1]) {
            throw new Error('Invalid Jalali year ' + year);
        }

        for (i = 1; i < bl; i += 1) {
            jm = breaks[i];
            jump = jm - jp;
            if (year < jm) {
                break;
            }
            jp = jm;
        }
        n = year - jp;

        if (jump - n < 6) {
            n = n - jump + (Math.floor((jump + 4) / 33) * 33);
        }
        leap = (((n + 1) % 33) - 1) % 4;
        if (leap === -1) {
            leap = 4;
        }

        return leap === 0;
    }

    function d2g(jdn) {
        var j = 4 * jdn + 139361631;
        var i = 4 * (j % 146097) + 3;
        var j2 = 4 * (i % 1461) + 3;
        var d = Math.floor(j2 / 4) + 1;
        var m = Math.floor((5 * Math.floor(j2 / 4) + 2) / 153);
        var day = Math.floor(d - Math.floor((153 * m + 2) / 5));
        var month = m < 10 ? m + 3 : m - 9;
        var year = Math.floor(j / 146097) * 100 + Math.floor(i / 1461) - 4800 + Math.floor((m + 2) / 12);
        return { gy: year, gm: month, gd: day };
    }

    function g2d(gy, gm, gd) {
        var d = Math.floor((gy + Math.floor((gm - 8) / 6) + 100100) * 1461 / 4)
            + Math.floor((153 * ((gm + 9) % 12) + 2) / 5)
            + gd - 34840408;
        d = d - Math.floor(Math.floor((gy + 100100 + Math.floor((gm - 8) / 6)) / 100) * 3 / 4) + 752;
        return d;
    }

    function d2j(jdn) {
        var gy = d2g(jdn).gy;
        var jy = gy - 621;
        var r = jalaliCal(jy);
        var jdn1f = g2d(gy, 3, r.march);
        var k = jdn - jdn1f;
        var jm, jd;

        if (k >= 0) {
            if (k <= 185) {
                jm = 1 + Math.floor(k / 31);
                jd = (k % 31) + 1;
                return { jy: jy, jm: jm, jd: jd };
            } else {
                k -= 186;
            }
        } else {
            jy -= 1;
            k += 179;
            if (r.leap === 1) {
                k += 1;
            }
        }
        jm = 7 + Math.floor(k / 30);
        jd = (k % 30) + 1;
        return { jy: jy, jm: jm, jd: jd };
    }

    function j2d(jy, jm, jd) {
        var r = jalaliCal(jy);
        return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - Math.floor(jm / 7) * (jm - 7) + jd - 1;
    }

    function jalaliCal(jy) {
        var breaks = [
            -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178
        ];
        var bl = breaks.length;
        var gy = jy + 621;
        var leapJ = -14;
        var jp = breaks[0];
        var jm, jump, leap, n, i;

        for (i = 1; i < bl; i += 1) {
            jm = breaks[i];
            jump = jm - jp;
            if (jy < jm) {
                break;
            }
            leapJ = leapJ + Math.floor(jump / 33) * 8 + Math.floor(((jump % 33)) / 4);
            jp = jm;
        }
        n = jy - jp;
        leapJ = leapJ + Math.floor(n / 33) * 8 + Math.floor(((n % 33) + 3) / 4);
        if ((jump % 33) === 4 && jump - n === 4) {
            leapJ += 1;
        }

        var leapG = Math.floor(gy / 4) - Math.floor(((Math.floor(gy / 100) + 1) * 3) / 4) - 150;
        var march = 20 + leapJ - leapG;

        if (jump - n < 6) {
            n = n - jump + (Math.floor((jump + 4) / 33) * 33);
        }
        leap = (((n + 1) % 33) - 1) % 4;
        if (leap === -1) {
            leap = 4;
        }

        return { leap: leap, gy: gy, march: march };
    }

    BidarJalali.gregorianToJalali = function (gy, gm, gd) {
        return d2j(g2d(gy, gm, gd));
    };

    BidarJalali.jalaliToGregorian = function (jy, jm, jd) {
        return d2g(j2d(jy, jm, jd));
    };

    BidarJalali.toPersianDigits = function (str) {
        if (str === null || str === undefined) return '';
        var p = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
        return String(str).replace(/[0-9]/g, function (w) {
            return p[+w];
        });
    };

    BidarJalali.toEnglishDigits = function (str) {
        if (!str) return '';
        return String(str)
            .replace(/[۰-۹]/g, function (d) { return String.fromCharCode(d.charCodeAt(0) - 1728); })
            .replace(/[٠-٩]/g, function (d) { return String.fromCharCode(d.charCodeAt(0) - 1584); });
    };

    BidarJalali.gToJ = function (gDateStr) {
        if (!gDateStr) return '';
        var clean = String(gDateStr).trim();
        var parts = clean.split(' ')[0].split('-');
        if (parts.length < 3) return gDateStr;
        var gy = parseInt(parts[0], 10);
        var gm = parseInt(parts[1], 10);
        var gd = parseInt(parts[2], 10);
        if (isNaN(gy) || isNaN(gm) || isNaN(gd)) return gDateStr;

        var j = BidarJalali.gregorianToJalali(gy, gm, gd);
        var sm = j.jm < 10 ? '0' + j.jm : String(j.jm);
        var sd = j.jd < 10 ? '0' + j.jd : String(j.jd);
        var result = j.jy + '/' + sm + '/' + sd;

        if (clean.indexOf(' ') > -1) {
            var timePart = clean.split(' ')[1];
            result += ' ' + timePart;
        }
        return result;
    };

    BidarJalali.jToG = function (jDateStr) {
        if (!jDateStr) return null;
        var clean = BidarJalali.toEnglishDigits(String(jDateStr).trim());
        var parts = clean.split(' ')[0].split('/');
        if (parts.length < 3) parts = clean.split(' ')[0].split('-');
        if (parts.length < 3) return null;

        var jy = parseInt(parts[0], 10);
        var jm = parseInt(parts[1], 10);
        var jd = parseInt(parts[2], 10);
        if (isNaN(jy) || isNaN(jm) || isNaN(jd)) return null;

        var g = BidarJalali.jalaliToGregorian(jy, jm, jd);
        var sm = g.gm < 10 ? '0' + g.gm : String(g.gm);
        var sd = g.gd < 10 ? '0' + g.gd : String(g.gd);
        var result = g.gy + '-' + sm + '-' + sd;

        if (clean.indexOf(' ') > -1) {
            var timePart = clean.split(' ')[1];
            result += ' ' + timePart;
        }
        return result;
    };

    root.BidarJalali = BidarJalali;
})(typeof window !== 'undefined' ? window : this);
