# پلن اصلاح و بهبود بخش ۲: بومی‌سازی ایران و ارتباطات (Section 2 Remediation Plan)

این سند تلفیق بازبینی‌های دو مرحله‌ای مدل **HungerG on Qoder (Pass 1)** و **GLM-5.4 on AutoClaw (Pass 2)** برای ماژول `extensions/bidar-iran` است.

---

## ۱. فهرست باگ‌ها و اصلاحات فنی (P0 & P1)

### الف) تقویم جلالی و زمان‌ها (JalaliHelper.php)
1. **[JAL-01] تبدیل دقیق تاریخ‌های ISO بر مبنای منطقه زمانی ایران:**
   - متد `toJalaliDate` در مواجهه با تاریخ‌های با آفست یا UTC نباید بر اساس منطقه زمانی دلخواه سرور جابجا شود.
2. **[JAL-02] اعتبارسنجی سخت‌گیرانه تاریخ‌ها:**
   - رد تاریخ‌های غیرواقعی میلادی مانند `2026-02-30` (خروجی خالی یا null).
   - رد سال صفر جلالی `0000/01/01` (خروجی null).
   - پرتاب استثنای `InvalidArgumentException` در صورت ارسال ماه خارج از محدوده ۱ تا ۱۲ یا سال‌های خارج از محدوده معتبر در `getJalaliMonthRange`.

### ب) اعتبارسنجی و نرمال‌سازی متون و تلفن (Support)
3. **[NORM-01] ایمن‌سازی نرمال‌ساز متون در برابر بایت‌های نامعتبر UTF-8:**
   - در `PersianTextNormalizer.php`: متون حاوی بایت‌های معیوب (مانند `\xFF`) نباید باعث خطا یا خروجی خراب شوند.
4. **[PHONE-01] رد کاراکترهای کنترلی در شماره تلفن:**
   - در `IranPhoneNormalizer.php`: شماره‌های دارای کاراکترهای کنترلی (`\0` و غیره) باید نامعتبر شناخته شوند (`return null`).
5. **[CSV-01] جلوگیری از تزریق فرمول و تطبیق ستون‌ها در CSV:**
   - در `PersianCsvExporter.php`: کاراکترهای مخفی و پیشوندهای فرمول شامل `\t=` و `\u{00A0}=` باید خنثی شوند (با پیشوند کوتیشن تک `'`).
   - سطرهای انجمنی (associative) باید دقیقاً بر اساس ترتیب `headers` فیلتر و مرتب شوند.

### ج) وب‌هوک‌ها و پیامک (Sms & Voip)
6. **[SMS-01] تطابق شمارنده‌های کمپین پیامک:**
   - در `SmsCampaignService.php`: متغیر `total` باید شامل تمامی گیرندگان ورودی (حتی فاقد شماره) باشد تا همواره `total === sent + failed` برقرار باشد.
7. **[API-01] اعتبارسنجی نوع ورودی و تزریق وابستگی در کنترلرها:**
   - در `PostSendSms.php`: اگر مقدار `message` رشته نباشد (مانند آرایه یا آبجکت)، بلافاصله خطای `BadRequest` پرتاب شود و پرووایدر فراخوانی نگردد.
   - اصلاح تزریق کانتینر (`Container`) در کنترلرهای `PostSendSms` و `PostVoipWebhook` برای اطمینان از عملکرد صحیح در محیط اجرایی EspoCRM.

---

## ۲. دستور کار ساب‌ایجنت پیاده‌سازی (TDD Fixer Instructions)

۱. انتقال آزمون‌های اعتبارسنجی از `/tmp/BidarIranRedAuditTest.php` به پوشه تست واحد ماژول در `extensions/bidar-iran/tests/Unit/BidarIranAuditTest.php`.
۲. اجرای تست‌ها برای مشاهده فاز قرمز (Red Phase).
۳. اعمال اصلاحات در فایل‌های:
   - `extensions/bidar-iran/Support/JalaliHelper.php`
   - `extensions/bidar-iran/Support/PersianTextNormalizer.php`
   - `extensions/bidar-iran/Support/PersianCsvExporter.php`
   - `extensions/bidar-iran/Support/IranPhoneNormalizer.php`
   - `extensions/bidar-iran/Services/SmsCampaignService.php`
   - `extensions/bidar-iran/Api/PostSendSms.php`
۴. اجرای مجدد آزمون‌های واحد و اطمینان از پاس شدن ۱۰۰٪:
   ```bash
   vendor/bin/phpunit -c extensions/phpunit.xml
   ```
۵. گزارش نهایی به ارکستریتور.
