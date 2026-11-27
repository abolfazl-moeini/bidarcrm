<?php

declare(strict_types=1);

namespace Espo\Modules\BidarIran\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Espo\Modules\BidarIran\Support\PersianCsvExporter;

class PersianCsvExporterTest extends TestCase
{
    public function testExportPrependsUtf8Bom(): void
    {
        $csv = PersianCsvExporter::export(['نام'], [['علی']]);
        $this->assertStringStartsWith("\xEF\xBB\xBF", $csv);
    }

    public function testExportConvertsDateColumnsToJalali(): void
    {
        $headers = ['نام', 'تاریخ ثبت'];
        $rows = [
            ['معامله تست', '2026-11-22'],
            ['معامله دیگر', '2025-03-20'], // leap year 1403/12/30
        ];

        $csv = PersianCsvExporter::export($headers, $rows, [1]);

        $this->assertStringContainsString('1405/09/01', $csv);
        $this->assertStringContainsString('1403/12/30', $csv);
        $this->assertStringNotContainsString('2026-11-22', $csv);
    }

    public function testExportConvertsDateColumnsByColumnName(): void
    {
        $headers = ['نام', 'تاریخ'];
        $rows = [
            ['name' => 'تست', 'date' => '2026-11-22'],
        ];

        $csv = PersianCsvExporter::export($headers, $rows, ['date']);

        $this->assertStringContainsString('1405/09/01', $csv);
    }

    public function testExportProtectsAgainstFormulaInjection(): void
    {
        $headers = ['فرمول ۱', 'فرمول ۲', 'فرمول ۳', 'فرمول ۴'];
        $rows = [
            ['=cmd|/c calc', '+1234', '-2+2', '@SUM(A1:A2)'],
        ];

        $csv = PersianCsvExporter::export($headers, $rows);

        $this->assertStringContainsString("'=cmd|/c calc", $csv);
        $this->assertStringContainsString("'+1234", $csv);
        $this->assertStringContainsString("'-2+2", $csv);
        $this->assertStringContainsString("'@SUM(A1:A2)", $csv);
    }

    public function testExportBlocksInvisibleWhitespaceAndAdditionalFormulaPrefixes(): void
    {
        $values = ["\u{FEFF}=1+1", "\u{200B}=1+1", "\tcmd", "\rcmd", ';=1+1', '|=1+1'];
        $csv = PersianCsvExporter::export(array_fill(0, count($values), 'value'), [$values]);
        foreach ($values as $value) {
            $this->assertStringContainsString("'" . $value, $csv);
        }
    }

    public function testExportDoesNotDoublePrefixAlreadyEscapedFormula(): void
    {
        $csv = PersianCsvExporter::export(['value'], [["'=1+1"]]);
        $this->assertStringContainsString("'=1+1", $csv);
        $this->assertStringNotContainsString("''=1+1", $csv);
    }

    public function testAssociativeHeadersAlignRowsByHeaderKeysAndFormatDateTime(): void
    {
        $csv = PersianCsvExporter::export(
            ['name' => 'نام', 'date' => 'تاریخ'],
            [['date' => '2026-11-22', 'name' => 'علی']],
            ['date']
        );
        $this->assertSame("\xEF\xBB\xBFنام,تاریخ\nعلی,1405/09/01\n", $csv);

        $dateTimeCsv = PersianCsvExporter::export(['Date'], [['2026-11-22 14:30:00']], [0]);
        $this->assertStringContainsString('1405/09/01 18:00', $dateTimeCsv);
        $notDateCsv = PersianCsvExporter::export(['Date'], [['N/A']], [0]);
        $this->assertStringContainsString('N/A', $notDateCsv);
    }

    public function testExportSafelySerializesNonScalarCells(): void
    {
        $csv = PersianCsvExporter::export(['array', 'false', 'true'], [[['a', 'b'], false, true]]);
        $this->assertStringContainsString('a, b', $csv);
        $this->assertStringContainsString('false', $csv);
        $this->assertStringContainsString('true', $csv);
    }

    public function testExportUsesRfc4180QuoteEscaping(): void
    {
        $csv = PersianCsvExporter::export(['value'], [['a"b']]);
        $this->assertStringContainsString('"a""b"', $csv);
        $this->assertStringNotContainsString('a\\"b', $csv);
    }

    public function testExportHandlesEmptyData(): void
    {
        $csv = PersianCsvExporter::export([], []);
        $this->assertSame("\xEF\xBB\xBF", $csv);
    }
}
