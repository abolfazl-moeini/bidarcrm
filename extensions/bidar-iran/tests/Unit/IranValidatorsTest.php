<?php

declare(strict_types=1);

namespace Espo\Modules\BidarIran\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Espo\Modules\BidarIran\Support\IranValidators;

class IranValidatorsTest extends TestCase
{
    public function testIsValidNationalCode(): void
    {
        // Valid national codes (English, Persian, formatted)
        $this->assertTrue(IranValidators::isValidNationalCode('0084575948'));
        $this->assertTrue(IranValidators::isValidNationalCode('۰۰۸۴۵۷۵۹۴۸'));
        $this->assertTrue(IranValidators::isValidNationalCode(' 008-4575948 '));

        // Invalid checksum
        $this->assertFalse(IranValidators::isValidNationalCode('0084575949'));

        // All identical digits
        $this->assertFalse(IranValidators::isValidNationalCode('0000000000'));
        $this->assertFalse(IranValidators::isValidNationalCode('1111111111'));
        $this->assertFalse(IranValidators::isValidNationalCode('۹۹۹۹۹۹۹۹۹۹'));

        // Invalid length or chars
        $this->assertFalse(IranValidators::isValidNationalCode('12345'));
        $this->assertFalse(IranValidators::isValidNationalCode('00845759480'));
        $this->assertFalse(IranValidators::isValidNationalCode('abcdefghij'));
        $this->assertFalse(IranValidators::isValidNationalCode(''));
        $this->assertFalse(IranValidators::isValidNationalCode("00845\n75948"));
        $this->assertFalse(IranValidators::isValidNationalCode("14856\t73412"));
        $this->assertTrue(IranValidators::isValidNationalCode("00845\u{00A0}75948"));
    }

    public function testIsValidCompanyNationalId(): void
    {
        // Valid 11-digit legal entity IDs
        $this->assertTrue(IranValidators::isValidCompanyNationalId('10103507982'));
        $this->assertTrue(IranValidators::isValidCompanyNationalId('۱۰۱۰۳۵۰۷۹۸۲'));
        $this->assertTrue(IranValidators::isValidCompanyNationalId('101-0350798-2'));
        $this->assertTrue(IranValidators::isValidCompanyNationalId('10380274534'));

        // Invalid checksum
        $this->assertFalse(IranValidators::isValidCompanyNationalId('10103507983'));

        // All identical digits
        $this->assertFalse(IranValidators::isValidCompanyNationalId('11111111111'));
        $this->assertFalse(IranValidators::isValidCompanyNationalId('00000000000'));

        // Invalid length
        $this->assertFalse(IranValidators::isValidCompanyNationalId('1010350798'));
        $this->assertFalse(IranValidators::isValidCompanyNationalId('101035079820'));
        $this->assertFalse(IranValidators::isValidCompanyNationalId(''));
    }

    public function testIsValidPostalCode(): void
    {
        // Valid postal codes
        $this->assertTrue(IranValidators::isValidPostalCode('1485673412'));
        $this->assertTrue(IranValidators::isValidPostalCode('۱۴۸۵۶۷۳۴۱۲'));
        $this->assertTrue(IranValidators::isValidPostalCode('14856-73412'));
        // BUG-08: Postal codes containing 0 or 2 in positions 2 to 5 are valid
        $this->assertTrue(IranValidators::isValidPostalCode('1920212345'), 'Postal code with 2 and 0 in digits 2..5 must be valid');
        $this->assertTrue(IranValidators::isValidPostalCode('1023456789'), 'Postal code with 0 and 2 in digits 2..5 must be valid');
        $this->assertTrue(IranValidators::isValidPostalCode('۳۰۲۴۵۶۷۸۹۱'), 'Persian postal code with 0 and 2 in digits 2..5 must be valid');

        // Starting with 0 or 2 (forbidden in Iran postal code system)
        $this->assertFalse(IranValidators::isValidPostalCode('0485673412'));
        $this->assertFalse(IranValidators::isValidPostalCode('2485673412'));

        // First 5 digits repetitive
        $this->assertFalse(IranValidators::isValidPostalCode('1111173412'));
        $this->assertFalse(IranValidators::isValidPostalCode('۳۳۳۳۳۷۳۴۱۲'));

        // Invalid length
        $this->assertFalse(IranValidators::isValidPostalCode('14856'));
        $this->assertFalse(IranValidators::isValidPostalCode('148567341299'));
        $this->assertFalse(IranValidators::isValidPostalCode(''));
        $this->assertTrue(IranValidators::isValidPostalCode('1485622222'));
        $this->assertFalse(IranValidators::isValidPostalCode('1000000000'));
        $this->assertFalse(IranValidators::isValidPostalCode('1111111111'));
    }

    public function testIsValidSheba(): void
    {
        // Valid Iranian IBAN / Sheba
        $validSheba = 'IR270170000000100324200001';
        $this->assertTrue(IranValidators::isValidSheba($validSheba));
        $this->assertTrue(IranValidators::isValidSheba('ir27 0170 0000 0010 0324 2000 01'));
        $this->assertTrue(IranValidators::isValidSheba('IR۲۷۰۱۷۰۰۰۰۰۰۰۱۰۰۳۲۴۲۰۰۰۰۱'));

        // Invalid check digits
        $this->assertFalse(IranValidators::isValidSheba('IR280170000000100324200001'));

        // Invalid prefix
        $this->assertFalse(IranValidators::isValidSheba('GB270170000000100324200001'));

        // Invalid length
        $this->assertFalse(IranValidators::isValidSheba('IR27017000'));
        $this->assertFalse(IranValidators::isValidSheba($validSheba . '0'));
        $this->assertFalse(IranValidators::isValidSheba(''));
        $this->assertFalse(IranValidators::isValidSheba('IR000000000000000000000009'));
        $this->assertFalse(IranValidators::isValidSheba('IR010000000000000000000088'));
        $this->assertFalse(IranValidators::isValidSheba('IR990000000000000000000070'));
        $this->assertFalse(IranValidators::isValidSheba('IR270000000000000000000001'));
    }
}
