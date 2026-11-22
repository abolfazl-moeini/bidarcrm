<?php

declare(strict_types=1);

namespace Espo\Modules\BidarIran\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Espo\Modules\BidarIran\Support\IranPhoneNormalizer;

class IranPhoneNormalizerTest extends TestCase
{
    private IranPhoneNormalizer $normalizer;

    protected function setUp(): void
    {
        $this->normalizer = new IranPhoneNormalizer();
    }

    public function testConvertsPersianAndArabicDigitsToEnglish(): void
    {
        $persian = '۰۹۱۲۳۴۵۶۷۸۹';
        $arabic = '٠٩١٢٣٤٥٦٧٨٩';

        $this->assertSame('+989123456789', $this->normalizer->toE164($persian));
        $this->assertSame('+989123456789', $this->normalizer->toE164($arabic));
    }

    public function testNormalizesVariousIranianPhoneFormatsToE164(): void
    {
        $this->assertSame('+989123456789', $this->normalizer->toE164('09123456789'));
        $this->assertSame('+989123456789', $this->normalizer->toE164('989123456789'));
        $this->assertSame('+989123456789', $this->normalizer->toE164('00989123456789'));
        $this->assertSame('+989123456789', $this->normalizer->toE164('+989123456789'));
        $this->assertSame('+989123456789', $this->normalizer->toE164(' 0912-345-6789 '));
    }

    public function testNormalizesToLocalIranianFormat(): void
    {
        $this->assertSame('09123456789', $this->normalizer->toLocal('+989123456789'));
        $this->assertSame('09123456789', $this->normalizer->toLocal('989123456789'));
        $this->assertSame('09123456789', $this->normalizer->toLocal('۰۹۱۲۳۴۵۶۷۸۹'));
    }

    public function testRejectsInvalidPhoneNumbers(): void
    {
        $this->assertNull($this->normalizer->toE164('12345'));
        $this->assertNull($this->normalizer->toE164('091234567')); // too short
        $this->assertNull($this->normalizer->toE164('09123456789012')); // too long
        $this->assertNull($this->normalizer->toE164('invalid'));
    }
}
