# پلن اصلاح و بهبود بخش ۱: موتور فروش و کاریزها (Section 1 Remediation Plan)

این سند تلفیق بازبینی‌های دو مرحله‌ای مدل **HungerG on Qoder (Pass 1)** و **GLM-5.4 on AutoClaw (Pass 2)** برای ماژول `extensions/bidar-sales` است.

---

## ۱. فهرست باگ‌ها و اصلاحات ضروری (P0 & P1)

### الف) امنیت و کنترل دسترسی (Security & ACL)
1. **[SEC-01] جلوگیری از ایجاد کلید API برای دیگران توسط ادمین‌های عادی (Privilege Escalation)**
   - **فایل**: `extensions/bidar-sales/Services/BidarApiKeyService.php`
   - **ایراد**: متد `createKey()` تنها با بررسی `isAdmin()` اجازه ساخت کلید برای هر کاربری (حتی سوپرادمین) را می‌دهد.
   - **اصلاح**: ساخت کلید برای کاربران دیگر صرفاً باید توسط سوپرادمین (`isSuperAdmin` یا با تأیید Acl) مجاز باشد. کاربر هدف باید فعال و معتبر باشد.
2. **[SEC-02] اعتبارسنجی و ایمن‌سازی IP محدودکننده (Fail-Closed)**
   - **فایل**: `extensions/bidar-sales/Services/BidarApiKeyService.php` و `BidarApiKeyLogin.php`
   - **ایراد**: آرایه `allowedIpList` اعتبارسنجی نمی‌شود. در صورت عدم انطباق یا فرمت اشتباه، نباید دسترسی آزاد داده شود (Fail-Closed).
   - **اصلاح**: اعتبارسنجی IP هنگام ایجاد کلید؛ بررسی دقیق در لاگین؛ در صورت بروز خطا یا فرمت نامعتبر، رد درخواست (Fail-Closed).
3. **[SEC-03] ابطال ایمن کلید (Audit Logging & Soft Revoke)**
   - **فایل**: `extensions/bidar-sales/Services/BidarApiKeyService.php`
   - **ایراد**: `revokeKey()` ثبت نمی‌کند چه کسی و در چه زمانی کلید را باطل کرده است.
   - **اصلاح**: فیلدهای `isActive=false`, `revokedAt`, `revokedByUserId` و ثبت لاگ.
4. **[ACL-01] حذف فالبک ناایمن بدون ACL در داشبورد (Fail-Closed Dashboard)**
   - **فایل**: `extensions/bidar-sales/Controllers/GetDashboardSummary.php`
   - **ایراد**: در بلوک `catch`، فالبک بدون فیلترهای ACL اجرا می‌شد که ممکن بود داده‌های کاربران دیگر را افشا کند.
   - **اصلاح**: حذف فالبک ناایمن؛ بازگرداندن خطای مناسب یا اعمال strict access control.

---

### ب) منطق کاریز و محاسبات مالی (Pipeline & Goal Logic)
5. **[PIPE-01] اصلاح رفتار با احتمال صفر (Probability = 0)**
   - **فایل**: `extensions/bidar-sales/Services/DashboardSummaryService.php`
   - **ایراد**: معاملات بازی که صرفاً احتمال آن‌ها صفر ثبت شده نباید به عنوان «باخت» در نظر گرفته شوند و از قیف فروش حذف گردند؛ تعیین وضعیت برنده/بازنده باید بر اساس `mappedStatus` (یا `stage`) باشد نه صرفاً صفر بودن فیلد احتمال.
   - **اصلاح**: تفکیک دقیق بین مرحله باخت و مرحله باز با احتمال صفر.
6. **[PIPE-02] تفکیک و گروه‌بندی بر اساس شناسه مرحله (Stage ID) نه نام مرحله**
   - **فایل**: `extensions/bidar-sales/Services/DashboardSummaryService.php`
   - **ایراد**: کلید خوردن قیف بر اساس نام مرحله در صورت وجود مراحل هم‌نام در چند کاریز تداخل ایجاد می‌کند.
   - **اصلاح**: استفاده از Stage ID به عنوان شناسه اصلی مراحل در قیف فروش.
7. **[PIPE-03] یکسان‌سازی منطق تشخیص معامله برنده (Won Deal)**
   - **فایل**: `extensions/bidar-sales/Services/DashboardSummaryService.php`
   - **ایراد**: ناهمخوانی بین `calculateSummary()` و `calculateGoalProgress()`.
   - **اصلاح**: استفاده از متد کمکی یکسان برای تعیین تحقق وضعیت معامله.

---

### ج) تمیزکاری و سازگاری با استانداردها (Code Health)
8. **[CODE-01] اعتبارسنجی نام کلید و انقضا**
   - **فایل**: `extensions/bidar-sales/Services/BidarApiKeyService.php`
   - **اصلاح**: اعتبارسنجی طول نام (حداکثر ۱۰۰ کاراکتر)؛ عدم پذیرش تاریخ انقضای گذشته؛ یکسان‌سازی ثابت `KEY_PREFIX_LENGTH = 16`.

---

## ۲. دستور کار ساب‌ایجنت پیاده‌سازی (TDD Fixer Instructions)

۱. اضافه کردن تست‌های شکست‌خورده (Red Phase) در `extensions/tests/unit/BidarApiKeyServiceTest.php` و `extensions/tests/unit/DashboardSummaryServiceTest.php`.
۲. پیاده‌سازی اصلاحات فوق در کلاس‌های هدف (Green Phase).
۳. اجرای تست‌های PHPUnit و اطمینان از پاس شدن ۱۰۰٪:
   ```bash
   vendor/bin/phpunit -c extensions/phpunit.xml
   ```
۴. گزارش نهایی به ارکستریتور.
