<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Deal;
use App\Models\Stage;
use App\Services\DealService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DealController extends Controller
{
    public function __construct(
        protected DealService $dealService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $pipelineId = $request->has('pipeline_id') ? (int) $request->input('pipeline_id') : null;

        $this->dealService->recalculateRottenThresholds($pipelineId);

        $query = Deal::query()->with(['stage', 'pipeline', 'assignedUser']);

        if ($pipelineId) {
            $query->where('pipeline_id', $pipelineId);
        }

        if ($request->has('stage_id')) {
            $query->where('stage_id', $request->input('stage_id'));
        }

        $deals = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'data' => $deals,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'pipeline_id' => 'required|exists:pipelines,id',
            'stage_id' => 'required|exists:stages,id',
            'amount' => 'nullable|numeric|min:0',
            'status' => 'nullable|string|in:open,won,lost',
            'win_probability' => 'nullable|integer|min:0|max:100',
            'assigned_user_id' => 'nullable|exists:users,id',
        ]);

        $stage = Stage::findOrFail($validated['stage_id']);

        if (!isset($validated['win_probability'])) {
            $validated['win_probability'] = $stage->win_probability;
        }

        $validated['status'] = $validated['status'] ?? 'open';
        $validated['amount'] = $validated['amount'] ?? 0;

        $deal = Deal::create($validated);

        return response()->json([
            'data' => $deal->load(['stage', 'pipeline', 'assignedUser']),
        ], 201);
    }

    public function move(Request $request, int|string $id): JsonResponse
    {
        $validated = $request->validate([
            'stage_id' => 'required|exists:stages,id',
        ]);

        $deal = Deal::findOrFail($id);
        $stage = Stage::findOrFail($validated['stage_id']);

        $updatedDeal = $this->dealService->moveStage($deal, $stage);

        return response()->json([
            'data' => $updatedDeal,
            'message' => 'Deal moved successfully',
        ]);
    }
}
