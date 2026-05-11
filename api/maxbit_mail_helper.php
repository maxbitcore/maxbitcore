<?php
/**
 * Shared transactional mail: same SMTP / PHPMailer path as notify-order-paid.php.
 */
require_once __DIR__ . '/order_notify_mail.php';

function maxbit_public_site_url(): string
{
    $u = maxbit_order_mail_cfg('MAXBIT_PUBLIC_SITE_URL', '');
    if (is_string($u) && $u !== '') {
        return rtrim($u, '/');
    }
    $env = getenv('MAXBIT_PUBLIC_SITE_URL');
    if (is_string($env) && $env !== '') {
        return rtrim($env, '/');
    }
    return 'https://www.maxbitcore.com';
}

/**
 * @return bool true if mail accepted (SMTP ok or php mail returned true)
 */
function maxbit_mail_transactional(string $to, string $subject, string $body, ?string $replyTo = null): bool
{
    $to = trim($to);
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $shopFrom = maxbit_order_mail_cfg('MAXBIT_MAIL_FROM', 'info@maxbitcore.com');
    $shopFromName = maxbit_order_mail_cfg('MAXBIT_MAIL_FROM_NAME', 'MaxBit Orders');

    if (maxbit_order_mail_smtp_ready() && maxbit_order_mail_use_phpmailer()) {
        $r = maxbit_order_mail_send_retry($to, $subject, $body, $replyTo, null);
        if (!$r['ok']) {
            error_log('maxbit_mail_transactional SMTP: ' . ($r['error'] ?? 'send_failed'));
        }
        return $r['ok'];
    }

    $ok = maxbit_order_mail_send_php_mail(
        $to,
        $subject,
        $body,
        $shopFrom,
        $shopFromName,
        $replyTo ?? $shopFrom,
        null
    );
    if (!$ok) {
        error_log('maxbit_mail_transactional php mail failed');
    }
    return $ok;
}
