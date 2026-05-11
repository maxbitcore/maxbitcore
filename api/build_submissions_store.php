<?php
/**
 * Persist custom build / configurator submissions for admin (get-submissions.php).
 * File: api/data/build-submissions.json (created on first write).
 */

function maxbit_build_submissions_file(): string
{
    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    return $dir . '/build-submissions.json';
}

/** @return array<int, array<string, mixed>> */
function maxbit_build_submissions_read(): array
{
    $f = maxbit_build_submissions_file();
    if (!is_readable($f)) {
        return [];
    }
    $raw = file_get_contents($f);
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $d = json_decode($raw, true);
    return is_array($d) ? $d : [];
}

/** @param array<int, array<string, mixed>> $list */
function maxbit_build_submissions_write(array $list): void
{
    $f = maxbit_build_submissions_file();
    file_put_contents($f, json_encode($list, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
}

/** Prepend submission; dedupe by id; cap list length. */
function maxbit_build_submissions_append(array $submission): void
{
    $list = maxbit_build_submissions_read();
    if (!isset($submission['status']) || $submission['status'] === '') {
        $submission['status'] = 'pending';
    }
    $submission['serverReceivedAt'] = date('c');
    $id = isset($submission['id']) ? trim((string) $submission['id']) : '';
    if ($id !== '') {
        $list = array_values(array_filter($list, function ($row) use ($id) {
            return !is_array($row) || (string) ($row['id'] ?? '') !== $id;
        }));
    }
    array_unshift($list, $submission);
    if (count($list) > 500) {
        $list = array_slice($list, 0, 500);
    }
    maxbit_build_submissions_write($list);
}

function maxbit_build_submissions_set_status(string $id, string $status): bool
{
    $list = maxbit_build_submissions_read();
    $found = false;
    foreach ($list as $i => $row) {
        if (!is_array($row)) {
            continue;
        }
        if ((string) ($row['id'] ?? '') === $id) {
            $list[$i]['status'] = $status;
            $found = true;
            break;
        }
    }
    if ($found) {
        maxbit_build_submissions_write($list);
    }
    return $found;
}

function maxbit_build_submissions_delete(string $id): bool
{
    $list = maxbit_build_submissions_read();
    $before = count($list);
    $new = array_values(array_filter($list, function ($row) use ($id) {
        return !is_array($row) || (string) ($row['id'] ?? '') !== $id;
    }));
    if (count($new) === $before) {
        return false;
    }
    maxbit_build_submissions_write($new);
    return true;
}
