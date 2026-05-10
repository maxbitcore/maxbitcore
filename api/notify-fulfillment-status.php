<?php
/**
 * Called by Node when admin changes fulfillment status (shop-orders PATCH).
 * Emails the customer. Uses same secret as notify-order-paid.php.
 *
 * Header: X-Maxbit-Order-Notify-Secret (optional if MAXBIT_ORDER_NOTIFY_SECRET is set in PHP env/config)
 * Body JSON: orderId, customerEmail, previousStatus, newStatus
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
$customerEmail = isset($data['customerEmail']) ? trim((string) $data['customerEmail']) : '';
$previousStatus = isset($data['previousStatus']) ? trim((string) $data['previousStatus']) : '';
$newStatus = isset($data['newStatus']) ? trim((string) $data['newStatus']) : '';

if ($orderId === '' || $newStatus === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'missing_fields']);
    exit;
}

if ($customerEmail === '' || !filter_var($customerEmail, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_customer_email']);
    exit;
}

if ($previousStatus === $newStatus) {
    echo json_encode(['ok' => true, 'skipped' => true, 'reason' => 'same_status']);
    exit;
}

$shopFrom = maxbit_order_mail_cfg('MAXBIT_MAIL_FROM', 'info@maxbitcore.com');
$shopFromName = maxbit_order_mail_cfg('MAXBIT_MAIL_FROM_NAME', 'MaxBit Orders');

$lines = [
    'Processing' => "Your order is being prepared. We'll notify you when it ships.",
    'Shipped' => 'Great news — your order has shipped. Tracking details may follow in a separate message.',
    'Delivered' => 'Your order is marked as delivered. Thank you for choosing MaxBit.',
    'Cancelled' => 'Your order has been cancelled. If you were charged, refunds are handled according to our policy — contact us if you have questions.',
];

$msg = $lines[$newStatus] ?? ('Your order status is now: ' . $newStatus . '.');

$subject = '[MaxBit] Order update — ' . $orderId . ' — ' . $newStatus;
$body = "Hello,\r\n\r\n";
$body .= "We're writing about your MaxBit order {$orderId}.\r\n\r\n";
$body .= "Status update: {$previousStatus} → {$newStatus}\r\n\r\n";
$body .= $msg . "\r\n\r\n";
$body .= "— The MaxBit team\r\n";
$body .= "Questions? Reply to this email or write to max@maxbitcore.com\r\n";

if (!maxbit_order_mail_smtp_ready() || !maxbit_order_mail_use_phpmailer()) {
    http_response_code(503);
    echo json_encode(['ok' => false, 'error' => 'smtp_not_configured']);
    exit;
}

$r = maxbit_order_mail_send_retry($customerEmail, $subject, $body, $shopFrom, null);
if (!$r['ok']) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'send_failed',
        'detail' => isset($r['error']) ? substr((string) $r['error'], 0, 400) : '',
    ]);
    exit;
}

echo json_encode(['ok' => true, 'sent' => true]);
