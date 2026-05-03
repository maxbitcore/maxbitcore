<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit;
}

include_once 'db_config.php';

/** Raw DB datetime/string → ISO 8601 for the app, or null if empty/invalid */
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

$data = json_decode(file_get_contents("php://input"));
if (!$data) {
    $data = (object) $_POST;
}

if (!empty($data->username) && !empty($data->password)) {
    $username = $data->username;
    $password = $data->password;
    $adminCode = isset($data->adminCode) ? $data->adminCode : (isset($data->admin_code) ? $data->admin_code : null);

    try {
        $stmt = $conn->prepare("SELECT * FROM users WHERE username = :username LIMIT 1");
        $stmt->execute([':username' => $username]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$user) {
            http_response_code(401);
            echo json_encode(["success" => false, "message" => "User not found"]);
            exit;
        }

        if (!password_verify($password, $user['password'])) {
            http_response_code(401);
            echo json_encode(["success" => false, "message" => "Invalid password"]);
            exit;
        }

        if ($user['role'] === 'admin') {
            if (empty($adminCode)) {
                echo json_encode([
                    "success" => true,
                    "requiresAdminCode" => true,
                    "message" => "Admin code is required"
                ]);
                exit;
            }

            if ($adminCode !== '7496143678234589') {
                http_response_code(403);
                echo json_encode(["success" => false, "message" => "Invalid Admin Code"]);
                exit;
            }
        }

        $token = bin2hex(random_bytes(32));

        // Реальная дата из БД — без подстановки «сегодня»
        $joinedRaw = $user['created_at'] ?? $user['joined'] ?? $user['registered_at'] ?? null;
        $joinedIso = is_string($joinedRaw) ? maxbit_joined_iso($joinedRaw) : null;

        $payload = [
            "success" => true,
            "status" => "success",
            "token" => $token,
            "id" => isset($user['id']) ? (int) $user['id'] : null,
            "username" => $user['username'],
            "firstName" => $user['first_name'] ?? 'Guest',
            "lastName" => $user['last_name'] ?? '',
            "email" => $user['email'] ?? '',
            "role" => $user['role'],
        ];
        if ($joinedIso !== null) {
            $payload["joined"] = $joinedIso;
        }

        echo json_encode($payload);
        exit;

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Server error: " . $e->getMessage()]);
    }
} else {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "USERNAME AND PASSWORD ARE REQUIRED"]);
}
