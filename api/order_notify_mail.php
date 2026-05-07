<?php
/**
 * SMTP send for order notifications (cPanel domain mailbox, e.g. info@maxbitcore.com).
 * Requires: composer install in api/ → vendor/autoload.php
 * Config: order_mail_config.php (copy from order_mail_config.example.php) or getenv MAXBIT_SMTP_*.
 */

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

/**
 * Load optional local config (defines constants).
 */
function maxbit_order_mail_load_config(): void
{
    static $loaded = false;
    if ($loaded) {
        return;
    }
    $loaded = true;
    $path = __DIR__ . '/order_mail_config.php';
    if (is_readable($path)) {
        require_once $path;
    }
}

function maxbit_order_mail_cfg(string $key, $default = '')
{
    maxbit_order_mail_load_config();
    $env = getenv($key);
    if ($env !== false && $env !== '') {
        return $env;
    }
    if (defined($key)) {
        return constant($key);
    }
    return $default;
}

function maxbit_order_mail_smtp_ready(): bool
{
    $host = maxbit_order_mail_cfg('MAXBIT_SMTP_HOST', '');
    return is_string($host) && $host !== '';
}

function maxbit_order_mail_use_phpmailer(): bool
{
    return is_readable(__DIR__ . '/vendor/autoload.php');
}

/**
 * Send plain-text email. From address is always the domain mailbox (info@…).
 *
 * @param string|null $bcc Optional comma/space-separated BCC addresses (e.g. backup inbox).
 * @return array{ok: bool, error?: string}
 */
function maxbit_order_mail_send(string $to, string $subject, string $body, ?string $replyTo = null, ?string $bcc = null): array
{
    if (!maxbit_order_mail_smtp_ready()) {
        return ['ok' => false, 'error' => 'smtp_not_configured'];
    }

    if (!maxbit_order_mail_use_phpmailer()) {
        return ['ok' => false, 'error' => 'phpmailer_missing_run_composer_install_in_api'];
    }

    require_once __DIR__ . '/vendor/autoload.php';

    $host = maxbit_order_mail_cfg('MAXBIT_SMTP_HOST', '');
    $port = (int) maxbit_order_mail_cfg('MAXBIT_SMTP_PORT', '465');
    $enc = strtolower((string) maxbit_order_mail_cfg('MAXBIT_SMTP_ENCRYPTION', 'ssl'));
    $user = maxbit_order_mail_cfg('MAXBIT_SMTP_USER', '');
    $pass = maxbit_order_mail_cfg('MAXBIT_SMTP_PASS', '');
    $from = maxbit_order_mail_cfg('MAXBIT_MAIL_FROM', 'info@maxbitcore.com');
    $fromName = maxbit_order_mail_cfg('MAXBIT_MAIL_FROM_NAME', 'MaxBit Orders');

    $mail = new PHPMailer(true);
    try {
        $mail->CharSet = PHPMailer::CHARSET_UTF8;
        $mail->isSMTP();
        $mail->Host = $host;
        $mail->SMTPAuth = true;
        $mail->Username = $user;
        $mail->Password = $pass;
        $mail->Port = $port;

        if ($enc === 'tls') {
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        } else {
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
        }

        $mail->setFrom($from, $fromName);
        $mail->addAddress($to);
        if ($bcc !== null && $bcc !== '') {
            foreach (preg_split('/[,;\s]+/', $bcc, -1, PREG_SPLIT_NO_EMPTY) as $piece) {
                $addr = trim((string) $piece);
                if ($addr !== '' && filter_var($addr, FILTER_VALIDATE_EMAIL)) {
                    $mail->addBCC($addr);
                }
            }
        }
        if ($replyTo !== null && $replyTo !== '' && filter_var($replyTo, FILTER_VALIDATE_EMAIL)) {
            $mail->addReplyTo($replyTo);
        }
        $mail->Subject = $subject;
        $mail->Body = $body;
        $mail->send();
        return ['ok' => true];
    } catch (Exception $e) {
        return ['ok' => false, 'error' => $mail->ErrorInfo ?: $e->getMessage()];
    }
}

/**
 * Fallback when SMTP is not set up: PHP mail() (often unreliable on shared hosting).
 */
function maxbit_order_mail_send_php_mail(
    string $to,
    string $subject,
    string $body,
    string $fromEmail,
    string $fromName,
    ?string $replyTo = null,
    ?string $bcc = null
): bool {
    $fromHeader = 'From: ' . $fromName . ' <' . $fromEmail . '>';
    $headers = [
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        $fromHeader,
    ];
    if ($replyTo !== null && $replyTo !== '' && filter_var($replyTo, FILTER_VALIDATE_EMAIL)) {
        $headers[] = 'Reply-To: ' . $replyTo;
    }
    if ($bcc !== null && $bcc !== '') {
        $parts = [];
        foreach (preg_split('/[,;\s]+/', $bcc, -1, PREG_SPLIT_NO_EMPTY) as $piece) {
            $addr = trim((string) $piece);
            if ($addr !== '' && filter_var($addr, FILTER_VALIDATE_EMAIL)) {
                $parts[] = $addr;
            }
        }
        if ($parts !== []) {
            $headers[] = 'Bcc: ' . implode(', ', $parts);
        }
    }
    return (bool) @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, implode("\r\n", $headers));
}
