<?php

declare(strict_types=1);

namespace Espo\Modules\BidarIran\Support;

final class IranPhoneNormalizer
{
    private const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    private const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    private const ASCII_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

    public function toAsciiDigits(string $input): string
    {
        return str_replace(self::ARABIC_DIGITS, self::ASCII_DIGITS,
            str_replace(self::PERSIAN_DIGITS, self::ASCII_DIGITS, $input));
    }

    public function toLocal(string $phone): ?string
    {
        $phone = trim($phone);
        if ($phone === '' || preg_match('/\p{C}/u', $phone) ||
            !preg_match('/^[0-9۰-۹٠-٩+\-\s().]+$/u', $phone) ||
            preg_match('/(?<!^)\+/', $phone)) {
            return null;
        }

        $clean = preg_replace('/[\s().-]/u', '', $this->toAsciiDigits($phone)) ?? '';
        if (preg_match('/^(?:(?:\+98|0098|98)0?|0)?(9\d{9})$/', $clean, $m)) {
            return '0' . $m[1];
        }
        if (preg_match('/^(?:(?:\+98|0098|98)0?|0)([1-8]\d{9})$/', $clean, $m)) {
            return '0' . $m[1];
        }

        return null;
    }

    public function toLocalMobile(string $phone): ?string
    {
        $local = $this->toLocal($phone);
        return $local !== null && preg_match('/^09\d{9}$/', $local) ? $local : null;
    }

    public function toE164(string $phone): ?string
    {
        $local = $this->toLocal($phone);
        return $local === null ? null : '+98' . substr($local, 1);
    }
}
