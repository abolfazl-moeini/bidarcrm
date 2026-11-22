<?php

namespace App\Services;

use App\Models\Company;
use App\Models\Contact;

class ContactService
{
    public function __construct(
        protected TimelineService $timelineService
    ) {}

    /**
     * Create a new contact and log timeline event.
     */
    public function createContact(array $data): Contact
    {
        $contact = Contact::create($data);

        $this->timelineService->log(
            $contact,
            'contact_created',
            "مخاطب {$contact->full_name} در سیستم دیدار ثبت شد.",
            [
                'email' => $contact->email,
                'phone' => $contact->phone,
                'company_id' => $contact->company_id,
            ]
        );

        if ($contact->company_id) {
            $company = Company::find($contact->company_id);
            if ($company) {
                $this->timelineService->log(
                    $contact,
                    'company_linked',
                    "مخاطب به سازمان {$company->name} متصل گردید.",
                    [
                        'company_id' => $company->id,
                        'company_name' => $company->name,
                    ]
                );
            }
        }

        return $contact->load('company');
    }

    /**
     * Link contact to a company, update custom fields and log to unified timeline.
     */
    public function linkToCompany(Contact $contact, int $companyId, array $attributes = []): Contact
    {
        $company = Company::findOrFail($companyId);

        $contact->company_id = $company->id;

        if (!empty($attributes['job_title'])) {
            $contact->job_title = $attributes['job_title'];
        }

        if (isset($attributes['custom_fields']) && is_array($attributes['custom_fields'])) {
            $existing = is_array($contact->custom_fields) ? $contact->custom_fields : [];
            $contact->custom_fields = array_merge($existing, $attributes['custom_fields']);
        }

        $contact->save();

        // Automatically generate timeline event record with type='company_linked'
        $this->timelineService->log(
            $contact,
            'company_linked',
            "مخاطب به سازمان {$company->name} پیوند داده شد.",
            [
                'company_id' => $company->id,
                'company_name' => $company->name,
                'job_title' => $contact->job_title,
            ]
        );

        // Also log event on company timeline
        $this->timelineService->log(
            $company,
            'contact_linked',
            "مخاطب {$contact->full_name} به سازمان ملحق شد.",
            [
                'contact_id' => $contact->id,
                'job_title' => $contact->job_title,
            ]
        );

        return $contact->load('company');
    }
}
