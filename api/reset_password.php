<?php
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
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

include_once __DIR__ . '/db_config.php';

$data = json_decode(file_get_contents('php://input'), true);
$token = isset($data['token']) ? trim((string) $data['token']) : '';
$newPassword = isset($data['newPassword']) ? (string) $data['newPassword'] : '';

if (strlen($token) < 32 || strlen($newPassword) < 8) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid token or password too short (minimum 8 characters).',
    ]);
    exit;
}

try {
    $stmt = $conn->prepare(
        'SELECT email FROM maxbit_password_resets WHERE token = ? AND expires_at > NOW() LIMIT 1'
    );
    $stmt->execute([$token]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row || empty($row['email'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid or expired reset link.']);
        exit;
    }

    $email = $row['email'];
    $hash = password_hash($newPassword, PASSWORD_BCRYPT);
    $upd = $conn->prepare('UPDATE users SET password = ? WHERE email = ? LIMIT 1');
    $upd->execute([$hash, $email]);

    $del = $conn->prepare('DELETE FROM maxbit_password_resets WHERE email = ?');
    $del->execute([$email]);

    echo json_encode(['success' => true, 'message' => 'Password updated. You can sign in.']);
} catch (PDOException $e) {
    error_log('reset_password: ' . $e->getMessage());
    $msg = $e->getMessage();
    if (stripos($msg, 'maxbit_password_resets') !== false || stripos($msg, "doesn't exist") !== false) {
        http_response_code(503);
        echo json_encode([
            'success' => false,
            'message' => 'Password reset is not set up. Use “Forgot password” once to initialize, or contact support.',
        ]);
        exit;
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Could not update password']);
}
