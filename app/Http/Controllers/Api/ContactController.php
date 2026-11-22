<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Services\ContactService;
use App\Services\TimelineService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContactController extends Controller
{
    public function __construct(
        protected ContactService $contactService,
        protected TimelineService $timelineService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = Contact::query()->with('company');

        if ($request->filled('company_id')) {
            $query->where('company_id', $request->input('company_id'));
        }

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('job_title', 'like', "%{$search}%");
            });
        }

        $contacts = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'data' => $contacts,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'company_id' => 'nullable|exists:companies,id',
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:50',
            'job_title' => 'nullable|string|max:255',
            'custom_fields' => 'nullable|array',
        ]);

        $contact = $this->contactService->createContact($validated);

        return response()->json([
            'data' => $contact,
        ], 201);
    }

    public function show(string|int $id): JsonResponse
    {
        $contact = Contact::with(['company', 'timelineEvents' => function ($q) {
            $q->orderBy('created_at', 'desc');
        }])->findOrFail($id);

        return response()->json([
            'data' => $contact,
        ]);
    }

    public function link(Request $request, string|int $id): JsonResponse
    {
        $validated = $request->validate([
            'company_id' => 'required|exists:companies,id',
            'job_title' => 'nullable|string|max:255',
            'custom_fields' => 'nullable|array',
        ]);

        $contact = Contact::findOrFail($id);

        $contact = $this->contactService->linkToCompany(
            $contact,
            (int) $validated['company_id'],
            $request->only(['job_title', 'custom_fields'])
        );

        return response()->json([
            'data' => $contact,
        ]);
    }

    public function timeline(string|int $id): JsonResponse
    {
        $contact = Contact::findOrFail($id);
        $timeline = $this->timelineService->getTimelineFor($contact);

        return response()->json([
            'data' => $timeline,
        ]);
    }
}
