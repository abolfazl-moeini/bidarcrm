<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Tests\Unit;

use Espo\Core\Acl;
use Espo\Core\Api\Request;
use Espo\Core\InjectableFactory;
use Espo\Core\Exceptions\BadRequest;
use Espo\Core\Exceptions\Forbidden;
use Espo\Core\Select\SelectBuilder;
use Espo\Core\Select\SelectBuilderFactory;
use Espo\Entities\User;
use Espo\Modules\BidarSales\Api\BidarExportAction;
use Espo\ORM\Entity;
use Espo\ORM\EntityCollection;
use Espo\ORM\EntityManager;
use Espo\ORM\Query\Select;
use Espo\ORM\Repository\RDBRepository;
use Espo\ORM\Repository\RDBSelectBuilder;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class BidarExportActionTest extends TestCase
{
    private function createEntityMock(array $initialValues = [], ?string $id = 'entity-1'): Entity
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

    public function testMissingEntityTypeThrowsBadRequest(): void
    {
        $action = new BidarExportAction();
        $request = $this->createMock(Request::class);
        $request->method('getRouteParam')->with('entityType')->willReturn(null);

        $this->expectException(BadRequest::class);
        $action->process($request);
    }

    public function testUnsupportedEntityTypeThrowsBadRequest(): void
    {
        $action = new BidarExportAction();
        $request = $this->createMock(Request::class);
        $request->method('getRouteParam')->with('entityType')->willReturn('UnsupportedEntity');

        $this->expectException(BadRequest::class);
        $action->process($request);
    }

    public function testScopeAclDeniedThrowsForbidden(): void
    {
        $acl = $this->createMock(Acl::class);
        $acl->expects($this->once())
            ->method('checkScope')
            ->with('Opportunity', 'read')
            ->willReturn(false);

        $user = $this->createMock(User::class);
        $user->method('isSystem')->willReturn(false);
        $factory = $this->createMock(SelectBuilderFactory::class);
        $em = $this->createMock(EntityManager::class);
        $em->expects($this->never())->method('getRDBRepository');

        $action = new BidarExportAction($em, $acl, $factory, $user);
        $request = $this->createMock(Request::class);
        $request->method('getRouteParam')->with('entityType')->willReturn('Opportunity');

        $this->expectException(Forbidden::class);
        $action->process($request);
    }

    public static function missingAuthorizationDependencyProvider(): array
    {
        return [
            'missing user' => ['user'],
            'system user' => ['system'],
            'missing acl' => ['acl'],
            'missing select builder factory' => ['factory'],
        ];
    }

    #[DataProvider('missingAuthorizationDependencyProvider')]
    public function testProcessFailsClosedBeforeRepositoryAccess(string $missing): void
    {
        $user = $this->createMock(User::class);
        $user->method('isSystem')->willReturn($missing === 'system');
        $acl = $this->createMock(Acl::class);
        $acl->method('checkScope')->willReturn(true);
        $factory = $this->createMock(SelectBuilderFactory::class);
        $em = $this->createMock(EntityManager::class);
        $em->expects($this->never())->method('getRDBRepository');

        $action = new BidarExportAction(
            $em,
            $missing === 'acl' ? null : $acl,
            $missing === 'factory' ? null : $factory,
            $missing === 'user' ? null : $user,
        );
        $request = $this->createMock(Request::class);
        $request->method('getRouteParam')->with('entityType')->willReturn('Opportunity');

        $this->expectException(Forbidden::class);
        $action->process($request);
    }

    public function testMissingSelectBuilderFactoryIsCreatedThroughInjectableFactory(): void
    {
        $user = $this->createMock(User::class);
        $user->method('isSystem')->willReturn(false);

        $acl = $this->createMock(Acl::class);
        $acl->method('checkScope')->willReturn(true);
        $acl->method('getScopeForbiddenFieldList')->willReturn([]);

        $factory = $this->createMock(SelectBuilderFactory::class);
        $injectableFactory = $this->createMock(InjectableFactory::class);
        $injectableFactory->expects($this->once())
            ->method('create')
            ->with(SelectBuilderFactory::class)
            ->willReturn($factory);

        $action = new BidarExportAction(null, $acl, null, $user, $injectableFactory);
        $request = $this->createMock(Request::class);
        $request->method('getRouteParam')->with('entityType')->willReturn('Opportunity');

        $response = $action->process($request);

        $this->assertSame(200, $response->getStatusCode());
    }

    public function testExportRouteDoesNotBypassAuthentication(): void
    {
        $routesFile = dirname(__DIR__, 2) . '/Resources/routes.json';
        $routes = json_decode((string) file_get_contents($routesFile), true);
        $this->assertIsArray($routes);

        foreach ($routes as $route) {
            if (($route['route'] ?? '') === '/BidarExport/:entityType') {
                $this->assertNotTrue($route['noAuth'] ?? false);
                return;
            }
        }

        $this->fail('Export route is not registered.');
    }

    public function testExportOpportunityWithUtf8BomAndPersianHeaders(): void
    {
        $opp = $this->createEntityMock([
            'name' => 'معامله خرید سرور',
            'amount' => 50000000.0,
            'stage' => 'Prospecting',
            'probability' => 20,
            'closeDate' => '2026-12-01',
            'accountName' => 'شرکت آلفا',
            'contactName' => 'علی احمدی',
            'assignedUserName' => 'کارشناس فروش',
            'createdAt' => '2026-11-20 12:00:00',
        ], 'opp-1');

        $user = $this->createMock(User::class);
        $user->method('isSystem')->willReturn(false);

        $acl = $this->createMock(Acl::class);
        $acl->method('checkScope')->willReturn(true);
        $acl->method('checkEntityRead')->willReturn(true);
        $acl->method('getScopeForbiddenFieldList')->willReturn([]);

        $query = $this->createMock(Select::class);
        $selectBuilder = $this->createMock(SelectBuilder::class);
        $selectBuilder->expects($this->once())->method('from')->with('Opportunity')->willReturnSelf();
        $selectBuilder->expects($this->once())->method('withStrictAccessControl')->willReturnSelf();
        $selectBuilder->expects($this->once())->method('build')->willReturn($query);
        $factory = $this->createMock(SelectBuilderFactory::class);
        $factory->expects($this->once())->method('create')->willReturn($selectBuilder);

        $repoBuilder = $this->createMock(RDBSelectBuilder::class);
        $repoBuilder->expects($this->once())->method('limit')->with(0, 10000)->willReturnSelf();
        $repoBuilder->expects($this->once())->method('sth')->willReturnSelf();
        $repoBuilder->expects($this->once())->method('find')->willReturn(new EntityCollection([$opp]));
        $repo = $this->createMock(RDBRepository::class);
        $repo->expects($this->once())->method('clone')->with($query)->willReturn($repoBuilder);
        $repo->expects($this->never())->method('find');

        $em = $this->createMock(EntityManager::class);
        $em->method('getRDBRepository')->with('Opportunity')->willReturn($repo);

        $action = new BidarExportAction($em, $acl, $factory, $user);

        $request = $this->createMock(Request::class);
        $request->method('getRouteParam')->with('entityType')->willReturn('Opportunity');

        $response = $action->process($request);

        $this->assertSame('text/csv; charset=UTF-8', $response->getHeader('Content-Type'));
        $this->assertStringContainsString('opportunity-export-', (string) $response->getHeader('Content-Disposition'));

        $body = (string) $response->getBody();
        // Must start with UTF-8 BOM \xEF\xBB\xBF
        $this->assertStringStartsWith("\xEF\xBB\xBF", $body);

        // Contains Persian headers
        $this->assertStringContainsString('نام معامله', $body);
        $this->assertStringContainsString('مبلغ', $body);
        $this->assertStringContainsString('معامله خرید سرور', $body);
        $this->assertStringContainsString('شرکت آلفا', $body);
    }

    public function testExportFiltersForbiddenFieldsAndLinkNameColumns(): void
    {
        $acl = $this->createMock(Acl::class);
        $acl->expects($this->once())
            ->method('getScopeForbiddenFieldList')
            ->with('Opportunity', 'read')
            ->willReturn(['amount', 'account', 'contact', 'assignedUser']);

        $opp = $this->createEntityMock([
            'name' => 'معامله امن',
            'amount' => 50000000,
            'stage' => 'Proposal',
            'probability' => 80,
            'closeDate' => '2026-12-01',
            'accountName' => 'شرکت محرمانه',
            'contactName' => 'مخاطب محرمانه',
            'assignedUserName' => 'مسئول محرمانه',
            'createdAt' => '2026-11-20 12:00:00',
        ]);
        $action = new BidarExportAction(null, $acl);

        [$headers, $rows, $dateColumns] = $action->mapEntitiesToCsvData('Opportunity', [$opp]);

        $this->assertSame(['نام معامله', 'مرحله', 'درصد احتمال', 'تاریخ بستن', 'تاریخ ایجاد'], $headers);
        $this->assertSame(['معامله امن', 'Proposal', 80, '2026-12-01', '2026-11-20 12:00:00'], $rows[0]);
        $this->assertSame([3, 4], $dateColumns);
        $this->assertStringNotContainsString('شرکت محرمانه', implode(',', $rows[0]));
        $this->assertStringNotContainsString('مخاطب محرمانه', implode(',', $rows[0]));
        $this->assertStringNotContainsString('مسئول محرمانه', implode(',', $rows[0]));
    }

    public function testExportNeutralizesCsvFormulaPrefixesInCellValues(): void
    {
        $contact = $this->createEntityMock([
            'name' => '=1+1',
            'emailAddress' => '+SUM(A1:A2)',
            'phoneNumber' => '-1+1',
            'accountName' => '@SUM(1+1)',
            'title' => "\t=1+1",
            'assignedUserName' => "\r=1+1",
            'createdAt' => '2026-11-01',
        ]);
        $action = new BidarExportAction();

        [$headers, $rows] = $action->mapEntitiesToCsvData('Contact', [$contact]);

        $this->assertSame([
            "'=1+1",
            "'+SUM(A1:A2)",
            "'-1+1",
            "'@SUM(1+1)",
            "'\t=1+1",
            "'\r=1+1",
            '2026-11-01',
        ], $rows[0]);
        $this->assertCount(count($headers), $rows[0]);
    }

    public function testExportMappingsForContactAccountLeadTask(): void
    {
        $action = new BidarExportAction();

        $contact = $this->createEntityMock([
            'name' => 'سارا نوری',
            'emailAddress' => 'sara@example.com',
            'phoneNumber' => '09121112233',
            'accountName' => 'شرکت بتا',
            'title' => 'مدیر بازرگانی',
            'assignedUserName' => 'مدیر سیستم',
            'createdAt' => '2026-11-01',
        ]);

        [$headers, $rows, $dateCols] = $action->mapEntitiesToCsvData('Contact', [$contact]);
        $this->assertSame(['نام و نام خانوادگی', 'ایمیل', 'تلفن', 'شرکت', 'سمت', 'مسئول', 'تاریخ ایجاد'], $headers);
        $this->assertCount(1, $rows);
        $this->assertSame('سارا نوری', $rows[0][0]);
        $this->assertSame([6], $dateCols);

        $account = $this->createEntityMock([
            'name' => 'شرکت بتا',
            'emailAddress' => 'info@beta.ir',
            'phoneNumber' => '02188889999',
            'website' => 'https://beta.ir',
            'type' => 'Customer',
            'assignedUserName' => 'مدیر',
            'createdAt' => '2026-11-01',
        ]);

        [$headersAcc, $rowsAcc] = $action->mapEntitiesToCsvData('Account', [$account]);
        $this->assertSame('نام شرکت', $headersAcc[0]);
        $this->assertSame('شرکت بتا', $rowsAcc[0][0]);

        $lead = $this->createEntityMock([
            'name' => 'سرنخ اول',
            'status' => 'New',
            'source' => 'Website',
            'emailAddress' => 'lead@test.com',
            'phoneNumber' => '09350001122',
            'accountName' => 'سازمان',
            'assignedUserName' => 'کارشناس',
            'createdAt' => '2026-11-01',
        ]);

        [$headersLead, $rowsLead] = $action->mapEntitiesToCsvData('Lead', [$lead]);
        $this->assertSame('نام سرنخ', $headersLead[0]);
        $this->assertSame('سرنخ اول', $rowsLead[0][0]);

        $task = $this->createEntityMock([
            'name' => 'پیگیری قرارداد',
            'status' => 'Not Started',
            'priority' => 'High',
            'dateEnd' => '2026-11-25 18:00:00',
            'parentType' => 'Opportunity',
            'parentName' => 'معامله ۱',
            'assignedUserName' => 'کارشناس',
            'createdAt' => '2026-11-01',
        ]);

        [$headersTask, $rowsTask] = $action->mapEntitiesToCsvData('Task', [$task]);
        $this->assertSame('موضوع', $headersTask[0]);
        $this->assertSame('پیگیری قرارداد', $rowsTask[0][0]);
    }

    public function testMapEntitiesToCsvDataFiltersForbiddenFieldsAndNeutralizesFormulas(): void
    {
        $action = new BidarExportAction();
        $opp = $this->createEntityMock([
            'name' => '=CMD("calc")',
            'amount' => 999999,
            'stage' => '+1+1',
            'probability' => 50,
            'closeDate' => '2026-12-01',
            'accountName' => 'شرکت مخفی',
            'contactName' => '-2+3',
            'assignedUserName' => '@SUM(A1)',
            'createdAt' => '2026-11-20 12:00:00',
        ]);

        [$headers, $rows] = $action->mapEntitiesToCsvData('Opportunity', [$opp], ['amount', 'account']);

        $this->assertNotContains('مبلغ', $headers);
        $this->assertNotContains('شرکت', $headers);
        $this->assertSame("'=CMD(\"calc\")", $rows[0][0]);
        $this->assertSame("'+1+1", $rows[0][1]);
        $this->assertSame("'-2+3", $rows[0][4]);
        $this->assertSame("'@SUM(A1)", $rows[0][5]);
    }

    public function testExportPermissionDeniedThrowsForbidden(): void
    {
        $acl = $this->createMock(Acl::class);
        $acl->method('checkScope')->with('Opportunity', 'read')->willReturn(true);
        $acl->method('getPermissionLevel')->with('exportPermission')->willReturn('no');

        $user = $this->createMock(User::class);
        $user->method('isSystem')->willReturn(false);
        $factory = $this->createMock(SelectBuilderFactory::class);
        $em = $this->createMock(EntityManager::class);
        $em->expects($this->never())->method('getRDBRepository');

        $action = new BidarExportAction($em, $acl, $factory, $user);
        $request = $this->createMock(Request::class);
        $request->method('getRouteParam')->with('entityType')->willReturn('Opportunity');

        $this->expectException(Forbidden::class);
        $action->process($request);
    }

    public function testCsvSanitizesLeadingWhitespaceAndNewlineBeforeFormula(): void
    {
        $action = new BidarExportAction();
        $contact = $this->createEntityMock([
            'name' => ' =1+1',
            'emailAddress' => "\n=CMD()",
        ]);

        [, $rows] = $action->mapEntitiesToCsvData('Contact', [$contact]);
        $this->assertSame("' =1+1", $rows[0][0]);
        $this->assertSame("'\n=CMD()", $rows[0][1]);
    }
}
