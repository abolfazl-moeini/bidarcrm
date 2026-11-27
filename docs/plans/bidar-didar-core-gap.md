# تحلیل شکاف امکانات پایه CRM دیدار در برابر Bidar CRM و پلن پیاده‌سازی گام‌به‌گام

> **جایگاه در ترتیب پیاده‌سازی:** **مرحله ۳ (پس از مرحله ۱ وایت‌لیبل و مرحله ۲ ایرانی‌سازی بک‌اند)**  
> **مرجع نقشه راه کلان:** [docs/plans/README.md](file:///Users/moeini/Dev/didar/docs/plans/README.md)  
> **تداخل با ایجنت فرانت (`apps/web/`):**
> - در هر موج، **لایه‌های بک‌اند، متادیتا و تست PHPUnit (`extensions/bidar-sales/` و `extensions/bidar-iran/`)** کاملاً مستقل از `apps/web/` هستند و در **مرحله ۳** اجرا می‌شوند.
> - **لایه‌های رابط کاربری React (`apps/web/`)** برای جلوگیری از تداخل، با برچسب `[مرحله ۴ — UI]` مشخص شده‌اند تا پس از اتمام کار ایجنت فرانت متصل شوند.

این سند بر اساس مقایسه دقیق محیط واقعی دیدار با امکانات فعلی **Bidar CRM v1.0.1** (EspoCRM 10.1.4 + `extensions/bidar-sales/` + `extensions/bidar-iran/`) نوشته شده است.  
**محدوده:** صرفاً **امکانات پایه و روزمره CRM فروش** (بدون ورود به فاز ۲ مثل اتوماسیون پیچیده، تیکتینگ پیشرفته یا AI Chatbot).

---

## ۱. جدول تحلیل شکاف (Gap Analysis — وضعیت واقعی v1.0.1)

| # | امکان پایه در دیدار | وضعیت فعلی در Bidar CRM v1.0.1 | اولویت | پیچیدگی |
| :---: | :--- | :--- | :---: | :---: |
| ۱ | **دلایل شکست معامله (`lossReason`)** + مودال ثبت اجباری هنگام Closed Lost | ❌ ندارد (فیلد `lossReason` روی `Opportunity` تعریف نشده) | **P0** | خیلی کم |
| ۲ | **محصولات و اقلام سبک روی معامله** (انتخاب چند قلم + محاسبه خودکار جمع کل) | ❌ ندارد (نسخه پایه EspoCRM موجودیت Product/LineItem ندارد) | **P0** | متوسط |
| ۳ | **گزارش‌های پایه نشانگر** (نرخ تبدیل، سرعت تبدیل به روز، دلایل شکست، بهترین فروشندگان، شیوه آشنایی) | ⚠️ ناقص (`GET /api/v1/BidarDashboard/summary` فعلاً ۶ KPI پایه + `funnelStages` دارد) | **P0** | کم |
| ۴ | **دکمه «ذخیره به صورت فروش موفق»** در فرم افزودن معامله + افزودن سریع داخل ستون کاریز | ⚠️ در پروتوتایپ هست؛ در `DealCreateModal` باید اضافه شود | **P0** | خیلی کم |
| ۵ | **گروه‌بندی / برچسب مشتریان** (`customerGroups` روی اشخاص و شرکت‌ها) | ❌ ندارد | **P1** | خیلی کم |
| ۶ | **نمای پیش‌بینی فروش (Forecast View)** کنار کاریز و لیست (ستون‌های ماه‌های شمسی) | ❌ ندارد | **P1** | کم |
| ۷ | **هدف‌گذاری فروش ساده (`BidarGoal`)** — هدف ماهانه/هفتگی به تعداد یا مبلغ | ❌ ندارد | **P1** | متوسط |
| ۸ | **پین‌شده‌ها (Pinned Items)** در نوار بالا برای دسترسی سریع | ⚠️ بک‌اند ندارد (قابل ذخیره در `Preferences` کاربر + `localStorage`) | **P1** | خیلی کم |
| ۹ | **صندوق پیامک + قالب‌های آماده + پیامک گروهی به یک گروه مخاطب** | ⚠️ فقط `KavenegarSender` هست؛ قالب و تاریخچه ندارد | **P1** | متوسط |
| ۱۰ | **کانبان کارها / کارت‌ها (`Task Kanban`)** | ⚠️ در EspoCRM روی `Task` هست ولی در SPA پیاده نشده | **P2** | کم |
| ۱۱ | **تنظیمات ساده مدیر فروش (`/settings`)** در فرانت Headless | ⚠️ فقط در `/admin` فنی EspoCRM در دسترس است | **P2** | کم |
| ۱۲ | **فرم‌ساز ساده وب (Web-to-Lead Embed)** روی `LeadCapture` بومی | ⚠️ هسته `LeadCapture` موجود است؛ UI ساده ندارد | **P2** | کم |

---

## ۲. پلن اجرایی گام‌به‌گام (مبتنی بر معماری واقعی `v1.0.1`)

> **یادآوری معماری برای ایجنت:**
> - مسیرهای ماژول‌ها در مخزن بدون پوشه `src/` هستند: `extensions/bidar-sales/` و `extensions/bidar-iran/`.
> - روت واقعی داشبورد در `extensions/bidar-sales/Resources/routes.json` برابر **`GET /BidarDashboard/summary`** (با کلید `"actionClassName"`) است — هرگز روت قدیمی یا ناموجود `/BidarSales/action/dashboardSummary` را استفاده نکن.
> - برای بازه‌های ماه و فصل شمسی در گزارش‌ها از `Espo\Modules\BidarIran\Support\JalaliHelper` (ایجادشده در مرحله ۲) استفاده کن.

---

### موج ۱ — پایه‌های حیاتی فروش (P0)

#### گام `GAP-01`: افزودن «دلیل شکست معامله» (`lossReason` و `lossReasonNote`)
- **[مرحله ۳ — بک‌اند و متادیتا]:**
  - ویرایش `extensions/bidar-sales/Resources/metadata/entityDefs/Opportunity.json`:
    > **هشدار مهم ادغام (Anti-Pitfall):** این فایل همین الان دارای ۳ فیلد `lastActivityAt`، `isRotten` و `daysSinceLastActivity` است! هرگز کل فایل را بازنویسی نکن؛ دو فیلد زیر را **به داخل شیء `"fields"` موجود اضافه کن**:
    ```json
    "lossReason": {
      "type": "enum",
      "options": ["", "PriceTooHigh", "Competitor", "NoBudget", "NoResponse", "NotQualified", "Other"],
      "default": "",
      "audited": true
    },
    "lossReasonNote": {
      "type": "text",
      "rowsMin": 2
    }
    ```
  - افزودن ترجمه فارسی در `extensions/bidar-sales/Resources/i18n/fa_IR/Opportunity.json`:
    `PriceTooHigh` («قیمت بالا»)، `Competitor` («انتخاب رقیب»)، `NoBudget` («نبود بودجه»)، `NoResponse` («عدم پاسخگویی»)، `NotQualified` («نبود نیاز واقعی»)، `Other` («سایر»).
- **[مرحله ۴ — UI]:** هنگام انتقال معامله به `Closed Lost` یا کلیک «شکست معامله» در `KanbanPage` / `DealDetailPage`، مودال اجباری انتخاب `lossReason` (+ یادداشت اختیاری) باز شده و همراه `PATCH /api/v1/Opportunity/:id` ذخیره شود.
- **تست فوری:** بررسی JSON و تست واحد در `extensions/bidar-sales/tests/Unit/`.

#### گام `GAP-02`: محصولات و اقلام سبک معامله (`BidarProduct` و `BidarDealItem`)
- **[مرحله ۳ — بک‌اند و متادیتا]:**
  1. تعریف Scope و Entity برای **`BidarProduct`**:
     - `extensions/bidar-sales/Resources/metadata/scopes/BidarProduct.json` (`entity: true, object: true, tab: true, acl: true`)
     - `extensions/bidar-sales/Resources/metadata/entityDefs/BidarProduct.json`: فیلدهای `name` (varchar, required)، `sku` (varchar 64)، `unitPrice` (currency)، `category` (varchar 64)، `isActive` (bool, default `true`).
  2. تعریف Scope و Entity برای **`BidarDealItem`**:
     - `extensions/bidar-sales/Resources/metadata/scopes/BidarDealItem.json` (`entity: true, object: true, acl: true`)
     - `extensions/bidar-sales/Resources/metadata/entityDefs/BidarDealItem.json`: لینک `belongsTo` به `Opportunity` (`opportunity`) و `BidarProduct` (`product`) + فیلدهای `quantity` (float, default `1`)، `unitPrice` (currency)، `discountPercent` (float, default `0`)، `lineTotal` (currency).
  3. پیاده‌سازی Hook محاسبه خودکار با امضای رسمی EspoCRM 10.1.4:
     - `extensions/bidar-sales/Hooks/BidarDealItem/RecalculateOpportunityAmount.php`
     - پیاده‌سازی `Espo\Core\Hook\Hook\AfterSave` و `Espo\Core\Hook\Hook\AfterRemove`:
       - محاسبه `lineTotal = max(0, quantity * unitPrice * (1 - discountPercent / 100))`
       - جمع زدن کل اقلام مرتبط با `opportunityId` و ذخیره روی `Opportunity.amount` با `SaveOptions::default()->withSilent()->withSkipHooks()` (برای پیشگیری از حلقه بازگشتی!).
  4. افزودن تست واحد `extensions/bidar-sales/tests/Unit/DealItemCalculatorTest.php`.
- **[مرحله ۴ — UI]:** افزودن تب/بخش «محصولات معامله» در `DealDetailPage` و انتخاب چند قلم در `DealCreateModal`.
- **تست فوری:** `vendor/bin/phpunit -c extensions/phpunit.xml --filter DealItemCalculatorTest`

#### گام `GAP-03`: تکمیل گزارش‌های پایه در `DashboardSummaryService.php` روی مسیر `/api/v1/BidarDashboard/summary`
- **[مرحله ۳ — بک‌اند]:**
  - ویرایش `extensions/bidar-sales/Services/DashboardSummaryService.php` و `extensions/bidar-sales/Api/GetDashboardSummary.php`:
  - **حفظ کامل فیلدهای فعلی** (`openCount`, `openAmount`, `wonCount`, `wonAmount`, `rottenCount`, `overdueActivitiesCount`, `funnelStages`) جهت سازگاری عقب‌رو با تست‌های E2E و کلاینت.
  - **افزودن ۵ متریک جدید به خروجی JSON:**
    1. `conversionRate`: درصد `round((wonCount / max(1, wonCount + lostCount)) * 100, 1)` (اگر `wonCount + lostCount === 0` مقدار `0.0`).
    2. `avgSalesCycleDays`: میانگین تعداد روز از `createdAt` تا `closeDate` برای معاملات `Closed Won`.
    3. `lossReasonsBreakdown`: `[{ reason, label, count, amount }]` مرتب‌شده نزولی بر اساس `count`.
    4. `topSalesReps`: `[{ userId, userName, wonCount, wonAmount, openCount, rottenCount }]` مرتب‌شده نزولی بر اساس `wonAmount`.
    5. `leadSourceBreakdown`: `[{ source, count, wonCount, wonAmount }]`.
  - **پارامترهای فیلتر ورودی در `GetDashboardSummary::process(Request $request)`:**
    - `pipelineId` (موجود)، `assignedUserId`، `dateFrom`، `dateTo`، و پارامتر اختیاری `jalaliPeriod` (`current_month` | `last_month` | `current_quarter`) که با `JalaliHelper` به بازه میلادی تبدیل می‌شود.
  - گسترش `extensions/bidar-sales/tests/Unit/DashboardSummaryServiceTest.php`.
- **[مرحله ۴ — UI]:** نمایش کارت‌ها و جداول جدید در صفحه نشانگر/گزارش (`DashboardPage` / `ReportsPage`).
- **تست فوری:** `vendor/bin/phpunit -c extensions/phpunit.xml --filter DashboardSummaryServiceTest`

#### گام `GAP-04`: ثبت سریع فروش موفق در فرم معامله `[مرحله ۴ — UI]`
- در `apps/web/src/features/kanban/components/DealCreateModal.tsx`: افزودن دکمه ثانویه **«ذخیره به صورت فروش موفق»** که معامله را مستقیم با `stage: 'Closed Won'` و `probability: 100` روی `POST /api/v1/Opportunity` ثبت و کش‌های کانبان و نشانگر را باطل می‌کند.

---

### موج ۲ — تجربه کاربری روزمره تیم فروش (P1)

#### گام `GAP-05`: گروه‌بندی مشتریان (`customerGroups`)
- **[مرحله ۳ — متادیتا]:**
  - افزودن فیلد `customerGroups` (`type: "multiEnum"`) به:
    - `extensions/bidar-sales/Resources/metadata/entityDefs/Contact.json`
    - `extensions/bidar-sales/Resources/metadata/entityDefs/Account.json`
  - مقادیر پیش‌فرض: `["VIP", "Reseller", "Loyal", "Exhibition", "FirstPurchase"]` با ترجمه فارسی («VIP»، «نماینده»، «مشتری وفادار»، «نمایشگاه»، «خرید اول») در `i18n/fa_IR/`.
- **[مرحله ۴ — UI]:** نمایش Chip گروه در `ContactsPage` و `AccountsPage` + فیلتر سریع بر اساس گروه.

#### گام `GAP-06`: نمای «پیش‌بینی فروش» (Forecast View) `[مرحله ۴ — UI]`
- در `KanbanPage` (صفحه معاملات): افزودن تب سوم **«پیش‌بینی»** کنار «کاریز» و «لیست».
- **منطق خالص سمت فرانت (بدون نیاز به API جدید):** گروه‌بندی معاملات باز بر اساس ماه شمسی `closeDate` (با `getJalaliParts()` از `src/lib/jalali.ts`) در ۴ ستون: **ماه جاری**، **ماه آینده**، **۲ ماه آینده** و **بدون تاریخ بسته شدن**؛ نمایش «جمع کل مبلغ» و «جمع موزون (`amount * probability / 100`)» در هدر هر ستون.

#### گام `GAP-07`: هدف‌گذاری ساده فروش (`BidarGoal`)
- **[مرحله ۳ — بک‌اند و متادیتا]:**
  - تعریف Scope و Entity `BidarGoal` در `extensions/bidar-sales/Resources/metadata/`:
    - `name` (varchar, required)
    - `metricType` (`enum`: `wonAmount` | `wonCount` | `dealsCreated` | `activitiesHeld`)
    - `scopeType` (`enum`: `all` | `team` | `user`)
    - `assignedUserId` / `teamId` (لینک به `User` / `Team`)
    - `period` (`enum`: `daily` | `weekly` | `monthly`)
    - `dateStart` (date)، `dateEnd` (date)، `targetValue` (float, required)
  - افزودن متد محاسبه درصد تحقق (`calculateGoalProgress`) در `DashboardSummaryService.php` و تست واحد آن.
- **[مرحله ۴ — UI]:** ویجت نوار پیشرفت (Progress Bar) بالای صفحه نشانگر.

#### گام `GAP-08`: پین‌شده‌ها (Pinned Items) `[مرحله ۴ — UI]`
- دکمه سنجاق در هدر `DealDetailPage`، `ContactsPage` و `AccountsPage`.
- ذخیره حداکثر ۱۰ آیتم (`[{ entityType, id, name }]`) در `localStorage` (با کلید `bidar_pinned_items`) و همگام‌سازی اختیاری در تنظیمات کاربر، و نمایش در منوی کشویی نوار بالا.

#### گام `GAP-09`: تکمیل صندوق و قالب‌های پیامک در `extensions/bidar-iran/`
- **[مرحله ۳ — بک‌اند و متادیتا]:**
  1. تعریف موجودیت **`BidarSmsTemplate`**: `name` (varchar)، `body` (text با متغیرهای `{contactName}`, `{accountName}`, `{dealName}`), `isActive` (bool).
  2. تعریف موجودیت **`BidarSmsMessage`**: `phoneNumber` (varchar)، `body` (text)، `status` (`enum`: `sent`, `scheduled`, `failed`, `received`)، `providerMessageId` (varchar)، `contactId`، `opportunityId`، `scheduledAt` (datetime).
  3. ایجاد سرویس رندر قالب و ارسال گروهی: `extensions/bidar-iran/Services/SmsCampaignService.php` (استفاده از `IranPhoneNormalizer` و `KavenegarSender` موجود؛ جایگزینی امن متغیرها + ثبت لاگ در `BidarSmsMessage`).
  4. ثبت اکشن API در `extensions/bidar-iran/Resources/routes.json` (با کلید `"actionClassName"`):
     - `POST /BidarSms/send` $\rightarrow$ `Espo\Modules\BidarIran\Api\PostSendSms` (پیاده‌سازی `Espo\Core\Api\Action`).
  5. افزودن تست واحد `extensions/bidar-iran/tests/Unit/SmsCampaignServiceTest.php`.
- **[مرحله ۴ — UI]:** تکمیل مودال پیامک با شمارنده کاراکتر فارسی (۷۰ کاراکتر صفحه اول، ۶۷ کاراکتر صفحات بعدی)، انتخاب قالب آماده و ارسال به یک گروه مشتری.
- **تست فوری:** `vendor/bin/phpunit -c extensions/phpunit.xml --filter SmsCampaignServiceTest`

---

### موج ۳ — امکانات مکمل و خودکفایی مدیر فروش (P2)

#### گام `GAP-10`: کانبان کارها (`Task Kanban`)
- **[مرحله ۳ — متادیتا]:** فعال‌سازی `kanbanViewMode: true` و `kanbanStatusIgnoreList` در `extensions/bidar-sales/Resources/metadata/clientDefs/Task.json` روی وضعیت‌های `Not Started` / `Started` / `Completed`.
- **[مرحله ۴ — UI]:** نمای کانبان در صفحه `ActivitiesPage` با اتصال به `/api/v1/Kanban/Task`.

#### گام `GAP-11`: پنل تنظیمات ساده مدیر فروش (`/settings`) `[مرحله ۴ — UI]`
- صفحه `/settings` با ۴ تب برای مدیر فروش (بدون نیاز به ورود به منوهای پیچیده `/admin`):
  1. مدیریت دلایل شکست و شیوه‌های آشنایی
  2. CRUD محصولات و خدمات (`BidarProduct`)
  3. مدیریت گروه‌های مشتریان (`customerGroups`)
  4. مدیریت ساده کاربران و سطوح دسترسی

#### گام `GAP-12`: فرم‌ساز ساده جذب سرنخ (روی `LeadCapture` بومی) `[مرحله ۴ — UI]`
- اتصال به موجودیت بومی `LeadCapture` در EspoCRM و تولید کد Embed آماده (`<iframe>` / HTML) برای سایت مشتری جهت ثبت مستقیم در `/api/v1/Lead`.

---

## ۳. چک‌لیست پذیرش مرحله ۳ (بک‌اند) و مرحله ۴ (UI)

### پذیرش مرحله ۳ (بک‌اند — اجرا پیش از ادغام فرانت):
- [ ] `composer dump-autoload && vendor/bin/phpunit -c extensions/phpunit.xml` با ۱۰۰٪ تست سبز (شامل تست‌های جدید `DealItemCalculatorTest`, `DashboardSummaryServiceTest`, `SmsCampaignServiceTest`).
- [ ] تمام فایل‌های متادیتای JSON جدید (`Opportunity.json`, `BidarProduct.json`, `BidarDealItem.json`, `BidarGoal.json`, `BidarSmsTemplate.json`, `BidarSmsMessage.json`, `Contact.json`, `Account.json`) بدون خطای سینتکس هستند.
- [ ] `routes.json` فقط از `"actionClassName"` استفاده می‌کند و تمام اکشن‌ها و هوک‌ها اینترفیس رسمی EspoCRM 10.1.4 را پیاده‌سازی کرده‌اند.
- [ ] `bash scripts/build-release.sh && bash tests/installer/clean-install-smoke.sh dist/bidar-crm-v*.zip` بدون خطا پاس می‌شود.

### پذیرش مرحله ۴ (UI — پس از اتمام کار ایجنت فرانت):
- [ ] انتقال معامله به «شکست‌خورده» مودال اجباری دلیل شکست را باز می‌کند و آمار آن در گزارش نشانگر می‌نشیند.
- [ ] افزودن ۲ قلم محصول به معامله، مبلغ کل معامله را به‌صورت خودکار محاسبه و ذخیره می‌کند.
- [ ] صفحه نشانگر نرخ تبدیل (٪)، سرعت تبدیل (روز)، دلایل شکست، بهترین فروشندگان و نوار پیشرفت هدف ماهانه را نمایش می‌دهد.
- [ ] نمای «پیش‌بینی» معاملات باز را در ستون‌های ماه شمسی با جمع کل و جمع موزون نمایش می‌دهد.
- [ ] ارسال پیامک با قالب آماده و شمارنده کاراکتر فارسی روی `POST /api/v1/BidarSms/send` بدون خطا عمل می‌کند.
