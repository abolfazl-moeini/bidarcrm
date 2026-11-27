<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Api;

use Espo\Core\Acl;
use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Api\ResponseComposer;
use Espo\Core\Exceptions\BadRequest;
use Espo\Core\Exceptions\Forbidden;
use Espo\Core\InjectableFactory;
use Espo\Core\Select\SelectBuilderFactory;
use Espo\Entities\User;
use Espo\Modules\BidarIran\Support\PersianCsvExporter;
use Espo\ORM\Entity;
use Espo\ORM\EntityManager;

class BidarExportAction implements Action
{
    public const int MAX_EXPORT_ROWS = 10000;

    public const array ALLOWED_ENTITIES = [
        'Opportunity',
        'Contact',
        'Account',
        'Lead',
        'Task',
    ];

    private ?EntityManager $entityManager;
    private ?Acl $acl;
    private ?SelectBuilderFactory $selectBuilderFactory;
    private ?User $user;

    public function __construct(
        ?EntityManager $entityManager = null,
        ?Acl $acl = null,
        ?SelectBuilderFactory $selectBuilderFactory = null,
        ?User $user = null,
        ?InjectableFactory $injectableFactory = null
    ) {
        $this->entityManager = $entityManager;
        $this->acl = $acl;
        $createdFactory = $selectBuilderFactory === null && $injectableFactory !== null
            ? $injectableFactory->create(SelectBuilderFactory::class)
            : null;
        $this->selectBuilderFactory = $selectBuilderFactory
            ?? ($createdFactory instanceof SelectBuilderFactory ? $createdFactory : null);
        $this->user = $user;
    }

    public function process(Request $request): Response
    {
        $entityType = $request->getRouteParam('entityType');
        if (!$entityType || !is_string($entityType)) {
            throw new BadRequest('Entity type parameter is required.');
        }

        $entityType = ucfirst(trim($entityType));
        if (!in_array($entityType, self::ALLOWED_ENTITIES, true)) {
            throw new BadRequest("Unsupported entity type for export: {$entityType}. Allowed types: " . implode(', ', self::ALLOWED_ENTITIES));
        }

        // Fail-closed authentication & scope/export ACL permission check before any data access
        if (
            $this->user === null
            || $this->user->isSystem()
            || $this->acl === null
            || $this->selectBuilderFactory === null
            || !$this->acl->checkScope($entityType, 'read')
            || (method_exists($this->acl, 'getPermissionLevel') && $this->acl->getPermissionLevel('exportPermission') === 'no')
        ) {
            throw new Forbidden("Access denied to export {$entityType}.");
        }

        // Query entities with strict record-level ACL and bounded row limit
        $entities = [];
        if ($this->entityManager !== null) {
            try {
                $query = $this->selectBuilderFactory->create()
                    ->from($entityType)
                    ->withStrictAccessControl()
                    ->build();

                $collection = $this->entityManager
                    ->getRDBRepository($entityType)
                    ->clone($query)
                    ->limit(0, self::MAX_EXPORT_ROWS)
                    ->sth()
                    ->find();
            } catch (Forbidden $e) {
                throw new Forbidden("Access denied to export {$entityType}: " . $e->getMessage());
            }

            foreach ($collection as $entity) {
                if ($this->acl->checkEntityRead($entity)) {
                    $entities[] = $entity;
                }
            }
        }

        $forbiddenFields = $this->acl->getScopeForbiddenFieldList($entityType, 'read');
        [$headers, $rows, $dateColumns] = $this->mapEntitiesToCsvData($entityType, $entities, $forbiddenFields);

        $csvContent = PersianCsvExporter::export($headers, $rows, $dateColumns);
        $filename = strtolower($entityType) . '-export-' . date('Y-m-d') . '.csv';

        return ResponseComposer::empty()
            ->setHeader('Content-Type', 'text/csv; charset=UTF-8')
            ->setHeader('Content-Disposition', 'attachment; filename="' . $filename . '"')
            ->writeBody($csvContent);
    }

    /**
     * @param list<Entity> $entities
     * @param ?list<string> $forbiddenFields
     * @return array{0: list<string>, 1: list<list<mixed>>, 2: list<int|string>}
     */
    public function mapEntitiesToCsvData(string $entityType, array $entities, ?array $forbiddenFields = null): array
    {
        if ($forbiddenFields === null) {
            $forbiddenFields = $this->acl?->getScopeForbiddenFieldList($entityType, 'read') ?? [];
        }
        $columnDefs = match ($entityType) {
            'Opportunity' => [
                ['نام معامله', 'name', 'name', false],
                ['مبلغ', 'amount', 'amount', false],
                ['مرحله', 'stage', 'stage', false],
                ['درصد احتمال', 'probability', 'probability', false],
                ['تاریخ بستن', 'closeDate', 'closeDate', true],
                ['شرکت', 'accountName', 'account', false],
                ['مخاطب', 'contactName', 'contact', false],
                ['مسئول', 'assignedUserName', 'assignedUser', false],
                ['تاریخ ایجاد', 'createdAt', 'createdAt', true],
            ],
            'Contact' => [
                ['نام و نام خانوادگی', 'name', 'name', false],
                ['ایمیل', 'emailAddress', 'emailAddress', false],
                ['تلفن', 'phoneNumber', 'phoneNumber', false],
                ['شرکت', 'accountName', 'account', false],
                ['سمت', 'title', 'title', false],
                ['مسئول', 'assignedUserName', 'assignedUser', false],
                ['تاریخ ایجاد', 'createdAt', 'createdAt', true],
            ],
            'Account' => [
                ['نام شرکت', 'name', 'name', false],
                ['ایمیل', 'emailAddress', 'emailAddress', false],
                ['تلفن', 'phoneNumber', 'phoneNumber', false],
                ['وب‌سایت', 'website', 'website', false],
                ['نوع', 'type', 'type', false],
                ['مسئول', 'assignedUserName', 'assignedUser', false],
                ['تاریخ ایجاد', 'createdAt', 'createdAt', true],
            ],
            'Lead' => [
                ['نام سرنخ', 'name', 'name', false],
                ['وضعیت', 'status', 'status', false],
                ['شیوه آشنایی', 'source', 'source', false],
                ['ایمیل', 'emailAddress', 'emailAddress', false],
                ['تلفن', 'phoneNumber', 'phoneNumber', false],
                ['شرکت', 'accountName', 'account', false],
                ['مسئول', 'assignedUserName', 'assignedUser', false],
                ['تاریخ ایجاد', 'createdAt', 'createdAt', true],
            ],
            'Task' => [
                ['موضوع', 'name', 'name', false],
                ['وضعیت', 'status', 'status', false],
                ['اولویت', 'priority', 'priority', false],
                ['مهلت انجام', 'dateEnd', 'dateEnd', true],
                ['نوع والد', 'parentType', 'parent', false],
                ['نام والد', 'parentName', 'parent', false],
                ['مسئول', 'assignedUserName', 'assignedUser', false],
                ['تاریخ ایجاد', 'createdAt', 'createdAt', true],
            ],
            default => [],
        };

        $keptColumns = [];
        $headers = [];
        $dateColumns = [];

        foreach ($columnDefs as [$header, $fieldKey, $aclKey, $isDate]) {
            if (
                in_array($fieldKey, $forbiddenFields, true)
                || in_array($aclKey, $forbiddenFields, true)
            ) {
                continue;
            }
            $colIndex = count($headers);
            $headers[] = $header;
            $keptColumns[] = $fieldKey;
            if ($isDate) {
                $dateColumns[] = $colIndex;
            }
        }

        $rows = [];
        foreach ($entities as $e) {
            $row = [];
            foreach ($keptColumns as $fieldKey) {
                $row[] = self::sanitizeCsvCell($e->get($fieldKey));
            }
            $rows[] = $row;
        }

        return [$headers, $rows, $dateColumns];
    }

    private static function sanitizeCsvCell(mixed $value): mixed
    {
        if (!is_string($value) || $value === '') {
            return $value;
        }

        if (
            in_array($value[0], ['=', '+', '-', '@', "\t", "\r", "\n"], true)
            || preg_match('/^[\s\x00-\x1F]*[=+\-@]/', $value) === 1
        ) {
            return "'" . $value;
        }

        return $value;
    }
}
