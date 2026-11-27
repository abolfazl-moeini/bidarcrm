<?php

declare(strict_types=1);

namespace Espo\Modules\BidarIran\Tests\Unit;

use Espo\Modules\BidarIran\Api\PostSendSms;
use Espo\Modules\BidarIran\Services\SmsCampaignService;
use Espo\Modules\BidarIran\Support\IranPhoneNormalizer;
use Espo\Modules\BidarIran\Support\JalaliHelper;
use Espo\Modules\BidarIran\Support\PersianCsvExporter;
use Espo\Modules\BidarIran\Support\PersianTextNormalizer;
use PHPUnit\Framework\TestCase;

final class BidarIranAuditTest extends TestCase
{
    public function testCompactIsoDateIsNotShiftedByServerTimezone(): void
    {
        $previous = date_default_timezone_get();
        date_default_timezone_set('America/Los_Angeles');

        try {
            self::assertSame('1405/09/02', JalaliHelper::toJalaliDate('2026-11-22T21:30:00Z'));
        } finally {
            date_default_timezone_set($previous);
        }
    }

    public function testExplicitOffsetIsHonored(): void
    {
        self::assertSame('1405/09/01', JalaliHelper::toJalaliDate('2026-11-22T23:30:00+03:30'));
        self::assertSame('1405/09/02', JalaliHelper::toJalaliDate('2026-11-22T22:00:00-05:00'));
        self::assertSame('1404/10/15', JalaliHelper::toJalaliDate('2026-1-5T23:30:00+03:30'));
    }

    public function testImpossibleGregorianDateIsRejected(): void
    {
        self::assertSame('', JalaliHelper::toJalaliDate('2026-02-30'));
    }

    public function testZeroJalaliYearIsRejected(): void
    {
        self::assertNull(JalaliHelper::toGregorianDate('0000/01/01'));
    }

    public function testInvalidMonthIsRejectedInsteadOfClamped(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        JalaliHelper::getJalaliMonthRange(1405, 0);
    }

    public function testOutOfRangeJalaliYearIsRejected(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        JalaliHelper::getJalaliMonthRange(3178, 1);
    }

    public function testInvalidUtf8DoesNotCorruptNormalizedText(): void
    {
        self::assertSame('', PersianTextNormalizer::normalizeCharacters("\xFF"));
    }

    public function testCsvBlocksTabPrefixedFormula(): void
    {
        $csv = PersianCsvExporter::export(['header'], [["\t=1+1"]]);
        self::assertStringContainsString("'\t=1+1", $csv);
    }

    public function testCsvBlocksNonBreakingSpacePrefixedFormula(): void
    {
        $csv = PersianCsvExporter::export(['header'], [["\u{00A0}=1+1"]]);
        self::assertStringContainsString("'\u{00A0}=1+1", $csv);
    }

    public function testAssociativeCsvCellsFollowHeaderOrder(): void
    {
        $csv = PersianCsvExporter::export(['name', 'date'], [
            ['date' => '2026-11-22', 'name' => 'Ali'],
        ], ['date']);

        self::assertStringContainsString("Ali,1405/09/01", $csv);
    }

    public function testPhoneNormalizerRejectsEmbeddedControlCharacter(): void
    {
        self::assertNull((new IranPhoneNormalizer())->toLocal("0912\0 3456789"));
    }

    public function testCampaignTotalsIncludeEveryRecipient(): void
    {
        $service = new class extends SmsCampaignService {
            public function __construct()
            {
            }

            public function sendSms(
                string $phoneNumber,
                string $message,
                ?string $contactId = null,
                ?string $opportunityId = null
            ): array {
                return [
                    'success' => true,
                    'status' => 'sent',
                    'phoneNumber' => $phoneNumber,
                    'message' => $message,
                    'id' => 'test',
                ];
            }
        };

        $result = $service->sendCampaign([
            ['phone' => '09123456789'],
            ['phone' => ''],
        ], 'body');

        self::assertSame(2, $result['total']);
        self::assertSame($result['total'], $result['sent'] + $result['failed']);
        self::assertCount($result['total'], $result['results']);
    }

    public function testControllerRejectsObjectMessageBeforeDispatch(): void
    {
        $request = new class implements \Espo\Core\Api\Request {
            public function hasQueryParam(string $name): bool { return false; }
            public function getQueryParam(string $name): ?string { return null; }
            public function getQueryParams(): array { return []; }
            public function hasRouteParam(string $name): bool { return false; }
            public function getRouteParam(string $name): ?string { return null; }
            public function getRouteParams(): array { return []; }
            public function getHeader(string $name): ?string { return null; }
            public function hasHeader(string $name): bool { return false; }
            public function getHeaderAsArray(string $name): array { return []; }
            public function getMethod(): string { return 'POST'; }
            public function getUri(): \Psr\Http\Message\UriInterface { throw new \LogicException(); }
            public function getResourcePath(): string { return '/BidarSms/send'; }
            public function getBodyContents(): ?string { return null; }
            public function getParsedBody(): \stdClass { return (object) ['phone' => '09123456789', 'message' => ['x']]; }
            public function getCookieParam(string $name): ?string { return null; }
            public function getServerParam(string $name) { return null; }
            public function getContentType(): ?string { return 'application/json'; }
            public function toPsr7(): \Psr\Http\Message\ServerRequestInterface { throw new \LogicException(); }
        };

        $service = new class extends SmsCampaignService {
            public bool $called = false;

            public function __construct()
            {
            }

            public function sendSms(
                string $phoneNumber,
                string $message,
                ?string $contactId = null,
                ?string $opportunityId = null
            ): array {
                $this->called = true;

                return [
                    'success' => true,
                    'status' => 'sent',
                    'phoneNumber' => $phoneNumber,
                    'message' => $message,
                    'id' => 'test',
                ];
            }
        };

        try {
            (new PostSendSms($service))->process($request);
        } catch (\Espo\Core\Exceptions\BadRequest) {
            self::assertFalse($service->called);

            return;
        }

        self::fail('A non-scalar message must be rejected with BadRequest before any provider call.');
    }
}
