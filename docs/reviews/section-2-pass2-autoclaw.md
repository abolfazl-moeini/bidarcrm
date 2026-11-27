# بازبینی امنیتی، معماری و استاندارد — بخش ۲
## ماژول بومی‌سازی ایران و ارتباطات (`extensions/bidar-iran/`)

**سامانه:** بیدار CRM (BidarCRM 1.0.3 روی EspoCRM 10.1.4، PHP 8.5.11)
**دامنه:** `Support/`، `Sms/`، `Services/`، `Api/`، `Hooks/` از ماژول `BidarIran`
**تاریخ بازبینی:** ۲۴ نوامبر ۲۰۲۶ (۳ آذر ۱۴۰۵)
**روش:** خواندن بند‌به‌بند کد، اجرای ۶۱ تست واحد موجود، و اجرای ۴ پروب اجرایی روی PHP برای اثبات/رد هر ادعا

---

## ۰. خلاصه مدیریتی

ماژول از نظر **انطباق الگوریتمی** در سطح قابل قبولی است (الگوریتم کد ملی، شناسه ملی حقوقی، شبا و تبدیل تقویم شمسی درست پیاده‌سازی شده‌اند و ۶۱ تست واحد سبز است). اما از نظر **قابلیت اجرا در محیط عملیاتی** یک نقص بنیادی دارد که کل ماژول را از کار می‌اندازد:

> **در EspoCRM، هر پارامتر سازنده‌ای که nullable باشد (`?Type $x = null`) هرگز تزریق نمی‌شود و همیشه `null` می‌گیرد.**
> شاهد: `engine/application/Espo/Core/InjectableFactory.php:279`
> ```php
> if ($dependencyClass && $param->allowsNull()) {
>     return null;          // ← قبل از تلاش برای ساخت وابستگی
> }
> ```
> و `Api/RouteProcessor.php:170` اکشن‌ها را با همین `injectableFactory->create($actionClassName)` می‌سازد.

نتیجه‌ی مستقیم:

| نقطه ورود | وضعیت واقعی در پروداکشن | علت |
|---|---|---|
| `POST /BidarSms/send` | **همیشه شکست** («API key is not configured») | `?EntityManager` → `null` → `KavenegarSender` بدون کلید ساخته می‌شود |
| `POST /BidarVoip/webhook` | **همیشه ۴۰۳** («Invalid or missing VoIP webhook secret») | `?EntityManager` → `null` → `$secret = ''` → `authenticate()` fail-closed |
| ارسال پیامک بومی EspoCRM (`SenderFactory`) | **همیشه شکست** | `injectableFactory->create(KavenegarSender::class)` → همان nullableها |

یعنی **هر سه مسیر عملیاتی این بخش، در محیط واقعی کار نمی‌کنند**؛ تست‌ها سبزند چون در تست‌ها وابستگی‌ها به‌صورت صریح پاس داده می‌شوند و مسیر DI هرگز اجرا نمی‌شود.

**شمارش یافته‌ها:** ۳ بحرانی (P0) · ۵ بالا (P1) · ۶ متوسط (P2) · ۸ کم (P3)

### جدول یافته‌ها

| شناسه | شدت | محور | فایل:خط | عنوان |
|---|---|---|---|---|
| IRN-P0-01 | 🔴 بحرانی | معماری/DI | `Api/PostSendSms.php:20-25`، `Api/PostVoipWebhook.php:20-23`، `Sms/KavenegarSender.php:26-31`، `Services/SmsCampaignService.php:16-19` | تزریق nullable → کل ماژول در پروداکشن از کار افتاده |
| IRN-P0-02 | 🔴 بحرانی | احراز صلاحیت | `Api/PostSendSms.php:37-85` | هیچ بررسی ACL؛ هر کاربر احراز‌هویت‌شده می‌تواند پیامک انبوه بفرستد |
| IRN-P0-03 | 🔴 بحرانی | احراز صلاحیت | `Services/SmsCampaignService.php:48-59` | IDOR روی `templateId`؛ خواندن قالب‌های سایر تیم‌ها |
| IRN-P1-01 | 🟠 بالا | Rate Limit / DoS | `Api/PostSendSms.php:55-64` | بدون سقف تعداد گیرنده، طول پیام، یا محدودیت نرخ |
| IRN-P1-02 | 🟠 بالا | DoS / منطق | `Api/PostVoipWebhook.php:62,75` | اسکن کامل جدول Contact + `stageProbability` ناموجود → `WHERE 0` |
| IRN-P1-03 | 🟠 بالا | Fail-Open | `Sms/KavenegarSender.php:79-97` | پاسخ نامفهوم HTTP 200 = موفقیت |
| IRN-P1-04 | 🟠 بالا | نشت اعتبارنامه | `Sms/KavenegarSender.php:71,98-107` | کلید API در URL + زنجیره‌ی exception با پیام خام |
| IRN-P1-05 | 🟠 بالا | CSRF | `Resources/routes.json` (هر دو route) | بدون `consumes` → پذیرش form-urlencoded |
| IRN-P2-01 | 🟡 متوسط | تراکنش/Outbox | `Services/SmsCampaignService.php:84-112` | ارسال قبل از ثبت؛ خطای DB بلعیده می‌شود؛ بدون Idempotency |
| IRN-P2-02 | 🟡 متوسط | باگ منطقی | `Services/SmsCampaignService.php:181` | `total` با `sent+failed` نمی‌خواند |
| IRN-P2-03 | 🟡 متوسط | مدل داده | `Resources/metadata/entityDefs/BidarSmsMessage.json` | `providerMessageId`/`scheduledAt` هیچ‌گاه ست نمی‌شوند؛ enum مرده |
| IRN-P2-04 | 🟡 متوسط | تقویم شمسی | `Support/JalaliHelper.php:24,62,102,122,129` | سکوت در خطا، وابستگی به timezone سراسری، clamp بی‌صدا، مرز ۲۳:۵۹:۵۹ |
| IRN-P2-05 | 🟡 متوسط | یکپارچگی داده | `Support/PersianCsvExporter.php:9,27,54` | خرابی اعداد منفی، دور زدن محافظت هدر، مصرف حافظه |
| IRN-P2-06 | 🟡 متوسط | جهش داده | `Hooks/Common/NormalizePersianInput.php:17-33` | تغییر بی‌صدای `description`، بدون opt-out و بدون لاگ |
| IRN-P3-01 | 🔵 کم | کد مرده | `Support/IranValidators.php` (کل فایل) | هیچ‌جا فراخوانی نمی‌شود؛ فیلدها فقط `maxLength` دارند |
| IRN-P3-02 | 🔵 کم | UX/پذیرش | `Support/IranValidators.php:12,37,65` | NBSP/ZWSP باعث ریجکت کد ملی معتبر می‌شود |
| IRN-P3-03 | 🔵 کم | مشاهده‌پذیری | کل ماژول | صفر لاگ؛ ۱۰ بلوک `catch (Throwable)` بدون ردپا |
| IRN-P3-04 | 🔵 کم | AGPL | `composer.json:6`، `LICENSE*` | `Unlicense` در ریشه در تناقض با AGPL ماژول‌ها |
| IRN-P3-05 | 🔵 کم | AGPL/ریلیز | `build/release/custom/...` | نسخه‌ی build کهنه (۱.۰.۲) و ناهمگام با سورس (۱.۰.۳) |
| IRN-P3-06 | 🔵 کم | طراحی | `Sms/KavenegarSender.php:26-44` | سازنده هم config می‌خواند، هم client می‌سازد (SRP) |
| IRN-P3-07 | 🔵 کم | حریم خصوصی | `Api/PostVoipWebhook.php:56` | شماره تماس در query string → ثبت در access log |
| IRN-P3-08 | 🔵 کم | معنای HTTP | `Api/PostSendSms.php:83` | شکست با کد ۲۰۰ برمی‌گردد؛ مانیتورینگ کور می‌ماند |

---

## ۱. روش بررسی و شواهد

### ۱.۱ اجرای تست‌های موجود

```console
$ ./vendor/bin/phpunit -c extensions/phpunit.xml --testsuite unit --filter BidarIran
PHPUnit 11.5.58 by Sebastian Bergmann and contributors.
Runtime: PHP 8.5.11
.............................................................  61 / 61 (100%)
OK (61 tests, 292 assertions)
```

سبز بودن تست‌ها **شاهد سلامت نیست**؛ شاهد این است که مسیر DI هرگز تست نشده (بخش ۵).

### ۱.۲ پروب‌های اجرایی (اثبات ادعاها)

هر ادعای این گزارش با یک پروب روی PHP اجرا و خروجی‌اش ثبت شده است. خلاصه‌ی نتایج:

| پروب | نتیجه | نتیجه‌گیری |
|---|---|---|
| `getJalaliMonthRange(1405, 15)` | بازگشت بازه‌ی **اسفند ۱۴۰۵** | ماه نامعتبر به‌جای خطا، clamp می‌شود |
| `getJalaliMonthRange(0, 1)` | بازگشت سال **۰۶۲۱ میلادی** | سال بدون اعتبارسنجی |
| `getJalaliMonthRange(9999, 12)` | `InvalidArgumentException` از کتابخانه | خطا در عمق کتابخانه، نه در لایه‌ی ما |
| `toGregorianDate('0000/01/01')` | `'0621-03-21'` | بدون کرانه‌ی سال |
| `date_default_timezone_set('Asia/Tehran')` سپس `toJalaliDateTime('2026-11-22 12:00:00')` | `1405/09/01 12:00` به‌جای `15:30` | **۳:۳۰ اختلاف** — وابستگی به timezone سراسری |
| `PersianCsvExporter` با سلول `'-100'` | خروجی `'-100` | عدد منفی به متن تبدیل می‌شود |
| `PersianCsvExporter` با هدر `"\t=cmd"` | بدون escape | دور زدن محافظت CSV Injection |
| `isValidSheba('IR270170000000100324200001')` | `true` و mod-97 = **1** | ✅ الگوریتم شبا درست است |
| `isValidNationalCode('0012345679')` | `true` | ✅ الگوریتم کد ملی درست است |
| `isValidNationalCode("0012345679\u{00A0}")` | `false` | NBSP ریجکت می‌شود |

### ۱.۳ شواهد استاتیک

- `grep -rn "Utils\\Log"` در ماژول → **هیچ**
- `grep -rn "Acl\|Entities\\User"` → **هیچ**
- `grep -rn "Transaction\|beginTransaction"` → **هیچ**
- `grep -rni "rate\|throttle"` → **هیچ**
- `Resources/routes.json` → هیچ `consumes`، هیچ middleware
- `engine/.../metadata/app/api.json` → `globalMiddlewareClassNameList: []` (چارچوب هم Rate Limit عمومی ندارد)

---

## ۲. یافته‌های بحرانی (P0)

### IRN-P0-01 — تزریق nullable کل ماژول را غیرفعال کرده است

**فایل و خطوط**
- `Api/PostSendSms.php:20-25`
- `Api/PostVoipWebhook.php:20-23`
- `Sms/KavenegarSender.php:26-31`
- `Services/SmsCampaignService.php:16-19`

**شرح**

هر چهار کلاس، وابستگی‌های خود را nullable با مقدار پیش‌فرض `null` تعریف کرده‌اند. در EspoCRM این الگو یعنی «از DI صرف‌نظر کن»:

```php
// engine/application/Espo/Core/InjectableFactory.php:276-286
if ($dependencyClass && $param->allowsNull()) {
    return null;                      // ← اینجا
}
if ($dependencyClass) {
    return $this->createInternal($dependencyClass->getName(), ...);  // هرگز اجرا نمی‌شود
}
```

و در مسیر واقعی:

```php
// engine/application/Espo/Core/Api/RouteProcessor.php:170
$action = $this->injectableFactory->create($actionClassName);
```

**اثر واقعی (اثبات‌شده)**

`PostSendSms` با `$service = null` و `$entityManager = null` ساخته می‌شود → خط ۳۱ `new SmsCampaignService(null, null)` → خط ۲۱ `new KavenegarSender(null, null, null, null, null)` → خط ۴۰ `$this->apiKey = ''` → خط ۶۲ `throw new RuntimeException('... API key is not configured.')` → `SmsCampaignService::sendSms` آن را می‌گیرد و `success: false` برمی‌گرداند. **هیچ پیامکی ارسال نمی‌شود، حتی وقتی کاوه‌نگار در Integrations تنظیم شده باشد.**

`PostVoipWebhook` با `$service = null` و `$entityManager = null` → خط ۳۸ `$secret = ''` → خط ۴۵ `new VoipLookupService('')` → `authenticate()` همیشه `false` → **همیشه ۴۰۳**. این یکی حداقل fail-closed است، اما یعنی وب‌هوک هیچ‌وقت کار نمی‌کند.

`SenderFactory::create()` در `engine/application/Espo/Core/Sms/SenderFactory.php` نیز `injectableFactory->create($className)` را صدا می‌زند → **ارسال بومی پیامک EspoCRM هم از کار افتاده است.**

**ریشه‌ی مشترک:** همان الگو در `extensions/bidar-sales/Api/BidarExportAction.php` تکرار شده و آنجا پیامد امنیتی مستقیم دارد: `?Acl $acl = null` و `?SelectBuilderFactory` → `null` → **هر دو محافظ ACL غیرفعال** و `find()` بدون `withStrictAccessControl()` اجرا می‌شود → هر کاربر احراز‌هویت‌شده کل داده‌ها را اکسپورت می‌کند. این یافته خارج از دامنه‌ی بخش ۲ است اما چون مصرف‌کننده‌ی `PersianCsvExporter` است، در IRN-P2-05 به آن ارجاع داده می‌شود.

**راه‌حل**

قاعده: **nullable فقط برای پارامترهایی که `null` در آن‌ها معنای «پیش‌فرض» دارد** (مثل `?Closure $httpClient = null`)، نه برای وابستگی‌هایی که باید تزریق شوند.

```php
// Api/PostSendSms.php
use Espo\Core\Acl;
use Espo\Core\Exceptions\Forbidden;
use Espo\Core\Utils\Log;
use Espo\Entities\User;
use Espo\Modules\BidarIran\Sms\KavenegarSender;
use Espo\Modules\BidarIran\Support\IranPhoneNormalizer;

class PostSendSms implements Action
{
    private ?SmsCampaignService $service = null;

    public function __construct(
        private EntityManager $entityManager,   // غیر nullable → تزریق می‌شود
        private Acl $acl,
        private User $user,
        private Log $log,
    ) {}

    private function getService(): SmsCampaignService
    {
        return $this->service ??= new SmsCampaignService(
            new KavenegarSender($this->entityManager, new IranPhoneNormalizer()),
            $this->entityManager,
        );
    }
}
```

```php
// Sms/KavenegarSender.php — سازنده‌ی بدون nullable برای وابستگی‌های کلاسی
public function __construct(
    private EntityManager $entityManager,
    private IranPhoneNormalizer $normalizer,
    ?Closure $httpClient = null,          // null = «از client پیش‌فرض استفاده کن» → مجاز
) {
    $integration = $entityManager->getEntityById('Integration', 'Kavenegar');

    $this->apiKey = (string) ($integration?->get('apiKey') ?? '');
    $this->senderLine = $integration?->get('senderLine')
        ? (string) $integration->get('senderLine')
        : null;

    $this->httpClient = $httpClient ?? self::defaultHttpClient();
}
```

برای تست‌ها، سازنده‌ی صریح را نگه دارید (آزمون‌ها آرگومان می‌دهند، DI نه):
`new KavenegarSender($fakeEm, $normalizer, $fakeHttp)`.

**TDD**

```php
public function testApiLayerHasNoNullableClassTypedConstructorParams(): void
{
    // اگر کسی دوباره `?EntityManager $em = null` بنویسد، این تست فوراً می‌شکند.
    foreach ([PostSendSms::class, PostVoipWebhook::class, KavenegarSender::class, SmsCampaignService::class] as $class) {
        $ctor = (new ReflectionClass($class))->getConstructor();
        $this->assertNotNull($ctor, "$class باید سازنده داشته باشد.");

        foreach ($ctor->getParameters() as $param) {
            $type = $param->getType();
            $isClass = $type instanceof ReflectionNamedType && ! $type->isBuiltin();
            $isTestSeam = $param->getName() === 'httpClient'; // nullable مجاز

            if ($isClass && ! $isTestSeam) {
                $this->assertFalse(
                    $type->allowsNull(),
                    "$class::\${$param->getName()} nullable است → InjectableFactory مقدار null تزریق می‌کند (InjectableFactory.php:279)."
                );
            }
        }
    }
}

public function testProductionWiringResolvesEntityManager(): void
{
    // با Container واقعی EspoCRM
    $container = (new Application())->getContainer();
    $action = $container->get('injectableFactory')->create(PostSendSms::class);

    $em = (new ReflectionProperty($action, 'entityManager'))->getValue($action);

    $this->assertInstanceOf(EntityManager::class, $em, 'DI باید EntityManager را تزریق کند.');
}
```

---

### IRN-P0-02 — هیچ بررسی صلاحیتی روی `POST /BidarSms/send` وجود ندارد

**فایل و خطوط:** `Api/PostSendSms.php:37-85` (کل متد `process`)

**شرح**

اکشن فقط `Request` می‌گیرد و هیچ‌گونه `Acl`، `User` یا بررسی permission ندارد. در EspoCRM، احراز هویت (Authentication) با احراز صلاحیت (Authorization) متفاوت است: احراز هویت در `RouteProcessor` انجام می‌شود، اما **ACL فقط در لایه‌ی Record/Service اعمال می‌شود** — و این اکشن هیچ‌کدام را رد نمی‌کند.

**اثر**

هر کاربری که توکن API یا نشست معتبر داشته باشد — از جمله کاربر با نقش «فقط خواندنی»، کاربر تیم‌بندی‌شده، یا کاربر پورتال — می‌تواند:

1. به هر شماره‌ی دلخواه در ایران پیامک بفرستد (**هزینه‌ی مستقیم برای سازمان**)؛
2. با `recipients` نامحدود، کمپین انبوه اجرا کند (**SMS bombing / سوءاستفاده از اعتبار**)؛
3. محتوای دلخواه با نام سازمان بفرستد (**فیشینگ با برند سازمان**)؛
4. رکورد `BidarSmsMessage` با `contactId`/`opportunityId` دلخواه بسازد (**آلودگی داده و جعل ارتباط**).

**راه‌حل**

```php
public function process(Request $request): Response
{
    // ۱) مجوز سطح scope
    if (! $this->acl->checkScope('BidarSmsMessage', Table::ACTION_CREATE)) {
        throw new Forbidden('No permission to send SMS.');
    }

    $body = (array) $request->getParsedBody();

    // ۲) اعتبارسنجی مالکیت رکوردهای ارجاع‌شده
    foreach (['contactId', 'opportunityId'] as $key) {
        $id = isset($body[$key]) ? (string) $body[$key] : null;
        if ($id === null || $id === '') {
            continue;
        }
        $entityType = $key === 'contactId' ? 'Contact' : 'Opportunity';
        $entity = $this->entityManager->getEntityById($entityType, $id);
        if ($entity === null || ! $this->acl->checkEntityRead($entity)) {
            throw new Forbidden("No access to linked $entityType.");
        }
    }
    // ...
}
```

همچنین در `Resources/metadata/scopes/BidarSmsMessage.json` یک ACL صریح تعریف کنید تا ادمین بتواند نقش «اپراتور پیامک» بسازد.

**TDD**

```php
public function testSendSmsIsForbiddenWithoutCreatePermission(): void
{
    $acl = $this->createMock(Acl::class);
    $acl->method('checkScope')->with('BidarSmsMessage', Table::ACTION_CREATE)->willReturn(false);

    $action = new PostSendSms($this->createMock(EntityManager::class), $acl, $this->createMock(User::class), $this->createMock(Log::class));

    $request = $this->createMock(Request::class);
    $request->method('getParsedBody')->willReturn((object) ['phone' => '09120000000', 'message' => 'x']);

    $this->expectException(Forbidden::class);
    $action->process($request);
}

public function testSendSmsRejectsUnreadableContact(): void
{
    $acl = $this->createMock(Acl::class);
    $acl->method('checkScope')->willReturn(true);
    $acl->method('checkEntityRead')->willReturn(false);
    // ... assert Forbidden
}
```

---

### IRN-P0-03 — IDOR روی `templateId` (خواندن قالب‌های سایر تیم‌ها)

**فایل و خطوط:** `Services/SmsCampaignService.php:48-59`، فراخوانی در `Api/PostSendSms.php:47-53`

**شرح**

```php
$template = $this->entityManager->getEntityById('BidarSmsTemplate', $templateId);
```

`getEntityById` در EspoCRM **بدون ACL** است. هر کاربر احراز‌هویت‌شده می‌تواند با حدس/تخمین `templateId` بدنه‌ی هر قالبی را بخواند و به‌عنوان پیامک ارسال کند. `BidarSmsTemplate` در metadata دارای `acl: true` است، اما این مسیر آن را دور می‌زند. همچنین `isActive` نادیده گرفته می‌شود (قالب غیرفعال هم ارسال می‌شود).

**اثر**

- افشای محتوای قالب‌های محرمانه (متن‌های حقوقی، پیش‌نویس اطلاع‌رسانی، کدهای تخفیف).
- ارسال قالب غیرفعال/بایگانی‌شده به مشتری.

**راه‌حل**

```php
public function getTemplateBody(string $templateId, ?Acl $acl = null): ?string
{
    $template = $this->entityManager
        ->getRDBRepository('BidarSmsTemplate')
        ->where([
            'id' => $templateId,
            'isActive' => true,
        ])
        ->findOne();

    if ($template === null) {
        return null;
    }

    if ($acl !== null && ! $acl->checkEntityRead($template)) {
        throw new Forbidden('No access to the SMS template.');
    }

    return (string) ($template->get('body') ?? '');
}
```

**TDD**

```php
public function testGetTemplateBodyRejectsTemplateUserCannotRead(): void
{
    $template = $this->createMock(Entity::class);
    $repo = $this->createMock(RDBRepository::class);
    $repo->method('findOne')->willReturn($template);

    $em = $this->createMock(EntityManager::class);
    $em->method('getRDBRepository')->with('BidarSmsTemplate')->willReturn($repo);

    $acl = $this->createMock(Acl::class);
    $acl->method('checkEntityRead')->willReturn(false);

    $this->expectException(Forbidden::class);
    (new SmsCampaignService(null, $em))->getTemplateBody('tpl-1', $acl);
}

public function testGetTemplateBodyReturnsNullForInactiveTemplate(): void
{
    // repo->findOne → null → null برگردد و BadRequest رخ دهد
}
```

---

## ۳. یافته‌های بالا (P1)

### IRN-P1-01 — بدون Rate Limit، بدون سقف اندازه (هزینه و DoS)

**فایل و خطوط:** `Api/PostSendSms.php:42-45, 55-64`، `Services/SmsCampaignService.php:150-172`

**شرح**

- `$recipients` بدون سقف → یک درخواست می‌تواند ۱۰۰٬۰۰۰ گیرنده داشته باشد.
- `$message` بدون سقف طول → هر پیامک طولانی به چند بخش تقسیم و چند برابر هزینه می‌شود.
- `$variables` بدون سقف → `(string) $value` روی آرایه → warning + مقدار `'Array'`.
- حلقه‌ی `sendCampaign` **همه را در همان درخواست HTTP و پشت سر هم** اجرا می‌کند؛ با `CURLOPT_TIMEOUT = 10` و ۵۰۰ گیرنده، درخواست تا ۵۰۰۰ ثانیه معلق می‌ماند (پیش از رسیدن به timeout وب‌سرور).
- بدون dedupe → همان شماره چند بار ارسال می‌شود.
- هیچ محدودیت نرخ‌ای وجود ندارد (نه در routes.json، نه در چارچوب).

**اثر**

- ImageDoS: مصرف کامل اعتبار پیامک سازمان با یک درخواست.
- تایم‌اوت و درخواست‌های زامبی روی PHP-FPM.
- قابل استفاده به‌عنوان رله‌ی پیامک انبوه علیه اشخاص ثالث (تبعیض/اذیت).

**راه‌حل**

```php
private const int MAX_RECIPIENTS = 200;
private const int MAX_MESSAGE_LENGTH = 1000;
private const int MAX_REQUESTS_PER_MINUTE = 20;

public function process(Request $request): Response
{
    // ...
    if (is_array($recipients)) {
        if (count($recipients) > self::MAX_RECIPIENTS) {
            throw new BadRequest('Too many recipients.');
        }
    }
    if (mb_strlen($message) > self::MAX_MESSAGE_LENGTH) {
        throw new BadRequest('Message is too long.');
    }
    // ...
}
```

و برای Rate Limit، یک کلاس با اینترفیس بسازید (چارچوب ندارد):

```php
interface SmsRateLimiter
{
    /** @throws TooManyRequests */
    public function hit(string $userId, string $route): void;
}

final class DbSmsRateLimiter implements SmsRateLimiter
{
    public function __construct(private EntityManager $em, private Config $config) {}

    public function hit(string $userId, string $route): void
    {
        $windowStart = (new DateTimeImmutable('-60 seconds'))->format('Y-m-d H:i:s');

        $count = $this->em->getRDBRepository('BidarSmsMessage')
            ->where([
                'createdById' => $userId,
                'createdAt>=' => $windowStart,
            ])
            ->count();

        if ($count >= (int) $this->config->get('bidarSmsRateLimitPerMinute', 20)) {
            throw new TooManyRequests('Rate limit exceeded.');
        }
    }
}
```

**TDD**

```php
public function testCampaignRejectsMoreThanTwoHundredRecipients(): void
{
    $recipients = array_fill(0, 201, ['phone' => '09120000000']);
    // assert BadRequest('Too many recipients.')
}

public function testCampaignDeduplicatesRecipientsByPhone(): void
{
    $recipients = [
        ['phone' => '09121112233'],
        ['phone' => '+989121112233'], // همان شماره در فرمت E.164
    ];
    $result = $service->sendCampaign($recipients, 'hi');
    $this->assertSame(1, $result['total']);
}

public function testRateLimiterThrowsAfterThreshold(): void
{
    $limiter = new DbSmsRateLimiter($this->emReturningCount(20), $this->configWithLimit(20));
    $this->expectException(TooManyRequests::class);
    $limiter->hit('user-1', 'send');
}
```

---

### IRN-P1-02 — وب‌هوک VoIP: اسکن کامل جدول + فیلتر ناموجود + افشای بیش از حد

**فایل و خطوط:** `Api/PostVoipWebhook.php:62, 67, 75-77`، `Services/VoipLookupService.php:34-46`

**شرح و اثبات**

**(الف) اسکن کامل جدول:**

```php
$contactCollection = $this->entityManager->getRDBRepository('Contact')->find();   // خط ۶۲
```

هیچ `where`، هیچ `limit`، هیچ ایندکسی. هر فراخوانی وب‌هوک **تمام مخاطبان** را در حافظه بارگذاری و سپس در `VoipLookupService::lookup` به‌صورت خطی جست‌وجو می‌کند. با ۱۰۰٬۰۰۰ مخاطب، هر تماس ورودی ≈ ۱۰۰٬۰۰۰ شیء + همان‌قدر عملیات `toE164`. حافظه و CPU هر دو منفجر می‌شوند و چون `noAuth: true` است، در دسترس عموم است.

**(ب) `stageProbability` وجود ندارد:**

```php
->where(['stageProbability!=' => ['Closed Won', 'Closed Lost']])   // خط ۷۵
```

`Opportunity.json` در EspoCRM 10.1.4 **هیچ فیلدی به نام `stageProbability` ندارد** (فقط `stage` از نوع enum). رفتار ORM در این حالت:

```php
// engine/application/Espo/ORM/QueryComposer/BaseQueryComposer.php:2542-2544
if (! $entity->hasAttribute($left)) {
    return $this->quote(false);     // → رشته‌ی '0'
}
```

یعنی شرط به `WHERE (0)` تبدیل می‌شود و **همیشه صفر معامله برمی‌گردد**. پس وب‌هوک هرگز معامله‌ای نشان نمی‌دهد — حتی اگر احراز هویت درست می‌شد.

**(ج) بیش‌بازگشت داده:**

```php
'accountId' => $c->get('accountId'),
'accountName' => $c->get('accountName'),   // خط ۶۷-۶۹
```

وابسته به اینکه `accountName` attribute باشد یا نه، مقدار `null` برمی‌گردد؛ در هر حالت برگرداندن `accountId`/`accountName`/`phone` به ارائه‌دهنده‌ی VoIP نقض اصل حداقل‌سازی داده است.

**راه‌حل**

```php
// ۱) جست‌وجوی ایندکسی به‌جای اسکن کامل
$local = (new IranPhoneNormalizer())->toLocal($rawPhone);
if ($local === null) {
    return ResponseComposer::json(['found' => false, 'normalizedPhone' => $rawPhone, 'contact' => null, 'deals' => []]);
}

$contact = $this->entityManager
    ->getRDBRepository('Contact')
    ->where(['phoneNumber' => $local])      // یا ستون نرمال‌شده‌ی phoneNumberNormalized
    ->findOne();

// ۲) فیلتر درست روی stage
->where([
    'contactId' => $contact->getId(),
    'stage!=' => ['Closed Won', 'Closed Lost'],
])

// ۳) حداقل‌سازی خروجی
$contactData = [
    'id' => $contact->getId(),
    'name' => $contact->get('name'),
];
```

برای عملکرد واقعی، یک ستون `phoneNumberNormalized` (varchar، ایندکس‌دار) در `Contact` اضافه کنید و در `NormalizePersianInput` یا یک هوک اختصاصی پرش کنید.

**TDD**

```php
public function testLookupDoesNotLoadAllContacts(): void
{
    $repo = $this->createMock(RDBRepository::class);
    $repo->expects($this->once())->method('where')->with($this->callback(
        fn (array $w) => array_key_exists('phoneNumber', $w)
    ));
    $repo->expects($this->never())->method('find');   // find بدون where ممنوع

    // ... assert lookup
}

public function testDealsQueryFiltersByStageNotStageProbability(): void
{
    $query = $this->captureOpportunityQuery();
    $this->assertArrayHasKey('stage!=', $query['where']);
    $this->assertArrayNotHasKey('stageProbability!=', $query['where']);
}
```

---

### IRN-P1-03 — Fail-Open در تشخیص موفقیت کاوه‌نگار

**فایل و خطوط:** `Sms/KavenegarSender.php:79-97`

**شرح**

```php
if ($rawBody !== '') {
    $decoded = json_decode($rawBody, true);
    if (is_array($decoded) && isset($decoded['return']['status'])) {
        // فقط در صورت وجود return.status بررسی می‌شود
    }
}
return true;      // ← در همه‌ی حالت‌های دیگر: موفقیت!
```

حالت‌هایی که به‌اشتباه «موفق» ثبت می‌شوند:

| پاسخ HTTP | بدنه | نتیجه |
|---|---|---|
| ۲۰۰ | خالی | `true` |
| ۲۰۰ | HTML (captive portal، صفحه‌ی خطای CDN، WAF) | `true` |
| ۲۰۰ | `{"foo":1}` | `true` |
| ۲۰۰ | `{"return":{"message":"..."}}` بدون `status` | `true` |

**اثر**

`BidarSmsMessage.status = 'sent'` ثبت می‌شود، `success: true` به کاربر برمی‌گردد، گزارش‌ها ارسال موفق نشان می‌دهند، اما **پیامک هرگز نرسیده**. در گزارش‌های مالی/مالیات و در SLA با مشتری، این یک خطای داده‌ی جدی است.

**راه‌حل (Fail-Closed)**

```php
$decoded = json_decode($rawBody, true);

if (! is_array($decoded)) {
    throw new RuntimeException('Kavenegar SMS dispatch failed: malformed JSON response.');
}

$return = $decoded['return'] ?? null;

if (! is_array($return) || ! array_key_exists('status', $return)) {
    throw new RuntimeException('Kavenegar SMS dispatch failed: missing return.status.');
}

$returnStatus = (int) $return['status'];

if ($returnStatus !== 200) {
    throw new RuntimeException("Kavenegar SMS dispatch failed with API code {$returnStatus}: "
        . (string) ($return['message'] ?? ''));
}

$messageId = $decoded['entries'][0]['messageid'] ?? null;

if ($messageId === null || $messageId === '') {
    throw new RuntimeException('Kavenegar SMS dispatch failed: missing messageid.');
}

$this->lastMessageId = (string) $messageId;   // برای ذخیره در providerMessageId
return true;
```

**TDD**

```php
/** @dataProvider malformedResponseProvider */
public function testSendDirectFailsClosedOnMalformedResponse(string $body): void
{
    $sender = new KavenegarSender($this->emWithKey(), new IranPhoneNormalizer(),
        fn () => ['status' => 200, 'body' => $body]);

    $this->expectException(RuntimeException::class);
    $sender->sendDirect('09121112233', 'تست');
}

public static function malformedResponseProvider(): array
{
    return [
        'empty body'   => [''],
        'html'         => ['<html>Blocked</html>'],
        'no return'    => ['{"foo":1}'],
        'no status'    => ['{"return":{"message":"x"}}'],
        'no messageid' => ['{"return":{"status":200},"entries":[]}'],
    ];
}

public function testSendDirectCapturesProviderMessageId(): void
{
    $sender = new KavenegarSender($this->emWithKey(), new IranPhoneNormalizer(),
        fn () => ['status' => 200, 'body' => '{"return":{"status":200},"entries":[{"messageid":987654}]}']);

    $sender->sendDirect('09121112233', 'تست');

    $this->assertSame('987654', $sender->getLastMessageId());
}
```

---

### IRN-P1-04 — کلید API در URL و نشت آن در زنجیره‌ی Exception

**فایل و خطوط:** `Sms/KavenegarSender.php:71` (ساخت URL)، `98-107` (بازپخت خطا)

**شرح**

```php
$url = "https://api.kavenegar.com/v1/{$this->apiKey}/sms/send.json";   // خط ۷۱
```

کاوه‌نگار کلید را در مسیر URL می‌خواهد، پس این قسمت اجتناب‌ناپذیر است. اما سه ریسق قابل‌کاهش باقی می‌ماند:

1. **`catch (\Throwable $e)`** پیام را با `str_replace($this->apiKey, '***', $msg)` پاک می‌کند، اما در خط ۱۰۴ همان `$e` را به‌عنوان `previous` به exception جدید می‌دهد:
   ```php
   throw new RuntimeException($msg, (int) $e->getCode(), $e);   // خط ۱۰۴
   ```
   اگر پیام اصلی حاوی URL باشد (مثلاً در خطاهای سطح پایین‌تر یا exceptionهای خودِ کاوه‌نگار)، **کلید خام در `getPrevious()` باقی می‌ماند** و هر لاگر استک‌تیس آن را چاپ می‌کند. (همین الگو در خط ۱۰۶ هم تکرار شده است.)

2. **`str_replace` فقط شکل خام را پاک می‌کند.** اگر کلید در URL به‌صورت `urlencode`-شده ظاهر شود، پاک نمی‌شود.

3. **`CURLOPT_TIMEOUT = 10` بدون `CURLOPT_CONNECTTIMEOUT`** → اتصال معلق تا ۱۰ ثانیه؛ و **بدون `CURLOPT_PROTOCOLS`** → اگر URL روزی تغییر کند، مسیر به HTTP ساده باز می‌شود.

**راه‌حل**

```php
private static function redact(string $message, string $secret): string
{
    if ($secret === '') {
        return $message;
    }

    return str_replace(
        [$secret, urlencode($secret), rawurlencode($secret), base64_encode($secret)],
        '***',
        $message,
    );
}

// در catch:
$msg = self::redact($e->getMessage(), $this->apiKey);

// previous را عمداً نگه نمی‌داریم؛ به‌جایش یک exception بدون وابستگی به پیام خام می‌سازیم
throw new RuntimeException($msg, 0);
```

و در client:

```php
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);
curl_setopt($ch, CURLOPT_PROTOCOLS, CURLPROTO_HTTPS);
curl_setopt($ch, CURLOPT_REDIR_PROTOCOLS, CURLPROTO_HTTPS);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
curl_setopt($ch, CURLOPT_ENCODING, '');
```

**TDD**

```php
public function testExceptionChainNeverContainsApiKey(): void
{
    $key = 'super-secret-key-123';
    $sender = new KavenegarSender($this->emWithKey($key), new IranPhoneNormalizer(),
        fn () => ['status' => 500, 'body' => "error for https://api.kavenegar.com/v1/$key/x"]);

    try {
        $sender->sendDirect('09121112233', 'x');
        $this->fail('expected exception');
    } catch (RuntimeException $e) {
        $this->assertStringNotContainsString($key, $e->getMessage());
        $this->assertStringNotContainsString(urlencode($key), $e->getMessage());
        $this->assertNull($e->getPrevious(), 'زنجیره‌ی exception نباید پیام خام را حمل کند.');
    }
}
```

---

### IRN-P1-05 — سطح CSRF: مسیرها form-urlencoded را می‌پذیرند

**فایل:** `Resources/routes.json` (هر دو مسیر)

**شرح**

هیچ `consumes` تعریف نشده. `RouteProcessor::assertContentTypeAllowed` فقط وقتی `consumes` غیر null باشد اعمال می‌شود، و `RequestWrapper::getParsedBody()` برای بدنه‌های غیر JSON به `psr7Request->getParsedBody()` برمی‌گردد (یعنی `application/x-www-form-urlencoded` را هم می‌پذیرد).

در EspoCRM، محافظت CSRF مبتنی بر کوکی از این شرط است (`engine/application/Espo/Core/Api/Auth.php:364-375`):

```php
$request->getHeader('Sec-Fetch-Mode') === 'navigate'
&& in_array($request->getContentType(), [MULTIPART_FORM_DATA, APPLICATION_X_WWW_FORM_URLENCODED, TEXT_PLAIN])
```

یعنی کوکی فقط وقتی نادیده گرفته می‌شود که مرورگر `Sec-Fetch-Mode: navigate` بفرستد. مرورگرهایی که `Sec-Fetch-*` را نمی‌فرستند (Safari < 16.4) با یک فرم ساده‌ی cross-site می‌توانند `POST /BidarSms/send` را با `application/x-www-form-urlencoded` اجرا کنند و کوکی نشست قربانی همراه می‌رود → **CSRF واقعی روی ارسال پیامک با اعتبار سازمان**.

**راه‌حل**

```json
[
  {
    "route": "/BidarVoip/webhook",
    "method": "post",
    "actionClassName": "Espo\\Modules\\BidarIran\\Api\\PostVoipWebhook",
    "noAuth": true,
    "consumes": ["application/json"]
  },
  {
    "route": "/BidarSms/send",
    "method": "post",
    "actionClassName": "Espo\\Modules\\BidarIran\\Api\\PostSendSms",
    "consumes": ["application/json"]
  }
]
```

با `application/json`، درخواست cross-site نیاز به preflight دارد و بدون `Access-Control-Allow-Origin` شکست می‌خورد → CSRF بسته می‌شود.

**TDD**

```php
public function testRoutesRequireJsonContentType(): void
{
    $routes = json_decode((string) file_get_contents(dirname(__DIR__, 2) . '/Resources/routes.json'), true);

    foreach ($routes as $route) {
        $this->assertSame(['application/json'], $route['consumes'] ?? null, "مسیر {$route['route']} باید consumes داشته باشد.");
    }
}

public function testFormEncodedRequestIsRejected(): void
{
    // یک درخواست با Content-Type: application/x-www-form-urlencoded باید ۴۰۰ بگیرد
}
```

---

## ۴. یافته‌های متوسط (P2)

### IRN-P2-01 — ارسال قبل از ثبت، بدون تراکنش و بدون Idempotency

**فایل و خطوط:** `Services/SmsCampaignService.php:84-112`

**شرح**

```php
$dispatched = $this->sender->sendDirect(...);   // ۸۵ — ارسال اول
// ...
$this->entityManager->saveEntity($smsRecord);   // ۱۰۷ — ثبت بعد
} catch (Throwable) {
    // Log failure should not override dispatch outcome   // ۱۰۹-۱۱۱ — خطای DB بلعیده می‌شود
}
```

سه ایراد:

1. **ترتیب معکوس**: پیامک ارسال می‌شود، بعد رکورد. اگر `saveEntity` شکست بخورد، **پیامک رفته ولی هیچ ردی نیست**. برای یک سامانه‌ی مالی/حسابی این بدترین حالت است (هزینه بدون سند).
2. **بلعیدن خطای DB بدون لاگ**: هیچ `Log`ی وجود ندارد؛ خطا کاملاً بی‌صدا است.
3. **بدون Idempotency-Key**: اگر کلاینت درخواست را retry کند، پیامک تکراری ارسال می‌شود.

**راه‌حل — الگوی Outbox**

```php
public function sendSms(string $phoneNumber, string $message, ?string $contactId = null, ?string $opportunityId = null): array
{
    // ۱) ابتدا رکورد با وضعیت scheduled
    $record = $this->entityManager->getNewEntity('BidarSmsMessage');
    $record->set([
        'phoneNumber' => $phoneNumber,
        'body' => $message,
        'status' => 'scheduled',
        'contactId' => $contactId,
        'opportunityId' => $opportunityId,
        'createdAt' => date('Y-m-d H:i:s'),
    ]);
    $this->entityManager->saveEntity($record);

    // ۲) ارسال
    try {
        $this->sender->sendDirect($phoneNumber, $message);
        $record->set('status', 'sent');
        $record->set('providerMessageId', $this->sender->getLastMessageId());
    } catch (Throwable $e) {
        $record->set('status', 'failed');
        $record->set('error', mb_substr($e->getMessage(), 0, 500));   // فیلد متن جدید
        $this->log->error('SMS dispatch failed', ['recordId' => $record->getId(), 'exception' => $e]);
    }

    // ۳) ثبت نتیجه — اگر شکست بخورد، رکورد scheduled باقی می‌ماند و قابل بازیابی است
    $this->entityManager->saveEntity($record);

    return [...];
}
```

و برای Idempotency: ستون `idempotencyKey` (unique) روی `BidarSmsMessage` + `unique` constraint؛ در تکرار، همان رکورد قبلی برگردد.

**TDD**

```php
public function testRecordIsCreatedBeforeDispatch(): void
{
    $calls = [];
    $em = $this->emRecordingCalls($calls);
    $sender = $this->senderRecordingCalls($calls);

    (new SmsCampaignService($sender, $em))->sendSms('09121112233', 'x');

    $this->assertLessThan(
        array_search('dispatch', $calls, true),
        array_search('save', $calls, true),
        'رکورد باید پیش از ارسال ذخیره شود.'
    );
}

public function testDispatchFailureStillPersistsFailedRecord(): void
{
    // sender->sendDirect throws → record با status=failed ذخیره شود
}

public function testIdempotencyKeyPreventsDuplicateSend(): void
{
    $service->sendSms('09121112233', 'x', null, null, 'key-1');
    $service->sendSms('09121112233', 'x', null, null, 'key-1');   // تکراری

    $this->assertSame(1, $this->dispatchCount);
}
```

---

### IRN-P2-02 — `total` با `sent + failed` نمی‌خواند

**فایل و خط:** `Services/SmsCampaignService.php:181`

**شرح**

```php
'total' => count($recipients),   // ۱۸۱
```

گیرنده‌هایی که `phone` خالی دارند در خط ۱۵۲ `continue` می‌شوند و در `$results` نیستند، اما در `total` حساب می‌شوند.

**اثبات:** با `[['phone'=>''], ['phone'=>'09120000000']]` → `total=2, sent=1, failed=0`. در UI و گزارش‌ها «۲ ارسال» نمایش داده می‌شود در حالی که ۱ پیامک رفته است.

**راه‌حل**

```php
return [
    'total' => count($results),
    'sent' => $sentCount,
    'failed' => $failedCount,
    'skipped' => count($recipients) - count($results),
    'results' => $results,
];
```

**TDD**

```php
public function testCampaignTotalEqualsSentPlusFailed(): void
{
    $result = (new SmsCampaignService($this->okSender()))->sendCampaign([
        ['phone' => ''],
        ['phone' => '09121112233'],
    ], 'hi');

    $this->assertSame(1, $result['total']);
    $this->assertSame(1, $result['skipped']);
    $this->assertSame($result['sent'] + $result['failed'], $result['total']);
}
```

---

### IRN-P2-03 — فیلدهای مرده در مدل داده

**فایل:** `Resources/metadata/entityDefs/BidarSmsMessage.json`

**شرح**

| فیلد | وضعیت |
|---|---|
| `providerMessageId` | هیچ کدی آن را ست نمی‌کند (Kavenegar `messageid` را برمی‌گرداند) |
| `scheduledAt` | هیچ کدی آن را ست نمی‌کند |
| `status: "scheduled"` | هیچ کدی آن را می‌نویسد |
| `status: "received"` | هیچ مسیری (webhook ورودی) وجود ندارد |

**اثر:** امکان ردیابی پیامک در پرتال کاوه‌نگار از دست می‌رود؛ `scheduled` و `received` به‌عنوان گزینه‌های enum در UI ظاهر می‌شوند اما هیچ‌وقت استفاده نمی‌شوند (گمراه‌کننده).

**راه‌حل**

1. `providerMessageId` را در `sendSms` از `getLastMessageId()` پر کنید (نمونه در IRN-P1-03).
2. `scheduledAt` را یا در الگوی Outbox استفاده کنید یا حذفش کنید.
3. `received` را یا با یک وب‌هوک ورودی کاوه‌نگار پیاده کنید یا از enum حذف کنید.
4. یک فیلد `errorCode` (varchar 64) و `error` (text) اضافه کنید تا علت شکست باقی بماند.

**TDD**

```php
public function testSentRecordStoresProviderMessageId(): void
{
    $result = $service->sendSms('09121112233', 'x');
    $this->assertSame('987654', $this->lastSavedRecord->get('providerMessageId'));
}

public function testEntityDefHasNoUnusedEnumOptions(): void
{
    $def = json_decode((string) file_get_contents(.../BidarSmsMessage.json), true);
    $used = ['sent', 'failed', 'scheduled'];
    $this->assertSame([], array_values(array_diff($def['fields']['status']['options'], $used)));
}
```

---

### IRN-P2-04 — نقص‌های تبدیل تقویم شمسی

**فایل و خطوط:** `Support/JalaliHelper.php:24, 62, 102, 122, 129`

#### (الف) سکوت کامل در خطا — خطوط ۲۴، ۴۱، ۵۸، ۶۹، ۱۰۲، ۱۱۸، ۱۵۳، ۱۷۴، ۲۰۶، ۲۱۶

ده بلوک `catch (\Throwable) { return ''; }`. هر خطای تبدیل، تاریخ نامعتبر، یا باگ کتابخانه به یک رشته‌ی خالی تبدیل می‌شود که از «بدون تاریخ» قابل تفکیک نیست.

**اثر:** در گزارش‌ها و اکسپورت‌ها، رکوردهای دارای تاریخ خرابه به‌صورت «خالی» نمایش داده می‌شوند و هیچ‌کس متوجه خرابی داده نمی‌شود.

**راه‌حل:** `Log` تزریق کنید (کلاس `final` با متد static است؛ برای تزریق، آن را به کلاس با سازنده تبدیل کنید یا یک `Psr\Log\LoggerInterface` استاتیک قابل تنظیم اضافه کنید) و در `catch` با سطح `error` لاگ کنید.

#### (ب) وابستگی پنهان به timezone سراسری — خط ۶۲

```php
$dt = new \DateTimeImmutable($gregorianDateTime);   // بدون timezone صریح
```

برخلاف `toJalaliDate` (خط ۲۹-۳۱ که صریحاً UTC می‌دهد)، این متد به `date_default_timezone_get()` تکیه می‌کند. `Espo\Core\Application` آن را روی `UTC` می‌گذارد، پس **داخل EspoCRM درست کار می‌کند** — اما در هر نقطه‌ی ورود دیگر (کرون، worker صف، اسکریپت مستقل، تست) با `Asia/Tehran` به‌صورت پیش‌فرض، **۳:۳۰ ساعت خطا** می‌دهد.

**اثبات:**
```
default tz: Asia/Tehran
toJalaliDate('2026-11-22 12:00:00')     = 1405/09/01
toJalaliDateTime('2026-11-22 12:00:00') = 1405/09/01 12:00     ← باید 15:30 باشد
```

**راه‌حل:** `new \DateTimeImmutable($gregorianDateTime, new \DateTimeZone('UTC'))` — اگر رشته offset صریح داشته باشد PHP آن را حاکم می‌کند، پس این تغییر بی‌خطر است. همین اصلاح برای `diffForHumans` (خط ۲۰۶) لازم است.

#### (ج) clamp بی‌صدای ماه — خط ۱۲۲

```php
$jMonth = max(1, min(12, $jMonth));
```

**اثبات:** `getJalaliMonthRange(1405, 15)` → بازه‌ی **اسفند ۱۴۰۵** را برمی‌گرداند، بدون هیچ خطا. یک باگ در لایه‌ی بالا که ماه را از ورودی کاربر می‌گیرد، به‌صورت خاموش به ماه ۱۲ تبدیل می‌شود.

#### (د) عدم اعتبارسنجی سال

```php
$gStart = CalendarUtils::toGregorian($jYear, $jMonth, 1);   // خط ۱۲۵
```

**اثبات:** `getJalaliMonthRange(0, 1)` → `0621-03-21`؛ `toGregorianDate('0000/01/01')` → `'0621-03-21'`؛ `getJalaliMonthRange(9999, 12)` → `InvalidArgumentException` از دل کتابخانه.

**راه‌حل برای (ج) و (د):**

```php
private const int MIN_JALALI_YEAR = 1178;   // کرانه‌ی متعارف الگوریتم ۳۳ ساله
private const int MAX_JALALI_YEAR = 1633;

private static function assertJalaliDate(int $year, int $month, int $day): void
{
    if ($year < self::MIN_JALALI_YEAR || $year > self::MAX_JALALI_YEAR) {
        throw new InvalidArgumentException("Jalali year {$year} is out of the supported range "
            . self::MIN_JALALI_YEAR . '-' . self::MAX_JALALI_YEAR . '.');
    }
    if ($month < 1 || $month > 12) {
        throw new InvalidArgumentException("Jalali month must be 1-12, {$month} given.");
    }
    if ($day < 1 || $day > self::daysInJalaliMonth($year, $month)) {
        throw new InvalidArgumentException("Jalali day {$day} is invalid for {$year}/{$month}.");
    }
}
```

#### (ه) مرز بسته‌ی `23:59:59` — خط ۱۲۹

```php
$endLocalStr = sprintf('%04d-%02d-%02d 23:59:59', ...);
```

رکوردهای با کسری از ثانیه (`23:59:59.742`) از بازه خارج می‌شوند. در MySQL با `DATETIME` بدون کسر مشکل نیست، اما در PostgreSQL با `timestamp` مشکل جدی است.

**راه‌حل:** بازه‌ی نیمه‌باز:

```php
$next = CalendarUtils::toGregorian(
    $jMonth === 12 ? $jYear + 1 : $jYear,
    $jMonth === 12 ? 1 : $jMonth + 1,
    1,
);
$endExclusive = (new DateTimeImmutable(sprintf('%04d-%02d-%02d 00:00:00', ...$next), $tzObj))
    ->setTimezone($utc);

return [
    'start' => $startLocalStr,
    'end' => $endExclusive->modify('-1 second')->format('Y-m-d H:i:s'),
    'startUtc' => $startUtcStr,
    'endUtc' => $endExclusive->modify('-1 second')->format('Y-m-d H:i:s'),
    'startUtcExclusive' => $startUtcStr,
    'endUtcExclusive' => $endExclusive->format('Y-m-d H:i:s'),   // برای >= start AND < end
];
```

#### (و) `toJalaliDate` با heuristic طول رشته — خط ۳۰

```php
if (strlen($gregorianDate) > 10) { /* UTC فرض می‌شود */ }
```

این heuristic با `2026-11-22 21:30:00` درست کار می‌کند (چون EspoCRM در UTC ذخیره می‌کند) اما با رشته‌ای مثل `2026-11-22 21:30` (۱۶ کاراکتر، بدون ثانیه) هم UTC فرض می‌شود. توصیه: به‌جای طول رشته، یک پارامتر صریح `bool $assumeUtc` یا یک متد جداگانه `toJalaliDateFromUtc()` داشته باشید.

**TDD**

```php
public function testToJalaliDateTimeIsIndependentOfDefaultTimezone(): void
{
    $tz = date_default_timezone_get();
    date_default_timezone_set('Asia/Tehran');
    try {
        $this->assertSame('1405/09/01 15:30', JalaliHelper::toJalaliDateTime('2026-11-22 12:00:00'));
    } finally {
        date_default_timezone_set($tz);
    }
}

public function testMonthRangeRejectsInvalidMonth(): void
{
    $this->expectException(InvalidArgumentException::class);
    JalaliHelper::getJalaliMonthRange(1405, 13);
}

public function testMonthRangeRejectsYearOutOfRange(): void
{
    $this->expectException(InvalidArgumentException::class);
    JalaliHelper::getJalaliMonthRange(0, 1);
}

public function testMonthRangeIsHalfOpen(): void
{
    $range = JalaliHelper::getJalaliMonthRange(1405, 1);
    // آخرین لحظه‌ی بازه باید ۰۰:۰۰:۰۰ روز بعد باشد (exclusive)، نه ۲۳:۵۹:۵۹
    $this->assertSame('2026-04-21 00:00:00', $range['endUtcExclusive']);
}
```

---

### IRN-P2-05 — سه ایراد `PersianCsvExporter`

**فایل و خطوط:** `Support/PersianCsvExporter.php:9, 27, 54`

#### (الف) خرابی اعداد منفی — خط ۵۴

```php
$trimmed = ltrim($cell);
if ($trimmed !== '' && in_array($trimmed[0], self::FORMULA_PREFIXES, true)) {
    $cell = "'" . $cell;
}
```

**اثبات:** ورودی `'-100'` → خروجی `'-100`. مقدار عددی منفی به متن تبدیل می‌شود. در اکسپورت معاملات با `amount` منفی (مرجوعی، اعتبار) این یعنی **ستون مالی غیرقابل جمع‌شدن**.

توجه: تست موجود `testExportProtectsAgainstFormulaInjection` همین رفتار را **تثبیت** کرده (`'-2+2` → `"'-2+2"`). یعنی تست، باگ را محافظت می‌کند.

**راه‌حل:**

```php
private static function escapeFormula(string $cell): string
{
    $trimmed = ltrim($cell, " \t\r\n");

    if ($trimmed === '' || is_numeric($trimmed)) {
        return $cell;                     // عدد منفی/مثبت دست‌نخورده می‌ماند
    }

    if (in_array($trimmed[0], self::FORMULA_PREFIXES, true)) {
        return "'" . $cell;
    }

    return $cell;
}
```

#### (ب) دور زدن محافظت در هدر — خط ۲۷

```php
if ($hStr !== '' && in_array($hStr[0], self::FORMULA_PREFIXES, true)) {
```

برای هدرها برخلاف ردیف‌ها `ltrim` انجام نمی‌شود. **اثبات:** هدر `"\t=cmd"` بدون escape باقی می‌ماند.

**راه‌حل:** همان تابع `escapeFormula` را برای هدر هم به کار ببرید.

#### (ج) ساخت کل خروجی در حافظه — خط ۵۹-۷۰

```php
rewind($stream);
$csvContent = (string) stream_get_contents($stream);
fclose($stream);
return "\xEF\xBB\xBF" . $csvContent;
```

برای ۵۰٬۰۰۰ ردیف، کل CSV در حافظه ساخته و بعد کپی می‌شود (دو برابر). با `BidarExportAction` که کل entityها را هم در حافظه دارد، اکسپورت بزرگ حافظه را منفجر می‌کند.

**راه‌حل:** خروجی را به‌صورت stream برگردانید (یک `Generator` یا callback با `php://output`)، یا دست‌کم سقف تعداد ردیف و صفحه‌بندی اضافه کنید.

**TDD**

```php
public function testExportPreservesNegativeNumbers(): void
{
    $csv = PersianCsvExporter::export(['مبلغ'], [['-1000'], ['-2.5'], ['0']]);
    $this->assertStringNotContainsString("'-1000", $csv);
    $this->assertStringContainsString('-1000', $csv);
}

public function testExportEscapesHeadersWithLeadingWhitespace(): void
{
    $csv = PersianCsvExporter::export(["\t=cmd"], [['a']]);
    $this->assertStringContainsString("'\t=cmd", $csv);
}

public function testExportDoesNotBufferWholeFileInMemory(): void
{
    // با ۱۰٬۰۰۰ ردیف، مصرف حافظه باید کمتر از آستانه باشد
    $before = memory_get_peak_usage();
    PersianCsvExporter::export(['a'], array_fill(0, 10000, ['x']));
    $this->assertLessThan(8 * 1024 * 1024, memory_get_peak_usage() - $before);
}
```

---

### IRN-P2-06 — هوک نرمال‌سازی: جهش بی‌صدای `description`

**فایل و خطوط:** `Hooks/Common/NormalizePersianInput.php:17-33`

**شرح**

```php
private const TEXT_FIELDS = ['name', 'firstName', 'lastName', 'accountName', 'description'];  // ۱۸
// ...
$entity->set($field, PersianTextNormalizer::normalizeCharacters($val));                        // ۳۰
```

سه مشکل:

1. **`description` در فهرست است.** `normalizeCharacters` علاوه بر یکسان‌سازی ی/ک، فاصله‌های تکراری را جمع و `trim()` می‌کند (خط ۴۷ `PersianTextNormalizer.php`). نتیجه: کد، جدول، یا متن چندخطیِ تورفته در توضیحات **بی‌صدا تغییر می‌کند**. برای فیلد `description` که محتوای آزاد است، این یک جهش داده‌ی غیرقابل بازگشت است.
2. **بدون opt-out.** `SaveOptions` در EspoCRM 10 فقط `getContext()` دارد و bag عمومی ندارد؛ هیچ راهی برای «این ذخیره را نرمال نکن» وجود ندارد (import، migration، restore از backup).
3. **بدون لاگ.** اگر نرمال‌سازی چیزی را عوض کند، هیچ ردی باقی نمی‌ماند.

**نکته‌ی مثبت:** چون `set()` مقدار `fetched` را عوض نمی‌کند، اگر مقدار از قبل نرمال باشد چیزی در DB نوشته نمی‌شود (`isAttributeChanged` → `false`). پس نگرانی «نوشتن در هر save» مطرح نیست.

**راه‌حل**

```php
class NormalizePersianInput implements BeforeSave
{
    private const ALLOWED_ENTITIES = ['Account', 'Contact', 'Lead', 'Opportunity', 'Task', 'Call', 'Meeting'];

    // description عمداً حذف شد: محتوای آزاد است
    private const TEXT_FIELDS = ['name', 'firstName', 'lastName', 'accountName'];

    public function __construct(private Log $log) {}

    public function beforeSave(Entity $entity, SaveOptions $options): void
    {
        if (! in_array($entity->getEntityType(), self::ALLOWED_ENTITIES, true)) {
            return;
        }

        foreach (self::TEXT_FIELDS as $field) {
            if (! $entity->has($field) || ! $entity->isAttributeChanged($field)) {
                continue;                       // فقط فیلدهایی که واقعاً تغییر کرده‌اند
            }

            $value = $entity->get($field);

            if (! is_string($value) || $value === '') {
                continue;
            }

            $normalized = PersianTextNormalizer::normalizeCharacters($value);

            if ($normalized !== $value) {
                $this->log->debug('Persian normalization applied', [
                    'entityType' => $entity->getEntityType(),
                    'field' => $field,
                ]);
                $entity->set($field, $normalized);
            }
        }
    }
}
```

اگر نرمال‌سازی `description` لازم است، فقط تبدیل ی/ک و ارقام را انجام دهید و **فاصله‌ها و `trim` را دست نزنید** (یک متد جداگانه `normalizeCharactersPreservingWhitespace`).

**TDD**

```php
public function testHookDoesNotTouchDescription(): void
{
    $entity = new class extends Entity {
        public function getEntityType(): string { return 'Lead'; }
    };
    $entity->set('description', "خط اول\n\n    کد:\n    if (x) {\n        y();\n    }");

    (new NormalizePersianInput($this->createMock(Log::class)))
        ->beforeSave($entity, new SaveOptions());

    $this->assertSame("خط اول\n\n    کد:\n    if (x) {\n        y();\n    }", $entity->get('description'));
}

public function testHookOnlyNormalizesChangedAttributes(): void
{
    // entity با name fetch شده و تغییری نکرده → set() نباید صدا شود
}

public function testHookNormalizesName(): void
{
    $entity = $this->makeEntity('Contact', ['name' => 'علي كريمي']);
    // ...
    $this->assertSame('علی کریمی', $entity->get('name'));
}
```

---

## ۵. یافته‌های کم‌اهمیت (P3)

### IRN-P3-01 — `IranValidators` کد مرده است

**فایل:** `Support/IranValidators.php` (کل فایل)

`grep` در کل مخزن نشان می‌دهد این کلاس **هیچ‌جا** جز تست خودش فراخوانی نمی‌شود. در مقابل، `entityDefs/Account.json` برای `nationalId` فقط `maxLength: 11` دارد و `entityDefs/Contact.json` برای `nationalCode` فقط `maxLength: 10`.

**اثر:** کاربر می‌تواند `nationalCode = "abcdefghij"` را ذخیره کند. کل ارزش ماژول بومی‌سازی در این سطح از دست می‌رود.

**راه‌حل:** یک هوک `BeforeSave` اختصاصی:

```php
// Hooks/Contact/ValidateIranIdentifiers.php  (یا Common با فیلتر entityType)
final class ValidateIranIdentifiers implements BeforeSave
{
    public function beforeSave(Entity $entity, SaveOptions $options): void
    {
        $type = $entity->getEntityType();

        if ($type === 'Contact' && $entity->isAttributeChanged('nationalCode')) {
            $code = (string) $entity->get('nationalCode');
            if ($code !== '' && ! IranValidators::isValidNationalCode($code)) {
                throw new Error('کد ملی نامعتبر است.');   // پیام فارسی برای کاربر
            }
        }

        if ($type === 'Account' && $entity->isAttributeChanged('nationalId')) {
            $id = (string) $entity->get('nationalId');
            if ($id !== '' && ! IranValidators::isValidCompanyNationalId($id)) {
                throw new Error('شناسه ملی حقوقی نامعتبر است.');
            }
        }

        // کد پستی و شبا به همین ترتیب
    }
}
```

**TDD**

```php
public function testContactWithInvalidNationalCodeIsRejected(): void
{
    $contact = $this->makeEntity('Contact', ['nationalCode' => '1234567890']);
    $this->expectException(Error::class);
    (new ValidateIranIdentifiers())->beforeSave($contact, new SaveOptions());
}

public function testAccountWithValidCompanyNationalIdIsAccepted(): void
{
    $account = $this->makeEntity('Account', ['nationalId' => '10380274534']);
    (new ValidateIranIdentifiers())->beforeSave($account, new SaveOptions());
    $this->assertTrue(true);   // بدون exception
}
```

---

### IRN-P3-02 — NBSP/ZWSP کد ملی معتبر را ریجکت می‌کند

**فایل و خطوط:** `Support/IranValidators.php:12, 37, 65`

**شرح**

```php
$code = (string) preg_replace('/[\s\-]/', '', $code);
```

`\s` بدون پرچم `u` فقط فضاهای ASCII را می‌گیرد. `U+00A0` (NBSP) و `U+200B` (ZWSP) که از کپی‌کردن سایت‌های فارسی بسیار رایج‌اند، حذف نمی‌شوند.

**اثبات:** `isValidNationalCode("0012345679\u{00A0}")` → `false`، در حالی که مقدار بدون NBSP `true` است.

**راه‌حل**

```php
private static function sanitize(string $value): string
{
    $value = PersianTextNormalizer::toEnglishDigits($value);
    // فضاهای یونیکد، فاصله‌ی نامرئی، تیره و زیرخط
    return (string) preg_replace('/[\p{Z}\p{Cf}\-\s]/u', '', $value);
}
```

**TDD**

```php
/** @dataProvider invisibleCharacterProvider */
public function testNationalCodeIgnoresInvisibleCharacters(string $char): void
{
    $this->assertTrue(IranValidators::isValidNationalCode("0012345679{$char}"));
}

public static function invisibleCharacterProvider(): array
{
    return ['NBSP' => ["\u{00A0}"], 'ZWSP' => ["\u{200B}"], 'ZWNJ' => ["\u{200C}"], 'TAB' => ["\t"]];
}
```

---

### IRN-P3-03 — صفر لاگ در کل ماژول

**فایل:** تمام فایل‌های PHP

`grep -rn "Utils\\Log\|->log\|logger"` → **هیچ نتیجه**. ده بلوک `catch (Throwable)` در `JalaliHelper`، یک بلوک در `SmsCampaignService:109`، یک بلوک در `KavenegarSender:98` — همه بی‌صدا.

**اثر:** هیچ راهی برای تشخیص «چرا پیامک نرسید»، «چرا تاریخ خالی شد»، «چرا رکورد ذخیره نشد» وجود ندارد. در یک ماژول پیامک که هزینه‌ی مالی دارد، این یعنی عدم امکان عیب‌یابی.

**راه‌حل:** `Espo\Core\Utils\Log` را به سازنده‌ی `SmsCampaignService`، `KavenegarSender` و `JalaliHelper` (به‌صورت کلاس غیر استاتیک یا با یک logger قابل تنظیم) تزریق کنید. **هرگز PII (شماره تلفن، متن پیامک) را در سطح info لاگ نکنید**؛ فقط شناسه رکورد و کد خطا.

---

### IRN-P3-04 — ناهماهنگی مجوز AGPL

**فایل‌ها:** `composer.json:6`، `LICENSE`، `LICENSE-EXTENSIONS-AGPL3.txt`، `extensions/bidar-iran/LICENSE`

**شرح**

| محل | اعلام |
|---|---|
| `composer.json` ریشه | `"license": "Unlicense"` (مالکیت عمومی) |
| `LICENSE` ریشه | متن Unlicense |
| `LICENSE-EXTENSIONS-AGPL3.txt` | AGPL-3.0 برای `extensions/` |
| `extensions/bidar-iran/LICENSE` | AGPL-3.0 |
| `extensions/bidar-brand/LICENSE` | **وجود ندارد** |
| `extensions/bidar-theme/LICENSE` | **وجود ندارد** |

سه مشکل:

1. **تناقض صریح**: بسته‌ی Composer ریشه اعلام می‌کند «بدون مجوز»، در حالی که بخش عمده‌ی کد AGPL است. هر ابزار SAM/Composer/AI که مجوز را از `composer.json` می‌خواند، اشتباه می‌گیرد.
2. **دو ماژول بدون فایل مجوز**: `bidar-brand` و `bidar-theme` — نقض AGPL §5 (باید مجوز و اعلان کپی‌رایت داشته باشند).
3. **بدون هدر فایل**: هیچ‌کدام از فایل‌های PHP هدر مجوز/کپی‌رایت ندارند. AGPL الزام صریح به هدر ندارد، ولی برای انطباق و جلوگیری از ادعای مالکیت متقابل، توصیه‌ی استاندارد است.

**راه‌حل**

```json
// composer.json
{
  "license": "AGPL-3.0-or-later"
}
```

- برای `bidar-brand` و `bidar-theme` فایل `LICENSE` (متن AGPL + بند مالکیت) اضافه کنید.
- یک `NOTICE` در ریشه با متن «Corresponding Source» برای انطباق با AGPL §13 (سرویس شبکه‌ای) اضافه کنید.
- در `README` بخش «مجوز و سورس» با لینک به مخزن عمومی بگذارید.

---

### IRN-P3-05 — نسخه‌ی build کهنه و ناهمگام

**فایل:** `build/release/custom/Espo/Modules/BidarIran/`

```
Files extensions/bidar-iran/Api/PostSendSms.php and build/release/.../PostSendSms.php differ
Files extensions/bidar-iran/manifest.json and build/release/.../manifest.json differ
Only in extensions/bidar-iran: Controllers
```

- نسخه‌ی build: `1.0.2`، سورس: `1.0.3`
- build فاقد fallback `$body['recipient']` و فاقد پوشه‌ی `Controllers`

**اثر:** اگر فرآیند انتشار از `build/release` بسته‌بندی کند، **نسخه‌ی اشتباه و ناقص** منتشر می‌شود. این یک ریسک زنجیره‌ی تأمین است.

**راه‌حل:** `build/release` را از git حذف کنید و در CI تولید کنید؛ یا یک تست یکپارچگی اضافه کنید:

```php
public function testReleaseCopyMatchesSource(): void
{
    $source = dirname(__DIR__, 2);
    $build = dirname(__DIR__, 4) . '/build/release/custom/Espo/Modules/BidarIran';

    foreach (['Api', 'Services', 'Sms', 'Support', 'Hooks'] as $dir) {
        $this->assertSame(
            $this->hashDir("$source/$dir"),
            $this->hashDir("$build/$dir"),
            "پوشه‌ی $dir در build با سورس همگام نیست."
        );
    }
}
```

---

### IRN-P3-06 — `KavenegarSender` دو مسئولیت دارد

**فایل:** `Sms/KavenegarSender.php:26-44`

سازنده هم: (۱) خواندن پیکربندی از `Integration`، (۲) ساخت `IranPhoneNormalizer`، (۳) ساخت HTTP client. این یعنی کلاس هم Service Locator است، هم Factory، هم Client.

**راه‌حل:** جداسازی به دو کلاس:

```php
final class KavenegarConfig
{
    public function __construct(
        public readonly string $apiKey,
        public readonly ?string $senderLine,
    ) {
        if ($apiKey === '') {
            throw new RuntimeException('Kavenegar API key is not configured.');
        }
    }

    public static function fromIntegration(EntityManager $em): self
    {
        $integration = $em->getEntityById('Integration', 'Kavenegar');
        return new self(
            (string) ($integration?->get('apiKey') ?? ''),
            $integration?->get('senderLine') ? (string) $integration->get('senderLine') : null,
        );
    }
}

final class KavenegarSender implements Sender
{
    public function __construct(
        private KavenegarConfig $config,
        private IranPhoneNormalizer $normalizer,
        ?Closure $httpClient = null,
    ) {}
}
```

**TDD:** تست اینکه `KavenegarSender` بدون `KavenegarConfig` قابل ساخت نیست (خطای نوع در زمان کامپایل/ساخت).

---

### IRN-P3-07 — شماره تماس در query string

**فایل و خط:** `Api/PostVoipWebhook.php:56`

```php
?? $request->getQueryParam('phone') ?? ''
```

پذیرش شماره از query string یعنی شماره‌ی تماس‌گیرنده (داده‌ی شخصی) در access log وب‌سرور، لاگ‌های CDN و پراکسی ثبت می‌شود.

**راه‌حل:** فقط از بدنه‌ی JSON بخوانید. اگر ارائه‌دهنده‌ی VoIP مجبور به query است، حداقل در `nginx`/`Apache` لاگ‌گیری query را برای این مسیر غیرفعال کنید.

---

### IRN-P3-08 — شکست با کد ۲۰۰

**فایل و خط:** `Api/PostSendSms.php:83` (و `ResponseComposer::json` با پیش‌فرض ۲۰۰)

```php
$result = $service->sendSms(...);
return ResponseComposer::json($result);   // ۲۰۰ حتی وقتی success=false
```

**اثر:** سیستم‌های مانیتورینگ، load balancer و alerting هیچ سیگنالی از شکست نمی‌گیرند. در لاگ دسترسی، همه‌ی درخواست‌ها ۲۰۰ هستند.

**راه‌حل**

```php
$response = ResponseComposer::json($result);

if (! $result['success']) {
    $response = $response->setStatus(502);   // Bad Gateway: سرویس بالادستی شکست خورد
}

return $response;
```

**TDD**

```php
public function testFailedSendReturnsNon2xxStatus(): void
{
    $response = $action->process($requestWithBadPhone);
    $this->assertSame(502, $response->getStatusCode());
}
```

---

## ۶. نقشه‌ی راه اصلاح (به ترتیب اولویت)

| مرحله | کار | یافته‌ها | برآورد |
|---|---|---|---|
| ۱ | حذف nullable از سازنده‌های کلاس‌های API/Service + تست گارد reflection | P0-01 | ۰.۵ روز |
| ۲ | تزریق `Acl`/`User` و بررسی مجوز + بستن IDOR قالب | P0-02, P0-03 | ۱ روز |
| ۳ | `consumes: ["application/json"]` روی هر دو route | P1-05 | ۰.۲۵ روز |
| ۴ | Fail-Closed در `KavenegarSender` + ثبت `messageid` | P1-03, P2-03 | ۰.۵ روز |
| ۵ | سقف‌های ورودی + RateLimiter + dedupe | P1-01, P2-02 | ۱ روز |
| ۶ | اصلاح وب‌هوک: query ایندکسی + فیلتر `stage` + حداقل‌سازی خروجی | P1-02 | ۱ روز |
| ۷ | الگوی Outbox + Idempotency + لاگ | P2-01, P3-03 | ۱.۵ روز |
| ۸ | اصلاح `JalaliHelper` (UTC، بازه، نیمه‌باز) | P2-04 | ۱ روز |
| ۹ | اصلاح CSV (عدد منفی، هدر، استریم) | P2-05 | ۰.۵ روز |
| ۱۰ | اصلاح هوک نرمال‌سازی | P2-06 | ۰.۵ روز |
| ۱۱ | اتصال `IranValidators` + پاک‌سازی کاراکترهای نامرئی | P3-01, P3-02 | ۱ روز |
| ۱۲ | انطباق AGPL + حذف build کهنه | P3-04, P3-05 | ۰.۵ روز |

**جمع: حدود ۹.۵ روز‌کاری.**

---

## ۷. شکاف‌های پوشش تست (چرا تست‌ها سبزند ولی ماژول نمی‌خورد)

| شکاف | توضیح | تست پیشنهادی |
|---|---|---|
| **DI هرگز تست نشده** | همه‌ی تست‌ها `new PostSendSms($service)` می‌سازند؛ مسیر `InjectableFactory` اجرا نمی‌شود | تست گارد reflection + تست wiring با Container |
| **بدون تست یکپارچه** | `tests/Integration/.gitkeep` خالی است | حداقل یک تست HTTP واقعی روی `/BidarSms/send` و `/BidarVoip/webhook` |
| **مسیر ۴۰۳ وب‌هوک** | تست فقط با `service` تزریق‌شده اجرا می‌شود؛ مسیر `$entityManager === null` هرگز تست نشده | تست با `new PostVoipWebhook(null, $em)` و secret خالی |
| **تست، باگ را تثبیت کرده** | `testExportProtectsAgainstFormulaInjection` انتظار `'-2+2` دارد | تست جدید برای عدد منفی |
| **تست timezone** | همه‌ی تست‌های `toJalaliDateTime` با `tz='UTC'` اجرا می‌شوند | تست با `date_default_timezone_set('Asia/Tehran')` |
| **تست فیلتر معاملات** | `lookup` با آرایه‌ی آماده تست می‌شود، نه با query واقعی | تست روی SQL تولیدشده |
| **بدون تست امنیتی** | هیچ تستی برای ACL، IDOR، Rate Limit، CSRF وجود ندارد | ۶ تست پیشنهادی در بخش‌های بالا |
| **بدون تست properties** | هیچ تست property-based برای تبدیل تقویم وجود ندارد | round-trip: `toGregorian(toJalali(x)) == x` روی ۱۰۰۰ تاریخ تصادفی |

---

## پیوست الف — دستورات بازتولید شواهد

```bash
# ۱. اجرای تست‌ها
cd /Users/moeini/Dev/didar
./vendor/bin/phpunit -c extensions/phpunit.xml --testsuite unit --filter BidarIran

# ۲. اثبات nullable injection
grep -n "allowsNull" engine/application/Espo/Core/InjectableFactory.php
#   → 279:  if ($dependencyClass && $param->allowsNull()) { return null; }

# ۳. اثبات وابستگی به timezone
php -r 'date_default_timezone_set("Asia/Tehran");
  require "vendor/autoload.php";
  echo Espo\Modules\BidarIran\Support\JalaliHelper::toJalaliDateTime("2026-11-22 12:00:00");'
#   → 1405/09/01 12:00   (باید 15:30 باشد)

# ۴. اثبات clamp و عدم اعتبارسنجی سال
php -r 'require "vendor/autoload.php";
  print_r(Espo\Modules\BidarIran\Support\JalaliHelper::getJalaliMonthRange(1405, 15));'
#   → [start] => 2027-02-20 00:00:00   (اسفند، به‌جای خطا)

# ۵. اثبات خرابی عدد منفی در CSV
php -r 'require "vendor/autoload.php";
  echo Espo\Modules\BidarIran\Support\PersianCsvExporter::export(["a"], [["-100"]]);'
#   → '-100

# ۶. اثبات عدم استفاده از IranValidators
grep -rn "IranValidators" --include=*.php --include=*.json . | grep -v vendor | grep -v tests
#   → فقط تعریف کلاس
```

---

## پیوست ب — موارد تأیید شده (بی‌نقص)

برای انصاف، این بخش‌ها بررسی و **درست** تشخیص داده شدند:

| مورد | شاهد |
|---|---|
| الگوریتم کد ملی (۱۰ رقمی) | `isValidNationalCode('0084575948')` → `true`؛ checksum و قاعده‌ی ارقام یکسان درست |
| الگوریتم شناسه ملی حقوقی (۱۱ رقمی) | `isValidCompanyNationalId('10380274534')` → `true`؛ وزن‌ها و `t = d[9] + 2` درست |
| الگوریتم شبا (IBAN) | `IR270170000000100324200001` → mod-97 = **1** → `true`؛ جای‌گذاری `1827` برای `IR` درست |
| الگوریتم کد پستی | `^[13-9][0-9]{9}$` درست؛ حذف `2` و `0` از رقم اول |
| تبدیل سال کبیسه شمسی | `1403` کبیسه، `1404` عادی، `1408` کبیسه — همه با `jalaliCal` سازگار |
| `convertNumbers($str, true)` | امضای واقعی `convertNumbers(string $string, bool $toLatin = false)` — استفاده درست |
| BOM در CSV | `efbbbf` درست |
| `hash_equals` در احراز وب‌هوک | مقایسه‌ی مقاوم به timing attack — درست |
| Fail-Closed در secret خالی | `authenticate()` با secret خالی `false` برمی‌گرداند — درست |
| عدم استفاده از SSRF | URL در `KavenegarSender` ثابت است و از ورودی کاربر ساخته نمی‌شود |
| `CURLOPT_SSL_VERIFYPEER` | پیش‌فرض روشن؛ تغییری داده نشده — درست |

---

*پایان گزارش — بخش ۲*
