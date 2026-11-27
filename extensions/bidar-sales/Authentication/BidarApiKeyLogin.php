<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Authentication;

use DateTimeImmutable;
use Espo\Core\Api\Request;
use Espo\Core\Authentication\Helper\UserFinder;
use Espo\Core\Authentication\Login;
use Espo\Core\Authentication\Login\Data;
use Espo\Core\Authentication\Result;
use Espo\Core\Authentication\Result\FailReason;
use Espo\Entities\User;
use Espo\ORM\Entity;
use Espo\ORM\EntityManager;
use Throwable;

class BidarApiKeyLogin implements Login
{
    public const string NAME = 'ApiKey';
    public const string HEADER_API_KEY = 'X-Api-Key';

    private ?UserFinder $userFinder;
    private ?EntityManager $entityManager;

    public function __construct(
        ?UserFinder $userFinder = null,
        ?EntityManager $entityManager = null
    ) {
        $this->entityManager = $entityManager;
        $this->userFinder = $userFinder ?? ($entityManager !== null ? new UserFinder($entityManager) : null);
    }

    public function login(Data $data, Request $request): Result
    {
        $apiKey = $request->getHeader(self::HEADER_API_KEY);

        if (!$apiKey || !is_string($apiKey)) {
            return Result::fail(FailReason::WRONG_CREDENTIALS);
        }

        $apiKey = trim($apiKey);
        if ($apiKey === '') {
            return Result::fail(FailReason::WRONG_CREDENTIALS);
        }

        // 1. First priority: native admin ApiUser backwards compatibility
        if ($this->userFinder !== null) {
            try {
                $adminUser = $this->userFinder->findApiApiKey($apiKey);
                if ($adminUser instanceof User && $adminUser->isActive()) {
                    return Result::success($adminUser);
                }
            } catch (Throwable) {
                // Proceed to personal user key check
            }
        }

        // 2. Second priority: personal user API key
        if ($this->entityManager === null) {
            return Result::fail(FailReason::WRONG_CREDENTIALS);
        }

        $keyHash = hash('sha256', $apiKey);

        /** @var ?Entity $keyRecord */
        $keyRecord = $this->entityManager
            ->getRDBRepository('BidarUserApiKey')
            ->where([
                'keyHash' => $keyHash,
                'isActive' => true,
            ])
            ->findOne();

        if (!$keyRecord) {
            return Result::fail(FailReason::WRONG_CREDENTIALS);
        }

        $storedHash = (string) $keyRecord->get('keyHash');
        if (!hash_equals($storedHash, $keyHash)) {
            return Result::fail(FailReason::HASH_NOT_MATCHED);
        }

        // Check expiration
        $expiresAt = $keyRecord->get('expiresAt');
        if ($expiresAt !== null && $expiresAt !== '') {
            $expireTimestamp = is_numeric($expiresAt) ? (int) $expiresAt : strtotime((string) $expiresAt);
            if ($expireTimestamp !== false && $expireTimestamp < time()) {
                return Result::fail(FailReason::DENIED);
            }
        }

        // Check allowed IP list (fail-closed if corrupt/non-array)
        $allowedIps = $keyRecord->get('allowedIpList');
        if ($allowedIps !== null && $allowedIps !== '' && !is_array($allowedIps)) {
            return Result::fail(FailReason::DENIED);
        }
        if (is_array($allowedIps) && !empty($allowedIps)) {
            $clientIp = $request->getServerParam('REMOTE_ADDR') ?? $_SERVER['REMOTE_ADDR'] ?? null;
            if ($clientIp === null || !in_array($clientIp, $allowedIps, true)) {
                return Result::fail(FailReason::DENIED);
            }
        }

        // Fetch and validate owner user
        $userId = $keyRecord->get('userId');
        if (!$userId || !is_string($userId)) {
            return Result::fail(FailReason::USER_NOT_FOUND);
        }

        /** @var ?User $ownerUser */
        $ownerUser = $this->entityManager->getEntity('User', $userId);
        if (!$ownerUser instanceof User) {
            return Result::fail(FailReason::USER_NOT_FOUND);
        }

        // Security check: active, non-system, non-portal, non-api (ApiUser must use native UserFinder path)
        if (!$ownerUser->isActive() || $ownerUser->isSystem() || $ownerUser->isPortal() || $ownerUser->isApi()) {
            return Result::fail(FailReason::DENIED);
        }

        // Update lastUsedAt non-blockingly
        try {
            $keyRecord->set('lastUsedAt', date('Y-m-d H:i:s'));
            $this->entityManager->saveEntity($keyRecord, ['silent' => true]);
        } catch (Throwable) {
            // Non-blocking; do not fail authentication if timestamp update fails
        }

        // Zero Privilege Escalation: returns owner user; bypasses 2FA step for REST API clients
        return Result::success($ownerUser)->withBypassSecondStep();
    }
}
