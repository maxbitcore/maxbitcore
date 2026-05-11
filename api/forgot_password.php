<?php
/**
 * Password reset request — sends link via same SMTP as order emails (order_mail_config.php).
 * Creates table maxbit_password_resets on first use.
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
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

include_once __DIR__ . '/db_config.php';
require_once __DIR__ . '/maxbit_mail_helper.php';

$data = json_decode(file_get_contents('php://input'), true);
$email = isset($data['email']) ? trim((string) $data['email']) : '';

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid email address']);
    exit;
}

try {
    $conn->exec(
        'CREATE TABLE IF NOT EXISTS maxbit_password_resets (
            email VARCHAR(255) NOT NULL,
            token VARCHAR(64) NOT NULL,
            expires_at DATETIME NOT NULL,
            PRIMARY KEY (email),
            KEY idx_maxbit_pw_token (token)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
} catch (PDOException $e) {
    error_log('maxbit_password_resets table: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server configuration error']);
    exit;
}

try {
    $stmt = $conn->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
        echo json_encode(['success' => true]);
        exit;
    }

    $token = bin2hex(random_bytes(32));
    $expiresAt = (new DateTime('+1 hour'))->format('Y-m-d H:i:s');
    $ins = $conn->prepare(
        'REPLACE INTO maxbit_password_resets (email, token, expires_at) VALUES (?, ?, ?)'
    );
    $ins->execute([$email, $token, $expiresAt]);

    $base = maxbit_public_site_url();
    $link = $base . '/reset-password?token=' . rawurlencode($token);
    $shopFrom = maxbit_order_mail_cfg('MAXBIT_MAIL_FROM', 'info@maxbitcore.com');

    $subject = '[MaxBit] Reset your password';
    $body = "Hello,\r\n\r\n";
    $body .= "We received a request to reset the password for your MaxBit account.\r\n\r\n";
    $body .= "Open this link (valid for 1 hour):\r\n{$link}\r\n\r\n";
    $body .= "If you did not request this, you can ignore this email.\r\n\r\n";
    $body .= "— The MaxBit team\r\n";

    maxbit_mail_transactional($email, $subject, $body, $shopFrom);

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    error_log('forgot_password: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Could not process request']);
}
