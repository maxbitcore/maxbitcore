<?php
/**
 * Receives paid-order JSON from the checkout page and emails info@maxbitcore.com.
 * Deploy to the same host as other api/*.php files.
 *
 * Optional anti-spam: define MAXBIT_ORDER_NOTIFY_SECRET (same value as VITE_ORDER_NOTIFY_SECRET) —
 * then the request must send header X-Maxbit-Order-Notify-Secret with that value.
 */
ini_set('display_errors', '0');

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

$body = isset($data['order_body']) && is_string($data['order_body']) && $data['order_body'] !== ''
    ? $data['order_body']
    : json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

$to = 'info@maxbitcore.com';
$subject = '[MaxBit] Paid order ' . $orderId;
$customerEmail = isset($data['customerEmail']) ? trim((string) $data['customerEmail']) : '';
$fromHeader = 'From: MaxBit Orders <noreply@maxbitcore.com>';
$replyHeader = $customerEmail !== '' && filter_var($customerEmail, FILTER_VALIDATE_EMAIL)
    ? 'Reply-To: ' . $customerEmail
    : '';

$headers = [
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    $fromHeader,
];
if ($replyHeader !== '') {
    $headers[] = $replyHeader;
}

$ok = @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, implode("\r\n", $headers));
if (!$ok) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'mail_failed']);
    exit;
}

echo json_encode(['ok' => true]);
