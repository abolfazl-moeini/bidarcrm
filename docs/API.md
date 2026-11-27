# مستند جامع مرجع فنی REST API بیدار (BidarCRM REST API Reference)

> **نسخه مستند:** 2.0.0  
> **پایه هسته:** EspoCRM 10.1.4 REST API  
> **پیشوند آدرس (Base URL):** `/api/v1/`  
> **فرمت‌های داده:** `application/json` (پیش‌فرض) و `text/csv` (در خروجی‌های جدول)

این مستند، مرجع رسمی و راهنمای کامل برنامه‌نویسان جهت تعامل و اتصال سامانه‌های بیرونی (فروشگاه‌های اینترنتی مانند ووکامرس، وب‌سایت‌ها، فرم‌های لندینگ، خطوط تلفن ابری VoIP و اتوماسیون‌های سازمانی) با سامانه مدیریت ارتباط با مشتری بیدار (BidarCRM) است.

---

## ۱. اصول امنیتی و احراز هویت (Authentication & Security)

ارتباطات با بیدار به صورت کاملاً امن (`HTTPS`) انجام می‌پذیرد. سامانه‌های شخص ثالث می‌توانند از کلید اختصاصی API (`X-Api-Key`) یا توکن‌های استاندارد جهت برقراری ارتباط استفاده کنند.

### ۱.۱. اصل عدم ارتقای سطح دسترسی (Zero Privilege Escalation)
کلیدهای کاربری تولیدشده در سامانه بیدار (`BidarUserApiKey`) مستقیماً به کاربر مالک متصل هستند:
- تمامی محدودیت‌ها، سطوح دسترسی (ACL)، تیم‌ها و دسترسی رکوردی کاربر صادرکننده کلید، عیناً بر روی تمامی درخواست‌های ارسالی با آن کلید اعمال می‌شود.
- کاربران بدون سطح دسترسی ادمین هرگز نمی‌توانند داده‌های فراتر از دسترسی سازمانی خود را دریافت یا ویرایش کنند.
- در صورت فعال بودن احراز هویت دو مرحله‌ای (2FA) برای کاربر، درخواست‌های معتبر REST API به صورت خودکار و بدون انسداد (`withBypassSecondStep`) پردازش می‌شوند.

### ۱.۲. روش‌های احراز هویت

#### الف) کلید اختصاصی API کاربر (توصیه‌شده برای وب‌سایت‌ها و افزونه‌ها)
کلید را در هدر درخواست ارسال فرمایید:
```http
X-Api-Key: bdr_live_7a9c8e1f0b2d4e6a8c0e2f4a6b8d0e2f4a6b8d0e2f4a6b8d
Accept: application/json
Content-Type: application/json
```

#### ب) توکن نشست کاربری (Espo-Authorization)
درخواست‌های کلاینت وب و فرانت‌افیس بیدار از توکن سشن استفاده می‌نمایند:
```http
Espo-Authorization: <base64(username:token)>
Espo-Authorization-By-Token: true
```

#### ج) وب‌هوک سانترال و تلفن ابری (VoIP Caller ID)
رویدادهای تماس ورودی از خطوط تلفن با هدر اختصاصی اعتبارسنجی می‌شوند:
```http
X-Voip-Token: <YOUR_WEBHOOK_SECRET>
```

---

## ۲. خلاصه اندپوینت‌های کلیدی بیدار

| حوزه | متد | مسیر اندپوینت | شرح عملکرد |
| :--- | :---: | :--- | :--- |
| **پروفایل کاربر** | `GET` | `/App/user` | دریافت اطلاعات، نقش‌ها و اختیارات کاربر جاری |
| **مدیریت کلید API** | `GET` | `/BidarApiKey` | دریافت لیست کلیدهای فعال کاربر جاری |
| **مدیریت کلید API** | `POST` | `/BidarApiKey` | ساخت کلید API جدید (نمایش متن خام فقط یک‌بار) |
| **مدیریت کلید API** | `POST` | `/BidarApiKey/:id/rotate` | چرخش و تولید مجدد کلید امنیتی |
| **مدیریت کلید API** | `DELETE` | `/BidarApiKey/:id` | ابطال و حذف کلید |
| **کاریز فروش** | `GET` | `/Pipeline` | دریافت لیست کاریزهای فروش |
| **مراحل کاریز** | `GET` | `/PipelineStage` | دریافت مراحل کاریز و تنظیمات رکود (`rottenDays`) |
| **معاملات** | `GET` | `/Opportunity` | جستجو و دریافت لیست معاملات همراه وضعیت پوسیدگی |
| **معاملات** | `POST` | `/Opportunity` | ثبت معامله جدید با مرحله و اقلام |
| **معاملات** | `PUT` | `/Opportunity/:id` | ویرایش معامله، تغییر مرحله، ثبت دلایل شکست |
| **اشخاص (مخاطبین)** | `GET` | `/Contact` | دریافت و فیلتر اشخاص حقیقی |
| **اشخاص (مخاطبین)** | `POST` | `/Contact` | ثبت مخاطب با کد ملی و شماره موبایل ایران |
| **شرکت‌ها** | `GET` | `/Account` | دریافت و جستجوی شرکت‌ها و سازمان‌ها |
| **شرکت‌ها** | `POST` | `/Account` | ثبت شرکت با شناسه ملی و اطلاعات بانکی/شبا |
| **سرنخ‌های فروش** | `GET` | `/Lead` | دریافت سرنخ‌های ورودی |
| **سرنخ‌های فروش** | `POST` | `/Lead` | ایجاد سرنخ از فرم‌ها و کمپین‌ها |
| **تبدیل سرنخ** | `POST` | `/Lead/action/convert` | تبدیل یک‌کلیکه سرنخ به معامله + شخص + شرکت |
| **وظایف و پیگیری‌ها**| `GET` | `/Task` | دریافت وظایف، پیگیری‌ها و کانبان کارها |
| **وظایف و پیگیری‌ها**| `POST` | `/Task` | ثبت وظیفه یا یادآوری جدید با مهلت زمانی |
| **تماس‌های تلفنی** | `POST` | `/Call` | ثبت تماس تلفنی انجام‌شده یا برنامه‌ریزی‌شده |
| **جلسات** | `POST` | `/Meeting` | ثبت جلسه حضوری یا آنلاین |
| **یادداشت و استریم**| `POST` | `/Note` | ثبت یادداشت ۳۶۰ درجه روی پرونده معامله |
| **پیوست فایل** | `POST` | `/Attachment` | بارگذاری فایل، پیش‌فاکتور و اسناد |
| **محصولات و خدمات** | `GET` | `/BidarProduct` | دریافت کاتالوگ محصولات با قیمت واحد |
| **اقلام معامله** | `POST` | `/BidarDealItem` | افزودن ردیف محصول به معامله (محاسبه خودکار جمع کل) |
| **اهداف فروش** | `GET` | `/BidarGoal` | دریافت اهداف فروش ماهانه و فصلی شمسی |
| **ارسال پیامک** | `POST` | `/BidarSms/send` | ارسال پیامک تکی یا گروهی از طریق کاوه‌نگار |
| **قالب‌های پیامک** | `GET` | `/BidarSmsTemplate` | دریافت قالب‌های از پیش‌تعریف‌شده پیامک |
| **داشبورد فروش** | `GET` | `/BidarDashboard/summary` | دریافت آمار تجمیعی، قیف فروش، دلایل باخت و رکود |
| **خروجی CSV فارسی**| `GET` | `/BidarExport/:entityType` | دانلود خروجی استاندارد اکسل با UTF-8 BOM و تاریخ شمسی |

---

## ۳. راهنمای تفصیلی اندپوینت‌ها و نمونه‌های `cURL`

### ۳.۱. اطلاعات کاربر جاری (`/App/user`)
اطلاعات هویتی و پرمیشن‌های کاربری که با کلید یا توکن به سامانه متصل شده را برمی‌گرداند.

```bash
curl -s -X GET "https://crm.example.com/api/v1/App/user" \
  -H "X-Api-Key: bdr_live_xxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Accept: application/json"
```

---

### ۳.۲. مدیریت کلیدهای API کاربر (`/BidarApiKey`)

#### دریافت لیست کلیدهای کاربر (`GET /BidarApiKey`)
هش کلید (`keyHash`) به دلایل امنیتی هرگز در خروجی بازگردانده نمی‌شود و فقط پیشوند غیرحساس (`keyPrefix`) نمایش داده می‌شود.

```bash
curl -s -X GET "https://crm.example.com/api/v1/BidarApiKey" \
  -H "X-Api-Key: bdr_live_xxxxxxxxxxxxxxxxxxxxxxxx"
```

پاسخ نمونه:
```json
{
  "list": [
    {
      "id": "674218a0b1234",
      "name": "فروشگاه ووکامرس اصلی",
      "userId": "673f10a012345",
      "keyPrefix": "bdr_live_7a9c8e1...",
      "isActive": true,
      "expiresAt": "2027-03-20 00:00:00",
      "lastUsedAt": "2026-11-23 20:15:00",
      "allowedIpList": ["185.120.220.10"],
      "createdAt": "2026-11-20 10:00:00"
    }
  ],
  "total": 1
}
```

#### ایجاد کلید API جدید (`POST /BidarApiKey`)
> **توجه:** کلید کامل (`plainKey`) **تنها یک‌بار** در پاسخ بازگردانده می‌شود. آن را در جای امن ذخیره فرمایید.

```bash
curl -s -X POST "https://crm.example.com/api/v1/BidarApiKey" \
  -H "X-Api-Key: bdr_live_xxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "سایت بازرگانی تهران",
    "expiresAt": "2027-01-01 00:00:00",
    "allowedIpList": ["192.168.1.1", "185.200.10.5"]
  }'
```

پاسخ نمونه (HTTP 201 Created):
```json
{
  "id": "674218a0b9876",
  "name": "سایت بازرگانی تهران",
  "userId": "673f10a012345",
  "keyPrefix": "bdr_4f89a1b2c3d...",
  "plainKey": "bdr_4f89a1b2c3d4e5f67890abcdef1234567890abcdef123456",
  "isActive": true,
  "expiresAt": "2027-01-01 00:00:00",
  "allowedIpList": ["192.168.1.1", "185.200.10.5"],
  "createdAt": "2026-11-23 21:00:00"
}
```

#### چرخش کلید API (`POST /BidarApiKey/:id/rotate`)
هش قبلی کلید باطل شده و یک کلید جدید با همان نام و اختیارات تولید می‌شود.

```bash
curl -s -X POST "https://crm.example.com/api/v1/BidarApiKey/674218a0b9876/rotate" \
  -H "X-Api-Key: bdr_live_xxxxxxxxxxxxxxxxxxxxxxxx"
```

#### ابطال و حذف کلید (`DELETE /BidarApiKey/:id`)
```bash
curl -s -X DELETE "https://crm.example.com/api/v1/BidarApiKey/674218a0b9876" \
  -H "X-Api-Key: bdr_live_xxxxxxxxxxxxxxxxxxxxxxxx"
```

---

### ۳.۳. کاریز فروش و مراحل (`/Pipeline` و `/PipelineStage`)
در فرهنگ واژگان بیدار، فرآیند فروش همواره **«کاریز فروش»** نامیده می‌شود.

```bash
# دریافت لیست کاریزهای فروش
curl -s -X GET "https://crm.example.com/api/v1/Pipeline" \
  -H "X-Api-Key: bdr_live_xxxxxxxxxxxxxxxxxxxxxxxx"

# دریافت مراحل کاریز با شاخص روزهای رکود (rottenDays)
curl -s -X GET "https://crm.example.com/api/v1/PipelineStage?orderBy=order" \
  -H "X-Api-Key: bdr_live_xxxxxxxxxxxxxxxxxxxxxxxx"
```

---

### ۳.۴. معاملات و فروش (`/Opportunity`)

#### ثبت معامله جدید
```bash
curl -s -X POST "https://crm.example.com/api/v1/Opportunity" \
  -H "X-Api-Key: bdr_live_xxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "فروش تجهیزات شبکه به شرکت البرز",
    "amount": 185000000,
    "amountCurrency": "IRR",
    "pipelineId": "673f10a011111",
    "pipelineStageId": "673f10a022222",
    "closeDate": "2026-12-15",
    "accountId": "673f10a033333",
    "contactId": "673f10a044444"
  }'
```

#### علامت‌گذاری معامله ناموفق و ثبت دلیل باخت (`Loss Reason`)
هنگامی که معامله‌ای شکست می‌خورد، ثبت دلیل باخت الزامی است تا در نمودار دلایل شکست داشبورد پایش شود:

```bash
curl -s -X PUT "https://crm.example.com/api/v1/Opportunity/674218a0b0001" \
  -H "X-Api-Key: bdr_live_xxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "stage": "Closed Lost",
    "lossReason": "قیمت بالا",
    "lossReasonDescription": "مشتری با شرکت رقیب به دلیل تخفیف ۱۵ درصدی قرارداد بست."
  }'
```

---

### ۳.۵. اشخاص و شرکت‌ها (`/Contact` و `/Account`)
فیلدهای بومی‌سازی شده ایران و دسته‌بندی مشتریان را می‌توانید در این اندپوینت‌ها بخوانید و بنویسید:

```bash
# ثبت شخص حقیقی با کد ملی و شماره موبایل
curl -s -X POST "https://crm.example.com/api/v1/Contact" \
  -H "X-Api-Key: bdr_live_xxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "رضا",
    "lastName": "احمدی",
    "phoneNumber": "09121234567",
    "emailAddress": "ahmadi@example.ir",
    "nationalCode": "0012345678",
    "customerGroups": ["مشتریان ویژه (VIP)", "عمده‌فروش"]
  }'

# ثبت شرکت با شناسه ملی و شماره شبا
curl -s -X POST "https://crm.example.com/api/v1/Account" \
  -H "X-Api-Key: bdr_live_xxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "شرکت مهندسی پویا فن خاورمیانه",
    "phoneNumber": "02188776655",
    "nationalId": "10101234567",
    "postalCode": "1998765432",
    "shebaNumber": "IR120170000000123456789012",
    "website": "https://pooyafan.example.ir"
  }'
```

---

### ۳.۶. سرنخ‌های فروش و تبدیل یک‌کلیکه (`/Lead`)

#### ثبت سرنخ جدید (از فرم تماس وب‌سایت)
```bash
curl -s -X POST "https://crm.example.com/api/v1/Lead" \
  -H "X-Api-Key: bdr_live_xxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "محمد",
    "lastName": "صادقی",
    "phoneNumber": "09351112233",
    "accountName": "فروشگاه سپهر",
    "source": "وب‌سایت",
    "description": "درخواست مشاوره برای خرید عمده سرور"
  }'
```

#### تبدیل سرنخ به معامله + شخص + شرکت (`POST /Lead/action/convert`)
```bash
curl -s -X POST "https://crm.example.com/api/v1/Lead/action/convert" \
  -H "X-Api-Key: bdr_live_xxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "674218a0b5555",
    "records": {
      "Opportunity": { "name": "معامله اولیه سرور - فروشگاه سپهر" },
      "Account": { "name": "فروشگاه سپهر" },
      "Contact": { "firstName": "محمد", "lastName": "صادقی" }
    }
  }'
```

---

### ۳.۷. فعالیت‌ها، وظایف و پیگیری‌ها (`/Task`, `/Call`, `/Meeting`)

#### ثبت وظیفه پیگیری با مهلت زمانی
```bash
curl -s -X POST "https://crm.example.com/api/v1/Task" \
  -H "X-Api-Key: bdr_live_xxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ارسال پیش‌فاکتور رسمی و تماس پیگیری",
    "priority": "High",
    "status": "Not Started",
    "dateEnd": "2026-11-25 14:00:00",
    "parentType": "Opportunity",
    "parentId": "674218a0b0001"
  }'
```

---

### ۳.۸. اقلام محصول معامله با جمع خودکار (`BidarDealItem`)
هرگاه ردیفی به جدول اقلام معامله اضافه یا حذف گردد، فیلد `amount` معامله از طریق هوک سرور `RecalculateOpportunityAmount` به صورت خودکار به‌روزرسانی می‌شود:

```bash
curl -s -X POST "https://crm.example.com/api/v1/BidarDealItem" \
  -H "X-Api-Key: bdr_live_xxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "opportunityId": "674218a0b0001",
    "productId": "prod-101",
    "name": "سرور رکمونت مدل X-200",
    "quantity": 2,
    "unitPrice": 45000000,
    "discountPercent": 5
  }'
```

---

### ۳.۹. ارسال پیامک و قالب‌ها (`/BidarSms`)

```bash
curl -s -X POST "https://crm.example.com/api/v1/BidarSms/send" \
  -H "X-Api-Key: bdr_live_xxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "receptor": "09121234567",
    "message": "جناب آقای احمدی، پیش‌فاکتور سفارش شما صادر گردید. سامانه بیدار."
  }'
```

---

### ۳.۱۰. آمار تجمیعی داشبورد فروش (`GET /BidarDashboard/summary`)
اطلاعات داشبورد شامل تعداد و ارزش معاملات باز، برنده، پوسیده، فعالیت‌های معوق، مراحل قیف فروش، دلایل شکست و هدف فروش را برمی‌گرداند.

```bash
curl -s -X GET "https://crm.example.com/api/v1/BidarDashboard/summary?jalaliPeriod=current_month" \
  -H "X-Api-Key: bdr_live_xxxxxxxxxxxxxxxxxxxxxxxx"
```

پارامترهای اختیاری کوئری:
- `pipelineId`: فیلتر بر اساس یک کاریز مشخص
- `assignedUserId`: فیلتر بر اساس کارشناس فروش
- `jalaliPeriod`: بازه زمانی شمسی (`current_month`, `last_month`, `current_quarter`)
- `dateFrom` و `dateTo`: فیلتر دستی تاریخ میلادی (`YYYY-MM-DD`)

پاسخ نمونه:
```json
{
  "openCount": 14,
  "openAmount": 1250000000.0,
  "wonCount": 6,
  "wonAmount": 780000000.0,
  "lostCount": 2,
  "conversionRate": 75.0,
  "rottenCount": 2,
  "overdueActivitiesCount": 3,
  "funnelStages": [
    { "id": "st-1", "name": "سرنخ جدید", "count": 5, "amount": 350000000.0 },
    { "id": "st-2", "name": "مذاکره و پیش‌فاکتور", "count": 6, "amount": 600000000.0 },
    { "id": "st-3", "name": "تنظیم قرارداد", "count": 3, "amount": 300000000.0 }
  ],
  "lossReasonsBreakdown": [
    { "reason": "قیمت بالا", "count": 2, "amount": 140000000.0 }
  ],
  "goal": {
    "targetValue": 1000000000.0,
    "metricType": "wonAmount",
    "currentValue": 780000000.0,
    "achievementPercent": 78.0
  }
}
```

---

### ۳.۱۱. خروجی جدول داده به صورت CSV فارسی (`GET /BidarExport/:entityType`)
خروجی استاندارد، ایمن در برابر حملات تزریق فرمول (Formula Injection)، همراه با نشانگر **UTF-8 BOM** جهت باز شدن بی‌نقص در نسخه‌های مختلف نرم‌افزار اکسل، و تبدیل خودکار ستون‌های تاریخ میلادی به تاریخ خورشیدی (جلالی).

موجودیت‌های مجاز: `Opportunity`، `Contact`، `Account`، `Lead`، `Task`.

```bash
# دریافت فایل اکسل معاملات بازاریابی
curl -s -X GET "https://crm.example.com/api/v1/BidarExport/Opportunity" \
  -H "X-Api-Key: bdr_live_xxxxxxxxxxxxxxxxxxxxxxxx" \
  -o "opportunities-export.csv"
```

هدرهای بازگشتی:
```http
HTTP/1.1 200 OK
Content-Type: text/csv; charset=UTF-8
Content-Disposition: attachment; filename="opportunity-export-2026-11-23.csv"
```

---

## ۴. کدهای وضعیت خطای HTTP

| کد وضعیت | عنوان خطا | شرح و راهکار |
| :---: | :--- | :--- |
| **`200 OK`** | موفق | عملیات با موفقیت انجام شد و داده بازگردانده شد. |
| **`201 Created`** | رکورد ایجاد شد | منبع جدید (مانند کلید API یا معامله) ساخته شد. |
| **`400 Bad Request`** | درخواست نامعتبر | پارامترهای ارسالی ناقص یا دارای فرمت اشتباه هستند (مثلاً عدم ارسال فیلد اجباری `name` یا مقدار نامعتبر `entityType`). |
| **`401 Unauthorized`** | عدم احراز هویت | کلید `X-Api-Key` ارسال نشده، نامعتبر است، منقضی شده، یا IP درخواست‌کننده در لیست مجاز قرار ندارد. |
| **`403 Forbidden`** | دسترسی غیرمجاز | کاربر یا کلید معتبر است اما مجوز ACL لازم برای مشاهده یا ویرایش این بخش/رکورد را ندارد. |
| **`404 Not Found`** | رکورد یافت نشد | شناسه یا مسیر مورد تقاضا در دیتابیس یافت نشد. |
| **`500 Internal Error`**| خطای داخلی سرور | خطای پیش‌بینی نشده در سرور یا پایگاه داده رخ داده است. |

---

> **پشتیبانی فنی و گزارش بازخورد:**  
> کلیه بخش‌های معماری REST API بیدار تحت نظارت مهندسی سیستم‌های توزیع‌شده طراحی و تست شده‌اند و به طور کامل با ابزارهای استاندارد تست و خودکارسازی سازگار می‌باشند.
