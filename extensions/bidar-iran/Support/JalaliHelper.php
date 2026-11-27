<?php

declare(strict_types=1);

namespace Espo\Modules\BidarIran\Support;

use Morilog\Jalali\CalendarUtils;
use Morilog\Jalali\Jalalian;

final class JalaliHelper
{
    public static function toJalaliDate(
        ?string $gregorianDate,
        string $format = 'Y/m/d',
        bool $persianDigits = false,
        string $tz = 'Asia/Tehran'
    ): string {
        if ($gregorianDate === null || trim($gregorianDate) === '') {
            return '';
        }

        try {
            $tzObj = new \DateTimeZone($tz);
        } catch (\Exception) {
            $tzObj = new \DateTimeZone('Asia/Tehran');
        }

        try {
            $dt = self::parseGregorianInput(trim($gregorianDate), $tzObj);
            if ($dt === null) {
                return '';
            }
            $j = Jalalian::fromDateTime($dt);
            $formatted = $j->format($format);

            return $persianDigits ? CalendarUtils::convertNumbers($formatted) : $formatted;
        } catch (\Exception) {
            return '';
        }
    }

    public static function toJalaliDateTime(
        ?string $gregorianDateTime,
        string $format = 'Y/m/d H:i',
        string $tz = 'Asia/Tehran',
        bool $persianDigits = false
    ): string {
        if ($gregorianDateTime === null || trim($gregorianDateTime) === '') {
            return '';
        }

        try {
            $tzObj = new \DateTimeZone($tz);
        } catch (\Exception) {
            $tzObj = new \DateTimeZone('Asia/Tehran');
        }

        try {
            $dt = self::parseGregorianInput(trim($gregorianDateTime), $tzObj);
            if ($dt === null) {
                return '';
            }
            $j = Jalalian::fromDateTime($dt);
            $formatted = $j->format($format);

            return $persianDigits ? CalendarUtils::convertNumbers($formatted) : $formatted;
        } catch (\Exception) {
            return '';
        }
    }

    public static function toGregorianDate(string $jalaliDate): ?string
    {
        if (trim($jalaliDate) === '') {
            return null;
        }

        try {
            $clean = CalendarUtils::convertNumbers(trim($jalaliDate), true);
            if (!preg_match('/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/', $clean, $matches)) {
                return null;
            }

            $y = (int) $matches[1];
            $m = (int) $matches[2];
            $d = (int) $matches[3];

            if ($y < 1 || $y > 3177) {
                return null;
            }

            if ($m < 1 || $m > 12) {
                return null;
            }

            $maxDays = $m <= 6 ? 31 : ($m <= 11 ? 30 : (CalendarUtils::isLeapJalaliYear($y) ? 30 : 29));
            if ($d < 1 || $d > $maxDays) {
                return null;
            }

            $g = CalendarUtils::toGregorian($y, $m, $d);

            return sprintf('%04d-%02d-%02d', $g[0], $g[1], $g[2]);
        } catch (\Exception) {
            return null;
        }
    }

    /**
     * @return array{start: string, end: string, startUtc: string, endUtc: string}
     */
    public static function getJalaliMonthRange(
        int $jYear,
        int $jMonth,
        string $tz = 'Asia/Tehran',
        bool $toUtc = false
    ): array {
        try {
            $tzObj = new \DateTimeZone($tz);
        } catch (\Exception) {
            $tzObj = new \DateTimeZone('Asia/Tehran');
        }

        if ($jMonth < 1 || $jMonth > 12) {
            throw new \InvalidArgumentException(sprintf('Invalid Jalali month: %d (must be between 1 and 12).', $jMonth));
        }
        if ($jYear < 1 || $jYear > 3177) {
            throw new \InvalidArgumentException(sprintf('Invalid Jalali year: %d (must be between 1 and 3177).', $jYear));
        }

        $maxDays = $jMonth <= 6 ? 31 : ($jMonth <= 11 ? 30 : (CalendarUtils::isLeapJalaliYear($jYear) ? 30 : 29));

        $gStart = CalendarUtils::toGregorian($jYear, $jMonth, 1);
        $gEnd = CalendarUtils::toGregorian($jYear, $jMonth, $maxDays);

        $startLocalStr = sprintf('%04d-%02d-%02d 00:00:00', $gStart[0], $gStart[1], $gStart[2]);
        $endLocalStr = sprintf('%04d-%02d-%02d 23:59:59', $gEnd[0], $gEnd[1], $gEnd[2]);

        $utcTz = new \DateTimeZone('UTC');
        $startDt = new \DateTimeImmutable($startLocalStr, $tzObj);
        $startUtcStr = $startDt->setTimezone($utcTz)->format('Y-m-d H:i:s');

        $endDt = new \DateTimeImmutable($endLocalStr, $tzObj);
        $endUtcStr = $endDt->setTimezone($utcTz)->format('Y-m-d H:i:s');

        return [
            'start' => $toUtc ? $startUtcStr : $startLocalStr,
            'end' => $toUtc ? $endUtcStr : $endLocalStr,
            'startUtc' => $startUtcStr,
            'endUtc' => $endUtcStr,
        ];
    }

    /**
     * @return array{start: string, end: string, startUtc: string, endUtc: string}
     */
    public static function getCurrentJalaliMonthRange(string $tz = 'Asia/Tehran', bool $toUtc = false): array
    {
        try {
            $tzObj = new \DateTimeZone($tz);
        } catch (\Exception) {
            $tzObj = new \DateTimeZone('Asia/Tehran');
        }

        $now = new \DateTimeImmutable('now', $tzObj);
        $jNow = Jalalian::fromDateTime($now);

        return self::getJalaliMonthRange($jNow->getYear(), $jNow->getMonth(), $tz, $toUtc);
    }

    /**
     * @return array{start: string, end: string, startUtc: string, endUtc: string}
     */
    public static function getJalaliQuarterRange(
        int $quarter,
        ?int $jYear = null,
        string $tz = 'Asia/Tehran',
        bool $toUtc = false
    ): array {
        try {
            $tzObj = new \DateTimeZone($tz);
        } catch (\Exception) {
            $tzObj = new \DateTimeZone('Asia/Tehran');
        }

        if ($jYear === null) {
            $now = new \DateTimeImmutable('now', $tzObj);
            $jYear = Jalalian::fromDateTime($now)->getYear();
        }

        if ($quarter < 1 || $quarter > 4) {
            throw new \InvalidArgumentException(sprintf('Invalid Jalali quarter: %d (must be between 1 and 4).', $quarter));
        }
        $q = $quarter;
        $startMonth = ($q - 1) * 3 + 1;
        $endMonth = $startMonth + 2;

        $startRange = self::getJalaliMonthRange($jYear, $startMonth, $tz, $toUtc);
        $endRange = self::getJalaliMonthRange($jYear, $endMonth, $tz, $toUtc);

        return [
            'start' => $startRange['start'],
            'end' => $endRange['end'],
            'startUtc' => $startRange['startUtc'],
            'endUtc' => $endRange['endUtc'],
        ];
    }

    public static function diffForHumans(?string $gregorianDateTime, string $tz = 'Asia/Tehran'): string
    {
        if ($gregorianDateTime === null || trim($gregorianDateTime) === '') {
            return '';
        }

        try {
            $tzObj = new \DateTimeZone($tz);
        } catch (\Exception) {
            $tzObj = new \DateTimeZone('Asia/Tehran');
        }

        try {
            $dt = self::parseGregorianInput(trim($gregorianDateTime), $tzObj);
            if ($dt === null) {
                return '';
            }
            $jalalian = Jalalian::fromDateTime($dt);

            return $jalalian->format('Y/m/d H:i');
        } catch (\Exception) {
            return '';
        }
    }

    private static function parseGregorianInput(string $value, \DateTimeZone $targetTz): ?\DateTimeImmutable
    {
        if (preg_match('/^(\d{4})-(\d{1,2})-(\d{1,2})$/', $value, $m)) {
            if (!checkdate((int) $m[2], (int) $m[3], (int) $m[1])) {
                return null;
            }
            return new \DateTimeImmutable(sprintf('%04d-%02d-%02d 00:00:00', $m[1], $m[2], $m[3]), $targetTz);
        }

        if (!preg_match('/^(\d{4})-(\d{1,2})-(\d{1,2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})?$/', $value, $m)) {
            return null;
        }
        $hour = (int) $m[4];
        $minute = (int) $m[5];
        $second = isset($m[6]) && $m[6] !== '' ? (int) $m[6] : 0;
        if (!checkdate((int) $m[2], (int) $m[3], (int) $m[1]) || $hour > 23 || $minute > 59 || $second > 59) {
            return null;
        }
        return (new \DateTimeImmutable($value, new \DateTimeZone('UTC')))->setTimezone($targetTz);
    }
}
