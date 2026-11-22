<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Services\TimelineService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CompanyController extends Controller
{
    public function __construct(
        protected TimelineService $timelineService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = Company::query()->withCount('contacts');

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('industry', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        $companies = $query->orderBy('name', 'asc')->get();

        return response()->json([
            'data' => $companies,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'industry' => 'nullable|string|max:255',
            'phone' => 'nullable|string|max:50',
            'website' => 'nullable|string|max:255',
            'address' => 'nullable|string',
            'custom_fields' => 'nullable|array',
        ]);

        $company = Company::create($validated);

        $this->timelineService->log(
            $company,
            'company_created',
            "سازمان {$company->name} در سیستم ایجاد شد.",
            ['industry' => $company->industry]
        );

        return response()->json([
            'data' => $company,
        ], 201);
    }

    public function show(string|int $id): JsonResponse
    {
        $company = Company::with(['contacts'])->findOrFail($id);

        return response()->json([
            'data' => $company,
        ]);
    }
}
