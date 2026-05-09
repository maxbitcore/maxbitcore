<?php
/**
 * Sets product status to "Sold Out" when a Stripe payment completes (server-side hook).
 * Deploy next to save_products.php and set PRODUCTS_JSON to the same file that script reads/writes.
 *
 * Auth: header X-Maxbit-Mark-Products-Sold-Secret must equal MARK_PRODUCTS_SOLD_SECRET (define below or getenv).
 */
ini_set('display_errors', '0');

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Maxbit-Mark-Products-Sold-Secret');
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

// Must match Node MARK_PRODUCTS_SOLD_SECRET. PHP getenv() is often empty on shared hosting — use api/mark_products_sold.local.php (see example).
$markSoldSecretLocal = '';
$localSecretFile = __DIR__ . '/mark_products_sold.local.php';
if (is_readable($localSecretFile)) {
    $v = include $localSecretFile;
    if (is_string($v)) {
        $markSoldSecretLocal = trim($v);
    }
}
if (!defined('MARK_PRODUCTS_SOLD_SECRET')) {
    $env = getenv('MARK_PRODUCTS_SOLD_SECRET');
    define(
        'MARK_PRODUCTS_SOLD_SECRET',
        (is_string($env) && $env !== '') ? $env : $markSoldSecretLocal
    );
}
if (!defined('PRODUCTS_JSON')) {
    define('PRODUCTS_JSON', __DIR__ . '/products.json');
}

$secret = MARK_PRODUCTS_SOLD_SECRET;
if ($secret === '') {
    http_response_code(503);
    echo json_encode(['ok' => false, 'error' => 'mark_products_sold_not_configured']);
    exit;
}

$sent = $_SERVER['HTTP_X_MAXBIT_MARK_PRODUCTS_SOLD_SECRET'] ?? '';
if (!is_string($sent) || !hash_equals($secret, $sent)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'forbidden']);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data) || !isset($data['productIds']) || !is_array($data['productIds'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_json']);
    exit;
}

$ids = [];
foreach ($data['productIds'] as $pid) {
    if (is_string($pid) || is_numeric($pid)) {
        $t = trim((string) $pid);
        if ($t !== '' && strlen($t) <= 120) {
            $ids[$t] = true;
        }
    }
}
$ids = array_keys($ids);
if (count($ids) === 0) {
    echo json_encode(['ok' => true, 'updated' => 0, 'message' => 'no_ids']);
    exit;
}

$path = PRODUCTS_JSON;
if (!is_readable($path)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'products_file_missing', 'path' => $path]);
    exit;
}

$json = file_get_contents($path);
$products = json_decode($json, true);
if (!is_array($products)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'invalid_products_json']);
    exit;
}

$want = array_fill_keys($ids, true);
$updated = 0;
foreach ($products as $i => $p) {
    if (!is_array($p)) {
        continue;
    }
    $id = isset($p['id']) ? trim((string) $p['id']) : '';
    if ($id === '' || !isset($want[$id])) {
        continue;
    }
    $products[$i]['status'] = 'Sold Out';
    $updated++;
}

$out = json_encode($products, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($out === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'encode_failed']);
    exit;
}

if (file_put_contents($path, $out) === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'write_failed']);
    exit;
}

echo json_encode(['ok' => true, 'updated' => $updated, 'ids' => $ids]);
