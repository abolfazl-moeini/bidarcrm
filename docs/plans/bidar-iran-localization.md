# پلن اجرایی ایرانی‌سازی کامل Bidar CRM (دستورالعمل گام‌به‌گام فوق‌دقیق مخصوص AI Agent)

> **جایگاه در ترتیب پیاده‌سازی:** **مرحله ۲ (پس از وایت‌لیبل مرحله ۱)**  
> **مرجع نقشه راه کلان:** [docs/plans/README.md](file:///Users/moeini/Dev/didar/docs/plans/README.md)  
> **تداخل با ایجنت فرانت (`apps/web/`):**
> - **بخش A (وظایف `IR-01` تا `IR-08` — بک‌اند PHP، متادیتا، پنل `/admin` و پکیجر):** صفر تداخل با `apps/web/` ← **در همین مرحله ۲ فوراً اجرا شود.**
> - **بخش B (وظایف `IR-09` تا `IR-11` — فرانت Headless React در `apps/web/`):** ← **تا اتمام کار ایجنت فرانت صبر کرده و در مرحله ۴ اجرا شود.**

این سند عمداً با ساختار **وظایف اتمی (Atomic Tasks)**، مسیر فایل‌های دقیق مخزن `/Users/moeini/Dev/didar`، امضای دقیق کلاس‌ها، دام‌های رایج (Anti-Pitfalls) و دستور تست اختصاصی پس از هر گام نوشته شده تا حتی یک **ایجنت هوش مصنوعی سبک‌تر یا ضعیف‌تر** نیز بدون خطا، توهم (Hallucination) یا شکستن تست‌های فعلی (`45 PHPUnit` + `85 Vitest`) بتواند آن را کامل اجرا کند.

---

## ۰. قوانین قرمز غیرقابل نقض (Guardrails برای AI Agent)

پیش از نوشتن اولین خط کد، این **۸ قانون** را عیناً رعایت کن:

1. **دیتابیس و API همیشه میلادی و با ارقام لاتین است:** تمام ستون‌های `DATE` / `DATETIME` در MySQL و تمام Payloadهای `/api/v1/*` باید همیشه ISO میلادی (`YYYY-MM-DD` / `YYYY-MM-DD HH:mm:ss`) و ارقام انگلیسی (`0-9`) باشند. **هرگز** تاریخ شمسی یا ارقام فارسی (`۰-۹`) را در دیتابیس ذخیره نکن.
2. **تبدیل شمسی فقط در لبه نمایش و خروجی است:** تبدیل میلادی ↔ شمسی فقط در UI (پنل `/admin` و فرانت `/`) و خروجی‌های متنی (پیامک، ایمیل، PDF، گزارش ماهانه و CSV) انجام می‌شود.
3. **مسیر درست کدنویسی مخزن است نه پوشه نصب‌شده:** تمام کدهای PHP و متادیتا در `extensions/bidar-iran/` (بدون پوشه `src/`، مطابق ساختار PSR-4 نسخه `v1.0.1`) نوشته می‌شوند. هرگز فایل‌های هسته `engine/application/Espo/` را ویرایش نکن.
4. **چرخ را دوباره اختراع نکن:** کلاس‌های زیر همین الان در `extensions/bidar-iran/` وجود دارند و تست واحد دارند — آن‌ها را بازنویسی یا حذف نکن:
   - `extensions/bidar-iran/Support/IranPhoneNormalizer.php`
   - `extensions/bidar-iran/Sms/KavenegarSender.php`
   - `extensions/bidar-iran/Services/VoipLookupService.php`
   - `extensions/bidar-iran/Api/PostVoipWebhook.php`
5. **امضاهای رسمی EspoCRM 10.1.4 الزامی است:** هر Hook جدید باید `implements Espo\Core\Hook\Hook\BeforeSave` (یا `AfterSave`) با امضای `(Entity $entity, SaveOptions $options): void` باشد.
6. **تفاوت نسخه Tailwind در `apps/web/`:** فرانت از **React 19 + Vite 6 + Tailwind CSS v3.4.15** استفاده می‌کند (نه Tailwind v4!). هرگز سینتکس v4 مثل `@theme` یا `@import "tailwindcss"` را وارد `apps/web/` نکن و هرگز دستور `npx vibefarsi init` یا `npx farsiui init` را اجرا نکن.
7. **سازگاری عقب‌رو با تست‌های موجود در `apps/web/src/lib/`:** فایل‌های `apps/web/src/lib/jalali.ts` و `apps/web/src/lib/currency.ts` همین الان اکسپورت‌ها و تست‌های فعال دارند؛ هیچ تابع اکسپورت‌شده فعلی را حذف یا تغییر امضا نده.
8. **گیت تست پس از هر گام:** بدون سبز شدن دستور `Verify` هر گام، به گام بعدی نرو.

---

## ۱. جدول تصمیم معماری کتابخانه‌ها (چرا و کجا از هر ابزار استفاده می‌کنیم)

| کتابخانه / مخزن | لایه هدف | وضعیت | محل دقیق استفاده و دلیل |
| :--- | :--- | :---: | :--- |
| `morilog/jalali` (`^3.5`) | بک‌اند PHP (`extensions/bidar-iran`) | **الزامی** | تبدیل تاریخ در پیامک کاوه‌نگار، گزارش‌های ماه/فصل شمسی در `DashboardSummaryService`، خروجی CSV و متن نسبی «۲ روز پیش». |
| `majidh1/JalaliDatePicker` | پنل `/admin` (Backbone) | **الزامی** | سبک، بدون وابستگی، پشتیبانی بومی از `targetValueType: "gregorian"` (نمایش شمسی به کاربر + نوشتن مقدار میلادی در فیلد EspoCRM). |
| `@doranjs/core`, `@doranjs/holidays`, `@doranjs/react`, `@doranjs/nlp` | فرانت Headless (`apps/web/` — مرحله ۴) | **هدفمند (پشت Facade)** | موتور تقویم شمسی، تعطیلات رسمی/مذهبی ایران، انتخابگر تاریخ React و درک زبان طبیعی فارسی («فردا ساعت ۱۰»). *الزام: فقط از طریق `src/lib/jalali.ts` ایمپورت شوند.* |
| `vibefarsiui` *(کپی گزینشی، بدون `init`)* | فرانت Headless (`apps/web/` — مرحله ۴) | **گزینشی** | الگوهای فرمت تومان، ورودی موبایل و شبا؛ **بدون** اجرای `init` و با تبدیل هر کلاس Tailwind v4 به معادل Tailwind v3. |
| `FarsiUI` | — | **عدم استفاده** | جلوگیری از تداخل دو رجیستری UI و حفظ سیستم طراحی یکپارچه بیدار. |

---

## ۲. بخش A — وظایف بک‌اند و پنل `/admin` (اجرا در مرحله ۲ — صفر تداخل با `apps/web/`)

### گام `IR-01`: تعریف کامل واحد پولی ریال (`IRR`) و تومان (`IRT`) در متادیتای `BidarIran`

- **هدف:** ثبت «تومان» (`IRT`) و «ریال» (`IRR`) با نماد فارسی و **صفر رقم اعشار** در EspoCRM 10.1.4.
- **فایل‌های دقیق:**
  1. ایجاد `extensions/bidar-iran/Resources/metadata/app/currency.json`
  2. ایجاد یا تکمیل `extensions/bidar-iran/Resources/i18n/fa_IR/Global.json`
- **محتوای دقیق `extensions/bidar-iran/Resources/metadata/app/currency.json`:**
  ```json
  {
    "list": [
      "__APPEND__",
      "IRT"
    ],
    "symbolMap": {
      "IRR": "ریال",
      "IRT": "تومان"
    },
    "precisionMap": {
      "IRR": 0,
      "IRT": 0
    }
  }
  ```
- **محتوای دقیق بخش ارز در `extensions/bidar-iran/Resources/i18n/fa_IR/Global.json`:**
  ```json
  {
    "options": {
      "currency": {
        "IRR": "ریال ایران",
        "IRT": "تومان ایران"
      }
    }
  }
  ```
- **دام رایج (Anti-Pitfall):** در EspoCRM 10.1.4 اگر کلید `"list": ["__APPEND__", "IRT"]` را نگذاری، `IRT` اصلاً در منوی کشویی ارزها ظاهر نمی‌شود! و اگر `"precisionMap"` را نگذاری، مبالغ با `.00` نمایش داده می‌شوند. هر سه کلید الزامی‌اند.
- **تست فوری (Verify):**
  - بررسی صحت JSON با `php -r 'json_decode(file_get_contents("extensions/bidar-iran/Resources/metadata/app/currency.json"), false, 512, JSON_THROW_ON_ERROR); echo "OK\n";'`

---

### گام `IR-02`: تنظیمات پیش‌فرض منطقه زمانی، شروع هفته (شنبه) و ارز در `scripts/seed-sample-data.php` و کانفیگ نصب

- **هدف:** تضمین اینکه هر نصب تازه روی `Asia/Tehran`، زبان `fa_IR`، شروع هفته **شنبه (`weekStart: 6`)** و ارز تومان بدون اعشار تنظیم شود.
- **فایل‌های دقیق:**
  - ویرایش `scripts/seed-sample-data.php`، تزریق در `<target>/application/Espo/Resources/defaults/config.php` از طریق `scripts/apply-whitelabel.php` (تا حتی نصب وب `/install/` در هاست اشتراکی بدون نیاز به اجرای CLI این مقادیر را به‌عنوان پیش‌فرض داشته باشد) و مستندسازی در `docs/INSTALL_SHARED_HOSTING_FA.md`.
- **مقادیر دقیق الزامی:**
  ```php
  'language' => 'fa_IR',
  'timeZone' => 'Asia/Tehran',
  'weekStart' => 6, // 6 = شنبه (Saturday) — پیش‌فرض EspoCRM عدد 0 (یکشنبه) است!
  'dateFormat' => 'YYYY/MM/DD',
  'timeFormat' => 'HH:mm',
  'thousandSeparator' => ',',
  'decimalMark' => '.',
  'currencyList' => ['IRT', 'IRR'],
  'defaultCurrency' => 'IRT',
  'baseCurrency' => 'IRT',
  'currencyFormat' => 2, // نمایش واحد بعد از عدد: 150,000 تومان
  'currencyDecimalPlaces' => 0,
  'phoneNumberPreferredCountryList' => ['ir'],
  'phoneNumberInternational' => false,
  ```
- **دام رایج:** مقدار `weekStart` در EspoCRM برای شنبه `6` است (یکشنبه=0، دوشنبه=1 ... شنبه=6). عدد `0` یا `1` اشتباه است.
- **تست فوری:** بررسی سینتکس با `php -l scripts/seed-sample-data.php`.

---

### گام `IR-03`: نصب و بسته‌بندی `morilog/jalali` و ساخت `JalaliHelper.php`

- **هدف:** افزودن موتور دقیق تبدیل تاریخ شمسی سمت سرور در PHP (قابل استفاده در `BidarIran` و `BidarSales` و موجود در بسته ZIP بدون نیاز به Composer روی هاست).
- **فایل‌های دقیق:**
  1. اجرای `composer require morilog/jalali:^3.5` در ریشه مخزن `/Users/moeini/Dev/didar`.
  2. ایجاد `extensions/bidar-iran/Support/JalaliHelper.php` (نِیم‌اسپیس: `Espo\Modules\BidarIran\Support`).
  3. ایجاد تست واحد `extensions/bidar-iran/tests/Unit/JalaliHelperTest.php`.
- **متدهای دقیق و امضای الزامی در `JalaliHelper.php`:**
  ```php
  <?php
  declare(strict_types=1);

  namespace Espo\Modules\BidarIran\Support;

  final class JalaliHelper
  {
      public static function toJalaliDate(?string $gregorianDate, string $format = 'Y/m/d', bool $persianDigits = false): string;
      public static function toJalaliDateTime(?string $gregorianDateTime, string $format = 'Y/m/d H:i', string $tz = 'Asia/Tehran', bool $persianDigits = false): string;
      public static function toGregorianDate(string $jalaliDate): ?string;
      /** @return array{start: string, end: string} */
      public static function getJalaliMonthRange(int $jYear, int $jMonth, string $tz = 'Asia/Tehran'): array;
      /** @return array{start: string, end: string} */
      public static function getCurrentJalaliMonthRange(string $tz = 'Asia/Tehran'): array;
      /** @return array{start: string, end: string} */
      public static function getJalaliQuarterRange(int $quarter, ?int $jYear = null, string $tz = 'Asia/Tehran'): array;
      public static function diffForHumans(?string $gregorianDateTime, string $tz = 'Asia/Tehran'): string;
  }
  ```
- **الزام مهم برای `scripts/build-release.sh` (دام بسیار خطرناک!):**
  بسته `EspoCRM-10.1.4.zip` که در `build-release.sh` آنزیپ می‌شود **فاقد `morilog/jalali` در پوشه `vendor/` خودش است!** بنابراین در `scripts/build-release.sh` دقیقاً این ۳ کار را انجام بده:
  1. کپی پوشه `vendor/morilog/jalali` از مخزن اصلی به `${BUILD_DIR}/vendor/morilog/jalali`.
  2. ثبت نگاشت PSR-4 `'Morilog\\Jalali\\' => array($vendorDir . '/morilog/jalali/src')` در `${BUILD_DIR}/vendor/composer/autoload_psr4.php` و `autoload_static.php` (یا `require_once` کردن یک فایل `vendor/morilog/autoload.php` سبک در `bootstrap.php`).
  3. افزودن گیت تست در `tests/installer/clean-install-smoke.sh`:
     `php -r 'require "vendor/autoload.php"; echo \Morilog\Jalali\Jalalian::fromDateTime("2026-11-22")->format("Y/m/d");'` که باید دقیقاً `1405/09/01` چاپ کند.
- **تست‌های واحد اجباری در `JalaliHelperTest.php`:**
  - `toJalaliDate('2026-11-22') === '1405/09/01'`
  - `toJalaliDate('2026-11-22', 'Y/m/d', true) === '۱۴۰۵/۰۹/۰۱'`
  - `toJalaliDate('2025-03-20') === '1403/12/30'` *(تست سال کبیسه ۱۴۰۳ — اسفند ۳۰ روزه!)*
  - `toGregorianDate('۱۴۰۵/۰۹/۰۱') === '2026-11-22'`
  - ورودی `null` یا `''` یا نامعتبر هرگز Exception ندهد و `''` یا `null` برگرداند.
- **تست فوری:** `composer dump-autoload && vendor/bin/phpunit -c extensions/phpunit.xml --filter JalaliHelperTest`

---

### گام `IR-04`: ساخت `PersianTextNormalizer.php` و هوک `NormalizePersianInput.php`

- **هدف:** یکدست‌سازی کاراکترهای عربی/فارسی (`ي`←`ی`، `ك`←`ک`) و ارقام فارسی/عربی (`۰-۹`, `٠-٩` ← `0-9`) تا جستجوی MySQL و فیلترها هیچ‌وقت به‌خاطر صفحه‌کلید متفاوت کاربر شکست نخورند.
- **فایل‌های دقیق:**
  1. ایجاد `extensions/bidar-iran/Support/PersianTextNormalizer.php`
  2. ایجاد `extensions/bidar-iran/Hooks/Common/NormalizePersianInput.php`
  3. ایجاد تست واحد `extensions/bidar-iran/tests/Unit/PersianTextNormalizerTest.php`
- **متدهای دقیق `PersianTextNormalizer.php`:**
  - `toEnglishDigits(string $input): string` (`۰-۹` و `٠-٩` $\rightarrow$ `0-9`)
  - `toPersianDigits(string $input): string` (`0-9` $\rightarrow$ `۰-۹`)
  - `normalizeCharacters(string $input): string`:
    - `ي` (`\u{064A}`) و `ى` (`\u{0649}`) $\rightarrow$ `ی` (`\u{06CC}`)
    - `ك` (`\u{0643}`) $\rightarrow$ `ک` (`\u{06A9}`)
    - `ۀ` $\rightarrow$ `ه`، حذف کشیده (`ـ` / `\u{0640}`) و حذف فاصله‌های تکراری اضافی
    - تبدیل ارقام فارسی/عربی به انگلیسی در متن ذخیره‌شده
- **امضای دقیق هوک `NormalizePersianInput.php` (منطبق با EspoCRM 10.1.4):**
  ```php
  namespace Espo\Modules\BidarIran\Hooks\Common;

  use Espo\Core\Hook\Hook\BeforeSave;
  use Espo\ORM\Entity;
  use Espo\ORM\Repository\Option\SaveOptions;
  use Espo\Modules\BidarIran\Support\PersianTextNormalizer;

  /** @implements BeforeSave<Entity> */
  class NormalizePersianInput implements BeforeSave
  {
      private const ALLOWED_ENTITIES = ['Account', 'Contact', 'Lead', 'Opportunity', 'Task', 'Call', 'Meeting'];
      private const TEXT_FIELDS = ['name', 'firstName', 'lastName', 'accountName', 'description'];

      public function beforeSave(Entity $entity, SaveOptions $options): void
      {
          if (!in_array($entity->getEntityType(), self::ALLOWED_ENTITIES, true)) {
              return;
          }
          foreach (self::TEXT_FIELDS as $field) {
              $val = $entity->get($field);
              if (is_string($val) && $val !== '') {
                  $entity->set($field, PersianTextNormalizer::normalizeCharacters($val));
              }
          }
      }
  }
  ```
- **تست فوری:** `vendor/bin/phpunit -c extensions/phpunit.xml --filter PersianTextNormalizerTest`

---

### گام `IR-05`: ساخت `IranValidators.php` (کد ملی، شناسه ملی شرکت، کد پستی، شبا)

- **هدف:** اعتبارسنجی دقیق استانداردهای رسمی ایران در بک‌اند.
- **فایل‌های دقیق:**
  1. ایجاد `extensions/bidar-iran/Support/IranValidators.php`
  2. ایجاد تست واحد `extensions/bidar-iran/tests/Unit/IranValidatorsTest.php`
- **متدها و الگوریتم‌های دقیق:**
  1. `isValidNationalCode(string $code): bool`
     - ابتدا ارقام فارسی/عربی را با `PersianTextNormalizer::toEnglishDigits` تبدیل و فاصله/خط‌تیره را حذف کند.
     - باید دقیقاً ۱۰ رقم باشد و همه ارقام تکراری نباشد (`/^(.)\1{9}$/` مردود).
     - فرمول رسمی چک‌دیجیت: $S = \sum_{i=0}^{8} d_i \times (10 - i)$، $R = S \bmod 11$؛ اگر $R < 2$ باید $d_9 == R$ وگرنه $d_9 == 11 - R$.
  2. `isValidCompanyNationalId(string $id): bool`
     - ۱۱ رقم، غیرتکراری، الگوریتم رسمی چک‌دیجیت شناسه ملی اشخاص حقوقی ایران (ضرایب `[29, 27, 23, 19, 17, 29, 27, 23, 19, 17]` + رقم دهم + `2` و باقی‌مانده بر `11`).
  3. `isValidPostalCode(string $code): bool`
     - ۱۰ رقم، مطابق الگوی پست ایران: `/^[13-9]{5}[0-9]{5}$/` و نبود ۵ رقم اول تکراری.
  4. `isValidSheba(string $iban): bool`
     - حذف فاصله و حروف کوچک؛ مطابقت با `/^IR[0-9]{24}$/`؛ جابه‌جایی ۴ کاراکتر اول به انتها، تبدیل `I=18` و `R=27` و بررسی `bcmod($numeric, '97') === '1'` (با پیاده‌سازی Mod-97 قطعه‌ای بدون وابستگی اجباری به `ext-bcmath` برای سازگاری با همه هاست‌های اشتراکی!).
- **دام رایج:** بسیاری از هاست‌های اشتراکی `ext-bcmath` ندارند! در `isValidSheba` از حلقه ریاضی `($remainder * 10 + (int)$digit) % 97` استفاده کن تا بدون هیچ extension اضافی PHP کار کند.
- **تست فوری:** `vendor/bin/phpunit -c extensions/phpunit.xml --filter IranValidatorsTest`

---

### گام `IR-06`: واژگان استاندارد فروش فارسی و فیلدهای بومی ایران (استان/شهر، کد ملی، شناسه ملی)

- **هدف:** جایگزینی ترجمه‌های خشک ماشینی EspoCRM با واژگان حرفه‌ای فروش فارسی و افزودن فیلدهای اختیاری بازار ایران.
- **فایل‌های دقیق:**
  1. تکمیل `extensions/bidar-iran/Resources/i18n/fa_IR/Global.json`:
     | کلید / موجودیت | واژه فارسی بیدار |
     | :--- | :--- |
     | `Opportunity` / `Opportunities` | `معامله` / `معاملات` |
     | `Pipeline` / `Pipelines` | `کاریز` / `کاریزها` |
     | `Lead` / `Leads` | `سرنخ فروش` / `سرنخ‌های فروش` |
     | `Account` / `Accounts` | `شرکت` / `شرکت‌ها` |
     | `Contact` / `Contacts` | `شخص` / `اشخاص` |
     | `Call` / `Meeting` / `Task` | `تماس` / `جلسه` / `وظیفه` |
     | `Stream` | `تایم‌لاین تعاملات` |
     | `isRotten` | `معامله راکد` |
     | `Closed Won` / `Closed Lost` | `فروش موفق` / `شکست‌خورده` |
     | `Dashboard` | `نشانگر` |
  2. ایجاد `extensions/bidar-iran/Resources/metadata/entityDefs/Account.json`:
     - فیلدهای جدید: `nationalId` (varchar 11)، `economicCode` (varchar 14)، `registrationNumber` (varchar 20)، `iranProvince` (enum ۳۱ استان ایران)، `iranCity` (varchar 64).
  3. ایجاد `extensions/bidar-iran/Resources/metadata/entityDefs/Contact.json`:
     - فیلدهای جدید: `nationalCode` (varchar 10)، `birthDate` (date).
  4. ایجاد فایل‌های ترجمه متناظر `extensions/bidar-iran/Resources/i18n/fa_IR/Account.json` و `Contact.json`.
- **تست فوری:** بررسی JSON همه فایل‌های ساخته‌شده با `php -r` و اجرای `vendor/bin/phpunit -c extensions/phpunit.xml`.

---

### گام `IR-07`: خروجی CSV فارسی سازگار با اکسل ویندوز (UTF-8 BOM + تاریخ شمسی)

- **هدف:** جلوگیری از بهم‌ریختگی متون فارسی در اکسل ویندوز و نمایش تاریخ‌های خروجی به فرمت شمسی.
- **فایل‌های دقیق:**
  1. ایجاد کلاس کمکی `extensions/bidar-iran/Support/PersianCsvExporter.php`:
     - افزودن قطعی BOM سه بایتی `"\xEF\xBB\xBF"` در ابتدای جریان خروجی.
     - تبدیل خودکار فیلدهای تاریخ ISO به شمسی از طریق `JalaliHelper::toJalaliDate()`.
     - جلوگیری از CSV Formula Injection (پیشوندگذاری امن برای سلول‌های شروع‌شده با `=`, `+`, `-`, `@`).
  2. ایجاد تست واحد `extensions/bidar-iran/tests/Unit/PersianCsvExporterTest.php`.
- **تست فوری:** `vendor/bin/phpunit -c extensions/phpunit.xml --filter PersianCsvExporterTest`

---

### گام `IR-08`: شمسی‌سازی تقویم و تاریخ در پنل `/admin` (EspoCRM Backbone با `JalaliDatePicker`)

- **هدف:** نمایش و انتخاب تاریخ شمسی در کل پنل `/admin` با حفظ ذخیره‌سازی ۱۰۰٪ میلادی در EspoCRM.
- **فایل‌های دقیق:**
  1. کپی فایل‌های تولیدی `majidh1/JalaliDatePicker` در مخزن:
     - `client/custom/modules/bidar-iran/lib/jalalidatepicker.min.js`
     - `client/custom/modules/bidar-iran/lib/jalalidatepicker.min.css`
  2. ایجاد فایل تبدیل و راه‌انداز:
     - `client/custom/modules/bidar-iran/lib/bidar-jalali-utils.js` (توابع خالص `gToJ('2026-11-22')`، `jToG('1405/09/01')`، `toPersianDigits()` با پشتیبانی سال کبیسه ۱۴۰۳/۱۴۰۸).
     - `client/custom/modules/bidar-iran/lib/bidar-jalali-init.js` (فراخوانی `jalaliDatepicker.startWatch(...)`).
  3. ثبت اسکریپت‌ها در `extensions/bidar-iran/Resources/metadata/app/client.json`:
     ```json
     {
       "scriptList": [
         "__APPEND__",
         "client/custom/modules/bidar-iran/lib/jalalidatepicker.min.js",
         "client/custom/modules/bidar-iran/lib/bidar-jalali-utils.js",
         "client/custom/modules/bidar-iran/lib/bidar-jalali-init.js"
       ],
       "cssList": [
         "__APPEND__",
         "client/custom/modules/bidar-iran/lib/jalalidatepicker.min.css"
       ]
     }
     ```
  4. Override کردن **هر سه نوع فیلد تاریخ EspoCRM 10.1.4** (نکته مهم: `Call`/`Meeting`/`Task` از `datetimeOptional` استفاده می‌کنند!):
     - `extensions/bidar-iran/Resources/metadata/fields/date.json` $\rightarrow$ `{ "view": "bidar-iran:views/fields/date" }`
     - `extensions/bidar-iran/Resources/metadata/fields/datetime.json` $\rightarrow$ `{ "view": "bidar-iran:views/fields/datetime" }`
     - `extensions/bidar-iran/Resources/metadata/fields/datetimeOptional.json` $\rightarrow$ `{ "view": "bidar-iran:views/fields/datetime-optional" }`
  5. ایجاد ویوهای سبک ارث‌بری‌شده از ویوهای هسته در `client/custom/modules/bidar-iran/src/views/fields/{date,datetime,datetime-optional}.js`:
     - **حالت Detail و List:** نمایش خروجی `window.BidarJalali.gToJ(val)` به کاربر.
     - **حالت Edit و Search:** رندر یک `<input data-jdp>` شمسی (الگوی Dual-Input) که با تغییر کاربر مقدار میلادی را در فیلد مخفی/مدل اصلی EspoCRM نوشته و رویداد `change` را trigger می‌کند.
  6. **به‌روزرسانی `scripts/build-release.sh`:**
     - کپی خودکار `client/custom/modules/bidar-iran/` به `${BUILD_DIR}/client/custom/modules/bidar-iran/` تا در بسته ZIP نهایی موجود باشد.
- **دام رایج:** در `app/client.json` حتماً `"__APPEND__"` را به‌عنوان اولین عنصر `scriptList` و `cssList` قرار بده؛ وگرنه تمام اسکریپت‌های هسته EspoCRM پاک شده و پنل `/admin` کاملاً سفید می‌شود!
- **تست فوری:** `bash scripts/build-release.sh && bash tests/installer/clean-install-smoke.sh dist/bidar-crm-v*.zip`

---

## ۳. بخش B — وظایف فرانت Headless React *(اجرا در مرحله ۴ — پس از اتمام کار ایجنت فرانت)*

> [!IMPORTANT]
> **ممنوعیت اجرا پیش از اتمام کار ایجنت فرانت:** گام‌های `IR-09` تا `IR-11` روی `apps/web/` اعمال می‌شوند و باید پس از تثبیت کامل فرانت React در **مرحله ۴** انجام شوند.

### گام `IR-09`: ارتقای `apps/web/src/lib/jalali.ts` (Facade واحد با `@doranjs/*` و حفظ سازگاری عقب‌رو)

- **هدف:** افزودن تعطیلات رسمی ایران، تاریخ نسبی فارسی و ورودی زبان طبیعی («فردا ساعت ۱۱») بدون شکستن هیچ‌یک از تست‌های موجود.
- **نصب پکیج‌ها در `apps/web/`:**
  ```bash
  npm --prefix apps/web install @doranjs/core @doranjs/holidays @doranjs/react @doranjs/nlp
  ```
- **قانون سازگاری عقب‌رو (الزامی):** تمام اکسپورت‌های فعلی `apps/web/src/lib/jalali.ts` (`toJalaliDateString`, `formatJalaliDate`, `jalaliToGregorian`, `toUtcIsoString`, `isJalaliLeapYear`, `getJalaliMonthLength`, `getJalaliParts`, `getJalaliMonthRangeUtc`, `PERSIAN_MONTH_NAMES`, `PERSIAN_WEEKDAYS`) باید بدون تغییر امضا حفظ شوند و توابع جدید زیر به همان فایل اضافه گردند:
  - `formatJalaliDateTime(isoDateTime: string | null): string` (خروجی: `۱۴۰۵/۰۹/۰۱ · ۱۴:۳۰` در منطقه زمانی `Asia/Tehran`)
  - `formatRelativeJalali(isoDateTime: string | null): string` («امروز ۱۴:۰۰»، «دیروز»، «۳ روز پیش»)
  - `parseNaturalPersianDate(text: string): { isoDate: string; label: string } | null` (متصل به `@doranjs/nlp`)
  - `isIranHoliday(isoDate: string): { isHoliday: boolean; isFriday: boolean; title?: string }` (متصل به `@doranjs/holidays`)
  - `getJalaliMonthBounds(offsetMonths?: number): { startIso: string; endIso: string; label: string }`
- **تست فوری:** `npm --prefix apps/web run test:ci`

---

### گام `IR-10`: ایجاد `apps/web/src/lib/iran-format.ts` (فرمت واحد پول، تلفن و اعتبارسنجی ایران)

- **هدف:** تجمیع تمام فرمت‌دهنده‌ها و اعتبارسنج‌های ایران پشت یک ماژول واحد (با حفظ و re-export توابع موجود در `apps/web/src/lib/currency.ts`).
- **توابع دقیق:**
  - `toPersianDigits(val: string | number): string` و `toEnglishDigits(val: string): string`
  - `normalizePersianSearch(query: string): string` (`ي`←`ی`، `ك`←`ک`، ارقام فارسی←انگلیسی)
  - `formatCurrency(amount: number, unit: 'IRT' | 'IRR' = 'IRT', compact = false): string`
    - حالت کامل: `۳۱۰,۰۰۰,۰۰۰ تومان`
    - حالت فشرده: `۳۱۰ میلیون تومان` / `۱.۴۸ میلیارد تومان`
  - `formatIranPhone(phone: string): string` (نمایش با `dir="ltr"`: `0912 445 8810`)
  - `validateNationalCode(code: string): boolean` و `validateSheba(iban: string): boolean`
- **تست فوری:** افزودن `apps/web/src/test/iran-format.test.ts` و اجرای `npm --prefix apps/web run test:ci`.

---

### گام `IR-11`: اتصال DatePicker شمسی، تعطیلات ایران و ورودی هوشمند در فرم‌های `apps/web/`

- **هدف:** استفاده از Facadeهای گام‌های `IR-09` و `IR-10` در فرم‌ها و تقویم فرانت:
  1. در `JalaliCalendarView.tsx`: هایلایت قرمز جمعه‌ها و تعطیلات رسمی ایران از `isIranHoliday()` با Tooltip عنوان مناسبت.
  2. در `ActivityCreateModal.tsx` و `QuickLogBar`: پشتیبانی از ورود متن طبیعی مثل «فردا ساعت ۱۰» از طریق `parseNaturalPersianDate()`.
  3. در `DealCreateModal.tsx`: ورودی مبلغ با جداکننده هزارگان زنده (پذیرش کیبورد فارسی، ارسال عدد لاتین به API) + انتخابگر تاریخ شمسی با خروجی ISO میلادی.
  4. در جستجوی سراسری (`GlobalSearchBar`): اعمال `normalizePersianSearch()` پیش از ارسال کوئری.
- **تست فوری:** `npm --prefix apps/web run test:ci && npm --prefix apps/web run build`

---

## ۴. چک‌لیست پذیرش نهایی (Verification Matrix)

- [ ] **بک‌اند PHP (`vendor/bin/phpunit -c extensions/phpunit.xml`):** ۱۰۰٪ سبز شامل تست‌های `JalaliHelper` (از جمله سال کبیسه ۱۴۰۳)، `PersianTextNormalizer`، `IranValidators` (بدون نیاز به `ext-bcmath`) و `PersianCsvExporter` (دارای BOM).
- [ ] **متادیتای ارز و زمان:** در `/api/v1/Settings` مقدار `weekStart === 6`، `timeZone === 'Asia/Tehran'`، `currencyDecimalPlaces === 0` و هر دو ارز `IRT` و `IRR` بدون اعشار در دسترس‌اند.
- [ ] **پنل `/admin`:** فیلدهای `date`، `datetime` و `datetimeOptional` با تقویم شمسی `JalaliDatePicker` کار می‌کنند و در Network Tab مقدار ISO میلادی ارسال می‌شود.
- [ ] **فرانت Headless (مرحله ۴):** تقویم از شنبه شروع می‌شود، تعطیلات رسمی ایران مشخص‌اند، مبلغ با کیبورد فارسی وارد و به عدد لاتین ارسال می‌شود، و جستجوی «كريمي» رکورد «کریمی» را می‌یابد.
- [ ] **بسته ZIP نهایی:** `clean-install-smoke.sh` وجود `morilog/jalali` و فایل‌های `client/custom/modules/bidar-iran/` را تایید می‌کند.
