<?php

declare(strict_types=1);

namespace Espo\Modules\BidarIran\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Espo\Modules\BidarIran\Support\PersianTextNormalizer;
use Espo\Modules\BidarIran\Hooks\Common\NormalizePersianInput;
use Espo\ORM\Entity;
use Espo\ORM\Repository\Option\SaveOptions;

class PersianTextNormalizerTest extends TestCase
{
    public function testConvertsPersianAndArabicDigitsToEnglish(): void
    {
        $this->assertSame('0123456789', PersianTextNormalizer::toEnglishDigits('۰۱۲۳۴۵۶۷۸۹'));
        $this->assertSame('0123456789', PersianTextNormalizer::toEnglishDigits('٠١٢٣٤٥٦٧٨٩'));
        $this->assertSame('Code 1234', PersianTextNormalizer::toEnglishDigits('Code ۱۲۳۴'));
    }

    public function testConvertsEnglishAndArabicDigitsToPersian(): void
    {
        $this->assertSame('۰۱۲۳۴۵۶۷۸۹', PersianTextNormalizer::toPersianDigits('0123456789'));
        $this->assertSame('۰۱۲۳۴۵۶۷۸۹', PersianTextNormalizer::toPersianDigits('٠١٢٣٤٥٦٧٨٩'));
    }

    public function testNormalizesArabicYehAndKeheh(): void
    {
        // ي -> ی, ك -> ک
        $this->assertSame('علی کریمی', PersianTextNormalizer::normalizeCharacters('علي كريمي'));
        $this->assertSame('موسی', PersianTextNormalizer::normalizeCharacters('موسى'));
        $this->assertSame('بانک ملی', PersianTextNormalizer::normalizeCharacters('بانك ملي'));
    }

    public function testNormalizesHehYehAndRemovesTatweel(): void
    {
        // ۀ -> ه, ـ -> removed
        $this->assertSame('شرکت فناوری', PersianTextNormalizer::normalizeCharacters('شـــرکت فنـــاوری'));
        $this->assertSame('خانه بزرگ', PersianTextNormalizer::normalizeCharacters("خانۀ بزرگ"));
    }

    public function testCollapsesDuplicateWhitespaceAndNormalizesDigits(): void
    {
        $input = "  شرکت   فناوری   ۱۲۳  ";
        $this->assertSame('شرکت فناوری 123', PersianTextNormalizer::normalizeCharacters($input));
    }

    public function testNormalizesUnicodeWhitespaceAndStripsFormattingAndDiacritics(): void
    {
        $this->assertSame('الف ب', PersianTextNormalizer::normalizeCharacters("الف\u{00A0}ب"));
        $this->assertSame('الف ب', PersianTextNormalizer::normalizeCharacters("الف\tب"));
        foreach (["\u{FEFF}", "\u{200B}", "\u{200E}", "\u{200F}", "\u{202E}"] as $marker) {
            $this->assertSame('الفب', PersianTextNormalizer::normalizeCharacters('الف' . $marker . 'ب'));
        }
        $this->assertSame("می\u{200C}شود", PersianTextNormalizer::normalizeCharacters("می\u{200C}\u{200C}شود"));
        $this->assertSame('خانه بزرگ', PersianTextNormalizer::normalizeCharacters("خانۀ بزرگ"));
        $this->assertSame('ا', PersianTextNormalizer::normalizeCharacters("ا\u{064E}"));
    }

    public function testHookNormalizesSmsTemplateCityAndNationalIdentifiersSafely(): void
    {
        $hook = new NormalizePersianInput();
        $options = $this->createMock(SaveOptions::class);
        foreach ([
            'BidarSmsTemplate' => ['name' => 'قالب ۱۲۳', 'body' => 'متن ۱۲۳'],
            'Account' => ['iranCity' => 'تهران مرکزی', 'nationalId' => '۱۲۳-۴۵'],
            'Contact' => ['nationalCode' => '۰۰۸-۴۵۷۵۹۴۸'],
        ] as $type => $fields) {
            $entity = $this->createMock(Entity::class);
            $entity->method('getEntityType')->willReturn($type);
            $entity->method('has')->willReturnCallback(static fn($field) => array_key_exists($field, $fields));
            $entity->method('get')->willReturnCallback(static fn($field) => $fields[$field] ?? null);
            $entity->expects($this->atLeastOnce())->method('set')->willReturnSelf();
            $hook->beforeSave($entity, $options);
        }
    }

    public function testHookDoesNotSetAlreadyNormalizedTextOrReadOnlyAccountName(): void
    {
        $hook = new NormalizePersianInput();
        $entity = $this->createMock(Entity::class);
        $entity->method('getEntityType')->willReturn('Account');
        $entity->method('has')->willReturnCallback(static fn($field) => in_array($field, ['name', 'accountName'], true));
        $entity->method('get')->willReturn('شرکت ملی');
        $entity->expects($this->never())->method('set');
        $hook->beforeSave($entity, $this->createMock(SaveOptions::class));
    }

    public function testHookAcceptsArbitraryNationalIdentifierStringsWithoutThrowing(): void
    {
        $hook = new NormalizePersianInput();
        $entity = $this->createMock(Entity::class);
        $entity->method('getEntityType')->willReturn('Contact');
        $entity->method('has')->willReturnCallback(static fn($field) => $field === 'nationalCode');
        $entity->method('get')->willReturn("legacy\xFF-value");
        $entity->method('set')->willReturnSelf();
        $hook->beforeSave($entity, $this->createMock(SaveOptions::class));
        $this->assertTrue(true);
    }

    public function testHookNormalizesAllowedEntitiesBeforeSave(): void
    {
        $hook = new NormalizePersianInput();
        $options = $this->createMock(SaveOptions::class);

        $entity = $this->createMock(Entity::class);
        $entity->method('getEntityType')->willReturn('Account');
        $entity->method('has')->willReturnCallback(fn($field) => in_array($field, ['name', 'description'], true));
        $entity->method('get')->willReturnCallback(function ($field) {
            if ($field === 'name') return 'شركـــت   ملي';
            if ($field === 'description') return 'توضيح با ارقام ۱۲۳';
            return null;
        });

        $entity->expects($this->exactly(2))
            ->method('set')
            ->willReturnCallback(function ($field, $value) use ($entity) {
                if ($field === 'name') {
                    $this->assertSame('شرکت ملی', $value);
                }
                if ($field === 'description') {
                    $this->assertSame('توضیح با ارقام 123', $value);
                }
                return $entity;
            });

        $hook->beforeSave($entity, $options);
    }

    public function testHookIgnoresNonTargetEntities(): void
    {
        $hook = new NormalizePersianInput();
        $options = $this->createMock(SaveOptions::class);

        $entity = $this->createMock(Entity::class);
        $entity->method('getEntityType')->willReturn('Note');
        $entity->expects($this->never())->method('set');

        $hook->beforeSave($entity, $options);
    }
}
