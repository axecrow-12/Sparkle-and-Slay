<?php

function settingsDefaults(): array
{
    return [
        'store_name' => 'Sparkle & Slay',
        'email' => 'sales@sparkleandslay.com',
        'phone' => '+263 77 659 3476',
        'whatsapp' => '+263776593476',
        'ecocash_merchant_number' => '0783 123 456',
        'address' => 'Corner Robert and Angwa, NiceWear Mall Shop 2, Harare, Zimbabwe',
        'facebook' => 'https://facebook.com/sparkleandslay',
        'instagram' => 'https://instagram.com/sparkleandslay',
        'tiktok' => 'https://tiktok.com/@sparkleandslay',
    ];
}

function settingsRead(): array
{
    $settings = settingsDefaults();
    $rows = getDb()->query('SELECT setting_key, setting_value FROM store_settings')->fetchAll();
    foreach ($rows as $row) {
        if (array_key_exists($row['setting_key'], $settings)) {
            $settings[$row['setting_key']] = $row['setting_value'];
        }
    }
    return $settings;
}

function settingsGet(): void
{
    requireAdmin();
    jsonResponse(settingsRead());
}

function settingsPublicGet(): void
{
    $settings = settingsRead();
    jsonResponse([
        'store_name' => $settings['store_name'],
        'email' => $settings['email'],
        'phone' => $settings['phone'],
        'whatsapp' => $settings['whatsapp'],
        'ecocash_merchant_number' => $settings['ecocash_merchant_number'],
        'address' => $settings['address'],
        'facebook' => $settings['facebook'],
        'instagram' => $settings['instagram'],
        'tiktok' => $settings['tiktok'],
    ]);
}

function settingsUpdate(): void
{
    requireAdmin();
    $body = getJsonBody();
    $allowed = settingsDefaults();
    $db = getDb();
    $stmt = $db->prepare(
        'INSERT INTO store_settings (setting_key, setting_value) VALUES (:key, :value)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)'
    );
    foreach ($allowed as $key => $default) {
        if (array_key_exists($key, $body)) {
            $value = trim((string) $body[$key]);
            if ($key === 'store_name' && $value === '') {
                jsonResponse(['error' => 'Store name is required.'], 400);
            }
            $stmt->execute(['key' => $key, 'value' => $value]);
        }
    }
    jsonResponse(settingsRead());
}