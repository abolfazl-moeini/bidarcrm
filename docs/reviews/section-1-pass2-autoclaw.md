خلاصه: خودِ تولید کلید API درست است، ولی ۱۷ ایراد پیدا کردم (۱ بالا، ۹ متوسط، ۷ کم). جدی‌ترین‌ها: مدیر عادی می‌تواند برای هر کاربری کلید بسازد، مسیر دوم داشبورد در خطا ACL را کنار می‌گذارد، و احتمال صفر در کاریز «باخت» حساب می‌شود.

این دو سرویس در asf-v6 نبودند و در /Users/moeini/Dev/didar/extensions/bidar-sales/ بررسی شدند. بازبینی فقط خواندنی است: هیچ تستی اجرا نکردم و چیزی تغییر ندادم. «کاریز» در این پروژه یعنی pipeline و محاسبه‌اش در calculateSummary است.

فایل‌ها:

BidarApiKeyService.php
BidarApiKeyLogin.php
DashboardSummaryService.php
GetDashboardSummary.php
scopes/BidarUserApiKey.json
BidarApiKeyServiceTest.php
الف) امنیت

🔴 مدیر عادی می‌تواند برای هر کاربری، حتی سوپرادمین، کلید بسازد — createKey()

تنها شرط isAdmin() بودن درخواست‌دهنده است و کاربر هدف (userId) اعتبارسنجی نمی‌شود.
BidarApiKeyLogin صاحب کلید را فقط از روی hash پیدا می‌کند و 2FA را دور می‌زند، پس کلید به‌تنهایی هویت هدف را می‌گیرد.
تست testAdminCanCreateKeyForAnotherUser همین حالت را با کاربر ناموجود user-999 تثبیت کرده است.
راه‌حل: ساخت کلید برای دیگری فقط برای سوپرادمین؛ هدف باید موجود، فعال و از نوع system/portal/api/super-admin نباشد؛ ثبت audit برای ساخت، چرخش و حذف.

🟠 محدودیت IP قابل اتکا نیست — createKey() و BidarApiKeyLogin::login()

allowedIpList اعتبارسنجی نمی‌شود (نه IP، نه CIDR).
در ورود فقط REMOTE_ADDR با تطابق دقیق رشته‌ای بررسی می‌شود، و اگر مقدار ذخیره‌شده آرایه نباشد بررسی کلاً رد می‌شود (fail-open).
پشت reverse proxy یا همه رد می‌شوند یا همه عبور می‌کنند.
راه‌حل: اعتبارسنجی IP/CIDR هنگام ساخت، پشتیبانی از CIDR، یک resolver متمرکزِ مطلع از پراکسی، fail-closed.

🟠 حذف کلید بدون رد حسابرسی است — revokeKey()

removeEntity فقط soft-delete می‌کند و مدیر می‌تواند رکورد را restore کند.
ثبت نمی‌شود چه کسی، کِی و چرا کلیدی را ساخته، چرخانده یا حذف کرده است.
راه‌حل: revoke نرم (isActive=false، revokedAt، revokedByUserId)، لاگ audit، بستن restore.

🟡 خطاها بی‌صدا قورت داده می‌شوند و هر درخواست یک write دارد — BidarApiKeyLogin::login()

دو catch (Throwable) خالی وجود دارد و lastUsedAt در هر فراخوانی API ذخیره می‌شود.
راه‌حل: لاگ در سطح warning؛ به‌روزرسانی lastUsedAt حداکثر یک‌بار در چند دقیقه.

🟡 تصمیم دسترسی با isAdmin() — BidarApiKeyService (سه جا) و GetDashboardSummary

Espo 10.1 در User.php این کاربرد را deprecated کرده و Acl::checkAdmin را توصیه می‌کند؛ isAdmin() برای کاربر system هم true است.
راه‌حل: تزریق Acl و استفاده از checkAdmin() یا isEffectiveAdmin().
ب) ACL

🟠 مسیر دوم داشبورد fail-open است — GetDashboardSummary::process()

اگر کوئری دارای فیلتر ACL استثنا بدهد، catch (Throwable) به کوئری بدون فیلتر برمی‌گردد.
در آن حالت سطح team نادیده گرفته می‌شود و کاربر سطح own با پارامتر assignedUserId داده دیگران را می‌بیند.
شرط if ($acl && ...) هم وقتی $acl تهی باشد چک را رد می‌کند.
راه‌حل: حذف fallback و در خطا Forbidden یا rethrow؛ تست با کاربر team و با assignedUserId کاربر دیگر.

🟠 هدف فروش کاربر دیگر بدون ACL خوانده می‌شود — GetDashboardSummary::process()

با assignedUserId هر کاربری، نام و عدد هدف او برمی‌گردد.
اگر هدف فعال نباشد، آخرین هدفِ هر حوزه و دوره‌ای نمایش داده می‌شود.
راه‌حل: اعمال ACL روی BidarGoal؛ حذف fallback «آخرین هدف» یا فیلتر دوره و وضعیت فعال.

🟡 مدیر از مسیر عمومی REST مقدار keyHash را می‌بیند — اسکوپ BidarUserApiKey با entity: true

formatKeySafe() قول می‌دهد hash برنگردد، ولی GET /Api/v1/BidarUserApiKey برای مدیر keyHash را برمی‌گرداند.
برای غیرمدیر بسته است، بر اساس DefaultTable.php و ScopeChecker هسته.
راه‌حل: حذف keyHash از خروجی عمومی، مثلاً با recordDefs.BidarUserApiKey.outputFilterClassNameList.
ج) تولید کلید API

🟠 چرخش کلید، انقضا و وضعیت را دست نمی‌زند — rotateKey()

چرخش کلید منقضی یا غیرفعال، کلیدی می‌دهد که همان‌طور بی‌استفاده است.
راهی برای تغییر انقضا یا لیست IP وجود ندارد.
راه‌حل: پذیرش expiresAt و allowedIpList اختیاری و اعتبارسنجی‌شده، isActive=true صریح، پیام روشن برای کلید منقضی.

🟠 اعتبارسنجی ورودی ساخت کلید سست است — createKey()

strtotime() تقریباً هر چیزی را می‌پذیرد و تاریخ گذشته هم مجاز است، یعنی کلید از همان ابتدا منقضی است.
پیش‌فرض بدون انقضا است.
زمان ورودی بر اساس timezone سرور (UTC) تفسیر می‌شود، نه تهران.
اگر userId رشته نباشد، بی‌صدا برای خود کاربر کلید ساخته می‌شود.
راه‌حل: پارس سخت‌گیرانه، رد تاریخ گذشته، TTL پیش‌فرض و حداکثر، خطای 400 برای userId نامعتبر.

🟡 بهداشت کد — BidarApiKeyService

KEY_PREFIX_LENGTH = 16 استفاده نمی‌شود و extractPrefix() عدد 12 را hard-code کرده است.
طول name قبل از ذخیره بررسی نمی‌شود و رکورد بلندتر از ۱۰۰ نویسه به خطای دیتابیس می‌رسد.
EntityManager تهی به BadRequest می‌رسد (باید 500 باشد) و listKeys بی‌صدا لیست خالی برمی‌گرداند.
سقفی برای تعداد کلید هر کاربر نیست.
راه‌حل: یکسان‌سازی ثابت، اعتبارسنجی طول، استثنای درست، سقف تعداد کلید.
د) منطق محاسبهٔ کاریز

🟠 احتمال صفر برابر باخت گرفته می‌شود — calculateSummary()

هر معامله باز با probability = 0 (پیش‌فرض مرحله یا انتخاب کاربر) باخت حساب می‌شود، در «سایر» می‌افتد و از قیف حذف می‌شود.
نرخ تبدیل و قیف را خراب می‌کند.
راه‌حل: won/lost فقط از stage (mappedStatus) و probability فقط به‌عنوان fallback.

🟡 دو تعریف «برنده» — calculateSummary() در برابر calculateGoalProgress()

اولی mappedStatus مرحله را می‌بیند، دومی نه، چون stages به آن پاس نمی‌شود؛ پیشرفت هدف می‌تواند با wonAmount ناهمخوان شود.
راه‌حل: یک helper مشترک برای هر دو.

🟠 هدف تیمی درست محاسبه نمی‌شود — calculateGoalProgress() و GetDashboardSummary

scopeType = team در تعریف موجودیت مجاز است ولی فقط user پیاده شده؛ هدف تیمی معاملات همه را می‌شمارد و در اکشن هم انتخاب نمی‌شود.
راه‌حل: فیلتر با teamId یا حذف گزینه تا زمان پیاده‌سازی.

🟠 مبنای بازه زمانی ناهمسان است — GetDashboardSummary و calculateGoalProgress()

داشبورد معاملات را با createdAt فیلتر می‌کند، ولی هدف با closeDate و در بازه خودش.
معیار dealsCreated هم closeDate را مبنا می‌گیرد.
راه‌حل: فیلد تاریخ جداگانه برای هر معیار و هم‌راستاسازی با بازه داشبورد.

🟡 قیف بر اساس نام مرحله کلید می‌خورد — calculateSummary()

در داشبورد چندکاریزیِ بدون pipelineId، مراحل هم‌نام ادغام می‌شوند.
معامله‌ای که به هیچ مرحله‌ای نخورده در openCount هست ولی در قیف نیست.
راه‌حل: کلید با ID مرحله و یک bucket «نامشخص».

🟡 موارد جزئی — calculateGoalProgress() و calculateSummary()

معامله یا فعالیت بدون تاریخ، حتی با بازه هدف، شمرده می‌شود.
metricType ناشناخته بی‌صدا صفر می‌شود.
چرخه فروش منفی به‌جای حذف، صفر حساب می‌شود.
جمع‌های float گرد نمی‌شوند.
آنچه درست است
تولید کلید: random_bytes(24) یعنی ۱۹۲ بیت، ذخیره با SHA-256، نمایش یک‌بار، و پیشوند نمایشی فقط ۳۲ بیت از کلید را لو می‌دهد.
ورود: بررسی انقضا، IP و نوع صاحب کلید fail-closed است.
مسیر اصلی داشبورد: withStrictAccessControl() در Espo 10.1 وجود دارد و فیلتر ACL را در کوئری اعمال می‌کند.
آنچه تأیید نشده
تست‌ها: مجموعه تست اجرا نشد.
CSRF روی روت‌های POST و DELETE کلید: بررسی نکردم؛ اثرش محدود است، چون plainKey فقط در پاسخ برمی‌گردد.
پراکسی معکوس: رفتار پشت آن به نحوه استقرار بستگی دارد.
بازه شمسی: timezone را در JalaliHelper (ماژول BidarIran) نخواندم.

اگر بخواهید، به ترتیب ۱ ← ۶ ← ۱۲ و با TDD (اول تست) اصلاح می‌کنم.