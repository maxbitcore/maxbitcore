<?php
/**
 * Receives paid-order JSON from the checkout page and emails the shop inbox + the customer (default shop: max@maxbitcore.com).
 * Deploy to the same host as other api/*.php files.
 *
 * SMTP (recommended): vendor/ + order_mail_config.php (copy from order_mail_config.example.php).
 * Or run: composer install in api/
 *
 * Optional anti-spam: define MAXBIT_ORDER_NOTIFY_SECRET (same value as VITE_ORDER_NOTIFY_SECRET) —
 * then the request must send header X-Maxbit-Order-Notify-Secret with that value.
 */
ini_set('display_errors', '0');

require_once __DIR__ . '/order_notify_mail.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Maxbit-Order-Notify-Secret');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
    exit;
}

if (!defined('MAXBIT_ORDER_NOTIFY_SECRET')) {
    define('MAXBIT_ORDER_NOTIFY_SECRET', '');
}

$secret = MAXBIT_ORDER_NOTIFY_SECRET;
if ($secret !== '') {
    $sent = $_SERVER['HTTP_X_MAXBIT_ORDER_NOTIFY_SECRET'] ?? '';
    if (!is_string($sent) || !hash_equals($secret, $sent)) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'forbidden']);
        exit;
    }
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_json']);
    exit;
}

$orderId = isset($data['orderId']) ? trim((string) $data['orderId']) : '';
if ($orderId === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'missing_order_id']);
    exit;
}

$dedupeDir = __DIR__ . '/data';
$dedupeFile = $dedupeDir . '/order-notify-' . md5($orderId) . '.done';
if (!is_dir($dedupeDir)) {
    @mkdir($dedupeDir, 0755, true);
}
if (is_readable($dedupeFile)) {
    http_response_code(200);
    echo json_encode(['ok' => true, 'deduplicated' => true, 'customer_notified' => null]);
    exit;
}

$body = isset($data['order_body']) && is_string($data['order_body']) && $data['order_body'] !== ''
    ? $data['order_body']
    : json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

$customerBodyDetail = isset($data['customer_order_body']) && is_string($data['customer_order_body'])
        && $data['customer_order_body'] !== ''
    ? $data['customer_order_body']
    : $body;

$to = maxbit_order_mail_cfg('MAXBIT_SHOP_ORDER_TO', 'info@maxbitcore.com');
$shopBcc = maxbit_order_mail_cfg('MAXBIT_SHOP_ORDER_BCC', '');
$subject = '[MaxBit] Paid order ' . $orderId;
$customerEmail = isset($data['customerEmail']) ? trim((string) $data['customerEmail']) : '';
$shopFrom = maxbit_order_mail_cfg('MAXBIT_MAIL_FROM', 'info@maxbitcore.com');
$shopFromName = maxbit_order_mail_cfg('MAXBIT_MAIL_FROM_NAME', 'MaxBit Orders');

$replyShop = ($customerEmail !== '' && filter_var($customerEmail, FILTER_VALIDATE_EMAIL)) ? $customerEmail : null;

/**
 * When shop To and From are the same mailbox (e.g. info@), many SMTP setups do not show the message in Inbox.
 * Auto-BCC a second domain address so a copy always lands (override with MAXBIT_SHOP_ORDER_SAME_INBOX_BCC='' to disable).
 */
if (
    strcasecmp($to, $shopFrom) === 0
    && trim($shopBcc) === ''
    && trim(maxbit_order_mail_cfg('MAXBIT_SHOP_ORDER_BACKUP_EMAIL', '')) === ''
) {
    $autoBcc = trim(maxbit_order_mail_cfg('MAXBIT_SHOP_SAME_INBOX_BCC', 'max@maxbitcore.com'));
    if ($autoBcc !== '' && strcasecmp($autoBcc, $to) !== 0 && filter_var($autoBcc, FILTER_VALIDATE_EMAIL)) {
        $shopBcc = $autoBcc;
    } elseif ($autoBcc === '') {
        error_log(
            'maxbit notify-order-paid: shop To === From and no BCC — set MAXBIT_SHOP_ORDER_BCC or MAXBIT_SHOP_ORDER_BACKUP_EMAIL in order_mail_config.php'
        );
    }
}

if (maxbit_order_mail_smtp_ready() && maxbit_order_mail_use_phpmailer()) {
    $r1 = maxbit_order_mail_send_retry($to, $subject, $body, $replyShop, $shopBcc !== '' ? $shopBcc : null);
    if (!$r1['ok']) {
        http_response_code(500);
        echo json_encode([
            'ok' => false,
            'error' => 'smtp_failed',
            'detail' => isset($r1['error']) ? substr((string) $r1['error'], 0, 400) : '',
        ]);
        exit;
    }
    maxbit_order_mail_send_shop_backup($subject, $body, $replyShop);
    usleep(400000);
} else {
    $ok = maxbit_order_mail_send_php_mail(
        $to,
        $subject,
        $body,
        $shopFrom,
        $shopFromName,
        $replyShop,
        $shopBcc !== '' ? $shopBcc : null
    );
    if (!$ok) {
        http_response_code(500);
        echo json_encode([
            'ok' => false,
            'error' => 'mail_failed',
            'hint' => maxbit_order_mail_smtp_ready() && !maxbit_order_mail_use_phpmailer()
                ? 'Add api/vendor/ (PHPMailer autoload).'
                : 'Configure order_mail_config.php (SMTP) or fix server mail.',
        ]);
        exit;
    }
    maxbit_order_mail_send_shop_backup($subject, $body, $replyShop);
    usleep(400000);
}

$customer_notified = false;
/** Hidden copy of the buyer confirmation — set in order_mail_config.php (e.g. max@maxbitcore.com) if you want a backup in your inbox. */
$customerMailBcc = trim(maxbit_order_mail_cfg('MAXBIT_CUSTOMER_ORDER_BCC', ''));
if ($customerMailBcc !== '' && !filter_var($customerMailBcc, FILTER_VALIDATE_EMAIL)) {
    $customerMailBcc = '';
}

if ($customerEmail !== '' && filter_var($customerEmail, FILTER_VALIDATE_EMAIL)) {
    $custSubject = '[MaxBit] Order confirmed — ' . $orderId;
    $custBody = "Thank you for your order.\r\n\r\n";
    $custBody .= "We received your payment. Your order is in the queue and will be prepared for assembly and testing.\r\n";
    $custBody .= "Estimated delivery: 3–5 business days (US).\r\n\r\n";
    $custBody .= "Order details (for your records):\r\n\r\n" . $customerBodyDetail . "\r\n";
    $custBody .= "\r\nQuestions? Contact max@maxbitcore.com.\r\n\r\n";
    $custBody .= "Thank you for your purchase.\r\n\r\nKind regards,\r\nThe MaxBit team\r\n";

    if (maxbit_order_mail_smtp_ready() && maxbit_order_mail_use_phpmailer()) {
        $r2 = maxbit_order_mail_send_retry(
            $customerEmail,
            $custSubject,
            $custBody,
            $shopFrom,
            $customerMailBcc !== '' ? $customerMailBcc : null
        );
        if ($r2['ok']) {
            $customer_notified = true;
        } else {
            echo json_encode([
                'ok' => true,
                'customer_notified' => false,
                'customer_mail_error' => isset($r2['error']) ? substr((string) $r2['error'], 0, 400) : '',
            ]);
            exit;
        }
    } else {
        $custBccPhp = $customerMailBcc !== '' ? $customerMailBcc : null;
        $customer_notified = maxbit_order_mail_send_php_mail(
            $customerEmail,
            $custSubject,
            $custBody,
            $shopFrom,
            $shopFromName,
            $shopFrom,
            $custBccPhp
        );
        if (!$customer_notified) {
            sleep(1);
            $customer_notified = maxbit_order_mail_send_php_mail(
                $customerEmail,
                $custSubject,
                $custBody,
                $shopFrom,
                $shopFromName,
                $shopFrom,
                $custBccPhp
            );
        }
    }
}

@file_put_contents($dedupeFile, date('c'));
echo json_encode(['ok' => true, 'customer_notified' => $customer_notified]);
