<?php
/**
 * Shared read access to storefront products.json (same file as save_products.php / mark-products-sold.php).
 */

if (!defined('PRODUCTS_JSON')) {
    define('PRODUCTS_JSON', __DIR__ . '/products.json');
}

/** @return array<string, mixed> */
function maxbit_products_feed_config(): array
{
    static $cfg = null;
    if ($cfg !== null) {
        return $cfg;
    }
    $defaults = [
        'site_origin' => 'https://www.maxbitcore.com',
        'brand' => 'MaxBit',
        'feed_token' => '',
    ];
    $localFile = __DIR__ . '/meta_catalog_feed.local.php';
    if (is_readable($localFile)) {
        $local = include $localFile;
        if (is_array($local)) {
            $cfg = array_merge($defaults, $local);
            return $cfg;
        }
    }
    $cfg = $defaults;
    return $cfg;
}

/** @return array<int, array<string, mixed>> */
function maxbit_products_read(): array
{
    $path = PRODUCTS_JSON;
    if (!is_readable($path)) {
        return [];
    }
    $raw = file_get_contents($path);
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function maxbit_products_abs_url(string $origin, string $raw): string
{
    $u = trim($raw);
    if ($u === '') {
        return '';
    }
    if (preg_match('#^(data|blob):#i', $u)) {
        return '';
    }
    if (preg_match('#^https?://#i', $u)) {
        return $u;
    }
    if (str_starts_with($u, '//')) {
        return 'https:' . $u;
    }
    $origin = rtrim($origin, '/');
    $path = str_starts_with($u, '/') ? $u : '/' . $u;
    return $origin . $path;
}

function maxbit_products_plain_text(string $html): string
{
    $t = strip_tags($html);
    $t = html_entity_decode($t, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $t = preg_replace('/\s+/u', ' ', $t ?? '');
    return trim((string) $t);
}

function maxbit_products_meta_google_category(string $category): string
{
    $c = strtolower(trim($category));
    if (str_contains($c, 'component')) {
        return 'Electronics > Electronics Accessories > Computer Components';
    }
    if (str_contains($c, 'peripheral')) {
        return 'Electronics > Electronics Accessories > Computer Components > Input Devices';
    }
    return 'Electronics > Computers > Desktop Computers';
}

function maxbit_products_meta_availability(string $status): string
{
    $s = strtolower(trim($status));
    if ($s === 'sold out' || $s === 'discontinued') {
        return 'out of stock';
    }
    if ($s === 'pre-order' || $s === 'backordered' || $s === 'coming soon') {
        return 'preorder';
    }
    return 'in stock';
}

function maxbit_products_meta_quantity(string $availability): int
{
    return $availability === 'in stock' ? 10 : 0;
}

/** Published + approved products for storefront and Meta feed. */
function maxbit_products_list_published(): array
{
    $out = [];
    foreach (maxbit_products_read() as $p) {
        if (!is_array($p)) {
            continue;
        }
        $published = !isset($p['isPublished']) || $p['isPublished'] === true || $p['isPublished'] === 1;
        $approved = !isset($p['isApproved']) || $p['isApproved'] === true || $p['isApproved'] === 1;
        if (!$published || !$approved) {
            continue;
        }
        $id = isset($p['id']) ? trim((string) $p['id']) : '';
        if ($id === '') {
            continue;
        }
        $out[] = $p;
    }
    return $out;
}
