# پلن جامع اصلاح و بهبود بخش ۳ (قالب اختصاصی، نشان تجاری و استانداردهای بصری و RTL)
## Comprehensive Remediation Plan: Section 3 (Bidar Theme, Brand, RTL & UI/UX)

**بخش‌های هدف:**
- `extensions/bidar-theme/`
- `extensions/bidar-brand/`
- `client/custom/modules/bidar-theme/`
- `apps/web/src/components/layout/Sidebar.tsx`
- `apps/web/src/features/contacts/`
- `apps/web/src/pages/ReportsPage.tsx`

---

## ۱. فهرست باگ‌ها و اصلاحات ساختاری (Issues & Fixes)

### ۱.۱. [THM-01] یکپارچگی جهت سایدبار در صفحه نخست (`/` یا داشبورد) در نسخه کلاسیک
- **شناسه:** `THM-RTL-01`
- **علت ریشه‌ای:** در فایل `client/custom/modules/bidar-theme/css/bidar-rtl.css`، قواعد استایل راست‌چین کردن سایدبار به صورت شکننده مشروط به سلکتور `body[data-navbar="side"]` شده‌اند. از آنجا که هسته EspoCRM هرگز اتریبیوت `data-navbar="side"` را روی `body` تنظیم نمی‌کند (صرفاً کلاس‌ها و جهت `data-direction="rtl"` را ست می‌کند)، در صفحه نخست (`/` یا `#Dashboard`) این سلکتور تطابق نیافته و سایدبار به صورت چپ‌چین رندر می‌شود.
- **راه‌حل:**
  1. در `bidar-rtl.css`، سلکتورهای سایدبار بدون وابستگی اجباری به `data-navbar="side"` تعمیم یابند:
     ```css
     html[dir="rtl"] #navbar > .navbar,
     body[data-direction="rtl"] #navbar > .navbar,
     html[dir="rtl"] body[data-navbar="side"] #navbar > .navbar,
     body[data-direction="rtl"][data-navbar="side"] #navbar > .navbar {
         left: auto !important;
         right: 0 !important;
         border-right-width: 0 !important;
         border-left: var(--navbar-border-width, 1px) solid var(--bidar-sidebar-line, var(--navbar-inverse-border)) !important;
     }

     html[dir="rtl"] #content,
     body[data-direction="rtl"] #content,
     html[dir="rtl"] #main,
     body[data-direction="rtl"] #main {
         margin-left: 0 !important;
         margin-right: var(--navbar-width) !important;
     }

     html[dir="rtl"] #navbar .navbar-right,
     body[data-direction="rtl"] #navbar .navbar-right {
         left: 0 !important;
         right: auto !important;
         margin-left: 0 !important;
         margin-right: var(--navbar-width) !important;
         width: calc(100vw - var(--navbar-width)) !important;
     }
     ```
  2. در `client/custom/modules/bidar-theme/js/appearance.js`، در ابتدای چرخه بارگذاری به طور پیش‌فرض مقدار `document.body.dataset.navbar = 'side'` و در صورت فارسی بودن `document.documentElement.dir = 'rtl'` تضمین گردد.

---

### ۱.۲. [THM-02] صفحه ورود کلاسیک (RTL بودن کامل و چینش استاندارد لوگو)
- **شناسه:** `THM-LOGIN-01`
- **علت ریشه‌ای:** در `bidar-login.css` استایل‌های RTL تنها در صورتی فعال می‌شدند که اتریبیوت `html[dir="rtl"]` از قبل وجود داشته باشد؛ اما در بدو ورود کاربر ناشناس، این اتریبیوت ممکن است هنوز اعمال نشده باشد.
- **راه‌حل:**
  - در `bidar-login.css`، به طور پیش‌فرض برای `#login` و `body:has(#login)` جهت راست‌چین `direction: rtl; text-align: right;` تنظیم شود.
  - جایگاه لوگو در هدر کارت ورود با `text-align: center;` و ارتفاع حداکثر `48px` و پدینگ متناسب پایدار گردد.
  - لیبل‌های فرم‌ها راست‌چین و فیلدهای ورودی نام کاربری و کلمه عبور با متون فارسی متناسب همراه شوند.

---

### ۱.۳. [THM-03] سایدبار لایت در تم لایت (Light Theme Harmonization)
- **شناسه:** `THM-LIGHT-01`
- **درخواست کاربر:** «نسخه لایت سایدبارش دارکه به نظرم مناسب نیست، نسخه لایت سایدبار لایت نباید داشته باشه؟»
- **علت ریشه‌ای:** متغیرهای تم لایت به صورت پیش‌فرض سایدبار را با رنگ‌های تیره رندر می‌کردند.
- **راه‌حل:**
  - در `client/custom/modules/bidar-theme/css/bidar-tokens.css` برای حالت لایت:
    ```css
    :root[data-bidar-scheme="light"] {
        --bidar-sidebar-bg: #f8fafc;
        --bidar-sidebar-text: #334155;
        --bidar-sidebar-muted: #64748b;
        --bidar-sidebar-line: #e2e8f0;
        --bidar-sidebar-hover: #f1f5f9;
        --bidar-sidebar-active: #e0f2fe;
        --bidar-sidebar-strong: #0f172a;
        --bidar-sidebar-glow: none;
        --bidar-sidebar-logo-filter: none;
    }
    ```
  - در `apps/web/src/components/layout/Sidebar.tsx`:
    در حالت لایت از پس‌زمینه روشن `bg-slate-50 border-r border-slate-200 text-slate-700` با هایلایت فعال شیک استفاده شود تا با کل رابط کاربری هماهنگ گردد.

---

### ۱.۴. [THM-04] تفکیک کنتراست سایدبار و محتوای اصلی در تم دارک
- **شناسه:** `THM-DARK-01`
- **درخواست کاربر:** «نسخه دارک رنگ سایدبار با بقیه بخش‌ها خیلی نزدیک به همه. بررسی کن چه رنگی باشه بهتره.»
- **علت ریشه‌ای:** نسبت کنتراست لومینانس سایدبار (`#12152a`) با پس‌زمینه (`#0d0f1e`) کمتر از ۱.۱۵:۱ بود که باعث مسطح و نامشخص شدن مرزها می‌شد.
- **تصمیم بهینه طراحی (۳-Tier Depth):**
  - **سطح ۱ (Canvas / بدنه اصلی):** مشکی ملایم عمیق `#090d16`
  - **سطح ۲ (Sidebar / ناوبری ثابت):** سورمه‌ای غنی متالیک `#0f172a` به همراه خط جداکننده مشخص `1px solid rgba(255, 255, 255, 0.08)`
  - **سطح ۳ (Cards & Surfaces / پنل‌ها):** خاکستری تیره متمایز `#1e293b`
  این ساختار تفکیک بصری عالی و کامپوننت‌های برجسته مطابق با استانداردهای WCAG 2.1 ارائه می‌دهد.

---

### ۱.۵. [THM-05] جلوگیری از شکست چندخطی نشان‌های وضعیت (`white-space: nowrap`)
- **شناسه:** `THM-BADGE-01`
- **درخواست کاربر:** «جاهایی که badge نشون داده میشه مثل جدول سرنخ‌های فروش (Leads) ستون وضعیت، متن nowrap باشه و نشکند.»
- **راه‌حل:**
  - در `client/custom/modules/bidar-theme/css/bidar-data.css`:
    ```css
    .badge,
    .label,
    .bidar-badge,
    [class*="badge"],
    td[data-name="status"] span,
    td[data-name="stage"] span {
        white-space: nowrap !important;
        display: inline-flex;
        align-items: center;
    }
    ```
  - در کامپوننت‌های فرانت‌اند هدلس (`apps/web/src/features/leads/`, `KanbanColumn.tsx`, `ContactsTable.tsx`):
    افزودن کلاس `whitespace-nowrap shrink-0` به تمام نشان‌های وضعیت.

---

### ۱.۶. [THM-06] استانداردسازی فونت وزیرمتن در گزارش‌ها و جداول
- **شناسه:** `THM-FONT-01`
- **درخواست کاربر:** «مشکل فونت در url:reports کارت‌های بالای صفحه و ستون‌های جداول.»
- **راه‌حل:**
  - در `apps/web/src/pages/ReportsPage.tsx` و جداول داده:
    اطمینان از اعمال کلاس `font-vazirmatn` روی تمام هدرهای جدول (`th`)، سلول‌ها (`td`) و کارت‌های شاخص‌های کلیدی (KPIs).
    تبدیل تمام اعداد انگلیسی به ارقام فارسی از طریق `toPersianDigits()`.

---

### ۱.۷. [THM-07] ارتفاع کانتینر فیلتر گروه‌ها در `/app/contacts`
- **شناسه:** `THM-FILTER-01`
- **درخواست کاربر:** «بخش url:/app/contacts بخش فیلتر گروه: دیده نمیشه. ارتفاع container کم است.»
- **راه‌حل:**
  - در `apps/web/src/pages/ContactsPage.tsx` و کانتینر فیلترها:
    حذف هرگونه `overflow-hidden` سخت‌گیرانه یا ارتفاع ثابت؛ تنظیم `min-height: fit-content; overflow: visible; flex-wrap: wrap;` تا برچسب‌های گروه‌ها بدون بریده شدن کاملاً دیده شوند.

---

## ۲. برنامه اجرایی فاز قرمز و سبز (TDD Implementation)
1. **تست‌های واحد فرانت‌اند (Vitest):**
   - ایجاد/به‌روزرسانی تست‌ها در `apps/web/src/test/theme.test.ts` و `theme-tokens.test.ts` برای اعتبارسنجی توکن‌های سایدبار لایت، کنتراست دارک و `whitespace-nowrap` روی نشان‌ها.
2. **اعمال اصلاحات CSS و کامپوننت‌ها:**
   - ویرایش فایل‌های `bidar-rtl.css`, `bidar-login.css`, `bidar-tokens.css`, `bidar-dark.css`, `bidar-data.css`, `appearance.js` در قالب کلاسیک.
   - ویرایش `Sidebar.tsx`, `ContactsPage.tsx`, `ReportsPage.tsx` در فرانت‌اند هدلس.
3. **اعتبارسنجی:**
   - اجرای `npm --prefix apps/web run test:ci` (تضمین پاس شدن ۱۰۰٪ تست‌ها).
   - انتقال فایل‌ها به کانتینر Docker و اجرای `clear-cache`.
