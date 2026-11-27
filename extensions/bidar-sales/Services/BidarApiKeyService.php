<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Services;

use Espo\Core\Exceptions\BadRequest;
use Espo\Core\Exceptions\Forbidden;
use Espo\Core\Exceptions\NotFound;
use Espo\Entities\User;
use Espo\ORM\Entity;
use Espo\ORM\EntityManager;

class BidarApiKeyService
{
    public const KEY_PREFIX_LENGTH = 16;
    public const RANDOM_BYTES_COUNT = 24;

    private ?EntityManager $entityManager;

    public function __construct(?EntityManager $entityManager = null)
    {
        $this->entityManager = $entityManager;
    }

    /**
     * Generates a secure plain API key.
     */
    public function generatePlainKey(): string
    {
        return 'bdr_' . bin2hex(random_bytes(self::RANDOM_BYTES_COUNT));
    }

    /**
     * Extracts non-sensitive display prefix.
     */
    public function extractPrefix(string $plainKey): string
    {
        return substr($plainKey, 0, 12) . '...';
    }

    /**
     * Computes SHA-256 hash for storage.
     */
    public function hashKey(string $plainKey): string
    {
        return hash('sha256', $plainKey);
    }

    /**
     * Lists API keys for user. Never returns keyHash.
     *
     * @return array{list: list<array<string, mixed>>, total: int}
     */
    public function listKeys(User $currentUser, ?string $targetUserId = null): array
    {
        if ($this->entityManager === null) {
            return ['list' => [], 'total' => 0];
        }

        // If targetUserId is requested, only super-admin can view another user's keys
        $userId = $currentUser->getId();
        if ($targetUserId !== null && $targetUserId !== '' && $targetUserId !== $userId) {
            if (!method_exists($currentUser, 'isSuperAdmin') || !$currentUser->isSuperAdmin()) {
                throw new Forbidden('Only super-administrators can view API keys of other users.');
            }
            $userId = $targetUserId;
        }

        $collection = $this->entityManager
            ->getRDBRepository('BidarUserApiKey')
            ->where(['userId' => $userId])
            ->order('createdAt', 'desc')
            ->find();

        $list = [];
        foreach ($collection as $item) {
            $list[] = $this->formatKeySafe($item);
        }

        return [
            'list' => $list,
            'total' => count($list),
        ];
    }

    /**
     * Creates a new API key. Returns plainKey ONCE.
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function createKey(User $currentUser, array $data): array
    {
        if ($this->entityManager === null) {
            throw new BadRequest('Entity manager unavailable.');
        }

        $name = trim((string) ($data['name'] ?? ''));
        if ($name === '') {
            throw new BadRequest('Key name is required.');
        }
        if (mb_strlen($name) > 100) {
            throw new BadRequest('Key name cannot exceed 100 characters.');
        }

        if (
            (method_exists($currentUser, 'isSystem') && $currentUser->isSystem())
            || (method_exists($currentUser, 'isPortal') && $currentUser->isPortal())
            || (method_exists($currentUser, 'isApi') && $currentUser->isApi())
        ) {
            throw new BadRequest('Cannot create personal API key for system, portal, or API users.');
        }

        $targetUserId = $currentUser->getId();
        if (isset($data['userId']) && is_string($data['userId']) && $data['userId'] !== $targetUserId) {
            if (!method_exists($currentUser, 'isSuperAdmin') || !$currentUser->isSuperAdmin()) {
                throw new Forbidden('Only super-administrators can create API keys for other users.');
            }
            $targetUser = $this->entityManager->getEntity('User', $data['userId']);
            if (!$targetUser) {
                throw new NotFound('Target user not found.');
            }
            if (!$targetUser->get('isActive')) {
                throw new BadRequest('Cannot create API key for an inactive user.');
            }
            if (
                (method_exists($targetUser, 'isSystem') && $targetUser->isSystem())
                || (method_exists($targetUser, 'isPortal') && $targetUser->isPortal())
                || (method_exists($targetUser, 'isApi') && $targetUser->isApi())
            ) {
                throw new BadRequest('Cannot create personal API key for system, portal, or API users.');
            }
            $targetUserId = $data['userId'];
        }

        $plainKey = $this->generatePlainKey();
        $prefix = $this->extractPrefix($plainKey);
        $hash = $this->hashKey($plainKey);

        $expiresAt = null;
        if (!empty($data['expiresAt']) && is_string($data['expiresAt'])) {
            $ts = strtotime($data['expiresAt']);
            if ($ts === false) {
                throw new BadRequest('Invalid expiresAt format.');
            }
            if ($ts <= time()) {
                throw new BadRequest('Expiration date must be in the future.');
            }
            $expiresAt = date('Y-m-d H:i:s', $ts);
        }

        $allowedIpList = [];
        if (isset($data['allowedIpList']) && $data['allowedIpList'] !== null && $data['allowedIpList'] !== '') {
            if (is_array($data['allowedIpList'])) {
                $rawIps = $data['allowedIpList'];
            } elseif (is_string($data['allowedIpList'])) {
                $rawIps = explode(',', $data['allowedIpList']);
            } else {
                throw new BadRequest('allowedIpList must be an array or comma-separated string.');
            }
            foreach ($rawIps as $rawIp) {
                $ip = trim((string) $rawIp);
                if ($ip === '') {
                    continue;
                }
                if (!filter_var($ip, FILTER_VALIDATE_IP)) {
                    throw new BadRequest(sprintf('Invalid IP address format: "%s".', $ip));
                }
                $allowedIpList[] = $ip;
            }
            $allowedIpList = array_values(array_unique($allowedIpList));
        }

        /** @var Entity $entity */
        $entity = $this->entityManager->getEntity('BidarUserApiKey');
        $attributes = [
            'name' => $name,
            'userId' => $targetUserId,
            'keyPrefix' => $prefix,
            'keyHash' => $hash,
            'isActive' => true,
            'expiresAt' => $expiresAt,
            'allowedIpList' => $allowedIpList,
            'createdAt' => date('Y-m-d H:i:s'),
        ];
        foreach ($attributes as $k => $v) {
            $entity->set($k, $v);
        }

        $this->entityManager->saveEntity($entity);

        $result = $this->formatKeySafe($entity);
        // Expose plainKey and rawKey alias exactly once upon creation
        $result['plainKey'] = $plainKey;
        $result['rawKey'] = $plainKey;

        return $result;
    }

    /**
     * Rotates an existing key: regenerates hash, returns new plainKey once.
     *
     * @return array<string, mixed>
     */
    public function rotateKey(User $currentUser, string $keyId): array
    {
        if ($this->entityManager === null) {
            throw new BadRequest('Entity manager unavailable.');
        }

        $entity = $this->entityManager->getEntity('BidarUserApiKey', $keyId);
        if (!$entity) {
            throw new NotFound('API key not found.');
        }

        $this->assertOwnership($currentUser, $entity);

        if (!(bool) $entity->get('isActive')) {
            throw new BadRequest('Cannot rotate a revoked API key.');
        }

        $plainKey = $this->generatePlainKey();
        $prefix = $this->extractPrefix($plainKey);
        $hash = $this->hashKey($plainKey);

        $attributes = [
            'keyPrefix' => $prefix,
            'keyHash' => $hash,
            'lastUsedAt' => null,
            'modifiedAt' => date('Y-m-d H:i:s'),
        ];

        $txManager = $this->entityManager->getTransactionManager();
        $txManager->run(function () use ($entity, $attributes): void {
            foreach ($attributes as $k => $v) {
                $entity->set($k, $v);
            }
            $this->entityManager->saveEntity($entity);
        });

        $result = $this->formatKeySafe($entity);
        $result['plainKey'] = $plainKey;
        $result['rawKey'] = $plainKey;

        return $result;
    }

    /**
     * Deletes / revokes an API key.
     */
    public function revokeKey(User $currentUser, string $keyId): bool
    {
        if ($this->entityManager === null) {
            throw new BadRequest('Entity manager unavailable.');
        }

        $entity = $this->entityManager->getEntity('BidarUserApiKey', $keyId);
        if (!$entity) {
            throw new NotFound('API key not found.');
        }

        $this->assertOwnership($currentUser, $entity);

        $entity->set('isActive', false);
        $entity->set('revokedAt', date('Y-m-d H:i:s'));
        $entity->set('revokedByUserId', $currentUser->getId());

        $this->entityManager->saveEntity($entity);

        return true;
    }

    private function assertOwnership(User $currentUser, Entity $keyRecord): void
    {
        $ownerId = (string) $keyRecord->get('userId');
        $isSuperAdmin = method_exists($currentUser, 'isSuperAdmin') && $currentUser->isSuperAdmin();
        if ($ownerId !== $currentUser->getId() && !$isSuperAdmin) {
            throw new Forbidden('You do not have permission to manage this API key.');
        }
    }

    /**
     * Formats entity attributes safely without exposing keyHash.
     *
     * @return array<string, mixed>
     */
    public function formatKeySafe(Entity $entity): array
    {
        return [
            'id' => $entity->getId(),
            'name' => $entity->get('name'),
            'userId' => $entity->get('userId'),
            'keyPrefix' => $entity->get('keyPrefix'),
            'isActive' => (bool) $entity->get('isActive'),
            'expiresAt' => $entity->get('expiresAt'),
            'lastUsedAt' => $entity->get('lastUsedAt'),
            'allowedIpList' => $entity->get('allowedIpList') ?? [],
            'revokedAt' => $entity->get('revokedAt'),
            'revokedByUserId' => $entity->get('revokedByUserId'),
            'createdAt' => $entity->get('createdAt'),
        ];
    }
}
