<?php
/**
 * Update build submission status (pending / completed) for Commander Center.
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
    echo json_encode(['success' => false, 'message' => 'method_not_allowed']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$id = isset($data['id']) ? trim((string) $data['id']) : '';
$status = isset($data['status']) ? trim((string) $data['status']) : '';

if ($id === '' || $status === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'missing id or status']);
    exit;
}

require_once __DIR__ . '/build_submissions_store.php';

if (maxbit_build_submissions_set_status($id, $status)) {
    echo json_encode(['success' => true]);
    exit;
}

http_response_code(404);
echo json_encode(['success' => false, 'message' => 'submission not found']);
