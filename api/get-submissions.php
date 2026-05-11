<?php
/**
 * Commander Center — list of build / configurator protocols (JSON file on server).
 */
ini_set('display_errors', '0');

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/build_submissions_store.php';

echo json_encode(maxbit_build_submissions_read());
