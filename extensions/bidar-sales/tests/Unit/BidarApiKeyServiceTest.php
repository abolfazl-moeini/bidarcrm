<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Tests\Unit;

use Espo\Core\Exceptions\BadRequest;
use Espo\Core\Exceptions\Forbidden;
use Espo\Core\Exceptions\NotFound;
use Espo\Entities\User;
use Espo\Modules\BidarSales\Services\BidarApiKeyService;
use Espo\ORM\Entity;
use Espo\ORM\EntityCollection;
use Espo\ORM\EntityManager;
use Espo\ORM\Repository\RDBRepository;
use Espo\ORM\Repository\RDBSelectBuilder;
use Espo\ORM\TransactionManager;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class BidarApiKeyServiceTest extends TestCase
{
    private BidarApiKeyService $service;

    protected function setUp(): void
    {
        $this->service = new BidarApiKeyService();
    }

    private function createEntityMock(array $initialValues = [], ?string $id = 'key-101'): Entity
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

    private function createEntityManagerMock(?TransactionManager $transactionManager = null): EntityManager
    {
        $em = $this->createMock(EntityManager::class);
        if ($transactionManager === null) {
            $transactionManager = $this->createMock(TransactionManager::class);
            $transactionManager->method('run')->willReturnCallback(
                static fn (\Closure $callback): mixed => $callback()
            );
        }
        $em->method('getTransactionManager')->willReturn($transactionManager);

        return $em;
    }

    public function testGeneratePlainKeyFormat(): void
    {
        $key1 = $this->service->generatePlainKey();
        $key2 = $this->service->generatePlainKey();

        $this->assertStringStartsWith('bdr_', $key1);
        $this->assertStringStartsWith('bdr_', $key2);
        $this->assertNotSame($key1, $key2);
        // 'bdr_' (4) + 48 hex characters = 52 characters
        $this->assertSame(52, strlen($key1));
    }

    public function testExtractPrefixAndHash(): void
    {
        $plainKey = 'bdr_1234567890abcdef1234567890abcdef1234567890abcdef';
        $prefix = $this->service->extractPrefix($plainKey);
        $hash = $this->service->hashKey($plainKey);

        $this->assertSame('bdr_12345678...', $prefix);
        $this->assertSame(64, strlen($hash));
        $this->assertSame(hash('sha256', $plainKey), $hash);
    }

    public function testCreateKeyGeneratesPlainKeyOnceAndSavesHash(): void
    {
        $em = $this->createEntityManagerMock();
        $entity = $this->createEntityMock([], 'key-101');

        $em->expects($this->once())
            ->method('getEntity')
            ->with('BidarUserApiKey')
            ->willReturn($entity);

        $em->expects($this->once())
            ->method('saveEntity')
            ->with($entity);

        $service = new BidarApiKeyService($em);

        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn('user-007');
        $user->method('isAdmin')->willReturn(false);

        $result = $service->createKey($user, [
            'name' => 'فروشگاه ووکامرس',
            'expiresAt' => '2027-01-01 00:00:00',
            'allowedIpList' => ['192.168.1.1', '10.0.0.1'],
        ]);

        $this->assertSame('key-101', $result['id']);
        $this->assertSame('فروشگاه ووکامرس', $result['name']);
        $this->assertSame('user-007', $result['userId']);
        $this->assertTrue($result['isActive']);
        $this->assertArrayHasKey('plainKey', $result);
        $this->assertStringStartsWith('bdr_', $result['plainKey']);
        $this->assertArrayNotHasKey('keyHash', $result);

        // Verify entity received hashed value, not plain text
        $this->assertNotSame($result['plainKey'], $entity->get('keyHash'));
        $this->assertSame(hash('sha256', $result['plainKey']), $entity->get('keyHash'));
    }

    public function testCreateKeyRequiresName(): void
    {
        $em = $this->createEntityManagerMock();
        $service = new BidarApiKeyService($em);

        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn('user-007');

        $this->expectException(BadRequest::class);
        $service->createKey($user, ['name' => '   ']);
    }

    public function testNonAdminCannotCreateKeyForAnotherUser(): void
    {
        $em = $this->createEntityManagerMock();
        $service = new BidarApiKeyService($em);

        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn('user-007');
        $user->method('isAdmin')->willReturn(false);

        $this->expectException(Forbidden::class);
        $service->createKey($user, [
            'name' => 'Another User Key',
            'userId' => 'user-999',
        ]);
    }

    public function testRegularAdminCannotCreateKeyForAnotherUser(): void
    {
        $em = $this->createEntityManagerMock();
        $service = new BidarApiKeyService($em);

        $admin = $this->createMock(User::class);
        $admin->method('getId')->willReturn('admin-1');
        $admin->method('isAdmin')->willReturn(true);
        $admin->method('isSuperAdmin')->willReturn(false);

        $this->expectException(Forbidden::class);
        $this->expectExceptionMessage('Only super-administrators can create API keys for other users.');
        $service->createKey($admin, [
            'name' => 'User Key created by Admin',
            'userId' => 'user-999',
        ]);
    }

    public function testSuperAdminCanCreateKeyForAnotherActiveUser(): void
    {
        $em = $this->createEntityManagerMock();
        $entity = $this->createEntityMock([], 'key-102');
        $targetUser = $this->createMock(User::class);
        $targetUser->method('get')->with('isActive')->willReturn(true);

        $em->method('getEntity')->willReturnCallback(function (string $name, ?string $id = null) use ($entity, $targetUser) {
            if ($name === 'User' && $id === 'user-999') {
                return $targetUser;
            }
            if ($name === 'BidarUserApiKey') {
                return $entity;
            }
            return null;
        });

        $service = new BidarApiKeyService($em);

        $superAdmin = $this->createMock(User::class);
        $superAdmin->method('getId')->willReturn('superadmin-1');
        $superAdmin->method('isAdmin')->willReturn(true);
        $superAdmin->method('isSuperAdmin')->willReturn(true);

        $result = $service->createKey($superAdmin, [
            'name' => 'User Key created by SuperAdmin',
            'userId' => 'user-999',
        ]);

        $this->assertSame('user-999', $result['userId']);
    }

    public function testSuperAdminCannotCreateKeyForNonExistentUser(): void
    {
        $em = $this->createEntityManagerMock();
        $em->method('getEntity')->with('User', 'user-unknown')->willReturn(null);

        $service = new BidarApiKeyService($em);

        $superAdmin = $this->createMock(User::class);
        $superAdmin->method('getId')->willReturn('superadmin-1');
        $superAdmin->method('isAdmin')->willReturn(true);
        $superAdmin->method('isSuperAdmin')->willReturn(true);

        $this->expectException(NotFound::class);
        $service->createKey($superAdmin, [
            'name' => 'Key for ghost',
            'userId' => 'user-unknown',
        ]);
    }

    public function testSuperAdminCannotCreateKeyForInactiveUser(): void
    {
        $em = $this->createEntityManagerMock();
        $inactiveUser = $this->createMock(User::class);
        $inactiveUser->method('get')->with('isActive')->willReturn(false);

        $em->method('getEntity')->with('User', 'user-disabled')->willReturn($inactiveUser);

        $service = new BidarApiKeyService($em);

        $superAdmin = $this->createMock(User::class);
        $superAdmin->method('getId')->willReturn('superadmin-1');
        $superAdmin->method('isAdmin')->willReturn(true);
        $superAdmin->method('isSuperAdmin')->willReturn(true);

        $this->expectException(BadRequest::class);
        $this->expectExceptionMessage('Cannot create API key for an inactive user.');
        $service->createKey($superAdmin, [
            'name' => 'Key for inactive user',
            'userId' => 'user-disabled',
        ]);
    }

    public function testCreateKeyRejectsInvalidIpInAllowedIpList(): void
    {
        $em = $this->createEntityManagerMock();
        $service = new BidarApiKeyService($em);

        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn('user-007');

        $this->expectException(BadRequest::class);
        $this->expectExceptionMessage('Invalid IP address format: "999.999.999.999".');
        $service->createKey($user, [
            'name' => 'کلید با آی‌پی نامعتبر',
            'allowedIpList' => ['192.168.1.1', '999.999.999.999'],
        ]);
    }

    public function testCreateKeyRejectsLongName(): void
    {
        $em = $this->createEntityManagerMock();
        $service = new BidarApiKeyService($em);

        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn('user-007');

        $this->expectException(BadRequest::class);
        $this->expectExceptionMessage('Key name cannot exceed 100 characters.');
        $service->createKey($user, [
            'name' => str_repeat('a', 101),
        ]);
    }

    public function testCreateKeyRejectsPastExpiration(): void
    {
        $em = $this->createEntityManagerMock();
        $service = new BidarApiKeyService($em);

        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn('user-007');

        $this->expectException(BadRequest::class);
        $this->expectExceptionMessage('Expiration date must be in the future.');
        $service->createKey($user, [
            'name' => 'کلید منقضی',
            'expiresAt' => '2020-01-01 00:00:00',
        ]);
    }

    public function testListKeysHidesKeyHash(): void
    {
        $em = $this->createEntityManagerMock();
        $repo = $this->createMock(RDBRepository::class);

        $keyRecord = $this->createEntityMock([
            'name' => 'تست ۱',
            'userId' => 'user-1',
            'keyPrefix' => 'bdr_abc...',
            'keyHash' => 'super-secret-hash',
            'isActive' => true,
            'expiresAt' => null,
            'lastUsedAt' => '2026-11-20 10:00:00',
            'allowedIpList' => [],
            'createdAt' => '2026-11-01 00:00:00',
        ], 'k1');

        $collection = new EntityCollection([$keyRecord]);

        $selectBuilder = $this->createMock(RDBSelectBuilder::class);
        $selectBuilder->expects($this->once())
            ->method('order')
            ->willReturnSelf();
        $selectBuilder->expects($this->once())
            ->method('find')
            ->willReturn($collection);

        $repo->expects($this->once())
            ->method('where')
            ->with(['userId' => 'user-1'])
            ->willReturn($selectBuilder);

        $em->method('getRDBRepository')->with('BidarUserApiKey')->willReturn($repo);

        $service = new BidarApiKeyService($em);

        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn('user-1');

        $result = $service->listKeys($user);

        $this->assertSame(1, $result['total']);
        $item = $result['list'][0];
        $this->assertSame('k1', $item['id']);
        $this->assertSame('تست ۱', $item['name']);
        $this->assertSame('bdr_abc...', $item['keyPrefix']);
        $this->assertArrayNotHasKey('keyHash', $item);
        $this->assertArrayNotHasKey('plainKey', $item);
    }

    public function testRotateKeyGeneratesNewHashAndReturnsPlainKey(): void
    {
        $em = $this->createEntityManagerMock();
        $entity = $this->createEntityMock([
            'name' => 'کلید من',
            'userId' => 'user-1',
            'keyPrefix' => 'bdr_old...',
            'keyHash' => 'old-hash',
            'isActive' => true,
            'expiresAt' => null,
        ], 'key-1');

        $em->method('getEntity')->with('BidarUserApiKey', 'key-1')->willReturn($entity);
        $em->expects($this->once())->method('saveEntity')->with($entity);

        $service = new BidarApiKeyService($em);

        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn('user-1');
        $user->method('isAdmin')->willReturn(false);

        $result = $service->rotateKey($user, 'key-1');

        $this->assertArrayHasKey('plainKey', $result);
        $this->assertStringStartsWith('bdr_', $result['plainKey']);
        $this->assertSame(hash('sha256', $result['plainKey']), $entity->get('keyHash'));
        $this->assertNull($entity->get('lastUsedAt'));
    }

    public function testRotateKeyFailsWhenNotOwnerAndNotAdmin(): void
    {
        $em = $this->createEntityManagerMock();
        $entity = $this->createEntityMock(['userId' => 'user-owner'], 'key-1');

        $em->method('getEntity')->with('BidarUserApiKey', 'key-1')->willReturn($entity);

        $service = new BidarApiKeyService($em);

        $intruder = $this->createMock(User::class);
        $intruder->method('getId')->willReturn('user-intruder');
        $intruder->method('isAdmin')->willReturn(false);

        $this->expectException(Forbidden::class);
        $service->rotateKey($intruder, 'key-1');
    }

    public function testRevokeKeySetsAuditFieldsAndDeactivates(): void
    {
        $em = $this->createEntityManagerMock();
        $entity = $this->createEntityMock(['userId' => 'user-1', 'isActive' => true], 'key-1');

        $em->method('getEntity')->with('BidarUserApiKey', 'key-1')->willReturn($entity);
        $em->expects($this->once())->method('saveEntity')->with($entity);

        $service = new BidarApiKeyService($em);

        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn('user-1');
        $user->method('isAdmin')->willReturn(false);

        $success = $service->revokeKey($user, 'key-1');
        $this->assertTrue($success);
        $this->assertFalse($entity->get('isActive'));
        $this->assertNotNull($entity->get('revokedAt'));
        $this->assertSame('user-1', $entity->get('revokedByUserId'));
    }

    public function testRegularAdminCannotListOrRotateAnotherUsersKey(): void
    {
        $em = $this->createEntityManagerMock();
        $service = new BidarApiKeyService($em);

        $regularAdmin = $this->createMock(User::class);
        $regularAdmin->method('getId')->willReturn('admin-regular');
        $regularAdmin->method('isAdmin')->willReturn(true);
        $regularAdmin->method('isSuperAdmin')->willReturn(false);

        $this->expectException(Forbidden::class);
        $service->listKeys($regularAdmin, 'user-super');
    }

    public function testRegularAdminCannotRotateAnotherUsersKey(): void
    {
        $em = $this->createEntityManagerMock();
        $entity = $this->createEntityMock(['userId' => 'user-super', 'isActive' => true], 'key-super');
        $em->method('getEntity')->with('BidarUserApiKey', 'key-super')->willReturn($entity);

        $service = new BidarApiKeyService($em);

        $regularAdmin = $this->createMock(User::class);
        $regularAdmin->method('getId')->willReturn('admin-regular');
        $regularAdmin->method('isAdmin')->willReturn(true);
        $regularAdmin->method('isSuperAdmin')->willReturn(false);

        $this->expectException(Forbidden::class);
        $service->rotateKey($regularAdmin, 'key-super');
    }

    public function testRotateKeyRejectsInactiveKey(): void
    {
        $em = $this->createEntityManagerMock();
        $entity = $this->createEntityMock(['userId' => 'user-1', 'isActive' => false], 'key-revoked');
        $em->method('getEntity')->with('BidarUserApiKey', 'key-revoked')->willReturn($entity);

        $service = new BidarApiKeyService($em);

        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn('user-1');

        $this->expectException(BadRequest::class);
        $service->rotateKey($user, 'key-revoked');
    }

    public function testCreateKeyRejectsApiTargetUserAndInvalidAllowedIpList(): void
    {
        $em = $this->createEntityManagerMock();
        $targetApiUser = $this->createMock(User::class);
        $targetApiUser->method('isSystem')->willReturn(false);
        $targetApiUser->method('isPortal')->willReturn(false);
        $targetApiUser->method('isApi')->willReturn(true);
        $em->method('getEntity')->with('User', 'api-user-1')->willReturn($targetApiUser);

        $service = new BidarApiKeyService($em);

        $superAdmin = $this->createMock(User::class);
        $superAdmin->method('getId')->willReturn('super-1');
        $superAdmin->method('isSuperAdmin')->willReturn(true);

        $this->expectException(BadRequest::class);
        $service->createKey($superAdmin, [
            'name' => 'کلید نامعتبر',
            'userId' => 'api-user-1',
        ]);
    }

    public function testCreateKeyRejectsNonArrayNonStringAllowedIpList(): void
    {
        $em = $this->createEntityManagerMock();
        $service = new BidarApiKeyService($em);

        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn('user-1');

        $this->expectException(BadRequest::class);
        $service->createKey($user, [
            'name' => 'کلید با IP نامعتبر',
            'allowedIpList' => 123,
        ]);
    }

    public function testRegularAdminCannotRevokeAnotherUsersKey(): void
    {
        $em = $this->createEntityManagerMock();
        $entity = $this->createEntityMock(['userId' => 'user-super', 'isActive' => true], 'key-super');
        $em->method('getEntity')->with('BidarUserApiKey', 'key-super')->willReturn($entity);
        $em->expects($this->never())->method('saveEntity');
        $service = new BidarApiKeyService($em);
        $regularAdmin = $this->createMock(User::class);
        $regularAdmin->method('getId')->willReturn('admin-regular');
        $regularAdmin->method('isAdmin')->willReturn(true);
        $regularAdmin->method('isSuperAdmin')->willReturn(false);

        $this->expectException(Forbidden::class);
        $service->revokeKey($regularAdmin, 'key-super');
    }

    public static function systemOrPortalTargetUserProvider(): array
    {
        return [
            'system' => ['system'],
            'portal' => ['portal'],
        ];
    }

    #[DataProvider('systemOrPortalTargetUserProvider')]
    public function testCreateKeyRejectsSystemAndPortalTargetUsers(string $type): void
    {
        $em = $this->createEntityManagerMock();
        $targetUser = $this->createMock(User::class);
        $targetUser->method('get')->with('isActive')->willReturn(true);
        $targetUser->method('isSystem')->willReturn($type === 'system');
        $targetUser->method('isPortal')->willReturn($type === 'portal');
        $targetUser->method('isApi')->willReturn(false);
        $em->expects($this->once())
            ->method('getEntity')
            ->with('User', 'user-special')
            ->willReturn($targetUser);
        $em->expects($this->never())->method('saveEntity');
        $service = new BidarApiKeyService($em);
        $superAdmin = $this->createMock(User::class);
        $superAdmin->method('getId')->willReturn('superadmin-1');
        $superAdmin->method('isSuperAdmin')->willReturn(true);

        $this->expectException(BadRequest::class);
        $service->createKey($superAdmin, [
            'name' => 'Special user key',
            'userId' => 'user-special',
        ]);
    }

    public static function specialCurrentUserProvider(): array
    {
        return [
            'system' => ['system'],
            'portal' => ['portal'],
            'api' => ['api'],
        ];
    }

    #[DataProvider('specialCurrentUserProvider')]
    public function testCreateKeyRejectsSpecialCurrentUsers(string $type): void
    {
        $em = $this->createEntityManagerMock();
        $em->expects($this->never())->method('getEntity');
        $em->expects($this->never())->method('saveEntity');
        $service = new BidarApiKeyService($em);

        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn('special-user');
        $user->method('isSystem')->willReturn($type === 'system');
        $user->method('isPortal')->willReturn($type === 'portal');
        $user->method('isApi')->willReturn($type === 'api');

        $this->expectException(BadRequest::class);
        $this->expectExceptionMessage('system, portal, or API users');
        $service->createKey($user, ['name' => 'Special user key']);
    }

    public static function additionalInvalidAllowedIpListTypeProvider(): array
    {
        return [
            'false' => [false],
            'zero' => [0],
            'object' => [new \stdClass()],
        ];
    }

    #[DataProvider('additionalInvalidAllowedIpListTypeProvider')]
    public function testCreateKeyRejectsAdditionalInvalidAllowedIpListTypes(mixed $allowedIpList): void
    {
        $em = $this->createEntityManagerMock();
        $entity = $this->createEntityMock([], 'key-101');
        $em->method('getEntity')->with('BidarUserApiKey')->willReturn($entity);
        $em->expects($this->never())->method('saveEntity');
        $service = new BidarApiKeyService($em);
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn('user-1');

        $this->expectException(BadRequest::class);
        $service->createKey($user, [
            'name' => 'Invalid IP list type',
            'allowedIpList' => $allowedIpList,
        ]);
    }

    public function testRotateKeyRunsHashUpdateAndSaveInsideTransaction(): void
    {
        $insideTransaction = false;
        $transactionManager = $this->createMock(TransactionManager::class);
        $transactionManager->expects($this->once())
            ->method('run')
            ->willReturnCallback(function (\Closure $callback) use (&$insideTransaction): mixed {
                $insideTransaction = true;
                try {
                    return $callback();
                } finally {
                    $insideTransaction = false;
                }
            });

        $em = $this->createEntityManagerMock($transactionManager);
        $entity = $this->createEntityMock([
            'name' => 'کلید من',
            'userId' => 'user-1',
            'isActive' => true,
        ], 'key-1');
        $em->method('getEntity')->with('BidarUserApiKey', 'key-1')->willReturn($entity);
        $em->expects($this->once())
            ->method('saveEntity')
            ->with($entity)
            ->willReturnCallback(function () use (&$insideTransaction): void {
                $this->assertTrue($insideTransaction, 'Key persistence must occur inside the transaction.');
            });

        $service = new BidarApiKeyService($em);
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn('user-1');

        $result = $service->rotateKey($user, 'key-1');

        $this->assertArrayHasKey('plainKey', $result);
        $this->assertFalse($insideTransaction);
    }
}
