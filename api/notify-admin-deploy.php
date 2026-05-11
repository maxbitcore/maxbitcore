<?php
/**
 * Optional: email shop when admin saves catalog (same secret as notify-order-paid.php when set).
 */
ini_set('display_errors', '0');

require_once __DIR__ . '/maxbit_mail_helper.php';

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

$secret = '';
$cfgPath = __DIR__ . '/order_mail_config.php';
if (is_readable($cfgPath)) {
    require_once $cfgPath;
}
if (defined('MAXBIT_ORDER_NOTIFY_SECRET')) {
    $secret = (string) constant('MAXBIT_ORDER_NOTIFY_SECRET');
}
$envSec = getenv('MAXBIT_ORDER_NOTIFY_SECRET');
if (is_string($envSec) && $envSec !== '') {
    $secret = $envSec;
}
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

$action = isset($data['action']) ? trim((string) $data['action']) : 'catalog_update';
$label = isset($data['label']) ? trim((string) $data['label']) : '';

$to = maxbit_order_mail_cfg('MAXBIT_SHOP_ORDER_TO', 'info@maxbitcore.com');
$subject = '[MaxBit] System configuration / inventory deployed';
$body = "An administrator updated the MaxBit catalog or configuration.\r\n\r\n";
$body .= 'Action: ' . $action . "\r\n";
if ($label !== '') {
    $body .= 'Details: ' . $label . "\r\n";
}
$body .= 'Time (server): ' . date('c') . "\r\n";

maxbit_mail_transactional($to, $subject, $body, null);

echo json_encode(['ok' => true]);
