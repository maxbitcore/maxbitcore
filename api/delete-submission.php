<?php
/**
 * Remove a build submission from server store (Commander Center).
 */
ini_set('display_errors', '0');

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
    echo json_encode(['status' => 'error', 'message' => 'method_not_allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$id = isset($data['id']) ? trim((string) $data['id']) : '';

if ($id === '') {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'missing id']);
    exit;
}

require_once __DIR__ . '/build_submissions_store.php';

if (maxbit_build_submissions_delete($id)) {
    echo json_encode(['status' => 'success']);
    exit;
}

http_response_code(404);
echo json_encode(['status' => 'error', 'message' => 'not found']);
