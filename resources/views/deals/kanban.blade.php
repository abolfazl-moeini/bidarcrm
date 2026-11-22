<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>معاملات و قیف فروش | نرم‌افزار دیدار CRM</title>

    <!-- Persian Font: Vazirmatn -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">

    <!-- Tailwind CSS CDN for instant rendering in test & browser -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['Vazirmatn', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                    },
                    colors: {
                        didar: {
                            50: '#f0f9ff',
                            100: '#e0f2fe',
                            500: '#0284c7',
                            600: '#0369a1',
                            700: '#075985',
                            800: '#0c4a6e',
                            900: '#0f172a',
                        }
                    }
                }
            }
        }
    </script>
    <style>
        body {
            font-family: 'Vazirmatn', sans-serif;
        }
        /* Custom scrollbar for Kanban board */
        .kanban-scrollbar::-webkit-scrollbar {
            height: 8px;
            width: 8px;
        }
        .kanban-scrollbar::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 4px;
        }
        .kanban-scrollbar::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
        }
        .kanban-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
        }
        .drag-ghost {
            opacity: 0.4;
            transform: scale(0.98);
        }
        .drop-target {
            background-color: #e0f2fe !important;
            border-color: #0284c7 !important;
            border-style: dashed !important;
        }
    </style>
</head>
<body class="bg-slate-50 text-slate-800 min-h-screen flex flex-col font-sans antialiased select-none">

    <!-- Top App Navigation (Didar CRM Header) -->
    <header class="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between h-16">
                <!-- Right: Logo & Primary Navigation Links -->
                <div class="flex items-center gap-8">
                    <!-- Didar Brand Logo -->
                    <div class="flex items-center gap-2.5">
                        <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center shadow-md shadow-sky-500/20">
                            <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                            </svg>
                        </div>
                        <span class="text-xl font-extrabold tracking-tight text-white flex items-center gap-1">
                            دیدار <span class="text-xs px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 font-medium">CRM</span>
                        </span>
                    </div>

                    <!-- Navigation Items -->
                    <nav class="hidden md:flex items-center gap-1">
                        <a href="/deals" class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-slate-800 text-sky-400 border border-slate-700/60 shadow-inner">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                            </svg>
                            <span>معاملات و قیف فروش</span>
                        </a>
                        <a href="#" class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                            </svg>
                            <span>مخاطبان و شرکت‌ها</span>
                        </a>
                        <a href="#" class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                            </svg>
                            <span>فعالیت‌ها و یادآورها</span>
                        </a>
                        <a href="#" class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                            </svg>
                            <span>گزارش‌ها و تحلیل</span>
                        </a>
                    </nav>
                </div>

                <!-- Left: Quick Search, Add Button, Notifications, Avatar -->
                <div class="flex items-center gap-3">
                    <!-- Quick Search Input -->
                    <div class="relative hidden sm:block">
                        <input type="text" id="deal-search-input" placeholder="جستجوی معامله..." class="w-48 lg:w-64 bg-slate-800/80 text-white placeholder-slate-400 text-xs rounded-lg px-3 py-2 pl-8 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all">
                        <svg class="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                        </svg>
                    </div>

                    <!-- Create Deal CTA (Didar Style Green Button) -->
                    <button onclick="openNewDealModal()" class="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-sm shadow-emerald-700/30">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
                        </svg>
                        <span>معامله جدید</span>
                    </button>

                    <!-- User Profile Avatar -->
                    <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 border border-slate-700 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                        ع‌م
                    </div>
                </div>
            </div>
        </div>
    </header>

    <!-- Sub-Header / Pipeline Toolbar & Metrics (Didar Style) -->
    <div class="bg-white border-b border-slate-200 shadow-xs">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                
                <!-- Pipeline Switcher & Filter Pills -->
                <div class="flex flex-wrap items-center gap-3">
                    <!-- Pipeline Dropdown -->
                    <div class="flex items-center gap-2">
                        <label for="pipeline-select" class="text-xs font-semibold text-slate-500">قیف فروش:</label>
                        <form method="GET" action="/deals" id="pipeline-form">
                            <select id="pipeline-select" name="pipeline_id" onchange="document.getElementById('pipeline-form').submit()" class="bg-slate-50 border border-slate-300 text-slate-900 text-sm font-bold rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-sky-500 focus:outline-none cursor-pointer">
                                @foreach($pipelines as $p)
                                    <option value="{{ $p->id }}" {{ $currentPipeline->id === $p->id ? 'selected' : '' }}>
                                        {{ $p->name }}
                                    </option>
                                @endforeach
                            </select>
                        </form>
                    </div>

                    <!-- View Switcher -->
                    <div class="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                        <button class="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white text-slate-900 font-bold shadow-xs">
                            <svg class="w-3.5 h-3.5 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/>
                            </svg>
                            <span>کانبان</span>
                        </button>
                        <button class="flex items-center gap-1 px-2.5 py-1 rounded-md text-slate-600 hover:text-slate-900 font-medium">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
                            </svg>
                            <span>لیست</span>
                        </button>
                    </div>

                    <!-- Filter Chips -->
                    <div class="flex items-center gap-1.5 text-xs">
                        <button onclick="filterDeals('all')" id="filter-all" class="filter-btn px-2.5 py-1 rounded-full font-bold bg-sky-100 text-sky-800 border border-sky-300">
                            همه
                        </button>
                        <button onclick="filterDeals('rotten')" id="filter-rotten" class="filter-btn px-2.5 py-1 rounded-full font-medium bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-slate-200 flex items-center gap-1">
                            <span class="w-2 h-2 rounded-full bg-rose-500"></span>
                            <span>راکدها ({{ $rottenCount }})</span>
                        </button>
                    </div>
                </div>

                <!-- Pipeline Performance Metrics Strip (Didar KPI Strip) -->
                <div class="flex items-center gap-4 text-xs">
                    <!-- Total Count -->
                    <div class="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                        <span class="text-slate-500">تعداد معاملات:</span>
                        <span id="metric-total-deals" class="font-extrabold text-slate-900">{{ number_format($totalDeals) }} معامله</span>
                    </div>

                    <!-- Total Value -->
                    <div class="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                        <span class="text-emerald-700 font-medium">ارزش کل قیف:</span>
                        <span id="metric-total-amount" class="font-black text-emerald-900">{{ number_format($totalAmount) }} تومان</span>
                    </div>

                    @if($rottenCount > 0)
                    <!-- Rotten Alert KPI -->
                    <div class="flex items-center gap-1.5 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200">
                        <span class="text-rose-700 font-medium">هشدار رکود:</span>
                        <span class="font-black text-rose-800">{{ $rottenCount }} راکد</span>
                    </div>
                    @endif
                </div>

            </div>
        </div>
    </div>

    <!-- Main Kanban Board Workspace -->
    <main class="flex-1 overflow-x-auto kanban-scrollbar p-6">
        <div class="flex items-start gap-4 min-w-max pb-4">
            
            @forelse($stages as $stage)
                @php
                    $stageDeals = $stage->deals;
                    $stageTotalAmount = $stageDeals->sum('amount');
                    $stageCount = $stageDeals->count();
                @endphp
                <!-- Stage Column -->
                <section 
                    role="region" 
                    aria-label="{{ $stage->name }}"
                    class="stage-column w-80 bg-slate-100/90 rounded-2xl border border-slate-200/90 flex flex-col max-h-[calc(100vh-180px)] shadow-xs transition-colors"
                    data-stage-id="{{ $stage->id }}"
                    data-rotten-days="{{ $stage->rotten_days }}"
                    data-win-probability="{{ $stage->win_probability }}"
                >
                    <!-- Stage Column Header -->
                    <header class="p-3.5 border-b border-slate-200/80 bg-white/70 backdrop-blur-xs rounded-t-2xl">
                        <div class="flex items-center justify-between gap-2 mb-1.5">
                            <h2 class="font-bold text-sm text-slate-900 truncate">
                                {{ $stage->name }}
                            </h2>
                            <span class="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200">
                                {{ $stage->win_probability }}٪ شانس
                            </span>
                        </div>

                        <!-- Stage Meta: Count, Amount, Rotten Info -->
                        <div class="flex items-center justify-between text-xs text-slate-500">
                            <div>
                                <span class="stage-count font-bold text-slate-700">{{ $stageCount }} معامله</span>
                                <span class="mx-1">•</span>
                                <span class="stage-amount font-semibold text-emerald-700">{{ number_format($stageTotalAmount) }} ت</span>
                            </div>
                            @if($stage->rotten_days > 0)
                                <div class="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60 flex items-center gap-1" title="معامله بیش از این مدت راکد در نظر گرفته می‌شود">
                                    <svg class="w-3 h-3 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    </svg>
                                    <span>رکود: {{ $stage->rotten_days }} روز</span>
                                </div>
                            @endif
                        </div>
                    </header>

                    <!-- Column Deal Cards Droppable Container -->
                    <div 
                        class="stage-cards flex-1 p-3 space-y-3 overflow-y-auto kanban-scrollbar min-h-[400px]"
                        data-stage-id="{{ $stage->id }}"
                        ondragover="handleDragOver(event)"
                        ondragleave="handleDragLeave(event)"
                        ondrop="handleDrop(event, {{ $stage->id }})"
                    >
                        @foreach($stageDeals as $deal)
                            <!-- Deal Card -->
                            <article 
                                id="deal-card-{{ $deal->id }}"
                                class="deal-card bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-grab active:cursor-grabbing hover:border-sky-300 relative group"
                                draggable="true"
                                ondragstart="handleDragStart(event, {{ $deal->id }}, {{ $stage->id }})"
                                ondragend="handleDragEnd(event)"
                                data-deal-id="{{ $deal->id }}"
                                data-stage-id="{{ $stage->id }}"
                                data-amount="{{ $deal->amount }}"
                                data-is-rotten="{{ $deal->is_rotten ? '1' : '0' }}"
                                data-title="{{ $deal->title }}"
                            >
                                @if($deal->is_rotten)
                                    <!-- Rotten Alert Badge (Didar Signature Warning) -->
                                    <div role="status" class="rotten-alert flex items-center justify-between gap-1.5 px-2.5 py-1.5 mb-2.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                        <div class="flex items-center gap-1.5">
                                            <svg class="w-4 h-4 text-rose-500 animate-pulse shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                                            </svg>
                                            <span>معامله راکد ({{ $deal->days_in_stage }} روز)</span>
                                        </div>
                                        <span class="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-medium">نیاز به پیگیری</span>
                                    </div>
                                @endif

                                <!-- Deal Title -->
                                <h3 class="text-sm font-bold text-slate-900 group-hover:text-sky-600 transition-colors line-clamp-2 mb-2">
                                    {{ $deal->title }}
                                </h3>

                                <!-- Deal Amount -->
                                <div class="text-sm font-extrabold text-emerald-700 mb-3 flex items-center justify-between">
                                    <span>{{ number_format($deal->amount) }} <span class="text-xs font-normal text-slate-500">تومان</span></span>
                                    <span class="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                        {{ $deal->win_probability }}٪
                                    </span>
                                </div>

                                <!-- Deal Card Footer -->
                                <div class="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                                    <!-- Days in stage indicator -->
                                    <div class="flex items-center gap-1 text-[11px] {{ $deal->is_rotten ? 'text-rose-600 font-bold' : 'text-slate-500' }}">
                                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                        </svg>
                                        <span>{{ $deal->days_in_stage }} روز در مرحله</span>
                                    </div>

                                    <!-- Quick Actions & User Initials -->
                                    <div class="flex items-center gap-1.5">
                                        <span class="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                                            {{ mb_substr($deal->title, 0, 1) }}
                                        </span>
                                    </div>
                                </div>
                            </article>
                        @endforeach
                    </div>

                    <!-- Column Footer: Quick Add Deal button -->
                    <footer class="p-2.5 border-t border-slate-200/80 bg-white/40 rounded-b-2xl">
                        <button onclick="openNewDealModal({{ $stage->id }})" class="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-sky-700 hover:bg-white transition-all border border-dashed border-slate-300 hover:border-sky-400">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                            </svg>
                            <span>افزودن معامله</span>
                        </button>
                    </footer>
                </section>
            @empty
                <div class="w-full py-16 text-center text-slate-500">
                    <p class="text-base font-semibold">هیچ مرحله‌ای برای این قیف تعریف نشده است.</p>
                </div>
            @endforelse

        </div>
    </main>

    <!-- Modal: New Deal (Didar CRM Style) -->
    <div id="new-deal-modal" class="fixed inset-0 z-50 hidden flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
        <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden transform transition-all">
            <!-- Modal Header -->
            <div class="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
                        </svg>
                    </div>
                    <h3 class="text-base font-bold">ایجاد معامله جدید</h3>
                </div>
                <button onclick="closeNewDealModal()" class="text-slate-400 hover:text-white transition-colors">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>

            <!-- Modal Form -->
            <form id="new-deal-form" onsubmit="handleCreateDeal(event)" class="p-6 space-y-4">
                <input type="hidden" id="modal-pipeline-id" name="pipeline_id" value="{{ $currentPipeline->id }}">

                <div>
                    <label for="deal-title-input" class="block text-xs font-bold text-slate-700 mb-1.5">عنوان معامله <span class="text-rose-500">*</span></label>
                    <input type="text" id="deal-title-input" name="title" required placeholder="مثال: قرارداد فروش سالانه پتروشیمی" class="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none">
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label for="modal-stage-id" class="block text-xs font-bold text-slate-700 mb-1.5">مرحله فروش <span class="text-rose-500">*</span></label>
                        <select id="modal-stage-id" name="stage_id" required class="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none">
                            @foreach($stages as $stg)
                                <option value="{{ $stg->id }}">{{ $stg->name }} ({{ $stg->win_probability }}٪)</option>
                            @endforeach
                        </select>
                    </div>

                    <div>
                        <label for="deal-amount-input" class="block text-xs font-bold text-slate-700 mb-1.5">ارزش معامله (تومان)</label>
                        <input type="number" id="deal-amount-input" name="amount" min="0" step="1000" placeholder="مثال: ۵۰۰۰۰۰۰۰" class="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none">
                    </div>
                </div>

                <!-- Modal Actions -->
                <div class="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button type="button" onclick="closeNewDealModal()" class="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                        انصراف
                    </button>
                    <button type="submit" id="submit-deal-btn" class="px-5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white transition-all shadow-md shadow-emerald-700/20">
                        ثبت معامله
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- Toast Notification (Didar Style Persian Toast) -->
    <div id="toast-notification" class="fixed bottom-6 right-6 z-50 hidden transform transition-all duration-300">
        <div class="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900 text-white shadow-xl border border-slate-800 text-sm font-semibold">
            <div id="toast-icon" class="text-emerald-400">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
            </div>
            <span id="toast-message">عملیات با موفقیت انجام شد</span>
        </div>
    </div>

    <!-- Client-side Drag-and-Drop & API Sync Engine -->
    <script>
        let draggedDealId = null;
        let sourceStageId = null;

        function handleDragStart(e, dealId, stageId) {
            draggedDealId = dealId;
            sourceStageId = stageId;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', dealId);
            const card = document.getElementById('deal-card-' + dealId);
            if (card) {
                card.classList.add('drag-ghost');
            }
        }

        function handleDragEnd(e) {
            if (draggedDealId) {
                const card = document.getElementById('deal-card-' + draggedDealId);
                if (card) {
                    card.classList.remove('drag-ghost');
                }
            }
            document.querySelectorAll('.stage-cards').forEach(zone => {
                zone.classList.remove('drop-target');
            });
        }

        function handleDragOver(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const targetZone = e.currentTarget;
            if (!targetZone.classList.contains('drop-target')) {
                targetZone.classList.add('drop-target');
            }
        }

        function handleDragLeave(e) {
            const targetZone = e.currentTarget;
            targetZone.classList.remove('drop-target');
        }

        async function handleDrop(e, targetStageId) {
            e.preventDefault();
            const targetZone = e.currentTarget;
            targetZone.classList.remove('drop-target');

            const dealId = draggedDealId || e.dataTransfer.getData('text/plain');
            if (!dealId) return;

            if (Number(sourceStageId) === Number(targetStageId)) {
                return; // Dropped in the same stage
            }

            const card = document.getElementById('deal-card-' + dealId);
            if (!card) return;

            // Optimistic UI move
            targetZone.prepend(card);
            card.setAttribute('data-stage-id', targetStageId);

            // Once moved, rotten status is reset!
            const rottenAlert = card.querySelector('.rotten-alert');
            if (rottenAlert) {
                rottenAlert.remove();
                card.setAttribute('data-is-rotten', '0');
            }

            // Sync with backend API
            try {
                const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
                const response = await fetch('/api/deals/' + dealId + '/move', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-CSRF-TOKEN': csrfToken || ''
                    },
                    body: JSON.stringify({
                        stage_id: targetStageId
                    })
                });

                if (!response.ok) {
                    throw new Error('خطا در انتقال معامله');
                }

                const result = await response.json();
                showToast('معامله با موفقیت به مرحله جدید منتقل شد', 'success');

                // Update stage calculations
                recalculateColumns();

            } catch (err) {
                console.error(err);
                showToast('خطا در انتقال معامله در سرور', 'error');
                setTimeout(() => window.location.reload(), 1200);
            }
        }

        function recalculateColumns() {
            let totalAmount = 0;
            let totalDeals = 0;

            document.querySelectorAll('.stage-column').forEach(column => {
                const cards = column.querySelectorAll('.deal-card');
                let stageAmount = 0;
                cards.forEach(card => {
                    const amt = parseFloat(card.getAttribute('data-amount') || 0);
                    stageAmount += amt;
                });

                const countEl = column.querySelector('.stage-count');
                const amtEl = column.querySelector('.stage-amount');
                if (countEl) countEl.textContent = cards.length + ' معامله';
                if (amtEl) amtEl.textContent = stageAmount.toLocaleString('fa-IR') + ' ت';

                totalDeals += cards.length;
                totalAmount += stageAmount;
            });

            const metricTotalDeals = document.getElementById('metric-total-deals');
            const metricTotalAmount = document.getElementById('metric-total-amount');
            if (metricTotalDeals) metricTotalDeals.textContent = totalDeals + ' معامله';
            if (metricTotalAmount) metricTotalAmount.textContent = totalAmount.toLocaleString('fa-IR') + ' تومان';
        }

        // Modal Controls
        function openNewDealModal(stageId = null) {
            const modal = document.getElementById('new-deal-modal');
            if (modal) {
                if (stageId) {
                    const stageSelect = document.getElementById('modal-stage-id');
                    if (stageSelect) stageSelect.value = stageId;
                }
                modal.classList.remove('hidden');
            }
        }

        function closeNewDealModal() {
            const modal = document.getElementById('new-deal-modal');
            if (modal) modal.classList.add('hidden');
        }

        async function handleCreateDeal(e) {
            e.preventDefault();
            const btn = document.getElementById('submit-deal-btn');
            btn.disabled = true;
            btn.textContent = 'در حال ثبت...';

            const form = e.target;
            const payload = {
                title: form.title.value,
                pipeline_id: form.pipeline_id.value,
                stage_id: form.stage_id.value,
                amount: form.amount.value || 0,
            };

            try {
                const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
                const response = await fetch('/api/deals', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-CSRF-TOKEN': csrfToken || ''
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error('خطا در ثبت معامله');
                }

                showToast('معامله جدید با موفقیت ایجاد شد', 'success');
                setTimeout(() => window.location.reload(), 600);
            } catch (err) {
                console.error(err);
                showToast('خطا در ثبت معامله', 'error');
                btn.disabled = false;
                btn.textContent = 'ثبت معامله';
            }
        }

        function filterDeals(type) {
            document.querySelectorAll('.filter-btn').forEach(b => {
                b.classList.remove('bg-sky-100', 'text-sky-800', 'border-sky-300');
                b.classList.add('bg-slate-100', 'text-slate-700', 'border-slate-200');
            });

            const activeBtn = document.getElementById('filter-' + type);
            if (activeBtn) {
                activeBtn.classList.remove('bg-slate-100', 'text-slate-700', 'border-slate-200');
                activeBtn.classList.add('bg-sky-100', 'text-sky-800', 'border-sky-300');
            }

            document.querySelectorAll('.deal-card').forEach(card => {
                if (type === 'rotten') {
                    if (card.getAttribute('data-is-rotten') === '1') {
                        card.style.display = 'block';
                    } else {
                        card.style.display = 'none';
                    }
                } else {
                    card.style.display = 'block';
                }
            });
        }

        // Search Deals
        const searchInput = document.getElementById('deal-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', function(e) {
                const query = e.target.value.toLowerCase().trim();
                document.querySelectorAll('.deal-card').forEach(card => {
                    const title = (card.getAttribute('data-title') || '').toLowerCase();
                    if (!query || title.includes(query)) {
                        card.style.display = 'block';
                    } else {
                        card.style.display = 'none';
                    }
                });
            });
        }

        function showToast(message, type = 'success') {
            const toast = document.getElementById('toast-notification');
            const toastMsg = document.getElementById('toast-message');
            if (toast && toastMsg) {
                toastMsg.textContent = message;
                toast.classList.remove('hidden');
                setTimeout(() => {
                    toast.classList.add('hidden');
                }, 3000);
            }
        }
    </script>
</body>
</html>
