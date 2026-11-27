<?php

declare(strict_types=1);

namespace Espo\Modules\BidarIran\Support;

final class IranValidators
{
    public static function isValidNationalCode(string $code): bool
    {
        if (!self::hasAllowedFormatting($code)) {
            return false;
        }
        $code = PersianTextNormalizer::toEnglishDigits($code);
        $code = self::stripFormatting($code);

        if (!preg_match('/^\d{10}$/', $code)) {
            return false;
        }

        // All identical digits are invalid (e.g. 1111111111, 0000000000)
        if (count(array_unique(str_split($code))) === 1) {
            return false;
        }

        $sum = 0;
        for ($i = 0; $i < 9; $i++) {
            $sum += ((int) $code[$i]) * (10 - $i);
        }

        $rem = $sum % 11;
        $checkDigit = (int) $code[9];

        return ($rem < 2 && $checkDigit === $rem) || ($rem >= 2 && $checkDigit === (11 - $rem));
    }

    public static function isValidCompanyNationalId(string $id): bool
    {
        if (!self::hasAllowedFormatting($id)) {
            return false;
        }
        $id = PersianTextNormalizer::toEnglishDigits($id);
        $id = self::stripFormatting($id);

        if (!preg_match('/^\d{11}$/', $id)) {
            return false;
        }

        if (count(array_unique(str_split($id))) === 1) {
            return false;
        }

        $d = array_map('intval', str_split($id));
        $t = $d[9] + 2;
        $weights = [29, 27, 23, 19, 17, 29, 27, 23, 19, 17];

        $sum = 0;
        for ($i = 0; $i < 10; $i++) {
            $sum += ($d[$i] + $t) * $weights[$i];
        }

        $rem = $sum % 11;
        $checkDigit = ($rem === 10) ? 0 : $rem;

        return $d[10] === $checkDigit;
    }

    public static function isValidPostalCode(string $code): bool
    {
        if (!self::hasAllowedFormatting($code)) {
            return false;
        }
        $code = PersianTextNormalizer::toEnglishDigits($code);
        $code = self::stripFormatting($code);

        if (!preg_match('/^[13-9][0-9]{9}$/', $code)) {
            return false;
        }

        if (count(array_unique(str_split(substr($code, 0, 5)))) === 1 || substr($code, -5) === '00000' || count(array_unique(str_split($code))) < 2) {
            return false;
        }

        return true;
    }

    public static function isValidSheba(string $iban): bool
    {
        if (!self::hasAllowedFormatting($iban)) {
            return false;
        }
        $iban = PersianTextNormalizer::toEnglishDigits($iban);
        $iban = strtoupper(self::stripFormatting($iban));

        if (!preg_match('/^IR\d{24}$/', $iban)) {
            return false;
        }

        $checkDigits = substr($iban, 2, 2);
        $bban = substr($iban, 4);
        if ((int) $checkDigits < 2 || (int) $checkDigits > 98 || substr($iban, 4, 3) === '000' || preg_match('/^0+$/', $bban)) {
            return false;
        }
        $numeric = $bban . '1827' . $checkDigits;

        // Mod-97 without bcmath dependency
        $remainder = 0;
        $len = strlen($numeric);
        for ($i = 0; $i < $len; $i++) {
            $remainder = ($remainder * 10 + (int) $numeric[$i]) % 97;
        }

        return $remainder === 1;
    }

    private static function hasAllowedFormatting(string $value): bool
    {
        return preg_match('/[\x00-\x1F\x7F\p{Cc}\p{Cf}]/u', str_replace("\u{200C}", '', $value)) !== 1;
    }

    private static function stripFormatting(string $value): string
    {
        return (string) preg_replace('/[ \-\x{00A0}\x{200C}]+/u', '', $value);
    }
}
