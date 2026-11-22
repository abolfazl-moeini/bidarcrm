# راهنمای سریع نصب بیدار (TL;DR)

> **خلاصه یک‌صفحه‌ای راه‌اندازی سریع سامانه مدیریت ارتباط با مشتریان بیدار (BidarCRM)**  
> مناسب برای توسعه‌دهندگان، مدیران سرور و تیم‌های فنی که به دنبال نصب سریع بدون توضیحات اضافه هستند.

---

## روش ۱: اجرای محلی با داکر (Docker Compose) — کمتر از ۲ دقیقه

### گام ۱: ساخت پوشه و کپی بسته
```bash
# ساخت دایرکتوری پروژه و پوشه سورس
mkdir -p ~/Dev/bidar-crm/source

# کپی و اکسترکت بسته رسمی در پوشه سورس
unzip -q dist/bidar-crm-v1.0.0.zip -d ~/Dev/bidar-crm/source/
```

### گام ۲: ایجاد `docker-compose.yml`
یک فایل `~/Dev/bidar-crm/docker-compose.yml` با محتوای زیر بسازید:

```yaml
services:
  bidarcrm:
    container_name: bidarcrm-app
    image: arm64v8/wordpress
    platform: linux/arm64/v8
    restart: "no"
    ports:
      - "8089:80"
    environment:
      VIRTUAL_HOST: bidarcrm.test,bidar.test
      VIRTUAL_PORT: 80
    volumes:
      - ./source:/var/www/html
    command: >
      bash -c "
      php -m | grep -q pdo_mysql || docker-php-ext-install pdo_mysql &&
      a2enmod rewrite &&
      a2enmod headers &&
      apache2-foreground
      "

  bidarcrmdb:
    container_name: bidarcrmdb
    image: arm64v8/mysql
    platform: linux/arm64/v8
    restart: "no"
    ports:
      - "3316:3306"
    environment:
      MYSQL_DATABASE: bidarcrm
      MYSQL_USER: bidaruser
      MYSQL_PASSWORD: bidarpass
      MYSQL_ROOT_PASSWORD: root
    volumes:
      - bidarcrm_db_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "127.0.0.1", "-uroot", "-proot"]
      interval: 5s
      timeout: 5s
      retries: 20

volumes:
  bidarcrm_db_data:

networks:
  default:
    name: shared_net
    external: true
```
*(اگر از شبکه مشترک `shared_net` استفاده نمی‌کنید، بخش `networks` را حذف کنید تا شبکه پیش‌فرض داکر ساخته شود).*

### گام ۳: راه‌اندازی و ورود
```bash
cd ~/Dev/bidar-crm
docker compose up -d
```
مرورگر را باز کنید: **[http://localhost:8089](http://localhost:8089)**

**اطلاعات اتصال دیتابیس در ویزارد نصب:**
- **Host Name:** `bidarcrmdb`
- **Database Name:** `bidarcrm`
- **User Name:** `bidaruser`
- **Password:** `bidarpass`

---

## روش ۲: نصب در هاست اشتراکی (cPanel / DirectAdmin) — کمتر از ۳ دقیقه

> **بدون نیاز به SSH، Git، Node.js، NPM یا Composer**

### گام ۱: ساخت پایگاه داده در cPanel
1. به **MySQL Databases** بروید.
2. یک دیتابیس جدید و یک کاربر بسازید و رمز قوی تعیین کنید.
3. کاربر را با دسترسی کامل (**ALL PRIVILEGES**) به دیتابیس متصل کنید.
4. کدگذاری (Collation) دیتابیس حتماً `utf8mb4_unicode_ci` باشد.

### گام ۲: آپلود و استخراج فایل
1. فایل `dist/bidar-crm-v1.0.0.zip` را در پوشه `public_html/` (یا ساب‌دامین) آپلود کنید.
2. فایل را با ابزار **Extract** هاست از حالت فشرده خارج کنید.
3. مطمئن شوید فایل `.htaccess` در ریشه قرار گرفته است (گزینه *Show Hidden Files* فعال باشد).

### گام ۳: اجرای ویزارد نصب
1. آدرس سایت (مثلاً `https://crm.yourdomain.com`) را در مرورگر باز کنید.
2. مشخصات دیتابیس را وارد کرده و حساب کاربری ادمین اولیه را ایجاد کنید.

### گام ۴: تنظیم کران‌جاب (Cron Job)
در پنل هاست، یک کران‌جاب دقیقه‌ای اضافه کنید:
```bash
* * * * * /usr/local/bin/php /home/USER/public_html/cron.php > /dev/null 2>&1
```

---

## روش ۳: محیط توسعه فرانت‌اند (Development Mode)

اگر قصد تغییر یا توسعه رابط کاربری React را دارید:

```bash
# نصب پکیج‌های فرانت‌اند
npm --prefix apps/web install

# اجرای سرور توسعه Vite (HMR)
npm --prefix apps/web run dev
```
- فرانت‌اند توسعه: `http://localhost:5173/app/`
- بیلد نسخه پروداکشن: `npm --prefix apps/web run build`

---

## نشانی‌های مهم سامانه پس از نصب

| بخش | مسیر URL | کاربرد |
| :--- | :--- | :--- |
| **فرانت‌آفیس بیدار** | `/app` یا `/` | رابط کاربری پیشرفته فروش، کاریز کانبان، ثبت فعالیت‌ها و داشبورد |
| **صفحه ورود** | `/app/login` | لاگین کارشناسان و مدیران با نام کاربری و رمز عبور |
| **پنل مدیریت پیشرفته** | `/admin` | تنظیمات هسته EspoCRM، سفارشی‌سازی فیلدها و سطوح دسترسی (ACL) |
| **اندپوینت وب‌هوک سانترال VoIP** | `/api/v1/BidarVoip/webhook` | ثبت تماس ورودی/خروجی از سیستم‌های تلفنی Asterisk / Issabel |

---

## حداقل پیش‌نیازهای سرور

- **PHP:** 8.2 یا 8.3 (توصیه اکید: 8.3)
- **اکستنشن‌های PHP:** `pdo_mysql`, `mbstring`, `gd`, `zip`, `curl`, `intl`, `xml`
- **وب‌سرور:** Apache 2.4+ (با ماژول‌های فعال `rewrite` و `headers`) یا NGINX
- **MySQL / MariaDB:** MySQL 8.0+ یا MariaDB 10.5+

---

> [!TIP]
> برای راهنمای فوق‌العاده با جزئیات تصویری و حل خطاهای احتمالی هاست، فایل کامل [docs/INSTALL_SHARED_HOSTING_FA.md](file:///Users/moeini/Dev/didar/docs/INSTALL_SHARED_HOSTING_FA.md) را مطالعه کنید.
