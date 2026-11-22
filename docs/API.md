# مستند مرجع فنی API های بیدار (BidarCRM API Reference)

> **نسخه:** 1.0.0  
> **پایه هسته:** EspoCRM 10.1.4 REST API  
> **پیشوند مسیر:** `/api/v1/`

این سند مرجع فنی و راهنمای جامع تعامل با رابط‌های برنامه‌نویسی نرم‌افزار (API) سامانه بیدار است. این مستندات شامل سازوکار احراز هویت، اندپوینت‌های اختصاصی ماژول‌های فروش (`BidarSales`) و بومی‌سازی ایران (`BidarIran`)، مدل داده معاملات راکد و کدهای وضعیت استاندارد می‌باشد.

---

## ۱. معماری ارتباطی و احراز هویت (Authentication)

تمامی ارتباطات میان فرانت‌افیس بیدار و موتور بک‌اند از طریق درگاه یکپارچه مبدأ یکسان (`Same-Origin`) روی مسیر `/api/v1/` انجام می‌پذیرد. بدین ترتیب نیازی به هدرهای CORS نبوده و کوکی‌های امنیتی به صورت خودکار منتقل می‌شوند.

### ۱.۱. جریان ورود و دریافت توکن (Login Flow)

برای ورود به سامانه، کلاینت در اولین مرحله درخواست شناسایی را به اندپوینت هسته ارسال می‌کند:

- **روش:** `GET`
- **مسیر:** `/api/v1/App/user`
- **هدرهای درخواست:**
  ```http
  Authorization: Basic <base64(username:password)>
  Accept: application/json
  ```
- **پاسخ موفق (HTTP 200 OK):**
  پاسخ حاوی متادیتای کاربر و توکن اعتبارسنجی اولیه است. هسته بیدار همچنین یک کوکی امن با پرچم `HttpOnly` به نام `auth-token-secret` را جهت حفظ پایداری نشست ارسال می‌نماید.

### ۱.۲. هدرهای درخواست‌های احراز هویت‌شده (Authenticated Requests)

برای تمامی درخواست‌های بعدی، کلاینت باید مشخصات توکن دریافت شده را در هدرهای استاندارد EspoCRM ارسال کند:

```http
Espo-Authorization: <base64(username:token)>
Espo-Authorization-By-Token: true
Accept: application/json
Content-Type: application/json
```

> **نکته امنیتی:** کلیه درخواست‌های فرانت‌افیس با گزینه `credentials: 'include'` ارسال می‌شوند تا سکرت رمزنگاری‌شده سشن در کوکی همراه درخواست به سرور منتقل شود.

### ۱.۳. احراز هویت اختصاصی وب‌هوک VoIP (Token-Secret Header)

اندپوینت وب‌هوک سانترال تلفن ابری بیدار (`/api/v1/BidarVoip/webhook`) به دلیل فراخوانی مستقیم از سوی سرورهای سانترال (PBX) مانند ایزابل، فری‌پی‌بی‌ایکس یا خطوط تلفن ابری، از سیستم احراز هویت مبتنی بر هدر اختصاصی استفاده می‌کند:

- **هدر اعتبارسنجی:** `X-Voip-Token: <YOUR_WEBHOOK_SECRET>`
- **اعتبارسنجی در بک‌اند:** با تابع ایمن `hash_equals` جهت پیشگیری مطلق از حملات تحلیل زمانی (Timing Attacks) انجام می‌شود.

---

## ۲. اندپوینت تجمیعی داشبورد فروش (`BidarSales`)

این اندپوینت داده‌های تحلیلی و آماری مورد نیاز داشبورد مدیریت و فروش را در یک فراخوانی شبکه سبک تجمیع می‌کند.

### ۲.۱. مشخصات فنی اندپوینت
- **مسیر:** `/api/v1/BidarDashboard/summary`
- **متد:** `GET`
- **کنترلر بک‌اند:** `Espo\Modules\BidarSales\Api\GetDashboardSummary`
- **سرویس محاسباتی:** `Espo\Modules\BidarSales\Services\DashboardSummaryService`
- **سطح دسترسی:** نیاز به احراز هویت کاربری (Espo-Authorization)

### ۲.۲. نمونه درخواست
```bash
curl -X GET "https://crm.example.com/api/v1/BidarDashboard/summary" \
     -H "Espo-Authorization: YWRtaW46MmE5ZjEwYzkz..." \
     -H "Espo-Authorization-By-Token: true" \
     -H "Accept: application/json"
```

### ۲.۳. ساختار پاسخ (JSON Response Schema)
```json
{
  "openCount": 18,
  "openAmount": 1450000000.0,
  "wonCount": 7,
  "wonAmount": 890000000.0,
  "rottenCount": 3,
  "overdueActivitiesCount": 4,
  "funnelStages": [
    {
      "id": "stage-lead",
      "name": "سرنخ جدید",
      "count": 8,
      "amount": 400000000.0
    },
    {
      "id": "stage-contact",
      "name": "تماس اولیه و ارزیابی",
      "count": 5,
      "amount": 350000000.0
    },
    {
      "id": "stage-proposal",
      "name": "ارسال پیش‌فاکتور و مذاکره",
      "count": 3,
      "amount": 420000000.0
    },
    {
      "id": "stage-contract",
      "name": "تنظیم قرارداد",
      "count": 2,
      "amount": 280000000.0
    }
  ]
}
```

### ۲.۴. شرح فیلدهای خروجی
| نام فیلد | نوع داده | توضیحات |
| :--- | :--- | :--- |
| `openCount` | `int` | تعداد کل معاملات باز و جاری در خط لوله فروش |
| `openAmount` | `float` | مجموع ارزش ریالی معاملات جاری |
| `wonCount` | `int` | تعداد معاملات موفق برنده شده (`Closed Won`) |
| `wonAmount` | `float` | مجموع ارزش ریالی معاملات موفق |
| `rottenCount` | `int` | تعداد معاملات باز که به وضعیت پوسیده (فاقد پیگیری موثر) درآمده‌اند |
| `overdueActivitiesCount` | `int` | تعداد وظایف و پیگیری‌های معوقه و تاریخ‌گذشته فروشندگان |
| `funnelStages` | `array` | لیست تفکیکی مراحل کاریز، تعداد معاملات در هر مرحله و ارزش مالی متناظر |

---

## ۳. اندپوینت وب‌هوک سانترال تلفن ابری (`BidarIran`)

این اندپوینت رویدادهای تماس تلفنی ورودی یا خروجی سانترال را دریافت کرده و به صورت هوشمند پرونده مخاطب و معاملات مرتبط را شناسایی و بازیابی می‌نماید.

### ۳.۱. مشخصات فنی اندپوینت
- **مسیر:** `/api/v1/BidarVoip/webhook`
- **متد:** `POST`
- **کنترلر بک‌اند:** `Espo\Modules\BidarIran\Api\PostVoipWebhook`
- **سرویس:** `Espo\Modules\BidarIran\Services\VoipLookupService`
- **نرمال‌ساز شماره:** `Espo\Modules\BidarIran\Support\IranPhoneNormalizer`
- **سطح دسترسی:** عمومی با هدر اعتبارسنجی `X-Voip-Token` (`noAuth: true` در روت هسته)

### ۳.۲. بدنه درخواست (Request Body)
```json
{
  "caller": "09123456789",
  "extension": "104",
  "callId": "call-uniq-9872134",
  "duration": 145,
  "status": "answered",
  "direction": "inbound"
}
```

### ۳.۳. نمونه درخواست
```bash
curl -X POST "https://crm.example.com/api/v1/BidarVoip/webhook" \
     -H "Content-Type: application/json" \
     -H "X-Voip-Token: my-secure-voip-token-12345" \
     -d '{
       "caller": "۰۹۱۲۳۴۵۶۷۸۹",
       "extension": "101",
       "callId": "rec-55214",
       "status": "answered"
     }'
```

### ۳.۴. منطق نرمال‌سازی شماره تلفن ایرانی (`IranPhoneNormalizer`)
سیستم ورودی را در گام‌های زیر پاکسازی و یکنواخت می‌کند:
1. تبدیل ارقام فارسی (`۰-۹`) و عربی (`٠-٩`) به ارقام استاندارد اسکی (`0-9`).
2. حذف کاراکترهای اضافه مانند خط تیره، فاصله و پرانتز.
3. پشتیبانی از پیشوندهای `+98`، `0098`، `98` و `09`.
4. نگاشت دقیق به ساختار فرمت محلی (`0912xxxxxxx`) و فرمت جهانی استاندارد E.164 (`+98912xxxxxxx`).

### ۳.۵. پاسخ موفق هنگام شناسایی مخاطب (JSON Response Schema)
```json
{
  "found": true,
  "normalizedPhone": "+989123456789",
  "contact": {
    "id": "contact-701",
    "name": "محمدرضا رضایی",
    "phone": "09123456789",
    "email": "rezaei@example.com",
    "accountName": "شرکت مهندسی پویا فن"
  },
  "deals": [
    {
      "id": "deal-101",
      "name": "تجهیز سرورهای شرکت پویا فن",
      "stage": "ارسال پیش‌فاکتور و مذاکره",
      "amount": 280000000,
      "contactId": "contact-701"
    }
  ]
}
```

### ۳.۶. پاسخ هنگام عدم یافتن مخاطب
```json
{
  "found": false,
  "normalizedPhone": "+989123456789",
  "contact": null,
  "deals": []
}
```

---

## ۴. هوک‌ها و منطق محاسباتی معاملات راکد (Rotten Deals & Pipelines)

بیدار با هدف جلوگیری از فراموش شدن معاملات در میان مشغله‌های روزمره فروشندگان، از یک موتور پایش بلادرنگ رکود بهره می‌برد.

### ۴.۱. متادیتای موجودیت‌ها

#### الف) موجودیت معامله (`Opportunity`)
- `lastActivityAt` (`datetime`, `readOnly: true`, `index: true`): تاریخ و زمان دقیق آخرین تعامل روی این معامله.
- `isRotten` (`bool`, `notStorable: true`, `readOnly: true`): پرچم محاسباتی مشخص‌کننده پوسیدگی معامله.
- `daysSinceLastActivity` (`int`, `notStorable: true`, `readOnly: true`): تعداد روزهای سپری‌شده از آخرین تعامل.

#### ب) موجودیت مرحله کاریز (`PipelineStage`)
- `rottenDays` (`int`, `min: 1`): حداکثر روزهای مجاز توقف معامله در این مرحله قبل از پوسیده اعلام شدن.

### ۴.۲. سازوکار خودکار هوک‌های به‌روزرسانی (`Activity Hooks`)
1. **هنگام ساخت معامله جدید (`InitLastActivity`):** مقدار `lastActivityAt` با زمان جاری سیستم مقداردهی اولیه می‌شود.
2. **هنگام ثبت تعامل جدید (`UpdateOpportunityActivity`):** هرگاه تماس تلفنی، یادداشت استریم، ایمیل، تسک یا تغییری در مرحله معامله ثبت گردد، هوک سراسری سیستم بلافاصله فیلد `lastActivityAt` معامله متصل را به تاریخ و زمان جاری آپدیت می‌کند.

### ۴.۳. الگوریتم محاسبه وضعیت پوسیدگی (`RottenDealCalculator`)
وضعیت پوسیدگی معامله بر اساس فرمول زیر ارزیابی می‌شود:

$$\Delta t = \text{days}(\text{now} - \text{lastActivityAt})$$

- اگر مرحله معامله `Closed Won` یا `Closed Lost` باشد $\rightarrow$ معامله هرگز پوسیده نمی‌شود (`isRotten = false`).
- اگر مقدار `rottenDays` برای مرحله تعریف نشده باشد $\rightarrow$ معامله هرگز پوسیده نمی‌شود (`isRotten = false`).
- در غیر این صورت:
  $$\text{isRotten} = (\Delta t > \text{rottenDays})$$

---

## ۵. ارسال پیامک اطلاع‌رسانی (`KavenegarSmsProvider`)

ماژول `BidarIran` سرویس ارسال پیامک از طریق سامانه کاوه‌نگار را در قالب درایور رسمی در اختیار سایر بخش‌ها قرار می‌دهد:
- **اندپوینت بیرونی کاوه‌نگار:** `https://api.kavenegar.com/v1/{API_KEY}/sms/send.json`
- **پارامترها:**
  - `receptor`: شماره موبایل مقصد در فرمت نرمال محلی ایران (`09xxxxxxxxx`).
  - `message`: متن پیام ارسالی.
  - `sender`: خط فرستنده اختصاصی (اختیاری).

---

## ۶. کدهای خطای استاندارد HTTP

| کد وضعیت | عنوان خطا | علت و سناریوی وقوع |
| :---: | :--- | :--- |
| `200` | OK | درخواست با موفقیت پردازش شد و خروجی معتبر است. |
| `400` | Bad Request | پارامترهای ورودی نامعتبر هستند (مانند شماره تلفن نامعتبر یا عدم ارسال فیلدهای اجباری). |
| `401` | Unauthorized | عدم ارسال توکن احراز هویت، انقضای نشست کاربری یا نامعتبر بودن رمز سشن. کلاینت بیدار به طور خودکار به صفحه ورود هدایت می‌شود. |
| `403` | Forbidden | کاربر جاری سطح دسترسی لازم (ACL) برای مشاهده یا تغییر این رکورد را ندارد. |
| `404` | Not Found | شناسه رکورد، معامله، مخاطب یا روت درخواست‌شده یافت نشد. |
| `500` | Internal Server Error | خطای غیرمنتظره در پردازش‌های داخلی سرور یا اتصال پایگاه داده. |
