<?php

declare(strict_types=1);

namespace Espo\Modules\BidarSales\Tests\Unit;

use Espo\Core\Api\Request;
use Espo\Core\Exceptions\BadRequest;
use Espo\Core\Exceptions\Forbidden;
use Espo\Entities\User;
use Espo\Modules\BidarSales\Api\BidarApiKeyCreateAction;
use Espo\Modules\BidarSales\Api\BidarApiKeyDeleteAction;
use Espo\Modules\BidarSales\Api\BidarApiKeyListAction;
use Espo\Modules\BidarSales\Api\BidarApiKeyRotateAction;
use Espo\Modules\BidarSales\Services\BidarApiKeyService;
use PHPUnit\Framework\TestCase;

class BidarApiKeyActionsTest extends TestCase
{
    public function testListActionRequiresAuth(): void
    {
        $action = new BidarApiKeyListAction(null);
        $request = $this->createMock(Request::class);

        $this->expectException(Forbidden::class);
        $action->process($request);
    }

    public function testListActionSuccess(): void
    {
        $user = $this->createMock(User::class);
        $service = $this->createMock(BidarApiKeyService::class);
        $service->expects($this->once())
            ->method('listKeys')
            ->with($user, 'target-user-1')
            ->willReturn(['list' => [], 'total' => 0]);

        $action = new BidarApiKeyListAction($user, $service);
        $request = $this->createMock(Request::class);
        $request->method('getQueryParam')->with('userId')->willReturn('target-user-1');

        $response = $action->process($request);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('{"list":[],"total":0}', (string) $response->getBody());
    }

    public function testCreateActionRequiresAuth(): void
    {
        $action = new BidarApiKeyCreateAction(null);
        $request = $this->createMock(Request::class);

        $this->expectException(Forbidden::class);
        $action->process($request);
    }

    public function testCreateActionReturns201WithPlainKey(): void
    {
        $user = $this->createMock(User::class);
        $service = $this->createMock(BidarApiKeyService::class);
        $service->expects($this->once())
            ->method('createKey')
            ->with($user, ['name' => 'کلید تست'])
            ->willReturn([
                'id' => 'k1',
                'name' => 'کلید تست',
                'plainKey' => 'bdr_abc123',
            ]);

        $action = new BidarApiKeyCreateAction($user, $service);
        $request = $this->createMock(Request::class);
        $request->method('getParsedBody')->willReturn((object) ['name' => 'کلید تست']);

        $response = $action->process($request);

        $this->assertSame(201, $response->getStatusCode());
        $body = json_decode((string) $response->getBody(), true);
        $this->assertSame('k1', $body['id']);
        $this->assertSame('bdr_abc123', $body['plainKey']);
    }

    public function testRotateActionRequiresId(): void
    {
        $user = $this->createMock(User::class);
        $action = new BidarApiKeyRotateAction($user);
        $request = $this->createMock(Request::class);
        $request->method('getRouteParam')->with('id')->willReturn(null);

        $this->expectException(BadRequest::class);
        $action->process($request);
    }

    public function testRotateActionSuccess(): void
    {
        $user = $this->createMock(User::class);
        $service = $this->createMock(BidarApiKeyService::class);
        $service->expects($this->once())
            ->method('rotateKey')
            ->with($user, 'k1')
            ->willReturn([
                'id' => 'k1',
                'plainKey' => 'bdr_new_key',
            ]);

        $action = new BidarApiKeyRotateAction($user, $service);
        $request = $this->createMock(Request::class);
        $request->method('getRouteParam')->with('id')->willReturn('k1');

        $response = $action->process($request);

        $this->assertSame(200, $response->getStatusCode());
        $body = json_decode((string) $response->getBody(), true);
        $this->assertSame('bdr_new_key', $body['plainKey']);
    }

    public function testDeleteActionRequiresId(): void
    {
        $user = $this->createMock(User::class);
        $action = new BidarApiKeyDeleteAction($user);
        $request = $this->createMock(Request::class);
        $request->method('getRouteParam')->with('id')->willReturn(null);

        $this->expectException(BadRequest::class);
        $action->process($request);
    }

    public function testDeleteActionSuccess(): void
    {
        $user = $this->createMock(User::class);
        $service = $this->createMock(BidarApiKeyService::class);
        $service->expects($this->once())
            ->method('revokeKey')
            ->with($user, 'k1')
            ->willReturn(true);

        $action = new BidarApiKeyDeleteAction($user, $service);
        $request = $this->createMock(Request::class);
        $request->method('getRouteParam')->with('id')->willReturn('k1');

        $response = $action->process($request);

        $this->assertSame(200, $response->getStatusCode());
        $body = json_decode((string) $response->getBody(), true);
        $this->assertTrue($body['success']);
    }
}
