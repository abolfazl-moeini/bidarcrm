<?php

declare(strict_types=1);

namespace Espo\Modules\BidarIran\Support;

final class PersianCsvExporter
{
    /**
     * @param array<int|string, string> $headers
     * @param array<int, array<int|string, mixed>> $rows
     * @param array<int, int|string> $dateColumns
     */
    public static function export(array $headers, array $rows, array $dateColumns = []): string
    {
        $stream = fopen('php://temp', 'r+');
        if ($stream === false) {
            return "\xEF\xBB\xBF";
        }
        $assocHeaders = !array_is_list($headers);
        $labels = $assocHeaders ? array_values($headers) : $headers;
        if ($labels !== []) {
            fputcsv($stream, array_map(static fn ($v): string => self::protect(self::stringify($v)), $labels), ',', '"', escape: '');
        }

        foreach ($rows as $row) {
            $source = is_array($row) ? $row : [];
            $aligned = [];
            if ($assocHeaders) {
                foreach ($headers as $key => $label) {
                    $aligned[] = [$key, $source[$key] ?? $source[$label] ?? $source[array_search($key, array_keys($headers), true)] ?? ''];
                }
            } elseif (!array_is_list($source) && array_intersect($headers, array_keys($source)) !== []) {
                foreach ($headers as $index => $header) {
                    $aligned[] = [$header, $source[$header] ?? $source[$index] ?? ''];
                }
            } else {
                foreach (array_values($source) as $index => $value) {
                    if ($index < count($labels)) {
                        $sourceKey = array_keys($source)[$index] ?? $index;
                        $aligned[] = [$sourceKey, $value];
                    }
                }
                while (count($aligned) < count($labels)) {
                    $aligned[] = [count($aligned), ''];
                }
            }

            $cells = [];
            foreach ($aligned as $index => [$key, $value]) {
                $cell = self::stringify($value);
                if ($cell !== '' && (in_array($key, $dateColumns, true) || in_array($index, $dateColumns, true))) {
                    $converted = preg_match('/\d{2}:\d{2}/', $cell)
                        ? JalaliHelper::toJalaliDateTime($cell)
                        : JalaliHelper::toJalaliDate($cell);
                    if ($converted !== '') {
                        $cell = $converted;
                    }
                }
                $cells[] = self::protect($cell);
            }
            fputcsv($stream, $cells, ',', '"', escape: '');
        }
        rewind($stream);
        $content = (string) stream_get_contents($stream);
        fclose($stream);
        return "\xEF\xBB\xBF" . $content;
    }

    private static function stringify(mixed $value): string
    {
        if ($value === null) return '';
        if (is_bool($value)) return $value ? 'true' : 'false';
        if ($value instanceof \DateTimeInterface) return $value->format('Y-m-d H:i:s');
        if (is_array($value)) return implode(', ', array_map(self::stringify(...), $value));
        if ($value instanceof \Stringable) return (string) $value;
        if (is_scalar($value)) return (string) $value;
        return '';
    }

    private static function protect(string $cell): string
    {
        if (str_starts_with($cell, "'") || str_starts_with($cell, "\t") || str_starts_with($cell, "\r")) {
            return str_starts_with($cell, "'") ? $cell : "'" . $cell;
        }
        return preg_match('/^[\s\p{Cf}]*[=+\-@;|]/u', $cell) ? "'" . $cell : $cell;
    }
}
