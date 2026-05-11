<?php
/**
 * =============================================================================
 * ШАБЛОН — скопируйте этот файл на сервер как order_mail_config.php и заполните.
 * Не коммитьте order_mail_config.php (пароль). В .gitignore он уже игнорируется.
 * =============================================================================
 *
 * --- ШАГ 1. Почтовый ящик в cPanel ---
 * 1) Откройте cPanel → Email Accounts (Почтовые аккаунты).
 * 2) Нажмите «+ Create» / «Создать».
 * 3) Локальная часть: info  → получится info@ваш-домен.com (для maxbitcore.com — info@maxbitcore.com).
 * 4) Задайте пароль и сохраните — он пойдёт в MAXBIT_SMTP_PASS ниже.
 * 5) Нажмите у этого ящика «Connect Devices» / «Настройка клиента»:
 *    - Исходящий сервер (SMTP), хост — обычно mail.домен или то, что показал хостинг.
 *    - Порт: 465 (SSL) или 587 (TLS) — как в инструкции cPanel.
 *    - Имя пользователя SMTP — чаще всего ПОЛНЫЙ email (info@maxbitcore.com).
 *
 * --- ШАГ 2. PHPMailer (папка vendor) ---
 * Вариант A — на своём ПК, где установлен Composer:
 *   cd api
 *   composer install
 * Появится папка api/vendor/ — её целиком загрузите на хостинг в public_html/api/vendor/
 *   (или куда у вас лежит сайт: …/www/api/vendor/).
 *
 * Вариант B — по SSH на сервере (если есть):
 *   cd ~/public_html/api   (путь уточните у хостера)
 *   composer install
 *
 * Без папки vendor скрипт notify-order-paid.php не сможет отправлять через SMTP
 * (останется старый ненадёжный mail()).
 *
 * --- ШАГ 3. Файлы PHP на хостинге ---
 * В ту же папку api/, где уже лежат notify-order-paid.php, login.php и т.д., залейте:
 *   - notify-order-paid.php (обновлённый)
 *   - order_notify_mail.php
 *   - composer.json (необязательно для работы, но полезно для повторного composer install)
 *   - папка vendor/ целиком
 *   - этот файл скопируйте на сервер под именем order_mail_config.php и отредактируйте константы.
 *
 * --- ШАГ 4. Проверка ---
 * Оформите тестовый заказ. В браузере F12 → Network → запрос к notify-order-paid.php
 * должен вернуть JSON {"ok":true,...}. Если "smtp_failed" — смотрите поле "detail".
 *
 * MAXBIT_SMTP_HOST: только имя хоста (без ssl://). В cPanel «Connect Devices» часто указано:
 *   Outgoing server = maxbitcore.com, port 465 — или mail.домен — возьмите ТОЧНО как в инструкции хостера.
 */

define('MAXBIT_SMTP_HOST', 'maxbitcore.com');
define('MAXBIT_SMTP_PORT', 465);
/** 'ssl' для порта 465, 'tls' для порта 587 */
define('MAXBIT_SMTP_ENCRYPTION', 'ssl');
define('MAXBIT_SMTP_USER', 'info@maxbitcore.com');
define('MAXBIT_SMTP_PASS', 'PASTE_MAILBOX_PASSWORD_HERE');

/** Должен совпадать с ящиком, от имени которого логинитесь по SMTP */
define('MAXBIT_MAIL_FROM', 'info@maxbitcore.com');
define('MAXBIT_MAIL_FROM_NAME', 'MaxBit Orders');

/**
 * Публичный URL фронта (без слэша в конце) — ссылки «сброс пароля» в forgot_password.php.
 * Пример: https://www.maxbitcore.com
 */
// define('MAXBIT_PUBLIC_SITE_URL', 'https://www.maxbitcore.com');

/**
 * Куда слать уведомление магазину (первое письмо с деталями заказа).
 * Если From и To оба info@ — часть хостингов НЕ кладёт такое письмо во входящие (SMTP принимает, ящик пустой).
 * Решения (любое одно или несколько):
 *   A) В cPanel → Forwarders создайте orders@maxbitcore.com → forward на info@ и задайте ниже MAXBIT_SHOP_ORDER_TO = orders@...
 *   B) MAXBIT_SHOP_ORDER_BCC — скрытая копия на личный Gmail.
 *   C) MAXBIT_SHOP_ORDER_BACKUP_EMAIL — второе отдельное письмо на внешний ящик (самый надёжный вариант).
 *   D) Скрипт при To === From сам шлёт BCC на max@ (MAXBIT_SHOP_SAME_INBOX_BCC) — смените адрес при необходимости.
 */
/** Куда уходит «оповещение магазину»; в notify-order-paid.php по умолчанию info@maxbitcore.com */
// define('MAXBIT_SHOP_ORDER_TO', 'info@maxbitcore.com');
/** Пустая строка = отключить авто-BCC при одном и том же From/To */
// define('MAXBIT_SHOP_SAME_INBOX_BCC', 'max@maxbitcore.com');

/** Скрытая копия того же письма магазину (несколько адресов через запятую). */
// define('MAXBIT_SHOP_ORDER_BCC', 'your@gmail.com');

/**
 * Полная копия уведомления о заказе на ДРУГОЙ адрес (обычно личный Gmail).
 * Обязательно задайте, если на info@ ничего не приходит, а клиент получает письмо.
 */
// define('MAXBIT_SHOP_ORDER_BACKUP_EMAIL', 'your@gmail.com');

/**
 * Скрытая копия письма ПОКУПАТЕЛЮ (текст подтверждения заказа) — на max@ или личную почту.
 * Удобно, если основное письмо магазину не видно, а клиенту пришло: так вы всё равно получите копию их письма.
 */
// define('MAXBIT_CUSTOMER_ORDER_BCC', 'max@maxbitcore.com');

/**
 * Опционально: защита notify-order-paid.php, notify-fulfillment-status.php и notify-admin-deploy.php от чужих POST.
 * Тот же текст, что VITE_ORDER_NOTIFY_SECRET (сборка фронта) и MAXBIT_ORDER_NOTIFY_SECRET в Node server/.env.
 * Не копируйте реальный ключ в этот example-файл в репозиторий — только в order_mail_config.php на сервере.
 */
// define('MAXBIT_ORDER_NOTIFY_SECRET', 'paste_same_random_string_as_frontend_and_node');

/**
 * Регистрация / сброс пароля / заявка конфигуратора: api/register.php, forgot_password.php, reset_password.php,
 * submit-build.php, notify-admin-deploy.php, maxbit_mail_helper.php — заливайте рядом с notify-order-paid.php.
 * Таблица maxbit_password_resets создаётся автоматически при первом запросе forgot_password.php.
 */
