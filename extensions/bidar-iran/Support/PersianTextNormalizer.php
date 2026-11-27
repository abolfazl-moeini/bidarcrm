<?php

declare(strict_types=1);

namespace Espo\Modules\BidarIran\Support;

final class PersianTextNormalizer
{
    private const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    private const ARABIC_DIGITS  = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    private const ENGLISH_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

    public static function toEnglishDigits(string $input): string
    {
        $text = str_replace(self::PERSIAN_DIGITS, self::ENGLISH_DIGITS, $input);
        return str_replace(self::ARABIC_DIGITS, self::ENGLISH_DIGITS, $text);
    }

    public static function toPersianDigits(string $input): string
    {
        $text = str_replace(self::ARABIC_DIGITS, self::PERSIAN_DIGITS, $input);
        return str_replace(self::ENGLISH_DIGITS, self::PERSIAN_DIGITS, $text);
    }

    public static function normalizeCharacters(string $input): string
    {
        // Strip invalid UTF-8 bytes safely
        $converted = @iconv('UTF-8', 'UTF-8//IGNORE', $input);
        if ($converted === false) {
            $input = function_exists('mb_scrub') ? mb_scrub($input, 'UTF-8') : '';
        } else {
            $input = $converted;
        }

        // 1. Unify Arabic Yeh to Persian Yeh: ي (\u{064A}) and ى (\u{0649}) -> ی (\u{06CC})
        $text = str_replace(["\u{064A}", "\u{0649}"], "\u{06CC}", $input);

        // 2. Unify Arabic Keheh to Persian Keheh: ك (\u{0643}) -> ک (\u{06A9})
        $text = str_replace("\u{0643}", "\u{06A9}", $text);

        // 3. Normalize heh with yeh: ۀ (\u{06C0}) -> ه
        $text = str_replace("\u{06C0}", 'ه', $text);

        // 4. Remove Tatweel / Kashida: ـ (\u{0640})
        $text = str_replace("\u{0640}", '', $text);

        // 5. Convert digits to English
        $text = self::toEnglishDigits($text);

        $text = str_replace(["\u{0629}", "\u{06C1}"], 'ه', $text);
        $text = (string) preg_replace('/[\x{FEFF}\x{200B}\x{200E}-\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}\x{064B}-\x{0652}\x{0670}]/u', '', $text);
        $text = (string) preg_replace('/\x{200C}{2,}/u', "\u{200C}", $text);
        $text = (string) preg_replace('/^\x{200C}+|\x{200C}+(?=$)/u', '', $text);
        $text = (string) preg_replace('/([\p{Zs}\t])\x{200C}+|\x{200C}+([\p{Zs}\t])/u', '$1$2', $text);
        $text = (string) preg_replace('/[\p{Zs}\t]+/u', ' ', $text);

        return trim($text);
    }
}
