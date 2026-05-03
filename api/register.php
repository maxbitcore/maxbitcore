<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

require_once 'db_config.php';

/**
 * Для поля joined в ответе добавь колонку (один раз в MySQL):
 * ALTER TABLE users ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
 */
function maxbit_joined_iso(?string $raw): ?string
{
    if ($raw === null || $raw === '') {
        return null;
    }
    $raw = trim($raw);
    try {
        $dt = new DateTime($raw);
        return $dt->format('c');
    } catch (Exception $e) {
        return null;
    }
}

/** SELECT после INSERT: если колонки created_at ещё нет — повтор без неё (без joined в JSON). */
function maxbit_fetch_registered_user(PDO $conn, int $userId): array
{
    $sqlWith = 'SELECT id, username, email, first_name, last_name, role, created_at FROM users WHERE id = ? LIMIT 1';
    $sqlWithout = 'SELECT id, username, email, first_name, last_name, role FROM users WHERE id = ? LIMIT 1';

    $sel = $conn->prepare($sqlWith);
    try {
        $sel->execute([$userId]);
        return $sel->fetch(PDO::FETCH_ASSOC) ?: [];
    } catch (PDOException $e) {
        if (strpos($e->getMessage(), 'created_at') !== false) {
            $sel2 = $conn->prepare($sqlWithout);
            $sel2->execute([$userId]);
            return $sel2->fetch(PDO::FETCH_ASSOC) ?: [];
        }
        throw $e;
    }
}

$data = json_decode(file_get_contents('php://input'), true);

if (!$data || empty($data['username']) || empty($data['email']) || empty($data['password'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Username, email and password required']);
    exit;
}

$username = $data['username'];
$email = $data['email'];
$password = password_hash($data['password'], PASSWORD_BCRYPT);
$firstName = isset($data['firstName']) ? $data['firstName'] : '';
$lastName = isset($data['lastName']) ? $data['lastName'] : '';

try {
    $check = $conn->prepare('SELECT id FROM users WHERE username = ? OR email = ?');
    $check->execute([$username, $email]);
    $existingUser = $check->fetch();

    if ($existingUser) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Username or Email already exists']);
        exit;
    }

    $stmt = $conn->prepare(
        "INSERT INTO users (username, email, password, role, first_name, last_name) VALUES (?, ?, ?, 'user', ?, ?)"
    );

    if ($stmt->execute([$username, $email, $password, $firstName, $lastName])) {
        $userId = (int) $conn->lastInsertId();

        $row = maxbit_fetch_registered_user($conn, $userId);

        $joinedRaw = isset($row['created_at']) ? $row['created_at'] : null;
        $joinedIso = is_string($joinedRaw) ? maxbit_joined_iso($joinedRaw) : null;

        $payload = [
            'success' => true,
            'message' => 'Registration successful',
            'token' => bin2hex(random_bytes(16)),
            'id' => $userId,
            'username' => $row['username'] ?? $username,
            'email' => $row['email'] ?? $email,
            'firstName' => $row['first_name'] ?? $firstName,
            'lastName' => $row['last_name'] ?? $lastName,
            'role' => $row['role'] ?? 'user',
        ];
        if ($joinedIso !== null) {
            $payload['joined'] = $joinedIso;
        }

        echo json_encode($payload);
        exit;
    }

    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Registration failed']);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
