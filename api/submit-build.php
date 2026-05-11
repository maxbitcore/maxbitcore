<?php
/**
 * Custom build / configurator submission — emails shop inbox like order flow (SMTP from order_mail_config.php).
 */
ini_set('display_errors', '0');

require_once __DIR__ . '/maxbit_mail_helper.php';
require_once __DIR__ . '/build_submissions_store.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
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

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_json']);
    exit;
}

$userEmail = isset($data['userEmail']) ? trim((string) $data['userEmail']) : '';
if ($userEmail === '' || !filter_var($userEmail, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_email']);
    exit;
}

try {
    maxbit_build_submissions_append($data);
} catch (Throwable $e) {
    error_log('submit-build append: ' . $e->getMessage());
}

$id = isset($data['id']) ? trim((string) $data['id']) : 'unknown';
$to = maxbit_order_mail_cfg('MAXBIT_SHOP_ORDER_TO', 'info@maxbitcore.com');
$subject = '[MaxBit] Custom build request — ' . $id;
$body = "New configurator / custom build submission.\r\n\r\n";
$body .= json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\r\n";

$shopFrom = maxbit_order_mail_cfg('MAXBIT_MAIL_FROM', 'info@maxbitcore.com');
$okShop = maxbit_mail_transactional($to, $subject, $body, $userEmail);

$custSubject = '[MaxBit] We received your build request';
$custBody = "Hello,\r\n\r\n";
$custBody .= "Thank you — we received your custom build / configurator request (reference: {$id}).\r\n";
$custBody .= "Our team will review it and contact you if we need more details.\r\n\r\n";
$custBody .= "— The MaxBit team\r\n";
maxbit_mail_transactional($userEmail, $custSubject, $custBody, $shopFrom);

if (!$okShop) {
    error_log('submit-build: shop notification may have failed');
}

echo json_encode(['ok' => true]);
