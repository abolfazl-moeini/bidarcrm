# پلن جامع وایت‌لیبل کردن پروژه (White-Labeling) با برند پیش‌فرض `Bidar CRM`

> **جایگاه در ترتیب پیاده‌سازی:** **مرحله ۱ (اولویت اول — شروع فوری)**  
> **مرجع نقشه راه کلان:** [docs/plans/README.md](file:///Users/moeini/Dev/didar/docs/plans/README.md)  
> **تداخل با ایجنت فرانت (`apps/web/`):** گام‌های **WL-01 تا WL-06** کاملاً مستقل از `apps/web/` هستند و همین الان قابل اجرایند. فقط گام **WL-07** (اتصال `apps/web` به مانیفست برند) پس از اتمام کار ایجنت فرانت در مرحله ۴ اجرا می‌شود.

---

## ۱. هدف و تعریف معماری «وایت‌لیبل واقعی»

هدف این سند دوگانه است:
1. **وایت‌لیبل واقعی (Configurable White-Label Engine):** تمام مشخصات برند (نام، عنوان تب، لوگوهای روشن/تیره، فاوآیکون، رنگ اصلی، نام فرستنده ایمیل، لینک پشتیبانی و کپی‌رایت) از یک فایل مرکزی **`config/brand.config.json`** خوانده شوند تا پروژه با برند پیش‌فرض **`Bidar CRM` / `بیدار CRM`** عرضه شود و هر زمان بخواهید برای مشتری یا برند دیگری ری‌برند کنید، صرفاً با ویرایش همان یک فایل JSON و اجرای مجدد بیلد، کل سیستم (اینستالر، پنل `/admin`، ایمیل‌ها و فرانت Headless) با برند جدید تولید شود.
2. **حذف و مخفی‌سازی حداکثری نام و نشان CRM اصلی (EspoCRM) از دید کاربر:** در تمام صفحات روزمره (فرانت Headless، صفحه نصب `/install/`، صفحه ورود `/admin`، نوار کناری، عنوان تب مرورگر، فاوآیکون، ایمیل‌های خروجی، فوتر و اعلان‌های پنل مدیریت) هیچ نام، لوگو یا بنر تبلیغاتی از EspoCRM در چشم کاربر نباشد.

---

## ۲. چارچوب حقوقی و انطباق با مجوز AGPLv3 (مهم)

> [!WARNING]
> **الزام حقوقی بند 7(b) مجوز GNU AGPLv3 هسته EspoCRM:**
> هسته EspoCRM تحت مجوز `AGPL-3.0-or-later` با بند الحاقی Section 7(b) منتشر شده است که نگه‌داشتن ارجاع قانونی (Appropriate Legal Notice) و فایل `LICENSE.txt` را در کد منبع و اعلان حقوقی ایجاب می‌کند.
> **سیاست مهندسی بیدار برای انطباق کامل و هم‌زمان ظاهر ۱۰۰٪ وایت‌لیبل:**
> - **در تمام رابط‌های کاربری روزمره** (صفحه نصب، صفحه لاگین، هدر، سایدبار، فوتر صفحات کاری، عنوان تب مرورگر، فاوآیکون، ایمیل‌ها، گزارش‌ها و بنرهای آپدیت): ۱۰۰٪ برند **`Bidar CRM`** (یا برند تنظیم‌شده در `brand.config.json`) نمایش داده می‌شود و هیچ اثری از لوگو یا نام EspoCRM در دید کاربر قرار نمی‌گیرد.
> - **در لایه حقوقی و مخزن:** هدرهای لایسنس داخل فایل‌های PHP هسته (`engine/` و `application/Espo/`) و فایل `LICENSE.txt` هرگز حذف نمی‌شوند و یک یادداشت حقوقی محترمانه و غیرمزاحم در فایل `NOTICE.txt` ریشه (و بخش حقوقی مجوزها در صورت درخواست ممیزی) حفظ می‌شود.

---

## ۳. نقشه کامل نقاط حضور برند EspoCRM در پروژه (Audit Map)

بر اساس ممیزی مستقیم هسته `engine/` (EspoCRM 10.1.4)، نام یا لوگوی EspoCRM دقیقاً در **۵ لایه** ظاهر می‌شود:

| لایه | فایل‌ها / نقاط دقیق در EspoCRM 10.1.4 | آنچه کاربر می‌بیند | راهکار وایت‌لیبل |
| :---: | :--- | :--- | :--- |
| **۱. تنظیمات پایه** | `data/config.php` و اسکریپت `scripts/seed-sample-data.php` | `<title>EspoCRM</title>`، تب داشبورد `My Espo`، بنرهای نسخه جدید EspoCRM، نام فرستنده ایمیل | تنظیم خودکار از `brand.config.json` در زمان نصب و seed |
| **۲. ویزارد نصب (`/install/`)** | `install/core/i18n/{fa_IR,en_US}/install.json`، `install/core/tpl/{main,footer,finish}.tpl`، `public/install/img/start.png` | `EspoCRM Installation`، `به EspoCRM خوش آمدید`، `برو به EspoCRM`، فوتر `© EspoCRM, Inc.`، تصویر دستگاه‌ها با لوگوی Espo | پچ خودکار قالب‌ها و فایل‌های i18n اینستالر در `scripts/apply-whitelabel.php` |
| **۳. پنل `/admin` و متون UI** | `application/Espo/Resources/i18n/{fa_IR,en_US}/{Global,Admin,Settings,ScheduledJob}.json`، `client/res/templates/site/footer.tpl`، `client/res/templates/about.tpl`، منوهای `Admin/extensions` و `Admin/upgrade` | متون «ارتقا EspoCRM»، لینک `espocrm.com` در فوتر و کرون‌جاب، منوی فروشگاه اکستنشن‌ها، صفحه About | بازنویسی تمیز در `extensions/bidar-brand/Resources/i18n/` + مخفی‌سازی آیتم‌های خارجی در متادیتای `adminPanel.json` و CSS تم |
| **۴. فایل‌های هسته و دارایی‌های استاتیک** | `html/main.html` (خطوط ۵۸–۶۰)، `client/img/{favicon.ico,favicon.svg,logo.svg,logo-light.svg,logo-dark.svg}`، هدرهای HTTP در `.htaccess` / NGINX | فوتر هاردکد `EspoCRM, Inc.` در پوسته اصلی، فاوآیکون و لوگوی پیش‌فرض در کسری از ثانیه اول لود، هدر `X-Powered-By` | جایگزینی خودکار در `scripts/apply-whitelabel.php` (فراخوانی‌شده داخل `scripts/build-release.sh`) با کپی از `assets/brand/` |
| **۵. فرانت Headless (`apps/web/`)** | `apps/web/index.html`، `apps/web/public/brand/`، `LoginPage.tsx`، `Sidebar.tsx`، `AppShell.tsx` | عنوان، لوگو، کپی‌رایت و رنگ برند در فرانت | خواندن از `brand.config.json` (اجرا در **مرحله ۴**) |

---

## ۴. مانیفست مرکزی وایت‌لیبل (`config/brand.config.json`)

### گام `WL-01`: ایجاد فایل `config/brand.config.json`

این فایل منبع واحد حقیقت (Single Source of Truth) برای تمام پروژه است. مقادیر پیش‌فرض آن روی **Bidar CRM** تنظیم می‌شود:

```json
{
  "brandId": "bidar",
  "name": "Bidar CRM",
  "nameFa": "بیدار CRM",
  "shortName": "بیدار",
  "taglineFa": "سامانه هوشمند مدیریت فروش و ارتباط با مشتری",
  "taglineEn": "Sales & Customer Relationship Management",
  "websiteUrl": "https://bidarcrm.ir",
  "supportUrl": "https://bidarcrm.ir/support",
  "supportEmail": "support@bidarcrm.ir",
  "outboundEmailFromName": "بیدار CRM",
  "copyrightFa": "تمامی حقوق محفوظ است © ۱۴۰۵ بیدار CRM",
  "copyrightEn": "© 2026 Bidar CRM. All rights reserved.",
  "defaultDashboardTabName": "نشانگر من",
  "assets": {
    "logoLight": "assets/brand/bidar-logo.svg",
    "logoDark": "assets/brand/bidar-logo-dark.svg",
    "faviconSvg": "assets/brand/bidar-favicon.svg"
  },
  "colors": {
    "primary": "#0F766E",
    "primaryHover": "#115E59",
    "shellRail": "#0F172A",
    "shellTopbar": "#111827"
  },
  "adminHideExternalItems": [
    "extensions",
    "upgrade",
    "about"
  ],
  "disableUpstreamNotifications": true
}
```

> **نکته کلیدی:** فایل‌های `assets/brand/bidar-logo.svg`، `assets/brand/bidar-logo-dark.svg` و `assets/brand/bidar-favicon.svg` همین الان در مخزن وجود دارند.

---

## ۵. وظایف اتمی پیاده‌سازی (قابل اجرا توسط هر ایجنت بدون ابهام)

### گام `WL-02`: ایجاد ماژول سبک `extensions/bidar-brand/` (لایه امن در برابر آپدیت)

به‌جای دستکاری فایل‌های ترجمه هسته `application/Espo/Resources/i18n/`، تمام Overrideهای متادیتا و ترجمه در یک ماژول مستقل `BidarBrand` (بدون پوشه `src/` مطابق PSR-4) قرار می‌گیرند:

1. **فایل `extensions/bidar-brand/manifest.json`:**
   ```json
   {
     "name": "BidarBrand",
     "version": "1.1.0",
     "acceptableVersions": [">=10.1.0"],
     "php": [">=8.3"]
   }
   ```
2. **فایل `extensions/bidar-brand/Resources/module.json`:**
   ```json
   {
     "order": 90
   }
   ```
   *(مقدار `order: 90` تضمین می‌کند ترجمه‌ها و تنظیمات این ماژول بر ماژول‌های هسته و `BidarSales` اولویت داشته باشند).*
3. **بازنویسی ترجمه‌های فارسی (`extensions/bidar-brand/Resources/i18n/fa_IR/`):**
   - `Global.json`: جایگزینی کلیدهای شامل `Espo` یا `EspoCRM` (مانند عنوان داشبورد، منوی کاربری و صفحه About) با `بیدار CRM`.
   - `Admin.json`: بازنویسی کلیدهای `upgradeBackup`, `newVersionIsAvailable`, `upgrade`, `cronIsNotConfigured`, `systemRequirements` (حذف تمام لینک‌های `https://www.espocrm.com/documentation/...` و جایگزینی با راهنمای محلی بیدار).
   - `Settings.json`: بازنویسی `ldapCreateEspoUser`, `adminNotificationsNewVersion`, `b2cMode`, `ldapUsername`, `ldapBaseDn`, `ldapUserLoginFilter` (حذف تمام اشارات به `EspoCRM`).
   - `ScheduledJob.json`: بازنویسی متن راهنمای کرون‌جاب (`linux`, `mac`, `windows`) با نام `Bidar CRM`.
4. **بازنویسی ترجمه‌های انگلیسی (`extensions/bidar-brand/Resources/i18n/en_US/`):**
   - معادل همین ۴ فایل (`Global.json`, `Admin.json`, `Settings.json`, `ScheduledJob.json`) با نام `Bidar CRM` تا اگر ادمین زبان را به انگلیسی تغییر داد باز هم نام CRM اصلی ظاهر نشود.
5. **مخفی‌سازی منوهای خارجی پنل ادمین (`extensions/bidar-brand/Resources/metadata/app/adminPanel.json`):**
   - استفاده از دستور `__UNSET__` یا تنظیم `"hidden": true` برای آیتم‌های بیرونی (`extensions`, `upgrade`) و حذف لینک‌های خارجی فروشگاه اکستنشن‌ها.
6. **تنظیمات پیش‌فرض سیستمی (`extensions/bidar-brand/Resources/metadata/app/config.json` یا `defaults`):**
   - پیش‌فرض `applicationName: "بیدار CRM"`، `outboundEmailFromName: "بیدار CRM"`، `adminNotificationsNewVersion: false`، `adminNotificationsNewExtensionVersion: false`، `adminNotificationsCronIsNotConfigured: true` (با متن بیدار).

---

### گام `WL-03`: ساخت اسکریپت خودکار وایت‌لیبل (`scripts/apply-whitelabel.php`)

چون چند فایل معدود در هسته EspoCRM (مانند `html/main.html`، ویزارد `/install/` و `client/img/`) از سیستم `custom/` قابل Override کامل نیستند، یک اسکریپت PHP تکرارپذیر (Idempotent) در **`scripts/apply-whitelabel.php`** نوشته می‌شود که یک مسیر هدف (`--target=/path/to/build`) و فایل برند (`--brand=config/brand.config.json`) را می‌گیرد و تغییرات زیر را به‌صورت امن و بدون خطا اعمال می‌کند:

1. **فوتر پوسته اصلی (`<target>/html/main.html`):**
   - جایگزینی بلوک:
     ```html
     <a href="https://www.espocrm.com" title="Powered by EspoCRM" rel="noopener" target="_blank">EspoCRM, Inc.</a>
     ```
     با فوتر خوانده‌شده از `brand.config.json` (`copyrightFa` / `websiteUrl` / `nameFa`).
2. **فوتر ویو سمت کلاینت (`<target>/client/res/templates/site/footer.tpl`):**
   - جایگزینی دقیقاً مشابه `html/main.html` با برند `brand.config.json`.
3. **صفحه About (`<target>/client/res/templates/about.tpl`):**
   - نمایش نام برند (`Bidar CRM`)، شماره نسخه پروژه و حذف متن/لینک‌های تبلیغاتی خارجی.
4. **ویزارد نصب (`/install/`) — رفع کامل نمایش `EspoCRM Installation`:**
   - `<target>/install/core/tpl/footer.tpl`: جایگزینی `<a href="https://www.espocrm.com">EspoCRM, Inc.</a>` با برند `brand.config.json`.
   - `<target>/install/core/tpl/main.tpl`: جایگزینی `alt="EspoCRM"` با `alt="Bidar CRM"` و جایگزینی تصویر `public/install/img/start.png` با تصویر/لوگوی تمیز برند بیدار (یا حذف تصویر قدیمی دارای لوگوی Espo).
   - `<target>/install/core/i18n/fa_IR/install.json` و `en_US/install.json`:
     - `"headerTitle"`: `"نصب بیدار CRM"` / `"Bidar CRM Installation"`
     - `"Main page title"`: `"به بیدار CRM خوش آمدید"` / `"Welcome to Bidar CRM"`
     - `"Congratulation! Welcome to EspoCRM"`: `"تبریک! بیدار CRM با موفقیت نصب شد."`
     - `"Go to EspoCRM"`: `"ورود به بیدار CRM"`
     - جایگزینی تمام کلیدهای خطا (`phpVersion`, `requiredMysqlVersion`, `apache`, `nginx`, `share`) که حاوی نام `EspoCRM` یا لینک `espocrm.com` هستند.
   - `<target>/install/core/tpl/index.tpl`: افزودن `dir="rtl"` شرطی برای زبان فارسی (`fa_IR`) و بارگذاری فاوآیکون برند.
5. **دارایی‌های تصویری ریشه (`<target>/client/img/`):**
   - کپی `assets/brand/bidar-logo.svg` به `client/img/logo.svg` و `client/img/logo-light.svg`.
   - کپی `assets/brand/bidar-logo-dark.svg` به `client/img/logo-dark.svg`.
   - کپی `assets/brand/bidar-favicon.svg` به `client/img/favicon.svg` و تولید/کپی `client/img/favicon.ico` و `client/img/favicon192x192.png` (تا حتی پیش از لود CSS تم، لوگوی EspoCRM چشمک نزند!).
6. **تزریق پیش‌فرض‌های نصب وب (`<target>/application/Espo/Resources/defaults/config.php`):**
   - وقتی کاربر روی هاست اشتراکی از طریق مرورگر وارد `/install/` می‌شود، EspoCRM فایل `data/config.php` را از روی `application/Espo/Resources/defaults/config.php` می‌سازد. اسکریپت `apply-whitelabel.php` باید مقادیر پیش‌فرض زیر را مستقیم در `defaults/config.php` بسته نهایی تنظیم کند تا نصب وب بدون نیاز به اجرای هیچ اسکریپت CLI، از لحظه اول ۱۰۰٪ وایت‌لیبل و ایرانی بالا بیاید:
     - `'applicationName' => $brand['nameFa']` (`'بیدار CRM'`)
     - `'outboundEmailFromName' => $brand['outboundEmailFromName']`
     - `'theme' => 'Bidar'`، `'language' => 'fa_IR'`، `'timeZone' => 'Asia/Tehran'`، `'weekStart' => 6`
     - `'currencyList' => ['IRT', 'IRR']`، `'defaultCurrency' => 'IRT'`، `'baseCurrency' => 'IRT'`، `'currencyDecimalPlaces' => 0`
     - `'adminNotificationsNewVersion' => false`، `'adminNotificationsNewExtensionVersion' => false`
7. **تولید فایل `NOTICE.txt` (انطباق حقوقی AGPLv3):**
   - درج اطلاعیه استاندارد منبع‌باز در `NOTICE.txt` ریشه بسته (خارج از دید روزمره UI، حفظ کامل انطباق حقوقی).

---

### گام `WL-04`: پاکسازی هدرهای HTTP و امضای سرور در قالب‌های `deploy/`

در فایل‌های زیر، افشای امضای فناوری یا هدرهای غیرضروری حذف شود (بدون دست زدن به قوانین حیاتی `^client/ - [L]` و `^install$`):
1. **`deploy/htaccess.template` و `deploy/public-htaccess.template`:**
   ```apache
   <IfModule mod_headers.c>
       Header unset X-Powered-By
       Header always unset X-Powered-By
   </IfModule>
   ```
2. **`deploy/nginx.conf.template`:**
   - افزودن `fastcgi_hide_header X-Powered-By;` در بلوک PHP-FPM.

---

### گام `WL-05`: تنظیمات پیش‌فرض نصب و اسکریپت `scripts/seed-sample-data.php`

در اسکریپت‌های پیکربندی اولیه و نصب تازه (`scripts/seed-sample-data.php` و فایل راهنمای `data/config.php`):
- مقداردهی خودکار کلیدهای زیر از `config/brand.config.json`:
  ```php
  'applicationName' => 'بیدار CRM',
  'outboundEmailFromName' => 'بیدار CRM',
  'adminNotificationsNewVersion' => false,
  'adminNotificationsNewExtensionVersion' => false,
  'dashboardLayout' => [
      (object) [
          'name' => 'نشانگر من',
          'layout' => [],
      ],
  ],
  ```

---

### گام `WL-06`: اتصال به پایپ‌لاین بسته‌بندی (`scripts/build-release.sh`) و Smoke Test

1. **در `scripts/build-release.sh`:**
   - افزودن `bidar-brand` به حلقه بسته‌بندی ماژول‌ها (`for mod_slug in bidar-sales bidar-iran bidar-brand;`).
   - فراخوانی خودکار اسکریپت وایت‌لیبل پیش از ساخت ZIP:
     ```bash
     echo "==> Applying White-Label branding from config/brand.config.json..."
     php "${ROOT_DIR}/scripts/apply-whitelabel.php" \
       --target="${BUILD_DIR}" \
       --brand="${ROOT_DIR}/config/brand.config.json"
     ```
2. **در `tests/installer/clean-install-smoke.sh`:**
   - افزودن گیت خودکار **White-Label Verification Gate**:
     - بررسی عدم وجود رشته `EspoCRM, Inc.` در `html/main.html`، `client/res/templates/site/footer.tpl` و `install/core/tpl/footer.tpl`.
     - بررسی عدم وجود `"EspoCRM Installation"` در `install/core/i18n/fa_IR/install.json` و `en_US/install.json`.
     - بررسی وجود فایل `custom/Espo/Modules/BidarBrand/manifest.json` و مطابقت `client/img/logo-light.svg` با `assets/brand/bidar-logo.svg`.

---

### گام `WL-07`: اتصال فرانت Headless (`apps/web/`) به `brand.config.json` *(اجرا در مرحله ۴ — پس از اتمام کار ایجنت فرانت)*

> [!NOTE]
> این گام به دلیل فعالیت هم‌زمان ایجنت فرانت در `apps/web/`، در **مرحله ۴** اجرا می‌شود.

1. افزودن پلاگین سبک Vite یا خواندن مستقیم `config/brand.config.json` در `apps/web/vite.config.ts` و تزریق `VITE_BRAND_NAME`, `VITE_BRAND_NAME_FA`, `VITE_BRAND_COPYRIGHT_FA` در زمان بیلد.
2. ساخت ماژول واحد `apps/web/src/lib/brand.ts` که همه کامپوننت‌ها (`LoginPage`, `Sidebar`, `AppShell`, `index.html`) نام برند، لوگو و کپی‌رایت را منحصراً از آن بخوانند (صفر رشته هاردکدشده).
3. کپی خودکار دارایی‌های `assets/brand/*` به `apps/web/public/brand/` هنگام بیلد (فایل‌های `apps/web/public/brand/bidar-*.svg` همین الان کپی شده‌اند و باید با `assets/brand/` همگام بمانند).
4. **پاکسازی نام توکن‌های `didar.*` از Tailwind و کامپوننت‌ها (Clean-Room & White-Label Gate):**
   - در `apps/web/tailwind.config.js` و کامپوننت‌های `apps/web/src/`، کلید رنگی `colors.didar` (`bg-didar-rail`, `bg-didar-topbar`, `bg-didar-green` و ...) باید به نام خنثی و وایت‌لیبل **`colors.bidar`** (یا متغیرهای CSS `--bidar-*`) تغییر نام یابد تا هیچ نام تجاری خارجی در باندل نهایی JS/CSS وجود نداشته باشد.
   - گیت تست: `grep -rn -i "didar" apps/web/src/ apps/web/tailwind.config.js` باید صفر نتیجه برگرداند.

---

## ۶. چک‌لیست پذیرش و تست خودکار وایت‌لیبل (QA Gates)

پیش از اعلام اتمام مرحله ۱، همه دستورها و معیارهای زیر باید ۱۰۰٪ سبز شوند:

```bash
# ۱. تست واحد اسکریپت وایت‌لیبل و ماژول BidarBrand
vendor/bin/phpunit -c extensions/phpunit.xml

# ۲. بیلد بسته نهایی با تزریق خودکار brand.config.json
bash scripts/build-release.sh

# ۳. تایید ساختار ZIP و اسموک‌تست شامل گیت‌های وایت‌لیبل
bash tests/installer/verify-zip-structure.sh dist/bidar-crm-v*.zip
bash tests/installer/clean-install-smoke.sh dist/bidar-crm-v*.zip
```

- [ ] باز کردن `/install/` در مرورگر عنوان «نصب بیدار CRM» و «به بیدار CRM خوش آمدید» را بدون هیچ نام یا لوگوی EspoCRM نمایش می‌دهد.
- [ ] باز کردن `/admin` عنوان تب «بیدار CRM»، فاوآیکون بیدار، لوگوی بیدار و فوتر بیدار دارد و هیچ بنر «نسخه جدید EspoCRM» یا منوی فروشگاه اکستنشن نمایش داده نمی‌شود.
- [ ] ایمیل‌های تست ارسال‌شده از سیستم نام فرستنده «بیدار CRM» دارند و لینک `espocrm.com` در فوتر آن‌ها وجود ندارد.
- [ ] با تغییر مقدار `nameFa` در `config/brand.config.json` به یک برند تستی (مثلاً «سامانه آلفا») و اجرای مجدد `scripts/build-release.sh`، کل بسته تولیدی بدون تغییر حتی یک خط کد PHP/HTML به نام جدید درمی‌آید.
- [ ] فایل `LICENSE.txt` و `NOTICE.txt` برای رعایت کامل مجوز AGPLv3 در ریشه بسته حفظ شده‌اند.
