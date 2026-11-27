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

    public function testNormalizesIranianLandlines(): void
    {
        $this->assertSame('02188776655', $this->normalizer->toLocal('02188776655'));
        $this->assertSame('+982188776655', $this->normalizer->toE164('02188776655'));
        $this->assertSame('02188776655', $this->normalizer->toLocal('+98 (0) 21-8877-6655'));
        $this->assertSame('+982188776655', $this->normalizer->toE164('+98 (0) 21-8877-6655'));
        $this->assertSame('+983133334444', $this->normalizer->toE164('03133334444'));
    }

    public function testNormalizesDoublePrefixTrunkZeroOnMobiles(): void
    {
        foreach (['+9809123456789', '009809123456789', '+98 (0) 912-345-6789'] as $phone) {
            $this->assertSame('09123456789', $this->normalizer->toLocal($phone));
            $this->assertSame('+989123456789', $this->normalizer->toE164($phone));
        }
    }

    public function testRejectsShortCodesBareLandlineAndEmbeddedGarbage(): void
    {
        foreach (['2188776655', '110', '1500', "user:alice@09123456789\u{202E}", 'abc09123456789'] as $phone) {
            $this->assertNull($this->normalizer->toE164($phone), 'Unexpectedly accepted: ' . $phone);
        }
    }

    public function testToLocalMobileAcceptsOnlyMobileNumbers(): void
    {
        $this->assertSame('09123456789', $this->normalizer->toLocalMobile('+989123456789'));
        $this->assertNull($this->normalizer->toLocalMobile('02188776655'));
    }
}
