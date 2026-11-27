<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Tests\Unit;

use Espo\Core\Api\Request;
use Espo\Core\Authentication\Helper\UserFinder;
use Espo\Core\Authentication\Login\Data;
use Espo\Core\Authentication\Result\FailReason;
use Espo\Entities\User;
use Espo\Modules\BidarSales\Authentication\BidarApiKeyLogin;
use Espo\ORM\Entity;
use Espo\ORM\EntityManager;
use Espo\ORM\Repository\RDBRepository;
use Espo\ORM\Repository\RDBSelectBuilder;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class BidarApiKeyLoginTest extends TestCase
{
    private function createEntityMock(array $initialValues = [], ?string $id = 'key-1'): Entity
    {
        $values = $initialValues;
        $entity = $this->createMock(Entity::class);
        $entity->method('getId')->willReturn($id);
        $entity->method('get')->willReturnCallback(function (string $k) use (&$values) {
            return $values[$k] ?? null;
        });
        $entity->method('set')->willReturnCallback(function ($k, $v = null) use (&$values, $entity) {
            if (is_array($k)) {
                foreach ($k as $subK => $subV) {
                    $values[$subK] = $subV;
                }
            } else {
                $values[$k] = $v;
            }
            return $entity;
        });
        return $entity;
    }

    private function createPersonalKeyLogin(string $apiKey, array $keyData): array
    {
        $keyRecord = $this->createEntityMock($keyData + [
            'keyHash' => hash('sha256', $apiKey),
            'isActive' => true,
            'expiresAt' => null,
            'allowedIpList' => [],
        ]);
        $builder = $this->createMock(RDBSelectBuilder::class);
        $builder->method('findOne')->willReturn($keyRecord);
        $repo = $this->createMock(RDBRepository::class);
        $repo->method('where')->willReturn($builder);
        $em = $this->createMock(EntityManager::class);
        $em->method('getRDBRepository')->with('BidarUserApiKey')->willReturn($repo);
        $userFinder = $this->createMock(UserFinder::class);
        $userFinder->method('findApiApiKey')->willReturn(null);

        return [new BidarApiKeyLogin($userFinder, $em), $em, $keyRecord];
    }

    public function testMissingHeaderFails(): void
    {
        $login = new BidarApiKeyLogin();
        $request = $this->createMock(Request::class);
        $request->method('getHeader')->with('X-Api-Key')->willReturn(null);

        $result = $login->login(new Data(null, null), $request);

        $this->assertFalse($result->isSuccess());
        $this->assertSame(FailReason::WRONG_CREDENTIALS, $result->getFailReason());
    }

    public function testEmptyHeaderFails(): void
    {
        $login = new BidarApiKeyLogin();
        $request = $this->createMock(Request::class);
        $request->method('getHeader')->with('X-Api-Key')->willReturn('   ');

        $result = $login->login(new Data(null, null), $request);

        $this->assertFalse($result->isSuccess());
        $this->assertSame(FailReason::WRONG_CREDENTIALS, $result->getFailReason());
    }

    public function testAdminApiUserFirstPriority(): void
    {
        $adminUser = $this->createMock(User::class);
        $adminUser->method('isActive')->willReturn(true);

        $userFinder = $this->createMock(UserFinder::class);
        $userFinder->expects($this->once())
            ->method('findApiApiKey')
            ->with('admin-secret-key-123')
            ->willReturn($adminUser);

        $login = new BidarApiKeyLogin($userFinder);

        $request = $this->createMock(Request::class);
        $request->method('getHeader')->with('X-Api-Key')->willReturn('admin-secret-key-123');

        $result = $login->login(new Data(null, null), $request);

        $this->assertTrue($result->isSuccess());
        $this->assertSame($adminUser, $result->getUser());
    }

    public function testNativeApiUserAuthenticationWorksWhenUserFinderIsInjectedAsNull(): void
    {
        $apiUser = $this->createMock(User::class);
        $apiUser->method('isActive')->willReturn(true);
        $apiUser->method('isApi')->willReturn(true);

        $builder = $this->createMock(RDBSelectBuilder::class);
        $builder->expects($this->once())->method('findOne')->willReturn($apiUser);
        $repo = $this->createMock(RDBRepository::class);
        $repo->expects($this->once())
            ->method('where')
            ->with([
                'type' => User::TYPE_API,
                'apiKey' => 'native-api-key',
                'authMethod' => 'ApiKey',
            ])
            ->willReturn($builder);

        $em = $this->createMock(EntityManager::class);
        $em->expects($this->once())
            ->method('getRDBRepositoryByClass')
            ->with(User::class)
            ->willReturn($repo);
        $em->expects($this->never())->method('getRDBRepository');
        $em->expects($this->never())->method('saveEntity');

        $login = new BidarApiKeyLogin(null, $em);
        $request = $this->createMock(Request::class);
        $request->method('getHeader')->with('X-Api-Key')->willReturn('native-api-key');

        $result = $login->login(new Data(null, null), $request);

        $this->assertTrue($result->isSuccess());
        $this->assertSame($apiUser, $result->getUser());
        $this->assertFalse($result->bypassSecondStep());
    }

    public function testPersonalUserApiKeySuccess(): void
    {
        $apiKey = 'bdr_live_abcdef1234567890abcdef1234567890';
        $keyHash = hash('sha256', $apiKey);

        $keyRecord = $this->createEntityMock([
            'keyHash' => $keyHash,
            'userId' => 'user-42',
            'isActive' => true,
            'expiresAt' => null,
            'allowedIpList' => [],
        ], 'key-42');

        $ownerUser = $this->createMock(User::class);
        $ownerUser->method('isActive')->willReturn(true);
        $ownerUser->method('isSystem')->willReturn(false);
        $ownerUser->method('isPortal')->willReturn(false);

        $builder = $this->createMock(RDBSelectBuilder::class);
        $builder->expects($this->once())
            ->method('findOne')
            ->willReturn($keyRecord);

        $repo = $this->createMock(RDBRepository::class);
        $repo->expects($this->once())
            ->method('where')
            ->with(['keyHash' => $keyHash, 'isActive' => true])
            ->willReturn($builder);

        $em = $this->createMock(EntityManager::class);
        $em->method('getRDBRepository')->with('BidarUserApiKey')->willReturn($repo);
        $em->method('getEntity')->with('User', 'user-42')->willReturn($ownerUser);
        $em->expects($this->once())->method('saveEntity')->with($keyRecord, ['silent' => true]);

        $userFinder = $this->createMock(UserFinder::class);
        $userFinder->method('findApiApiKey')->willReturn(null);

        $login = new BidarApiKeyLogin($userFinder, $em);

        $request = $this->createMock(Request::class);
        $request->method('getHeader')->with('X-Api-Key')->willReturn($apiKey);

        $result = $login->login(new Data(null, null), $request);

        $this->assertTrue($result->isSuccess());
        $this->assertSame($ownerUser, $result->getUser());
        $this->assertTrue($result->bypassSecondStep());
        $this->assertNotNull($keyRecord->get('lastUsedAt'));
    }

    public function testPersonalUserApiKeyExpiredFails(): void
    {
        $apiKey = 'bdr_expired_key';
        $keyHash = hash('sha256', $apiKey);

        $keyRecord = $this->createEntityMock([
            'keyHash' => $keyHash,
            'userId' => 'user-42',
            'isActive' => true,
            'expiresAt' => '2020-01-01 00:00:00', // expired
            'allowedIpList' => [],
        ]);

        $builder = $this->createMock(RDBSelectBuilder::class);
        $builder->method('findOne')->willReturn($keyRecord);

        $repo = $this->createMock(RDBRepository::class);
        $repo->method('where')->willReturn($builder);

        $em = $this->createMock(EntityManager::class);
        $em->method('getRDBRepository')->with('BidarUserApiKey')->willReturn($repo);

        $login = new BidarApiKeyLogin(null, $em);

        $request = $this->createMock(Request::class);
        $request->method('getHeader')->with('X-Api-Key')->willReturn($apiKey);

        $result = $login->login(new Data(null, null), $request);

        $this->assertFalse($result->isSuccess());
        $this->assertSame(FailReason::DENIED, $result->getFailReason());
    }

    public function testPersonalUserApiKeyIpRestrictionViolatedFails(): void
    {
        $apiKey = 'bdr_ip_restricted';
        $keyHash = hash('sha256', $apiKey);

        $keyRecord = $this->createEntityMock([
            'keyHash' => $keyHash,
            'userId' => 'user-42',
            'isActive' => true,
            'expiresAt' => null,
            'allowedIpList' => ['192.168.1.100'],
        ]);

        $builder = $this->createMock(RDBSelectBuilder::class);
        $builder->method('findOne')->willReturn($keyRecord);

        $repo = $this->createMock(RDBRepository::class);
        $repo->method('where')->willReturn($builder);

        $em = $this->createMock(EntityManager::class);
        $em->method('getRDBRepository')->with('BidarUserApiKey')->willReturn($repo);

        $login = new BidarApiKeyLogin(null, $em);

        $request = $this->createMock(Request::class);
        $request->method('getHeader')->with('X-Api-Key')->willReturn($apiKey);
        $request->method('getServerParam')->with('REMOTE_ADDR')->willReturn('203.0.113.195');

        $result = $login->login(new Data(null, null), $request);

        $this->assertFalse($result->isSuccess());
        $this->assertSame(FailReason::DENIED, $result->getFailReason());
    }

    public function testPersonalKeyCannotAuthenticateNativeApiUserAsOwner(): void
    {
        [$login, $em] = $this->createPersonalKeyLogin('bdr_api_owner', [
            'userId' => 'api-user-1',
        ]);
        $owner = $this->createMock(User::class);
        $owner->method('isActive')->willReturn(true);
        $owner->method('isSystem')->willReturn(false);
        $owner->method('isPortal')->willReturn(false);
        $owner->method('isApi')->willReturn(true);
        $em->method('getEntity')->with('User', 'api-user-1')->willReturn($owner);
        $em->expects($this->never())->method('saveEntity');

        $request = $this->createMock(Request::class);
        $request->method('getHeader')->with('X-Api-Key')->willReturn('bdr_api_owner');

        $result = $login->login(new Data(null, null), $request);

        $this->assertFalse($result->isSuccess());
        $this->assertSame(FailReason::DENIED, $result->getFailReason());
    }

    public static function corruptAllowedIpListProvider(): array
    {
        return [
            'string' => ['192.0.2.10'],
            'integer' => [123],
        ];
    }

    #[DataProvider('corruptAllowedIpListProvider')]
    public function testPersonalKeyFailsClosedForNonEmptyNonArrayAllowedIpList(mixed $allowedIpList): void
    {
        [$login, $em] = $this->createPersonalKeyLogin('bdr_corrupt_ip_list', [
            'userId' => 'user-42',
            'allowedIpList' => $allowedIpList,
        ]);
        $owner = $this->createMock(User::class);
        $owner->method('isActive')->willReturn(true);
        $owner->method('isSystem')->willReturn(false);
        $owner->method('isPortal')->willReturn(false);
        $owner->method('isApi')->willReturn(false);
        $em->method('getEntity')->with('User', 'user-42')->willReturn($owner);
        $em->expects($this->never())->method('saveEntity');

        $request = $this->createMock(Request::class);
        $request->method('getHeader')->with('X-Api-Key')->willReturn('bdr_corrupt_ip_list');

        $result = $login->login(new Data(null, null), $request);

        $this->assertFalse($result->isSuccess());
        $this->assertSame(FailReason::DENIED, $result->getFailReason());
    }

    public function testInactiveOrSystemOwnerUserFails(): void
    {
        $apiKey = 'bdr_system_user_key';
        $keyHash = hash('sha256', $apiKey);

        $keyRecord = $this->createEntityMock([
            'keyHash' => $keyHash,
            'userId' => 'user-system',
            'isActive' => true,
            'expiresAt' => null,
            'allowedIpList' => [],
        ]);

        $systemUser = $this->createMock(User::class);
        $systemUser->method('isActive')->willReturn(true);
        $systemUser->method('isSystem')->willReturn(true); // System user disallowed!

        $builder = $this->createMock(RDBSelectBuilder::class);
        $builder->method('findOne')->willReturn($keyRecord);

        $repo = $this->createMock(RDBRepository::class);
        $repo->method('where')->willReturn($builder);

        $em = $this->createMock(EntityManager::class);
        $em->method('getRDBRepository')->with('BidarUserApiKey')->willReturn($repo);
        $em->method('getEntity')->with('User', 'user-system')->willReturn($systemUser);

        $login = new BidarApiKeyLogin(null, $em);

        $request = $this->createMock(Request::class);
        $request->method('getHeader')->with('X-Api-Key')->willReturn($apiKey);

        $result = $login->login(new Data(null, null), $request);

        $this->assertFalse($result->isSuccess());
        $this->assertSame(FailReason::DENIED, $result->getFailReason());
    }

    public function testNativeApiUserAuthWorksWhenUserFinderIsNull(): void
    {
        $apiUser = $this->createMock(User::class);
        $apiUser->method('isActive')->willReturn(true);
        $apiUser->method('isApi')->willReturn(true);

        $builder = $this->createMock(RDBSelectBuilder::class);
        $builder->method('findOne')->willReturn($apiUser);

        $userRepo = $this->createMock(RDBRepository::class);
        $userRepo->method('where')->willReturn($builder);

        $em = $this->createMock(EntityManager::class);
        $em->method('getRDBRepositoryByClass')->with(User::class)->willReturn($userRepo);

        // Simulate InjectableFactory injecting null for ?UserFinder
        $login = new BidarApiKeyLogin(null, $em);

        $request = $this->createMock(Request::class);
        $request->method('getHeader')->with('X-Api-Key')->willReturn('native-api-user-key');

        $result = $login->login(new Data(null, null), $request);

        $this->assertTrue($result->isSuccess());
        $this->assertSame($apiUser, $result->getUser());
    }

    public function testPersonalUserApiKeyRejectsApiTypeOwnerUser(): void
    {
        $apiKey = 'bdr_api_owner_rejected';
        $keyHash = hash('sha256', $apiKey);

        $keyRecord = $this->createEntityMock([
            'keyHash' => $keyHash,
            'userId' => 'user-api',
            'isActive' => true,
            'expiresAt' => null,
            'allowedIpList' => [],
        ]);

        $apiOwner = $this->createMock(User::class);
        $apiOwner->method('isActive')->willReturn(true);
        $apiOwner->method('isSystem')->willReturn(false);
        $apiOwner->method('isPortal')->willReturn(false);
        $apiOwner->method('isApi')->willReturn(true);

        $builder = $this->createMock(RDBSelectBuilder::class);
        $builder->method('findOne')->willReturn($keyRecord);

        $repo = $this->createMock(RDBRepository::class);
        $repo->method('where')->willReturn($builder);

        $em = $this->createMock(EntityManager::class);
        $em->method('getRDBRepository')->with('BidarUserApiKey')->willReturn($repo);
        $em->method('getEntity')->with('User', 'user-api')->willReturn($apiOwner);

        $userFinder = $this->createMock(UserFinder::class);
        $userFinder->method('findApiApiKey')->willReturn(null);

        $login = new BidarApiKeyLogin($userFinder, $em);

        $request = $this->createMock(Request::class);
        $request->method('getHeader')->with('X-Api-Key')->willReturn($apiKey);

        $result = $login->login(new Data(null, null), $request);

        $this->assertFalse($result->isSuccess());
        $this->assertSame(FailReason::DENIED, $result->getFailReason());
    }

    public function testPersonalUserApiKeyRejectsCorruptNonArrayAllowedIpList(): void
    {
        $apiKey = 'bdr_corrupt_ip_list';
        $keyHash = hash('sha256', $apiKey);

        $keyRecord = $this->createEntityMock([
            'keyHash' => $keyHash,
            'userId' => 'user-42',
            'isActive' => true,
            'expiresAt' => null,
            'allowedIpList' => '192.168.1.100',
        ]);

        $builder = $this->createMock(RDBSelectBuilder::class);
        $builder->method('findOne')->willReturn($keyRecord);

        $repo = $this->createMock(RDBRepository::class);
        $repo->method('where')->willReturn($builder);

        $em = $this->createMock(EntityManager::class);
        $em->method('getRDBRepository')->with('BidarUserApiKey')->willReturn($repo);

        $userFinder = $this->createMock(UserFinder::class);
        $userFinder->method('findApiApiKey')->willReturn(null);

        $login = new BidarApiKeyLogin($userFinder, $em);

        $request = $this->createMock(Request::class);
        $request->method('getHeader')->with('X-Api-Key')->willReturn($apiKey);
        $request->method('getServerParam')->with('REMOTE_ADDR')->willReturn('192.168.1.100');

        $result = $login->login(new Data(null, null), $request);

        $this->assertFalse($result->isSuccess());
        $this->assertSame(FailReason::DENIED, $result->getFailReason());
    }
}
