<?php
/**
 * Copy to meta_catalog_feed.local.php on the server (same folder as meta-catalog-feed.php).
 *
 * @return array<string, string>
 */
return [
    /** Must match the canonical site URL (product links + absolute image URLs). */
    'site_origin' => 'https://www.maxbitcore.com',
    'brand' => 'MaxBit',
    /** Optional: require ?token=... on feed URL (set the same token in Commerce Manager feed URL). */
    'feed_token' => '',
];
