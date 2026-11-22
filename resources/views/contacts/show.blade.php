<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>پرونده ۳۶۰ درجه: {{ $contact->first_name }} {{ $contact->last_name }} | دیدار CRM</title>
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
                <a href="{{ route('contacts.index') }}" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg transition">
                    ← بازگشت به فهرست مخاطبان
                </a>
            </div>
        </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <!-- Top Profile Banner -->
        <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs mb-8">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div class="flex items-center gap-5">
                    <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-2xl flex items-center justify-center shadow-md">
                        {{ mb_substr($contact->first_name, 0, 1) }}
                    </div>
                    <div>
                        <h1 class="text-2xl font-black text-slate-900 tracking-tight">
                            {{ $contact->first_name }} {{ $contact->last_name }}
                        </h1>
                        <div class="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-600">
                            @if ($contact->job_title)
                                <span class="font-medium text-slate-800">{{ $contact->job_title }}</span>
                                <span class="text-slate-300">•</span>
                            @endif
                            @if ($contact->company)
                                <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                    🏢 {{ $contact->company->name }}
                                </span>
                                <span class="text-slate-300">•</span>
                            @endif
                            <span class="font-mono text-slate-600">{{ $contact->phone }}</span>
                            @if ($contact->email)
                                <span class="text-slate-300">•</span>
                                <span class="text-slate-600">{{ $contact->email }}</span>
                            @endif
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <!-- Sidebar / Details Card -->
            <div class="space-y-6">
                <!-- Company Details Card -->
                <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                    <h2 class="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">
                        🏢 اطلاعات سازمان
                    </h2>
                    @if ($contact->company)
                        <div class="space-y-3 text-sm">
                            <div>
                                <span class="text-xs text-slate-400 block mb-0.5">نام سازمان</span>
                                <strong class="text-slate-800">{{ $contact->company->name }}</strong>
                            </div>
                            @if ($contact->company->industry)
                                <div>
                                    <span class="text-xs text-slate-400 block mb-0.5">صنعت / حوزه فعالیت</span>
                                    <span class="text-slate-700">{{ $contact->company->industry }}</span>
                                </div>
                            @endif
                            @if ($contact->company->phone)
                                <div>
                                    <span class="text-xs text-slate-400 block mb-0.5">تلفن سازمانی</span>
                                    <span class="font-mono text-slate-700">{{ $contact->company->phone }}</span>
                                </div>
                            @endif
                            @if ($contact->company->website)
                                <div>
                                    <span class="text-xs text-slate-400 block mb-0.5">وب‌سایت</span>
                                    <a href="{{ $contact->company->website }}" target="_blank" class="text-blue-600 hover:underline text-xs">
                                        {{ $contact->company->website }}
                                    </a>
                                </div>
                            @endif
                        </div>
                    @else
                        <p class="text-sm text-slate-400">هنوز به هیچ سازمانی پیوند داده نشده است.</p>
                    @endif
                </div>

                <!-- Custom Fields Card -->
                <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                    <h2 class="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 mb-4">
                        🏷️ فیلدهای سفارشی و داده‌های ویژه
                    </h2>
                    @if (!empty($contact->custom_fields))
                        <div class="space-y-3 text-sm">
                            @foreach ($contact->custom_fields as $key => $value)
                                <div>
                                    <span class="text-xs text-slate-400 block mb-0.5">{{ $key }}</span>
                                    <span class="font-semibold text-slate-800">
                                        {{ is_scalar($value) ? $value : json_encode($value, JSON_UNESCAPED_UNICODE) }}
                                    </span>
                                </div>
                            @endforeach
                        </div>
                    @else
                        <p class="text-sm text-slate-400">فیلد سفارشی ثبت نشده است.</p>
                    @endif
                </div>
            </div>

            <!-- Unified Activity Timeline -->
            <div class="lg:col-span-2">
                <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                    <div class="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                        <div class="flex items-center gap-2">
                            <span class="text-xl">⏱️</span>
                            <h2 class="text-lg font-black text-slate-900">خط زمانی یکپارچه فعالیت‌ها (Unified Activity Timeline)</h2>
                        </div>
                        <span class="text-xs bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-full">
                            {{ $contact->timelineEvents->count() }} رویداد
                        </span>
                    </div>

                    <!-- Timeline Events Container -->
                    <div id="activity-timeline" class="relative pr-4 space-y-6 before:absolute before:top-2 before:bottom-2 before:right-2 before:w-0.5 before:bg-slate-200">
                        @forelse ($contact->timelineEvents as $event)
                            <div class="relative pr-6 group">
                                <!-- Dot -->
                                <div class="absolute right-0 top-1.5 w-4 h-4 rounded-full bg-blue-600 border-4 border-white shadow-xs group-hover:scale-125 transition"></div>

                                <div class="bg-slate-50 border border-slate-200/80 rounded-xl p-4 hover:border-slate-300 transition">
                                    <div class="flex items-center justify-between gap-4 mb-1.5">
                                        <span class="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                                            {{ $event->type }}
                                        </span>
                                        <time class="text-xs text-slate-400 font-mono">{{ $event->created_at->diffForHumans() }}</time>
                                    </div>
                                    <p class="text-sm text-slate-800 font-medium leading-relaxed">
                                        {{ $event->description }}
                                    </p>
                                    @if (!empty($event->meta))
                                        <div class="mt-2 text-xs bg-white border border-slate-100 rounded-lg p-2.5 text-slate-600">
                                            <pre class="font-sans whitespace-pre-wrap">{{ json_encode($event->meta, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) }}</pre>
                                        </div>
                                    @endif
                                </div>
                            </div>
                        @empty
                            <div class="text-center py-12 text-slate-400 text-sm">
                                هنوز هیچ رویدادی برای این مخاطب ثبت نشده است.
                            </div>
                        @endforelse
                    </div>
                </div>
            </div>
        </div>
    </main>
</body>
</html>
