<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>مدیریت مخاطبان و سازمان‌ها | دیدار CRM</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet" type="text/css" />
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <style>
        body { font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, sans-serif; }
    </style>
</head>
<body class="bg-slate-50 text-slate-800 antialiased min-h-screen">
    <!-- Header Navbar -->
    <header class="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div class="flex items-center gap-6">
                <a href="{{ route('deals.kanban') }}" class="flex items-center gap-2">
                    <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                        د
                    </div>
                    <span class="font-bold text-xl text-slate-900 tracking-tight">دیدار CRM</span>
                </a>
                <nav class="hidden md:flex items-center gap-1 text-sm font-medium">
                    <a href="{{ route('deals.kanban') }}" class="px-3 py-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition">کانبان معاملات</a>
                    <a href="{{ route('contacts.index') }}" class="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 font-semibold transition">مخاطبان و سازمان‌ها</a>
                </nav>
            </div>
            <div class="flex items-center gap-3">
                <span class="text-xs bg-emerald-50 text-emerald-700 font-medium px-2.5 py-1 rounded-full border border-emerald-200">
                    نسخه لاراول ۱۳
                </span>
            </div>
        </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
                <h1 class="text-2xl font-black text-slate-900 tracking-tight">مدیریت مخاطبان و سازمان‌ها</h1>
                <p class="text-sm text-slate-500 mt-1">دفترچه آدرس هوشمند و پرونده جامع ارتباطی مشتریان و سازمان‌ها</p>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-xs bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg">
                    مجموع مخاطبان: {{ $contacts->total() }}
                </span>
            </div>
        </div>

        <!-- Table Card -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full text-right text-sm">
                    <thead class="bg-slate-50 text-slate-600 text-xs font-bold border-b border-slate-200 uppercase">
                        <tr>
                            <th class="py-4 px-6">نام مخاطب</th>
                            <th class="py-4 px-6">سازمان / شرکت</th>
                            <th class="py-4 px-6">سمت شغلی</th>
                            <th class="py-4 px-6">اطلاعات تماس</th>
                            <th class="py-4 px-6 text-center">عملیات</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        @forelse ($contacts as $contact)
                            <tr class="hover:bg-slate-50/80 transition group">
                                <td class="py-4 px-6">
                                    <a href="{{ route('contacts.show', $contact) }}" class="font-bold text-slate-900 group-hover:text-blue-600 transition flex items-center gap-3">
                                        <div class="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm">
                                            {{ mb_substr($contact->first_name, 0, 1) }}
                                        </div>
                                        <span>{{ $contact->first_name }} {{ $contact->last_name }}</span>
                                    </a>
                                </td>
                                <td class="py-4 px-6">
                                    @if ($contact->company)
                                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                            🏢 {{ $contact->company->name }}
                                        </span>
                                    @else
                                        <span class="text-slate-400 text-xs">بدون سازمان</span>
                                    @endif
                                </td>
                                <td class="py-4 px-6 text-slate-600">
                                    {{ $contact->job_title ?: '—' }}
                                </td>
                                <td class="py-4 px-6 text-slate-600">
                                    <div class="flex flex-col gap-0.5">
                                        <span class="font-mono text-xs text-slate-800">{{ $contact->phone }}</span>
                                        @if ($contact->email)
                                            <span class="text-xs text-slate-400">{{ $contact->email }}</span>
                                        @endif
                                    </div>
                                </td>
                                <td class="py-4 px-6 text-center">
                                    <a href="{{ route('contacts.show', $contact) }}" class="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 transition">
                                        مشاهده پرونده و تایم‌لاین
                                    </a>
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="5" class="py-12 text-center text-slate-400">
                                    مخاطبی ثبت نشده است.
                                </td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>

            @if ($contacts->hasPages())
                <div class="p-4 border-t border-slate-100 bg-slate-50/50">
                    {{ $contacts->links() }}
                </div>
            @endif
        </div>
    </main>
</body>
</html>
