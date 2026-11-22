<?php

namespace App\Http\Controllers;

use App\Models\Company;
use App\Models\Contact;
use Illuminate\Http\Request;
use Illuminate\View\View;

class ContactViewController extends Controller
{
    public function index(Request $request): View
    {
        $contacts = Contact::with('company')->latest()->paginate(25);
        $companies = Company::orderBy('name')->get();

        return view('contacts.index', compact('contacts', 'companies'));
    }

    public function show(Contact $contact): View
    {
        $contact->load(['company', 'timelineEvents' => function ($query) {
            $query->latest();
        }]);

        return view('contacts.show', compact('contact'));
    }
}
