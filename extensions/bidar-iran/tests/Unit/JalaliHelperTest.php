<?php

declare(strict_types=1);

namespace Espo\Modules\BidarIran\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Espo\Modules\BidarIran\Support\JalaliHelper;

class JalaliHelperTest extends TestCase
{
    public function testToJalaliDateConvertsCorrectly(): void
    {
        $this->assertSame('1405/09/01', JalaliHelper::toJalaliDate('2026-11-22'));
        $this->assertSame('۱۴۰۵/۰۹/۰۱', JalaliHelper::toJalaliDate('2026-11-22', 'Y/m/d', true));
    }

    public function testToJalaliDateNearUtcMidnightConvertsWithTehranTimezone(): void
    {
        // 2026-11-22 21:30:00 UTC is 2026-11-23 01:00:00 in Asia/Tehran (+03:30)
        // In Jalali: 2026-11-22 is 1405/09/01, but 2026-11-23 is 1405/09/02
        $this->assertSame('1405/09/02', JalaliHelper::toJalaliDate('2026-11-22 21:30:00'));
        $this->assertSame('1405/09/02', JalaliHelper::toJalaliDate('2026-11-22T21:30:00Z'));

        // Daytime UTC: 2026-11-22 12:00:00 UTC is 2026-11-22 15:30:00 in Tehran => 1405/09/01
        $this->assertSame('1405/09/01', JalaliHelper::toJalaliDate('2026-11-22 12:00:00'));
    }

    public function testToJalaliDateHandlesLeapYear1403(): void
    {
        // 1403 is a leap year; Esfand has 30 days (2025-03-20 is 1403/12/30)
        $this->assertSame('1403/12/30', JalaliHelper::toJalaliDate('2025-03-20'));
    }

    public function testToJalaliDateHandlesEmptyAndInvalidInputs(): void
    {
        $this->assertSame('', JalaliHelper::toJalaliDate(null));
        $this->assertSame('', JalaliHelper::toJalaliDate(''));
        $this->assertSame('', JalaliHelper::toJalaliDate('   '));
        $this->assertSame('', JalaliHelper::toJalaliDate('not-a-valid-date'));
        $this->assertSame('', JalaliHelper::toJalaliDate('2026-11-22 12:00:00 garbage'));
        $this->assertSame('', JalaliHelper::toJalaliDate('2026-11-22 24:00:00'));
    }

    public function testToJalaliDateTimeConvertsCorrectly(): void
    {
        $result = JalaliHelper::toJalaliDateTime('2026-11-22 12:00:00', 'Y/m/d H:i', 'UTC');
        $this->assertSame('1405/09/01 12:00', $result);

        $resultPersian = JalaliHelper::toJalaliDateTime('2026-11-22 12:00:00', 'Y/m/d H:i', 'UTC', true);
        $this->assertSame('۱۴۰۵/۰۹/۰۱ ۱۲:۰۰', $resultPersian);
    }

    public function testToJalaliDateTimeHandlesEmptyAndInvalidInputs(): void
    {
        $this->assertSame('', JalaliHelper::toJalaliDateTime(null));
        $this->assertSame('', JalaliHelper::toJalaliDateTime(''));
        $this->assertSame('', JalaliHelper::toJalaliDateTime('invalid-datetime'));
        $this->assertSame('', JalaliHelper::toJalaliDateTime('2026-02-30 12:00:00'));
        $this->assertSame('', JalaliHelper::toJalaliDateTime('2026-11-22 24:00:00'));
        $this->assertSame('', JalaliHelper::toJalaliDateTime('now'));
    }

    public function testToJalaliDateTimeUsesUtcForNaiveDateTimeAndTargetTimezoneForDateOnly(): void
    {
        $previous = date_default_timezone_get();
        date_default_timezone_set('Asia/Tehran');
        try {
            $this->assertSame('1405/09/01 15:30', JalaliHelper::toJalaliDateTime('2026-11-22 12:00:00'));
            $this->assertSame('1405/09/01 00:00', JalaliHelper::toJalaliDateTime('2026-11-22'));
        } finally {
            date_default_timezone_set($previous);
        }
    }

    public function testToGregorianDateConvertsCorrectly(): void
    {
        $this->assertSame('2026-11-22', JalaliHelper::toGregorianDate('1405/09/01'));
        $this->assertSame('2026-11-22', JalaliHelper::toGregorianDate('۱۴۰۵/۰۹/۰۱'));
        $this->assertSame('2025-03-20', JalaliHelper::toGregorianDate('1403/12/30'));
    }

    public function testToGregorianDateRejectsInvalidDates(): void
    {
        // 1404 is not a leap year, Esfand 30 does not exist
        $this->assertNull(JalaliHelper::toGregorianDate('1404/12/30'));
        $this->assertNull(JalaliHelper::toGregorianDate('1405/13/01'));
        $this->assertNull(JalaliHelper::toGregorianDate('1405/01/32'));
        $this->assertNull(JalaliHelper::toGregorianDate(''));
        $this->assertNull(JalaliHelper::toGregorianDate('invalid'));
    }

    public function testGetJalaliMonthRange(): void
    {
        // Farvardin: 31 days
        $rangeFarvardin = JalaliHelper::getJalaliMonthRange(1405, 1);
        $this->assertSame('2026-03-21 00:00:00', $rangeFarvardin['start']);
        $this->assertSame('2026-04-20 23:59:59', $rangeFarvardin['end']);
        // Verify UTC conversion: Farvardin 1 00:00:00 Tehran is 2026-03-20 20:30:00 UTC
        $this->assertSame('2026-03-20 20:30:00', $rangeFarvardin['startUtc']);
        $this->assertSame('2026-04-20 20:29:59', $rangeFarvardin['endUtc']);

        // When toUtc is requested
        $rangeUtc = JalaliHelper::getJalaliMonthRange(1405, 1, 'Asia/Tehran', true);
        $this->assertSame('2026-03-20 20:30:00', $rangeUtc['start']);
        $this->assertSame('2026-04-20 20:29:59', $rangeUtc['end']);

        // Esfand in leap year 1403: 30 days
        $rangeLeapEsfand = JalaliHelper::getJalaliMonthRange(1403, 12);
        $this->assertSame('2025-02-19 00:00:00', $rangeLeapEsfand['start']);
        $this->assertSame('2025-03-20 23:59:59', $rangeLeapEsfand['end']);

        // Esfand in regular year 1404: 29 days
        $rangeRegularEsfand = JalaliHelper::getJalaliMonthRange(1404, 12);
        $this->assertSame('2026-02-20 00:00:00', $rangeRegularEsfand['start']);
        $this->assertSame('2026-03-20 23:59:59', $rangeRegularEsfand['end']);
    }

    public function testGetCurrentJalaliMonthRange(): void
    {
        $range = JalaliHelper::getCurrentJalaliMonthRange();
        $this->assertArrayHasKey('start', $range);
        $this->assertArrayHasKey('end', $range);
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2} 00:00:00$/', $range['start']);
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2} 23:59:59$/', $range['end']);
    }

    public function testGetJalaliQuarterRange(): void
    {
        // Q1 1405: Farvardin 1 to Khordad 31
        $q1 = JalaliHelper::getJalaliQuarterRange(1, 1405);
        $this->assertSame('2026-03-21 00:00:00', $q1['start']);
        $this->assertSame('2026-06-21 23:59:59', $q1['end']);

        // Q4 1403: Dey 1 to Esfand 30 (leap)
        $q4 = JalaliHelper::getJalaliQuarterRange(4, 1403);
        $this->assertSame('2024-12-21 00:00:00', $q4['start']);
        $this->assertSame('2025-03-20 23:59:59', $q4['end']);
    }

    public function testGetJalaliQuarterRangeRejectsOutOfRangeQuarter(): void
    {
        foreach ([0, 5] as $quarter) {
            try {
                JalaliHelper::getJalaliQuarterRange($quarter, 1405);
                $this->fail('Expected InvalidArgumentException for quarter ' . $quarter);
            } catch (\InvalidArgumentException) {
                $this->assertTrue(true);
            }
        }
    }

    public function testDiffForHumans(): void
    {
        $now = date('Y-m-d H:i:s');
        $diff = JalaliHelper::diffForHumans($now);
        $this->assertNotEmpty($diff);

        $this->assertSame('', JalaliHelper::diffForHumans(null));
        $this->assertSame('', JalaliHelper::diffForHumans(''));
        $this->assertSame('', JalaliHelper::diffForHumans('invalid'));
        $this->assertSame('', JalaliHelper::diffForHumans('2026-02-30 12:00:00'));
        $this->assertSame('', JalaliHelper::diffForHumans('now'));
    }

    public function testDiffForHumansUsesUtcFallbackForNaiveDatabaseTimestamps(): void
    {
        $previous = date_default_timezone_get();
        date_default_timezone_set('Asia/Tehran');
        try {
            $expected = JalaliHelper::toJalaliDateTime('2026-11-22 12:00:00', 'Y/m/d H:i');
            $this->assertSame($expected, JalaliHelper::diffForHumans('2026-11-22 12:00:00'));
            $this->assertNotSame('', JalaliHelper::diffForHumans('2026-11-22T12:00:00Z'));
        } finally {
            date_default_timezone_set($previous);
        }
    }
}
