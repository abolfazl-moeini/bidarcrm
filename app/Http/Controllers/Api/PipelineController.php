<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pipeline;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PipelineController extends Controller
{
    public function index(): JsonResponse
    {
        $pipelines = Pipeline::with(['stages', 'deals'])->get();

        return response()->json([
            'data' => $pipelines,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'stages' => 'nullable|array',
            'stages.*.name' => 'required|string|max:255',
            'stages.*.slug' => 'nullable|string|max:255',
            'stages.*.order' => 'nullable|integer',
            'stages.*.rotten_days' => 'nullable|integer|min:0',
            'stages.*.win_probability' => 'nullable|integer|min:0|max:100',
        ]);

        $pipeline = DB::transaction(function () use ($validated) {
            $pipeline = Pipeline::create([
                'name' => $validated['name'],
            ]);

            if (!empty($validated['stages'])) {
                foreach ($validated['stages'] as $index => $stageData) {
                    $pipeline->stages()->create([
                        'name' => $stageData['name'],
                        'slug' => $stageData['slug'] ?? Str::slug($stageData['name']),
                        'order' => $stageData['order'] ?? ($index + 1),
                        'rotten_days' => $stageData['rotten_days'] ?? 0,
                        'win_probability' => $stageData['win_probability'] ?? 0,
                    ]);
                }
            }

            return $pipeline;
        });

        return response()->json([
            'data' => $pipeline->load('stages'),
        ], 201);
    }
}
