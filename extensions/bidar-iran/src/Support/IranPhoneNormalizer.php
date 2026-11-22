<?php

declare(strict_types=1);

namespace Espo\Modules\BidarIran\Support;

class IranPhoneNormalizer
{
    private const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    private const ARABIC_DIGITS  = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    private const ASCII_DIGITS   = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

    public function toAsciiDigits(string $input): string
    {
        $converted = str_replace(self::PERSIAN_DIGITS, self::ASCII_DIGITS, $input);
        return str_replace(self::ARABIC_DIGITS, self::ASCII_DIGITS, $converted);
    }

    public function toLocal(string $phone): ?string
    {
        $clean = preg_replace('/[^\d+]/', '', $this->toAsciiDigits($phone)) ?? '';

        if (preg_match('/^(?:\+98|0098|98)?(9\d{9})$/', $clean, $matches)) {
            return '0' . $matches[1];
        }

        if (preg_match('/^0(9\d{9})$/', $clean, $matches)) {
            return '0' . $matches[1];
        }

        return null;
    }

    public function toE164(string $phone): ?string
    {
        $local = $this->toLocal($phone);
        if ($local === null) {
            return null;
        }

        return '+98' . substr($local, 1);
    }
}
