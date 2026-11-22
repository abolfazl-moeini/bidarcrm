<?php

namespace App\Http\Controllers;

use App\Models\Pipeline;
use App\Models\Stage;
use App\Services\DealService;
use Illuminate\Http\Request;
use Illuminate\View\View;

class DealViewController extends Controller
{
    public function __construct(
        protected DealService $dealService
    ) {}

    public function index(Request $request): View
    {
        $pipelines = Pipeline::with('stages')->get();

        if ($pipelines->isEmpty()) {
            $defaultPipeline = Pipeline::create(['name' => 'فرایند فروش پیش‌فرض دیدار']);
            
            $stagesData = [
                ['name' => 'سرنخ اولیه', 'slug' => 'lead', 'order' => 1, 'rotten_days' => 3, 'win_probability' => 20],
                ['name' => 'تماس و بررسی نیاز', 'slug' => 'contact', 'order' => 2, 'rotten_days' => 5, 'win_probability' => 40],
                ['name' => 'ارائه پیش‌فاکتور', 'slug' => 'proposal', 'order' => 3, 'rotten_days' => 7, 'win_probability' => 60],
                ['name' => 'مذاکره نهایی', 'slug' => 'negotiation', 'order' => 4, 'rotten_days' => 5, 'win_probability' => 80],
                ['name' => 'بسته شده - موفق', 'slug' => 'won', 'order' => 5, 'rotten_days' => 0, 'win_probability' => 100],
            ];

            foreach ($stagesData as $stage) {
                $defaultPipeline->stages()->create($stage);
            }

            $pipelines = Pipeline::with('stages')->get();
        }

        $selectedPipelineId = $request->has('pipeline_id')
            ? (int) $request->input('pipeline_id')
            : $pipelines->first()->id;

        $currentPipeline = $pipelines->firstWhere('id', $selectedPipelineId) ?? $pipelines->first();

        // Dynamically recalculate rotten status for freshness
        $this->dealService->recalculateRottenThresholds($currentPipeline->id);

        $stages = Stage::where('pipeline_id', $currentPipeline->id)
            ->with(['deals' => function ($query) {
                $query->orderBy('created_at', 'desc');
            }])
            ->orderBy('order', 'asc')
            ->get();

        $allDeals = $stages->flatMap->deals;
        $totalDeals = $allDeals->count();
        $totalAmount = $allDeals->sum('amount');
        $rottenCount = $allDeals->where('is_rotten', true)->count();

        return view('deals.kanban', [
            'pipelines' => $pipelines,
            'currentPipeline' => $currentPipeline,
            'stages' => $stages,
            'totalDeals' => $totalDeals,
            'totalAmount' => $totalAmount,
            'rottenCount' => $rottenCount,
        ]);
    }
}
