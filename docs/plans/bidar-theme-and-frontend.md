# پلن توسعه تم `BidarTheme` (بر پایه Lucid) و نهایی‌سازی فرانت Headless React (`apps/web/`)

> **جایگاه در ترتیب پیاده‌سازی:** **مرحله ۴ — آخرین مرحله (اجرا پس از تکمیل مراحل ۱ تا ۳ و اتمام کار ایجنت در حال تبدیل نسخه استاتیک به React در `apps/web/`)**  
> **مرجع نقشه راه کلان:** [docs/plans/README.md](file:///Users/moeini/Dev/didar/docs/plans/README.md)  
> **وابستگی به وایت‌لیبل:** تمامی جزئیات حذف/جایگزینی برند و لوگوی EspoCRM از `/install/`، `/admin/`، ایمیل‌ها و `config/brand.config.json` در پلن مستقل [docs/plans/bidar-whitelabel.md](file:///Users/moeini/Dev/didar/docs/plans/bidar-whitelabel.md) (مرحله ۱) تعریف شده و این سند مکمل آن در لایه تم و رابط کاربری است.

---

## ۱. سیستم طراحی واحد بیدار (Unified RTL Design System — Light & Dark)

برای یکپارچگی بصری کامل میان فرانت Headless (`/`) و پنل مدیریت (`/admin`)، هر دو لایه از یک مجموعه Design Token مشترک (هم‌تراز با `docs/prototype/assets/styles.css` و موتور `apps/web/src/lib/theme.ts` با پشتیبانی حالت روشن و تیره) استفاده می‌کنند:

| توکن CSS | مقدار حالت روشن (پیش‌فرض پروتوتایپ) | کاربرد |
| :--- | :--- | :--- |
| `--shell-rail` | `#0F172A` | نوار کناری تیره در سمت راست (`56px` بسته / `216px` باز) |
| `--shell-topbar` | `#111827` | نوار بالایی جستجوی سراسری (`48px`) و ابزارهای سریع |
| `--primary` / `--primary-hover` | `#0F766E` / `#115E59` | رنگ اصلی برند بیدار (نفتی-فیروزه‌ای تیره؛ Clean-Room متمایز از سبز دیدار) |
| `--bg-canvas` / `--bg-surface` | `#F4F6F8` / `#FFFFFF` | پس‌زمینه بوم صفحه و سطح کارت‌ها/جداول/مودال‌ها |
| `--border` / `--border-strong` | `#E2E8F0` / `#CBD5E1` | حاشیه‌های ۱ پیکسل تمیز |
| `--success` / `--warning` / `--danger` | `#15803D` / `#B45309` / `#B91C1C` | فروش موفق / پیگیری امروز / معامله راکد و عقب‌افتاده |

### الزامات سخت‌گیرانه فونت لوکال وزیرمتن و RTL
- **حذف کامل وابستگی به CDN/Google Fonts:** فایل‌های `Vazirmatn-Variable.woff2` (یا وزن‌های `300..700`) به‌صورت محلی در مخزن ذخیره می‌شوند تا در شبکه داخلی و اینترنت ایران ۱۰۰٪ آفلاین و بدون تاخیر لود شوند:
  - تم پنل `/admin`: `client/custom/modules/bidar-theme/fonts/vazirmatn/`
  - فرانت Headless: `apps/web/public/fonts/vazirmatn/` (منتقل‌شونده به `public/app/fonts/vazirmatn/` در بیلد)
- **جهت‌دهی و تایپوگرافی فارسی:** `dir="rtl"` و `lang="fa"` روی `<html>`، اعمال `font-variant-numeric: tabular-nums` روی مبالغ و KPIها، و `dir="ltr"; text-align: right` برای شماره موبایل، تلفن ثابت، ایمیل و کدهای انگلیسی.
- **سازگاری با موتور Light/Dark فعلی `apps/web/`:** فایل `apps/web/src/lib/theme.ts` همین الان حالت روشن و تیره را با کلید `bidar_theme` در `localStorage` و کلاس `.dark` روی `<html>` مدیریت می‌کند؛ تمام توکن‌های رنگی جدید باید هر دو حالت روشن (`:root`) و تیره (`.dark`) را پوشش دهند.

---

## ۲. فاز ۴-الف — توسعه تم `BidarTheme` روی EspoCRM `/admin` بر پایه `espocrm-lucid-theme` (v0.22.2)

### ۲.۱. کلون مخزن مرجع و بررسی ساختار واقعی Lucid v0.22.2

```bash
cd /Users/moeini/Dev/bidar-crm
git clone https://github.com/AlexisSantin/espocrm-lucid-theme.git bidar-theme-src
cd bidar-theme-src
npm install
```

مخزن واقعی `espocrm-lucid-theme` (نسخه `0.22.2`) با ابزار رسمی **`espo-extension-tools`** ساخته می‌شود (`build.js`: `import {buildGeneral} from 'espo-extension-tools'; buildGeneral();`) و دارای دو ویژگی حیاتی است که در `BidarTheme` عیناً حفظ و بومی‌سازی می‌شوند:
1. پشتیبانی بومی از نمای دو ستونه Split (مشخصات رکورد + تایم‌لاین تعاملات) و نمای Classic.
2. پشتیبانی بومی از حالت روشن و تیره (`lucidDark` ← تغییر نام به `bidarDark`) و تغییر چگالی (Density).

### ۲.۲. ساختار هدف ماژول `BidarTheme` در مخزن `/Users/moeini/Dev/didar`

تمامی شناسه‌ها (`LucidTheme` ← `BidarTheme`، `lucid-theme` ← `bidar-theme`، `--lucid-*` ← `--bidar-*`، `lucidStyle` ← `bidarStyle`) ریفکتور و در مسیرهای استاندارد مخزن قرار می‌گیرند:

1. **سمت سرور (متادیتا و ترجمه در `extensions/bidar-theme/`):**
   - `extensions/bidar-theme/manifest.json` (`"name": "BidarTheme"`, `"acceptableVersions": [">=10.1.0"]`, `"php": [">=8.3"]`)
   - `extensions/bidar-theme/Resources/module.json`:
     ```json
     {
       "order": 60,
       "bundled": true,
       "jsTranspiled": true
     }
     ```
     *(کلیدهای `bundled: true` و `jsTranspiled: true` برای بارگذاری ES Moduleها در حالت Production هسته EspoCRM 10.1.4 الزامی‌اند).*
   - `extensions/bidar-theme/Resources/metadata/themes/Bidar.json`:
     - کلید `"stylesheet": "client/custom/modules/bidar-theme/css/bidar.css"`
     - کلید `"stylesheetIframe": "client/custom/modules/bidar-theme/css/bidar-iframe.css"`
     - کلید `"logo": "client/custom/modules/bidar-theme/img/bidar-logo.svg"`
     - تعریف صریح پارامتر جهت با پیش‌فرض RTL (در Lucid اصلی وجود ندارد و باید اضافه شود!):
       ```json
       "params": {
         "navbar": { "type": "enum", "default": "side", "options": ["side", "top"] },
         "direction": { "type": "enum", "default": "rtl", "options": ["rtl", "ltr"] }
       }
       ```
     - حفظ بلوک حالت تیره (`bidarDark` با `isDark: true` و `bidar-iframe-dark.css`).
   - `extensions/bidar-theme/Resources/metadata/app/client.json`:
     ```json
     {
       "scriptList": [
         "__APPEND__",
         "client/custom/modules/bidar-theme/js/appearance.js",
         "client/custom/modules/bidar-theme/lib/init.js",
         "client/custom/modules/bidar-theme/js/nav-groups.js"
       ],
       "developerModeScriptList": [
         "__APPEND__",
         "client/custom/modules/bidar-theme/js/appearance.js",
         "client/custom/modules/bidar-theme/js/nav-groups.js"
       ]
     }
     ```
   - `extensions/bidar-theme/Resources/metadata/clientDefs/Global.json`:
     ```json
     {
       "viewSetupHandlers": {
         "record/detail": ["__APPEND__", "bidar-theme:handlers/record-detail"],
         "list": ["__APPEND__", "bidar-theme:handlers/page-a11y"],
         "detail": ["__APPEND__", "bidar-theme:handlers/page-a11y"],
         "edit": ["__APPEND__", "bidar-theme:handlers/page-a11y"],
         "login": ["__APPEND__", "bidar-theme:handlers/page-a11y"]
       }
     }
     ```
   - `extensions/bidar-theme/Resources/metadata/entityDefs/{Preferences,Settings}.json` و `clientDefs/Settings.json` (نگاشت تنظیمات چگالی/حالت تیره/نمای Split به کلیدهای `bidar*`).
   - `extensions/bidar-theme/Resources/i18n/fa_IR/{Global,Settings}.json` (ترجمه کامل فارسی گزینه‌های تم و برچسب‌های «نمایش N فیلد خالی»، «اطلاعات رکورد»، «حالت روشن/تیره»).

2. **سمت کلاینت (`client/custom/modules/bidar-theme/`):**
   - `fonts/vazirmatn/Vazirmatn-Variable.woff2` (جایگزین کامل فونت‌های `Inter`, `Lexend`, `SpaceGrotesk` در Lucid)
   - `img/bidar-logo.svg`, `img/bidar-logo-dark.svg`, `img/bidar-favicon.svg` (کپی از `assets/brand/`)
   - لایه‌های CSS در `css/bidar.css` (معماری دقیق ۱۵ لایه‌ای Lucid + لایه RTL):
     - `@import "../../../../css/espo/light.css";`
     - `bidar-fonts.css` ← `@font-face` وزیرمتن
     - `bidar-tokens.css` ← توکن‌های رنگی بیدار (`--primary: #0F766E`, `--shell-rail: #0F172A`)
     - `bidar-espo-vars.css` ← نگاشت متغیرهای داخلی EspoCRM 10
     - `bidar-base.css`, `bidar-shell.css`, `bidar-controls.css`, `bidar-data.css`, `bidar-record.css`, `bidar-detail.css`, `bidar-overlays.css`, `bidar-login.css`
     - `bidar-dark.css`, `bidar-density.css`
     - **`bidar-rtl.css`** ← آخرین لایه برای تضمین اولویت اصلاحات راست‌چین
   - قالب‌ها: `res/templates/record/{detail,detail-classic,detail-content}.tpl`
   - ماژول‌های JS در `src/` (تطبیق‌یافته از Lucid): `bidar.js`, `handlers/{page-a11y,record-detail,user-interface}.js`, `helpers/{appearance,column-resizer,empty-fields,link-breaks,panel-collapse,record-band}.js`, `mixins/detail-bottom.js`, `views/navbar/appearance.js` + خروجی کامپایل‌شده `lib/init.js` و `lib/module-bidar-theme.js`.

### ۲.۳. اصلاحات جراحی دقیق برای RTL کردن کدهای JS و CSS مخزن Lucid

بر اساس بازبینی مستقیم کد منبع `espocrm-lucid-theme` v0.22.2، دقیقاً ۴ اصلاح جراحی لازم است:

1. **تغییر عرض ستون (`src/helpers/column-resizer.js`):**
   - کد فعلی Lucid در سازنده (`constructor`) دارد: `this.mirrored = isClassicLayout(view);`
   - اصلاح جراحی (یک خط با عملگر XOR):
     ```js
     const isRtl = document.documentElement.dir === 'rtl' || document.body.dataset.direction === 'rtl';
     this.mirrored = isClassicLayout(view) !== isRtl;
     ```
   - به این ترتیب در نمای Split فارسی، ستون «مشخصات رکورد» در **سمت راست** و ستون «تایم‌لاین» در **سمت چپ** قرار گرفته و کشیدن ماوس و کلیدهای `ArrowLeft` / `ArrowRight` دقیقاً در جهت طبیعی عمل می‌کنند.
2. **زبان و جهت سند (`src/handlers/page-a11y.js`):**
   - پس از `document.documentElement.lang = language.replace('_', '-');` اضافه شود:
     ```js
     const isRtlLang = /^(fa|ar|he|ur)/i.test(language);
     document.documentElement.dir = isRtlLang ? 'rtl' : 'ltr';
     ```
3. **نوار مراحل کاریز (`src/helpers/record-band.js` و `css/bidar-record.css`):**
   - اطمینان از جریان راست‌به‌چپ گام‌های Pipeline Stage و معکوس کردن جهت chevron/آیکون‌ها در `bidar-rtl.css`.
4. **مخفی‌سازی عناصر غیرلازم برند در `bidar-login.css` و `bidar-shell.css`:**
   - بازطراحی صفحه ورود `/admin` با لوگوی `bidar-logo.svg`، فونت وزیرمتن و هم‌راستا با قوانین [docs/plans/bidar-whitelabel.md](file:///Users/moeini/Dev/didar/docs/plans/bidar-whitelabel.md).

### ۲.۴. اتصال `BidarTheme` به بسته‌بندی (`scripts/build-release.sh`)

- افزودن `bidar-theme` به حلقه ماژول‌ها در `scripts/build-release.sh` (`extensions/bidar-theme/` $\rightarrow$ `custom/Espo/Modules/BidarTheme/`).
- کپی پوشه `client/custom/modules/bidar-theme/` (شامل باندل کامپایل‌شده `lib/init.js` و `lib/module-bidar-theme.js` و فونت وزیرمتن) به `${BUILD_DIR}/client/custom/modules/bidar-theme/`.
- افزودن گیت بررسی وجود `Bidar.json`، `bidar.css` و `Vazirmatn-Variable.woff2` در `tests/installer/clean-install-smoke.sh`.

---

## ۳. فاز ۴-ب — یکپارچه‌سازی و ارتقای فرانت Headless React (`apps/web/`)

> [!IMPORTANT]
> **وضعیت فعلی `apps/web/` (پس از آخرین تغییرات ایجنت فرانت) و دلتای باقی‌مانده برای مرحله ۴:**
> - **آنچه در `apps/web/` انجام شده است:**
>   1. موتور حالت روشن/تیره (`apps/web/src/lib/theme.ts` و `ThemeToggle.tsx` با `darkMode: 'class'` در `tailwind.config.js`).
>   2. کپی لوگوهای برند در `apps/web/public/brand/bidar-*.svg`.
>   3. بازطراحی پوسته `AppShell`, `Sidebar`, `KanbanBoard`, `DealDetailPage`, `ActivitiesPage`, `ContactsPage`, `AccountsPage`, `DashboardPage`, `LoginPage`.
> - **دلتای دقیق باقی‌مانده که در مرحله ۴ باید تکمیل شود:**
>   1. **باندل محلی فونت وزیرمتن (حذف CDN):** در حال حاضر `apps/web/index.html` فونت وزیرمتن را از `cdn.jsdelivr.net` لود می‌کند؛ باید فایل `Vazirmatn-Variable.woff2` در `apps/web/public/fonts/vazirmatn/` قرار گیرد و لینک CDN از `index.html` حذف شود.
>   2. **تغییر نام توکن `colors.didar` به `colors.bidar`:** در `apps/web/tailwind.config.js` و کامپوننت‌ها، پیشوند کلاس‌های `didar-*` باید به `bidar-*` تبدیل شود (`WL-07`).
>   3. **تکمیل ۳ نمای باقی‌مانده از پروتوتایپ `docs/prototype/`:**
>      - صفحه سرنخ‌ها (`LeadsPage.tsx` بر اساس `docs/prototype/leads.html` و مسیر `/leads`)
>      - صفحه گزارش‌های تحلیلی تکمیلی یا ادغام کامل در نشانگر (`ReportsPage.tsx` بر اساس `docs/prototype/reports.html` و مسیر `/reports`)
>      - مودال سراسری ارسال پیامک (`SmsModal.tsx` بر اساس `#smsModal` در `docs/prototype/index.html`)
>   4. **اتصال UI به قابلیت‌های مراحل ۲ و ۳:** مودال دلیل شکست (`GAP-01`)، جدول محصولات معامله (`GAP-02`)، نمای پیش‌بینی شمسی (`GAP-06`)، نوار هدف فروش (`GAP-07`)، پین‌شده‌ها (`GAP-08`) و تعطیلات رسمی تقویم (`IR-11`).

### ۳.۱. نگاشت دقیق صفحات به APIهای واقعی `Bidar CRM` (تصحیح‌شده نسبت به v1.0.1)

| صفحه مرجع در `docs/prototype/` | مسیر SPA در `apps/web/` | API واقعی EspoCRM + ماژول‌های بیدار | اتصالات مراحل ۱ تا ۳ |
| :--- | :--- | :--- | :--- |
| `index.html` (کاریز، لیست و پیش‌بینی) | `/` و `/deals` (و alias `/kanban`) | `GET /api/v1/Opportunity`، `GET /api/v1/PipelineStage`، `POST/PATCH /api/v1/Opportunity` | نشانگر `isRotten`، مودال اجباری `lossReason` (`GAP-01`)، دکمه «فروش موفق» (`GAP-04`)، نمای «پیش‌بینی» شمسی (`GAP-06`) |
| `deal-detail.html` | `/deals/:id` | `GET /api/v1/Opportunity/:id`، `GET /api/v1/Opportunity/:id/stream`، `POST /api/v1/{Note,Call,Meeting,Task}` | نوار مرحله تعاملی، محصولات معامله (`BidarDealItem` — `GAP-02`)، دکمه پین (`GAP-08`)، رفع فوری `isRotten` |
| `leads.html` | `/leads` | `GET/POST /api/v1/Lead`، `POST /api/v1/Lead/action/convert` | فیلتر وضعیت، تبدیل یک‌کلیکه سرنخ به معامله + شخص + شرکت |
| `activities.html` | `/activities` و `/calendar` | `GET/POST/PATCH /api/v1/{Task,Call,Meeting}` | تقویم شمسی شنبه-آغاز + تعطیلات ایران (`IR-09`, `IR-11`)، ورودی زبان طبیعی «فردا ساعت ۱۰»، کانبان کارها (`GAP-10`) |
| `contacts.html` | `/contacts` و `/accounts` | `GET/POST /api/v1/Contact`, `/Account` | برچسب گروه مشتری (`customerGroups` — `GAP-05`)، فیلدهای ایران (`nationalCode`/`nationalId` — `IR-06`)، دکمه تماس VoIP و پیامک |
| `reports.html` | `/dashboard` و `/reports` | **`GET /api/v1/BidarDashboard/summary`** *(روت واقعی v1.0.1)* | ۴ KPI پایه + نرخ تبدیل، سرعت فروش، دلایل شکست، بهترین فروشندگان (`GAP-03`)، نوار پیشرفت هدف (`BidarGoal` — `GAP-07`)، فیلتر ماه شمسی |
| تنظیمات فروش + ابزارهای سراسری | `/settings` و سراسری | **`POST /api/v1/BidarSms/send`** (`GAP-09`)، `GET /api/v1/GlobalSearch` | «بیداریاب» (`⌘K`) با نرمال‌سازی حروف عربی/فارسی (`IR-10`)، مودال پیامک با شمارنده کاراکتر و قالب آماده، تنظیمات مدیر فروش (`GAP-11`)، برندینگ از `brand.ts` (`WL-07`) |

### ۳.۲. استراتژی دوگانه خروجی استاتیک از React (Production Bundle + Optional Static HTML)

بر اساس نیاز پروژه، از سورس React واحد (`apps/web/`) دو خروجی شفاف و خودکار تولید می‌شود تا هرگز دو کدبیس جداگانه (HTML دستی + React) نگهداری نشود:

1. **خروجی اصلی پروداکشن هاست اشتراکی (`public/app/`):**
   - با اجرای `npm --prefix apps/web run build` تولید می‌شود.
   - شامل `index.html`، باندل‌های فشرده JS/CSS، فونت محلی وزیرمتن و لوگوهای `brand/*.svg` است.
   - ۱۰۰٪ فایل استاتیک بوده و در سرور مقصد (cPanel / DirectAdmin / Docker) **هیچ نیازی به Node.js ندارد**.
2. **خروجی اختیاری Static HTML Snapshot (در صورت نیاز به دمو آفلاین یا رفرنس `ui-level`):**
   - افزودن اسکریپت سبک `scripts/export-static-html.mjs` (با Playwright یا Vite preview) که صفحات رندرشده React (`/dashboard`, `/deals`, `/deals/:id`, `/leads`, `/contacts`, `/accounts`, `/activities`) را با داده‌های ماک به فایل‌های Static HTML مستقل در `tests/ui-level/refs/` (یا خروجی دمو) ذخیره کند.
   - مزیت: هر تغییری در کامپوننت‌های React بلافاصله در اسنپ‌شات‌های استاتیک و تست‌های رگرسیون بصری `ui-level` منعکس می‌شود.

---

## ۴. فاز ۴-ج — فعال‌سازی ریشه `/` روی Headless SPA در `.htaccess` (با حفظ فیکس اینستالر `v1.0.1`)

> [!CAUTION]
> **حفظ کامل فیکس حیاتی نسخه `v1.0.1`:**
> هنگام افزودن هدایت ریشه `/` به Headless SPA، قوانین **`RewriteRule ^client/ - [L]`** و **`RewriteRule ^install$ install/ [R=301,L]`** باید دقیقاً دست‌نخورده و بالاتر از قاعده ریشه باقی بمانند تا پنل `/admin` و ویزارد `/install/` هرگز بدون استایل یا دچار خطای `Unexpected token '<'` نشوند!

1. **در `deploy/htaccess.template` (بخش ۸ — پس از قوانین `/api/v1/`، `/client/`، `/install/`، `/admin/` و `/app/`):**
   ```apache
   # Route root "/" directly to Bidar Front-Office SPA (after /install, /admin, /client, /api/v1)
   RewriteRule ^$ public/app/index.html [L]

   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteCond %{REQUEST_FILENAME} !-d
   RewriteRule ^.*$ public/app/index.html [L]
   ```
2. **در `deploy/public-htaccess.template` (در حالت `DocumentRoot = public/`):**
   ```apache
   # Route root "/" directly to Bidar Front-Office SPA
   RewriteRule ^$ app/index.html [L]

   RewriteCond %{REQUEST_FILENAME} -f [OR]
   RewriteCond %{REQUEST_FILENAME} -d
   RewriteRule ^ - [L]

   RewriteRule ^.*$ app/index.html [L]
   ```
3. **در `deploy/nginx.conf.template`:**
   - تنظیم `location = / { try_files /app/index.html =404; }` در کنار حفظ `location /client/` و `location = /install { return 301 /install/; }`.

---

## ۵. چک‌لیست پذیرش نهایی مرحله ۴ و انتشار (Release QA Gates)

```bash
# ۱. تست‌های واحد و تایپ فرانت + بیلد استاتیک
npm --prefix apps/web run test:ci
npm --prefix apps/web run build

# ۲. تست‌های واحد بک‌اند PHP
composer dump-autoload
vendor/bin/phpunit -c extensions/phpunit.xml

# ۳. تست‌های E2E و رگرسیون بصری
npm --prefix packages/e2e run test:all
node tests/ui-level/run-ui-checks.mjs --profile all --dry-run

# ۴. تولید و راستی‌آزمایی بسته نهایی هاست اشتراکی
bash scripts/build-release.sh
bash tests/installer/verify-zip-structure.sh dist/bidar-crm-v*.zip
bash tests/installer/clean-install-smoke.sh dist/bidar-crm-v*.zip
```

- [ ] باز کردن دامنه اصلی (`/`) مستقیم فرانت Headless بیدار (React بیلدشده در `public/app/`) را با فونت **وزیرمتن لوکال**، چیدمان **RTL** و سوییچر روشن/تیره نمایش می‌دهد.
- [ ] باز کردن `/admin` پنل مدیریت را با تم **`Bidar`** (بر پایه Lucid v0.22.2، RTL، نمای Split با ستون مشخصات در راست و تایم‌لاین در چپ، بدون خطای تغییر عرض ستون) بارگذاری می‌کند.
- [ ] باز کردن `/install/` همچنان استایل کامل `/client/css/espo/espo.css` و اسکریپت‌های `/client/lib/espo.js` را با HTTP 200 دریافت می‌کند و تمام عناوین آن با برند `Bidar CRM` از مرحله ۱ همگام است.
- [ ] در حالت آفلاین (قطع دسترسی به Google Fonts و CDN)، فونت وزیرمتن در هر دو لایه بدون خطا لود می‌شود.
- [ ] هیچ خطای ۴۰۴ یا کنسول در مرورگر وجود ندارد و تمامی گیت‌های وایت‌لیبل، ایرانی‌سازی و شکاف دیدار (مراحل ۱ تا ۴) ۱۰۰٪ سبز هستند.
