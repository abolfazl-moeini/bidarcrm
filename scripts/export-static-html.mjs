#!/usr/bin/env node
/**
 * BidarCRM - Offline Static HTML Snapshots & Prototype Generator (WEB-03)
 *
 * Generates 100% offline static HTML snapshots for all key views:
 * - /login
 * - /dashboard
 * - /kanban
 * - /deals/:id
 * - /leads
 * - /contacts
 * - /accounts
 * - /activities
 * - /reports
 * - /settings
 *
 * Replaces broken symlink `docs/prototype` with a standalone directory containing an index page.
 * Strips all external CDNs (cdn.jsdelivr.net, cdn.tailwindcss.com) from tests/ui-level/refs/*.html.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const WEB_DIST_DIR = path.resolve(ROOT_DIR, 'apps/web/dist');
const PROTOTYPE_DIR = path.resolve(ROOT_DIR, 'docs/prototype');
const UI_REFS_DIR = path.resolve(ROOT_DIR, 'tests/ui-level/refs');

// Jalali display year used by every offline snapshot. Pinned (not derived from
// the wall clock) so regeneration is deterministic; refresh this single value
// when moving to a new period.
const SNAPSHOT_YEAR = '۱۴۰۵';

console.log('==> Starting BidarCRM Offline Static HTML Export (WEB-03)...');

// 1. Check if apps/web/dist exists
if (!fs.existsSync(WEB_DIST_DIR)) {
  console.error(`FATAL: apps/web/dist not found at ${WEB_DIST_DIR}. Please run "npm --prefix apps/web run build" first.`);
  process.exit(1);
}

// 2. Locate built CSS and Font
const assetsDir = path.join(WEB_DIST_DIR, 'assets');
const distFiles = fs.readdirSync(assetsDir);
const cssFileName = distFiles.find((f) => f.endsWith('.css') && f.startsWith('index-'));

if (!cssFileName) {
  console.error('FATAL: Could not find compiled CSS in apps/web/dist/assets/');
  process.exit(1);
}

const builtCssPath = path.join(assetsDir, cssFileName);
let baseCssContent = fs.readFileSync(builtCssPath, 'utf8');

// Font paths
const fontSourcePath = path.join(WEB_DIST_DIR, 'fonts/vazirmatn/Vazirmatn-Variable.woff2');
if (!fs.existsSync(fontSourcePath)) {
  console.error(`FATAL: Font not found at ${fontSourcePath}`);
  process.exit(1);
}

// Offline font-face rule prepended to CSS
const offlineFontFace = `@font-face {
  font-family: 'Vazirmatn';
  src: url('./fonts/Vazirmatn-Variable.woff2') format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
`;

const offlineCss = offlineFontFace + baseCssContent;

// 3. Setup docs/prototype directory (replace symlink if present)
console.log('--> Setting up docs/prototype directory...');
try {
  const stat = fs.lstatSync(PROTOTYPE_DIR);
  if (stat.isSymbolicLink()) {
    fs.unlinkSync(PROTOTYPE_DIR);
    console.log('    Removed broken symlink docs/prototype');
  } else if (stat.isDirectory()) {
    // Keep directory or clear contents
  }
} catch {
  // Doesn't exist, proceed
}

fs.mkdirSync(path.join(PROTOTYPE_DIR, 'assets/fonts'), { recursive: true });
fs.writeFileSync(path.join(PROTOTYPE_DIR, 'assets/bidar-styles.css'), offlineCss, 'utf8');
fs.copyFileSync(fontSourcePath, path.join(PROTOTYPE_DIR, 'assets/fonts/Vazirmatn-Variable.woff2'));

// 4. Setup tests/ui-level/refs/assets directory
fs.mkdirSync(path.join(UI_REFS_DIR, 'assets/fonts'), { recursive: true });
fs.writeFileSync(path.join(UI_REFS_DIR, 'assets/bidar-styles.css'), offlineCss, 'utf8');
fs.copyFileSync(fontSourcePath, path.join(UI_REFS_DIR, 'assets/fonts/Vazirmatn-Variable.woff2'));

// Shared Header/Navbar for prototype pages
function createShellNavbar(activeRoute = '/dashboard') {
  const routes = [
    { id: '/dashboard', label: 'داشبورد', file: 'dashboard.html' },
    { id: '/kanban', label: 'کاریز فروش', file: 'kanban.html' },
    { id: '/deals', label: 'جزئیات معامله', file: 'deal-detail.html' },
    { id: '/leads', label: 'سرنخ‌ها', file: 'leads.html' },
    { id: '/contacts', label: 'مخاطبان', file: 'contacts.html' },
    { id: '/accounts', label: 'شرکت‌ها', file: 'accounts.html' },
    { id: '/activities', label: 'فعالیت‌ها', file: 'activities.html' },
    { id: '/reports', label: 'گزارشات', file: 'reports.html' },
    { id: '/settings', label: 'تنظیمات', file: 'settings.html' },
  ];

  const linksHtml = routes
    .map((r) => {
      const isActive = activeRoute === r.id;
      return `<a href="${r.file}" class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        isActive
          ? 'bg-slate-800 text-white font-semibold'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
      }">${r.label}</a>`;
    })
    .join('\n          ');

  return `
    <header class="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between text-slate-100 select-none">
      <div class="flex items-center gap-4">
        <a href="index.html" class="flex items-center gap-2 hover:opacity-90 transition">
          <div class="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
            ب
          </div>
          <span class="font-bold text-sm tracking-tight text-white">بیدار CRM</span>
        </a>
        <nav class="hidden md:flex items-center gap-1 border-r border-slate-800 pr-4">
          ${linksHtml}
        </nav>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-xs bg-teal-950/80 text-teal-400 border border-teal-800/60 px-2 py-0.5 rounded-md font-mono hidden sm:inline">نسخه آفلاین</span>
        <a href="login.html" class="text-xs text-rose-400 hover:text-rose-300 font-medium">خروج</a>
      </div>
    </header>
  `;
}

function htmlPageWrapper({ title, activeRoute, content, bodyClass = 'bg-slate-950 text-slate-100 min-h-screen' }) {
  const navbar = activeRoute === '/login' ? '' : createShellNavbar(activeRoute);
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | بیدار CRM</title>
  <link rel="stylesheet" href="./assets/bidar-styles.css">
  <style>
    body { font-family: 'Vazirmatn', system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body class="${bodyClass}">
  ${navbar}
  <main class="w-full">
    ${content}
  </main>
</body>
</html>`;
}

// 5. Generate Views Content
const VIEWS = {
  login: {
    title: 'ورود به سامانه بیدار',
    activeRoute: '/login',
    bodyClass: 'min-h-screen w-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100',
    content: `
      <div class="bidar-login-card w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-8 backdrop-blur-md text-right">
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-600/20 border border-teal-500/30 text-teal-400 mb-4 shadow-inner font-bold text-xl">
            ب
          </div>
          <h1 class="text-2xl font-bold text-slate-100 tracking-tight">ورود به سامانه بیدار</h1>
          <p class="text-xs text-slate-400 mt-2">سامانه مدیریت ارتباط با مشتری و کاریز فروش</p>
        </div>

        <form class="space-y-4" onsubmit="event.preventDefault(); window.location.href='dashboard.html';">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">نام کاربری یا ایمیل</label>
            <input type="text" dir="ltr" value="admin" class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs font-mono outline-none focus:border-teal-500" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">رمز عبور</label>
            <input type="password" dir="ltr" value="password" class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs font-mono outline-none focus:border-teal-500" />
          </div>
          <button type="submit" class="w-full mt-3 py-2.5 px-4 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer">
            ورود به سامانه
          </button>
        </form>

        <div class="mt-6 pt-4 border-t border-slate-800/80 text-center">
          <a href="dashboard.html" class="text-xs text-teal-400 hover:underline">ورود مستقیم به پیشخوان فروش →</a>
        </div>
      </div>
      <footer class="mt-6 text-center text-xs text-slate-500">
        <p>© ${SNAPSHOT_YEAR} بیدار (BidarCRM) — نسخه آفلاین ایزوله</p>
      </footer>
    `,
  },

  dashboard: {
    title: 'داشبورد و پیشخوان فروش',
    activeRoute: '/dashboard',
    content: `
      <div class="bidar-dashboard max-w-7xl mx-auto p-6 space-y-6" dir="rtl">
        <div>
          <h1 class="text-xl font-bold text-slate-100">پیشخوان فروش بیدار</h1>
          <p class="text-xs text-slate-400 mt-1">خلاصه عملکرد کاریز معاملات، درآمد تحقق‌یافته و رصد لحظه‌ای اقدامات</p>
        </div>

        <!-- KPI Strip -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xs">
            <span class="text-xs text-slate-400 font-medium">ارزش کل معاملات باز</span>
            <div class="text-xl font-bold text-slate-100 mt-2">۴۵۰,۰۰۰,۰۰۰ تومان</div>
            <div class="text-xs text-teal-400 mt-1 font-mono">۱۴ معامله جاری</div>
          </div>
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xs">
            <span class="text-xs text-slate-400 font-medium">درآمد محقق‌شده (برنده)</span>
            <div class="text-xl font-bold text-slate-100 mt-2">۳۲۰,۰۰۰,۰۰۰ تومان</div>
            <div class="text-xs text-emerald-400 mt-1 font-mono">۸ معامله موفق این ماه</div>
          </div>
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xs">
            <span class="text-xs text-slate-400 font-medium">معاملات پوسیده (بدون پیگیری)</span>
            <div class="text-xl font-bold text-rose-400 mt-2">۳ معامله</div>
            <div class="text-xs text-rose-500 mt-1">نیازمند اقدام فوری کارشناس</div>
          </div>
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xs">
            <span class="text-xs text-slate-400 font-medium">فعالیت‌های معوق</span>
            <div class="text-xl font-bold text-amber-400 mt-2">۵ وظیفه</div>
            <div class="text-xs text-amber-500 mt-1">سررسید گذشته</div>
          </div>
        </div>

        <!-- Funnel & Recent Deals -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-sm font-bold text-slate-100">قیف فروش معاملات کاریز اصلی</h3>
              <a href="kanban.html" class="text-xs text-teal-400 hover:underline">مشاهده کانبان ←</a>
            </div>
            <div class="space-y-3.5">
              <div>
                <div class="flex justify-between text-xs mb-1 text-slate-300">
                  <span>سرنخ اولیه (۶ معامله)</span>
                  <span class="font-mono">۱۲۰,۰۰۰,۰۰۰ تومان</span>
                </div>
                <div class="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div class="h-full bg-teal-500 rounded-full" style="width: 80%"></div>
                </div>
              </div>
              <div>
                <div class="flex justify-between text-xs mb-1 text-slate-300">
                  <span>جلسه و ارائه (۵ معامله)</span>
                  <span class="font-mono">۱۸۰,۰۰۰,۰۰۰ تومان</span>
                </div>
                <div class="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div class="h-full bg-indigo-500 rounded-full" style="width: 60%"></div>
                </div>
              </div>
              <div>
                <div class="flex justify-between text-xs mb-1 text-slate-300">
                  <span>صدور پیش‌فاکتور (۳ معامله)</span>
                  <span class="font-mono">۱۵۰,۰۰۰,۰۰۰ تومان</span>
                </div>
                <div class="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div class="h-full bg-amber-500 rounded-full" style="width: 40%"></div>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 class="text-sm font-bold text-slate-100 mb-4">اقدامات سریع</h3>
            <div class="space-y-2">
              <a href="kanban.html" class="block w-full text-center py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold">ثبت معامله جدید</a>
              <a href="leads.html" class="block w-full text-center py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium">مشاهده سرنخ‌های جدید</a>
              <a href="reports.html" class="block w-full text-center py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium">گزارش عملکرد ماهانه</a>
            </div>
          </div>
        </div>
      </div>
    `,
  },

  kanban: {
    title: 'کاریز معاملات و کانبان فروش',
    activeRoute: '/kanban',
    content: `
      <div class="p-6 space-y-5" dir="rtl">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h1 class="text-lg sm:text-xl font-bold text-slate-100">کاریز فروش اصلی</h1>
            <p class="text-xs text-slate-400 mt-0.5">مجموع ارزش معاملات باز: ۴۵۰,۰۰۰,۰۰۰ تومان</p>
          </div>
          <div class="flex items-center gap-2">
            <a href="deal-detail.html" class="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-xl shadow-xs">
              + معامله جدید
            </a>
          </div>
        </div>

        <!-- Kanban Board Columns -->
        <div class="bidar-kanban-board flex gap-4 overflow-x-auto pb-6 items-start">
          <!-- Column 1 -->
          <div class="w-80 flex-shrink-0 bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-3">
            <div class="flex items-center justify-between border-b border-slate-800 pb-2">
              <span class="text-xs font-bold text-slate-200">سرنخ اولیه</span>
              <span class="text-[11px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-mono">۲ معامله</span>
            </div>
            <div class="space-y-2.5">
              <a href="deal-detail.html" class="bidar-deal-card block bg-slate-950 border border-slate-800 hover:border-teal-500/50 rounded-xl p-3.5 transition">
                <div class="flex justify-between items-start">
                  <h4 class="text-xs font-bold text-slate-200">طرح تحول دیجیتال فولاد البرز</h4>
                </div>
                <div class="text-xs font-bold text-teal-400 mt-2 font-mono">۸۵,۰۰۰,۰۰۰ تومان</div>
                <div class="flex items-center justify-between mt-2 pt-2 border-t border-slate-900 text-[11px] text-slate-400">
                  <span>فولاد البرز</span>
                  <span class="font-mono">${SNAPSHOT_YEAR}/۰۹/۰۲</span>
                </div>
              </a>
              <div class="bidar-deal-card bg-slate-950 border border-slate-800 rounded-xl p-3.5">
                <h4 class="text-xs font-bold text-slate-200">خرید نرم‌افزار توسعه صادرات</h4>
                <div class="text-xs font-bold text-teal-400 mt-2 font-mono">۳۵,۰۰۰,۰۰۰ تومان</div>
                <div class="flex items-center justify-between mt-2 pt-2 border-t border-slate-900 text-[11px] text-slate-400">
                  <span>بازرگانی سینا</span>
                  <span class="font-mono">${SNAPSHOT_YEAR}/۰۹/۰۴</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Column 2 -->
          <div class="w-80 flex-shrink-0 bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-3">
            <div class="flex items-center justify-between border-b border-slate-800 pb-2">
              <span class="text-xs font-bold text-slate-200">جلسه و مذاکره اولیه</span>
              <span class="text-[11px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-mono">۱ معامله</span>
            </div>
            <div class="space-y-2.5">
              <a href="deal-detail.html" class="bidar-deal-card block bg-slate-950 border border-slate-800 hover:border-teal-500/50 rounded-xl p-3.5 transition">
                <div class="flex items-center justify-between">
                  <h4 class="text-xs font-bold text-slate-200">سامانه پشتیبانی مرکز داده آریا</h4>
                  <span class="px-2 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20">پوسیده (۶ روز)</span>
                </div>
                <div class="text-xs font-bold text-teal-400 mt-2 font-mono">۱۲۰,۰۰۰,۰۰۰ تومان</div>
                <div class="flex items-center justify-between mt-2 pt-2 border-t border-slate-900 text-[11px] text-slate-400">
                  <span>داده‌پردازان آریا</span>
                  <span class="font-mono">${SNAPSHOT_YEAR}/۰۹/۰۱</span>
                </div>
              </a>
            </div>
          </div>

          <!-- Column 3 -->
          <div class="w-80 flex-shrink-0 bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-3">
            <div class="flex items-center justify-between border-b border-slate-800 pb-2">
              <span class="text-xs font-bold text-slate-200">ارسال پیش‌فاکتور</span>
              <span class="text-[11px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-mono">۱ معامله</span>
            </div>
            <div class="space-y-2.5">
              <a href="deal-detail.html" class="bidar-deal-card block bg-slate-950 border border-slate-800 hover:border-teal-500/50 rounded-xl p-3.5 transition">
                <h4 class="text-xs font-bold text-slate-200">پروژه راه‌اندازی باشگاه مشتریان</h4>
                <div class="text-xs font-bold text-teal-400 mt-2 font-mono">۲۱۰,۰۰۰,۰۰۰ تومان</div>
                <div class="flex items-center justify-between mt-2 pt-2 border-t border-slate-900 text-[11px] text-slate-400">
                  <span>هلدینگ پارسیان</span>
                  <span class="font-mono">${SNAPSHOT_YEAR}/۰۸/۲۸</span>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    `,
  },

  'deal-detail': {
    title: 'نمای ۳۶۰ درجه جزئیات معامله',
    activeRoute: '/deals',
    content: `
      <div class="bidar-deal-detail max-w-7xl mx-auto p-6 space-y-6" dir="rtl">
        <div class="flex items-center justify-between border-b border-slate-800 pb-4">
          <div class="flex items-center gap-3">
            <a href="kanban.html" class="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs">← بازگشت</a>
            <div>
              <h1 class="text-lg font-bold text-slate-100">طرح تحول دیجیتال فولاد البرز</h1>
              <p class="text-xs text-slate-400 mt-0.5">شناسه معامله: <span class="font-mono">deal-101</span></p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold">ثبت به عنوان موفق (Won)</button>
            <button class="px-3.5 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded-xl text-xs font-semibold">لغو / ناموفق (Lost)</button>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Sidebar Meta -->
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 class="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2">اطلاعات مالی و طرف حساب</h3>
            <div class="space-y-3 text-xs">
              <div class="flex justify-between">
                <span class="text-slate-400">ارزش کل معامله:</span>
                <span class="font-bold text-teal-400 font-mono text-sm">۸۵,۰۰۰,۰۰۰ تومان</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">مرحله فعلی:</span>
                <span class="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded">مذاکره اولیه</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">طرف حساب:</span>
                <a href="accounts.html" class="text-slate-200 hover:underline">فولاد البرز</a>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">مخاطب اصلی:</span>
                <a href="contacts.html" class="text-slate-200 hover:underline">مهندس علیرضا رضایی</a>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">شماره تماس:</span>
                <span dir="ltr" class="font-mono text-slate-300">۰۹۱۲۱۱۱۴۴۵۵</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">تاریخ تقریبی بستن:</span>
                <span class="font-mono text-slate-300">${SNAPSHOT_YEAR}/۰۹/۲۰</span>
              </div>
            </div>

            <!-- Products / Deal Items -->
            <div class="mt-4 pt-4 border-t border-slate-800">
              <h4 class="text-xs font-bold text-slate-300 mb-2">اقلام معامله (Deal Items)</h4>
              <div class="space-y-2 text-xs">
                <div class="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <div class="font-medium text-slate-200">لایسنس سازمانی بیدار</div>
                    <div class="text-[11px] text-slate-500 font-mono">۱ عدد × ۵۰,۰۰۰,۰۰۰ تومان</div>
                  </div>
                  <div class="font-bold text-slate-100 font-mono">۵۰,۰۰۰,۰۰۰</div>
                </div>
                <div class="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <div class="font-medium text-slate-200">راه‌اندازی و سفارشی‌سازی</div>
                    <div class="text-[11px] text-slate-500 font-mono">۱ پکیج × ۳۵,۰۰۰,۰۰۰ تومان</div>
                  </div>
                  <div class="font-bold text-slate-100 font-mono">۳۵,۰۰۰,۰۰۰</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Main Stream Timeline -->
          <div class="lg:col-span-2 space-y-4">
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 class="text-sm font-bold text-slate-200 mb-3">ثبت یادداشت یا تماس جدید</h3>
              <form class="space-y-3" onsubmit="event.preventDefault();">
                <textarea rows="3" placeholder="توضیحات جلسه، توافقات یا پیگیری بعدی را اینجا بنویسید..." class="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 outline-none"></textarea>
                <div class="flex justify-end">
                  <button type="submit" class="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold">ثبت در پرونده معامله</button>
                </div>
              </form>
            </div>

            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 class="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2">تاریخچه وقایع و اقدامات</h3>
              <div class="space-y-3 text-xs">
                <div class="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl">
                  <div class="flex justify-between text-slate-400 mb-1">
                    <span class="font-medium text-teal-400">تماس تلفنی با مدیر خرید</span>
                    <span class="font-mono">امروز ۱۴:۳۰</span>
                  </div>
                  <p class="text-slate-300">هماهنگی جلسه حضوری برای روز شنبه و بررسی فاکتور نهایی.</p>
                </div>
                <div class="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl">
                  <div class="flex justify-between text-slate-400 mb-1">
                    <span class="font-medium text-slate-300">ایجاد معامله اولیه</span>
                    <span class="font-mono">۳ روز پیش</span>
                  </div>
                  <p class="text-slate-300">تبدیل از سرنخ ورودی وب‌سایت توسط کارشناس فروش.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `,
  },

  leads: {
    title: 'سرنخ‌های فروش (Leads)',
    activeRoute: '/leads',
    content: `
      <div class="max-w-7xl mx-auto p-6 space-y-5" dir="rtl">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h1 class="text-lg sm:text-xl font-bold text-slate-100">سرنخ‌های فروش (Leads)</h1>
            <p class="text-xs text-slate-400 mt-0.5">مشتریان بالقوه و تبدیل یک‌کلیکه به معامله، مخاطب و شرکت</p>
          </div>
          <button class="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold self-start sm:self-auto">+ سرنخ جدید</button>
        </div>

        <div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div class="overflow-x-auto">
            <table class="bidar-leads-table w-full text-right border-collapse text-xs">
              <thead>
                <tr class="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold">
                  <th class="py-3 px-4">نام سرنخ</th>
                  <th class="py-3 px-4">شرکت</th>
                  <th class="py-3 px-4">وضعیت</th>
                  <th class="py-3 px-4">شماره تماس</th>
                  <th class="py-3 px-4">تاریخ ثبت</th>
                  <th class="py-3 px-4 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800 text-slate-200">
                <tr class="hover:bg-slate-800/40">
                  <td class="py-3 px-4 font-bold text-slate-100">مهندس حمید شایان</td>
                  <td class="py-3 px-4 text-slate-400">توسعه تجارت مهر</td>
                  <td class="py-3 px-4"><span class="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[11px]">جدید</span></td>
                  <td class="py-3 px-4 font-mono" dir="ltr">۰۹۱۲۴۴۴۷۷۸۸</td>
                  <td class="py-3 px-4 font-mono text-slate-400">${SNAPSHOT_YEAR}/۰۹/۰۴</td>
                  <td class="py-3 px-4 text-center">
                    <button class="px-3 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-[11px] font-semibold">تبدیل به معامله</button>
                  </td>
                </tr>
                <tr class="hover:bg-slate-800/40">
                  <td class="py-3 px-4 font-bold text-slate-100">دکتر مریم سلیمانی</td>
                  <td class="py-3 px-4 text-slate-400">کلینیک کیمیا</td>
                  <td class="py-3 px-4"><span class="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px]">در حال پیگیری</span></td>
                  <td class="py-3 px-4 font-mono" dir="ltr">۰۹۳۵۱۲۳۹۸۷۶</td>
                  <td class="py-3 px-4 font-mono text-slate-400">${SNAPSHOT_YEAR}/۰۹/۰۲</td>
                  <td class="py-3 px-4 text-center">
                    <button class="px-3 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-[11px] font-semibold">تبدیل به معامله</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `,
  },

  contacts: {
    title: 'مخاطبان و مشتریان',
    activeRoute: '/contacts',
    content: `
      <div class="max-w-7xl mx-auto p-6 space-y-5" dir="rtl">
        <div class="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 class="text-xl font-bold text-slate-100">فهرست مخاطبان</h1>
            <p class="text-xs text-slate-400 mt-0.5">مدیریت اشخاص حقیقی، تصمیم‌گیرندگان و مدیران سازمان‌ها</p>
          </div>
          <button class="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold">+ مخاطب جدید</button>
        </div>

        <div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <table class="bidar-contacts-table w-full text-right border-collapse text-xs">
            <thead>
              <tr class="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold">
                <th class="py-3 px-4">نام کامل</th>
                <th class="py-3 px-4">شرکت متبوع</th>
                <th class="py-3 px-4">سمت</th>
                <th class="py-3 px-4">تلفن همراه</th>
                <th class="py-3 px-4">ایمیل</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800 text-slate-200">
              <tr class="hover:bg-slate-800/40">
                <td class="py-3 px-4 font-bold text-slate-100">علیرضا رضایی</td>
                <td class="py-3 px-4 text-slate-400">فولاد البرز</td>
                <td class="py-3 px-4">مدیر فناوری اطلاعات</td>
                <td class="py-3 px-4 font-mono" dir="ltr">۰۹۱۲۱۱۱۴۴۵۵</td>
                <td class="py-3 px-4 font-mono text-slate-400">a.rezaei@alborzsteel.ir</td>
              </tr>
              <tr class="hover:bg-slate-800/40">
                <td class="py-3 px-4 font-bold text-slate-100">سارا یوسفی</td>
                <td class="py-3 px-4 text-slate-400">بازرگانی سینا</td>
                <td class="py-3 px-4">مدیر بازرگانی خارجی</td>
                <td class="py-3 px-4 font-mono" dir="ltr">۰۹۳۳۲۲۲۹۹۰۰</td>
                <td class="py-3 px-4 font-mono text-slate-400">yousefi@sinatrading.com</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `,
  },

  accounts: {
    title: 'شرکت‌ها و حساب‌ها',
    activeRoute: '/accounts',
    content: `
      <div class="max-w-7xl mx-auto p-6 space-y-5" dir="rtl">
        <div class="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 class="text-xl font-bold text-slate-100">فهرست شرکت‌ها و طرف‌های حساب</h1>
            <p class="text-xs text-slate-400 mt-0.5">مدیریت مشتریان حقوقی و سازمان‌های طرف قرارداد</p>
          </div>
          <button class="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold">+ شرکت جدید</button>
        </div>

        <div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <table class="bidar-accounts-table w-full text-right border-collapse text-xs">
            <thead>
              <tr class="bg-slate-950 border-b border-slate-800 text-slate-400 font-semibold">
                <th class="py-3 px-4">نام شرکت</th>
                <th class="py-3 px-4">نوع</th>
                <th class="py-3 px-4">صنعت</th>
                <th class="py-3 px-4">شناسه ملی</th>
                <th class="py-3 px-4">شهر / استان</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800 text-slate-200">
              <tr class="hover:bg-slate-800/40">
                <td class="py-3 px-4 font-bold text-slate-100">فولاد البرز خاورمیانه</td>
                <td class="py-3 px-4"><span class="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">مشتری دائم</span></td>
                <td class="py-3 px-4 text-slate-400">فلزات و فولاد</td>
                <td class="py-3 px-4 font-mono" dir="ltr">۱۰۱۰۳۵۴۸۹۰۰</td>
                <td class="py-3 px-4">تهران</td>
              </tr>
              <tr class="hover:bg-slate-800/40">
                <td class="py-3 px-4 font-bold text-slate-100">داده‌پردازان آریا سپهر</td>
                <td class="py-3 px-4"><span class="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">مشتری بالقوه</span></td>
                <td class="py-3 px-4 text-slate-400">فناوری اطلاعات</td>
                <td class="py-3 px-4 font-mono" dir="ltr">۱۰۳۲۰۹۸۷۶۵۴</td>
                <td class="py-3 px-4">اصفهان</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `,
  },

  activities: {
    title: 'تقویم و فعالیت‌ها',
    activeRoute: '/activities',
    content: `
      <div class="max-w-7xl mx-auto p-6 space-y-5" dir="rtl">
        <div class="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 class="text-xl font-bold text-slate-100">برنامه کاری و پیگیری‌ها</h1>
            <p class="text-xs text-slate-400 mt-0.5">تماس‌ها، جلسات و وظایف معوق کاریز فروش</p>
          </div>
          <button class="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold">+ فعالیت جدید</button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="md:col-span-2 space-y-3">
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <h3 class="text-xs font-bold text-rose-400 mb-3 flex items-center gap-1.5">
                <span>●</span> وظایف سررسید گذشته (نیاز به اقدام فوری)
              </h3>
              <div class="space-y-2 text-xs">
                <div class="p-3 bg-slate-950 border border-rose-900/40 rounded-xl flex justify-between items-center">
                  <div>
                    <div class="font-bold text-slate-200">تماس تلفنی با فولاد البرز جهت ارسال پیش‌فاکتور</div>
                    <div class="text-[11px] text-slate-400 mt-0.5">مسئول: کارشناس فروش</div>
                  </div>
                  <span class="text-rose-400 font-mono text-[11px]">دیروز ۱۶:۰۰</span>
                </div>
              </div>
            </div>

            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <h3 class="text-xs font-bold text-teal-400 mb-3 flex items-center gap-1.5">
                <span>●</span> فعالیت‌های امروز
              </h3>
              <div class="space-y-2 text-xs">
                <div class="p-3 bg-slate-950 border border-slate-800 rounded-xl flex justify-between items-center">
                  <div>
                    <div class="font-bold text-slate-200">جلسه آنلاین دمو محصول با مدیران آریا سپهر</div>
                    <div class="text-[11px] text-slate-400 mt-0.5">لینک گوگل میت / اتاق جلسه ۳</div>
                  </div>
                  <span class="text-teal-400 font-mono text-[11px]">امروز ۱۵:۰۰</span>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h3 class="text-xs font-bold text-slate-200">تقویم شمسی ماه جاری</h3>
            <div class="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
              <div class="font-bold text-sm text-teal-400">آذر ماه ${SNAPSHOT_YEAR}</div>
              <p class="text-xs text-slate-400 mt-2">تمام رویدادها بر پایه تقویم رسمی هجری خورشیدی محاسبه شده‌اند.</p>
            </div>
          </div>
        </div>
      </div>
    `,
  },

  reports: {
    title: 'گزارشات تحلیلی و فروش',
    activeRoute: '/reports',
    content: `
      <div class="max-w-7xl mx-auto p-6 space-y-6" dir="rtl">
        <div class="border-b border-slate-800 pb-4">
          <h1 class="text-xl font-bold text-slate-100">گزارشات و آمارهای فروش</h1>
          <p class="text-xs text-slate-400 mt-0.5">تحلیل نرخ تبدیل، عملکرد کاریز و تحقق اهداف مالی</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center">
            <span class="text-xs text-slate-400">نرخ برنده شدن (Win Rate)</span>
            <div class="text-3xl font-bold text-teal-400 mt-2 font-mono">۶۸٪</div>
            <p class="text-[11px] text-slate-500 mt-1">نسبت معاملات موفق به کل معاملات خاتمه یافته</p>
          </div>
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center">
            <span class="text-xs text-slate-400">متوسط طول چرخه فروش</span>
            <div class="text-3xl font-bold text-slate-100 mt-2 font-mono">۱۲ روز</div>
            <p class="text-[11px] text-slate-500 mt-1">از زمان ثبت سرنخ تا بستن موفق معامله</p>
          </div>
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center">
            <span class="text-xs text-slate-400">تحقق هدف درآمدی ماهانه</span>
            <div class="text-3xl font-bold text-emerald-400 mt-2 font-mono">۸۴٪</div>
            <p class="text-[11px] text-slate-500 mt-1">۳۲۰ از ۵۰۰ میلیون تومان هدف آذر ماه</p>
          </div>
        </div>
      </div>
    `,
  },

  settings: {
    title: 'تنظیمات و پیکربندی سامانه',
    activeRoute: '/settings',
    content: `
      <div class="max-w-7xl mx-auto p-6 space-y-6" dir="rtl">
        <div class="border-b border-slate-800 pb-4">
          <h1 class="text-xl font-bold text-slate-100">تنظیمات بیدار CRM</h1>
          <p class="text-xs text-slate-400 mt-0.5">مدیریت کلیدهای API، محصولات و خدمات، اهداف فروش و الگوهای پیامکی</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-bold text-slate-200">کلیدهای دسترسی API (REST)</h3>
              <span class="px-2 py-0.5 bg-teal-500/10 text-teal-400 text-xs rounded border border-teal-500/20">X-Api-Key</span>
            </div>
            <p class="text-xs text-slate-400">امکان اتصال فروشگاه، وب‌سایت یا پنل حسابداری با توکن‌های امن بدون ارتقای سطح دسترسی.</p>
            <div class="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs flex justify-between items-center">
              <span>bidar_live_a89f...</span>
              <span class="text-emerald-400 text-[11px]">فعال</span>
            </div>
          </div>

          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-bold text-slate-200">محصولات و اقلام پیش‌فرض</h3>
              <span class="text-xs text-slate-400">۳ قلم کالا</span>
            </div>
            <p class="text-xs text-slate-400">تعریف قیمت پایه و واحدهای شمارش جهت افزودن سریع به معاملات.</p>
            <div class="space-y-1.5 text-xs text-slate-300">
              <div class="flex justify-between p-2 bg-slate-950 rounded-lg">
                <span>اشتراک سالانه نرم‌افزار</span>
                <span class="font-mono text-teal-400">۱۲,۰۰۰,۰۰۰ تومان</span>
              </div>
              <div class="flex justify-between p-2 bg-slate-950 rounded-lg">
                <span>پکیج آموزش و راه‌اندازی</span>
                <span class="font-mono text-teal-400">۵,۰۰۰,۰۰۰ تومان</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `,
  },
};

// 6. Write Prototype Static HTML Snapshots
console.log('--> Exporting standalone HTML views to docs/prototype/...');
for (const [key, view] of Object.entries(VIEWS)) {
  const filePath = path.join(PROTOTYPE_DIR, `${key}.html`);
  const html = htmlPageWrapper({
    title: view.title,
    activeRoute: view.activeRoute,
    content: view.content,
    bodyClass: view.bodyClass,
  });
  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`    Created docs/prototype/${key}.html`);
}

// 7. Write docs/prototype/index.html (Directory Showcase)
const prototypeCards = Object.entries(VIEWS)
  .map(([key, view]) => {
    return `
      <a href="${key}.html" class="group block p-5 bg-slate-900 border border-slate-800 hover:border-teal-500/50 rounded-2xl transition shadow-xs hover:shadow-teal-950/20">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-mono text-teal-400">${view.activeRoute}</span>
          <span class="text-[11px] text-slate-500 group-hover:text-teal-400 transition">مشاهده صفحه ←</span>
        </div>
        <h3 class="text-base font-bold text-slate-100 group-hover:text-white">${view.title}</h3>
        <p class="text-xs text-slate-400 mt-1 line-clamp-2">مشاهده نمای آفلاین استاتیک ۱۰۰٪ مستقل بدون نیاز به اینترنت یا سرور</p>
      </a>
    `;
  })
  .join('\n');

const indexHtml = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>راهنمای پروتوتایپ‌های آفلاین بیدار CRM | Bidar Prototype</title>
  <link rel="stylesheet" href="./assets/bidar-styles.css">
  <style>
    body { font-family: 'Vazirmatn', system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
  ${createShellNavbar('/index')}
  <main class="max-w-6xl mx-auto p-6 sm:p-10 space-y-8">
    <div class="text-center max-w-2xl mx-auto space-y-3">
      <div class="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-teal-600 text-white font-bold text-xl shadow-md">
        ب
      </div>
      <h1 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
        پروتوتایپ‌های استاتیک و آفلاین بیدار CRM
      </h1>
      <p class="text-xs sm:text-sm text-slate-400 leading-relaxed">
        تمام صفحات زیر با کدهای HTML استاتیک و فایل استایل کاملاً آفلاین (<span class="font-mono text-teal-400">assets/bidar-styles.css</span>) ساخته شده‌اند و بدون هیچ‌گونه اتصال اینترنتی یا CDN خارجی کار می‌کنند.
      </p>
    </div>

    <!-- Cards Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      ${prototypeCards}
    </div>

    <footer class="text-center pt-8 border-t border-slate-900 text-xs text-slate-500">
      <p>پروژه بیدار CRM — تمامی حقوق بر پایه لایسنس باز محفوظ است.</p>
    </footer>
  </main>
</body>
</html>`;

fs.writeFileSync(path.join(PROTOTYPE_DIR, 'index.html'), indexHtml, 'utf8');
console.log('    Created docs/prototype/index.html');

// 8. Regenerate ALL managed reference snapshots deterministically from VIEWS.
// shell.html and calendar.html are legacy hand-authored refs with no VIEWS
// entry; they are left as-is but still receive the CDN-cleanup pass below.
console.log('--> Regenerating tests/ui-level/refs/*.html from VIEWS...');
if (fs.existsSync(UI_REFS_DIR)) {
  for (const [key, view] of Object.entries(VIEWS)) {
    const targetRefPath = path.join(UI_REFS_DIR, `${key}.html`);
    const html = htmlPageWrapper({
      title: view.title,
      activeRoute: view.activeRoute,
      content: view.content,
      bodyClass: view.bodyClass,
    });
    fs.writeFileSync(targetRefPath, html, 'utf8');
    console.log(`    Wrote tests/ui-level/refs/${key}.html`);
  }

  // 9. Keep every ref offline-safe, including the legacy snapshots.
  console.log('--> Ensuring all refs are CDN-free with local offline assets...');
  const refFiles = fs.readdirSync(UI_REFS_DIR).filter((f) => f.endsWith('.html'));

  for (const refFile of refFiles) {
    const fullPath = path.join(UI_REFS_DIR, refFile);
    let content = fs.readFileSync(fullPath, 'utf8');

    let modified = false;

    // Remove cdn.jsdelivr.net stylesheet
    if (content.includes('cdn.jsdelivr.net')) {
      content = content.replace(/<link[^>]*cdn\.jsdelivr\.net[^>]*>/gi, '');
      modified = true;
    }

    // Remove cdn.tailwindcss.com script
    if (content.includes('cdn.tailwindcss.com')) {
      content = content.replace(/<script[^>]*cdn\.tailwindcss\.com[^>]*><\/script>/gi, '');
      modified = true;
    }

    // Ensure local offline stylesheet is present
    if (!content.includes('bidar-styles.css')) {
      content = content.replace('</head>', '  <link rel="stylesheet" href="./assets/bidar-styles.css">\n</head>');
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`    Updated ${refFile} -> CDN free with local assets`);
    }
  }
}

console.log('==> BidarCRM Offline Static HTML Export completed successfully.');
