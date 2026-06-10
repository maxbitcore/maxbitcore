<?php
/**
 * Meta Commerce / Facebook & Instagram Shop — scheduled product data feed (CSV).
 *
 * Commerce Manager → Catalog → Data sources → Add items → Data feed → Scheduled feed
 * URL: https://www.maxbitcore.com/api/meta-catalog-feed.php
 *
 * Uses the same products.json as the site (Deploy = isPublished). Components get
 * google_product_category for computer parts, not desktop systems.
 */
ini_set('display_errors', '0');

require_once __DIR__ . '/products_store.php';

$cfg = maxbit_products_feed_config();
$token = trim((string) ($cfg['feed_token'] ?? ''));
if ($token !== '') {
    $q = isset($_GET['token']) ? trim((string) $_GET['token']) : '';
    if (!hash_equals($token, $q)) {
        http_response_code(403);
        header('Content-Type: text/plain; charset=UTF-8');
        echo 'Forbidden';
        exit;
    }
}

$origin = rtrim((string) ($cfg['site_origin'] ?? 'https://www.maxbitcore.com'), '/');
$brand = trim((string) ($cfg['brand'] ?? 'MaxBit'));
if ($brand === '') {
    $brand = 'MaxBit';
}

header('Content-Type: text/csv; charset=UTF-8');
header('Cache-Control: no-store, max-age=0');
header('X-Robots-Tag: noindex');

$out = fopen('php://output', 'w');
if ($out === false) {
    http_response_code(500);
    exit;
}

// Meta Commerce CSV — required + shop / onsite checkout fields
fputcsv($out, [
    'id',
    'title',
    'description',
    'availability',
    'condition',
    'price',
    'link',
    'image_link',
    'brand',
    'google_product_category',
    'product_type',
    'quantity_to_sell_on_fb',
]);

foreach (maxbit_products_list_published() as $p) {
    $id = trim((string) ($p['id'] ?? ''));
    $title = maxbit_products_plain_text((string) ($p['name'] ?? 'MaxBit Product'));
    if ($title === '') {
        $title = 'MaxBit Product';
    }
    $descRaw = (string) ($p['description'] ?? '');
    if ($descRaw === '' && !empty($p['components'])) {
        $descRaw = (string) $p['components'];
    }
    $description = maxbit_products_plain_text($descRaw);
    if ($description === '') {
        $description = $title;
    }
    if (strlen($description) > 5000) {
        $description = substr($description, 0, 4997) . '...';
    }

    $category = (string) ($p['category'] ?? 'Gaming PCs');
    $customGpc = trim((string) ($p['googleProductCategory'] ?? $p['google_product_category'] ?? ''));
    $googleCategory = $customGpc !== ''
        ? $customGpc
        : maxbit_products_meta_google_category($category);

    $availability = maxbit_products_meta_availability((string) ($p['status'] ?? 'In Stock'));
    $priceNum = (float) ($p['price'] ?? 0);
    if ($priceNum <= 0) {
        continue;
    }
    $price = number_format($priceNum, 2, '.', '') . ' USD';

    $link = $origin . '/product/' . rawurlencode($id);

    $imgRaw = '';
    if (!empty($p['imageUrl'])) {
        $imgRaw = (string) $p['imageUrl'];
    } elseif (!empty($p['gallery']) && is_array($p['gallery']) && !empty($p['gallery'][0])) {
        $imgRaw = (string) $p['gallery'][0];
    }
    $imageLink = maxbit_products_abs_url($origin, $imgRaw);
    if ($imageLink === '') {
        continue;
    }

    fputcsv($out, [
        $id,
        $title,
        $description,
        $availability,
        'new',
        $price,
        $link,
        $imageLink,
        $brand,
        $googleCategory,
        $category,
        (string) maxbit_products_meta_quantity($availability),
    ]);
}

fclose($out);
