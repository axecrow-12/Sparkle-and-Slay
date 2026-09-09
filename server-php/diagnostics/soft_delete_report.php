<?php

/**
 * Diagnostic: proves that soft delete actually removes money from the custom
 * sales report, end to end.
 *
 *   php diagnostics/soft_delete_report.php
 *
 * By default it works directly against the database (no running server needed)
 * and mirrors the exact aggregation salesReport() uses. To also exercise the
 * live HTTP API (GET /reports/sales, DELETE /payments/{id}, restore), pass an
 * admin bearer token:
 *
 *   DIAG_TOKEN=<jwt> php diagnostics/soft_delete_report.php
 *   DIAG_API_BASE=http://127.0.0.1:4001/api DIAG_TOKEN=<jwt> php diagnostics/soft_delete_report.php
 *
 * It creates one throwaway order + payment ($9.99, verified), checks the
 * numbers move the way they should, then hard-deletes the throwaway rows so it
 * leaves no trace.
 */

require __DIR__ . '/../vendor/autoload.php';
loadEnv(__DIR__ . '/../.env');

$SAMPLE_AMOUNT = 9.99;
$failures = 0;

function out(string $message): void
{
    fwrite(STDOUT, $message . PHP_EOL);
}

function check(bool $condition, string $label): void
{
    global $failures;
    if ($condition) {
        out("  [PASS] $label");
    } else {
        out("  [FAIL] $label");
        $failures++;
    }
}

function near(float $a, float $b): bool
{
    return abs($a - $b) < 0.005;
}

/** The same sum the /reports/sales "Submitted" column is built from. */
function submittedTotal(PDO $db): float
{
    return (float) $db->query(
        "SELECT COALESCE(SUM(p.amount), 0)
         FROM payments p JOIN orders o ON o.id = p.order_id
         WHERE p.deleted_at IS NULL AND o.deleted_at IS NULL"
    )->fetchColumn();
}

function httpJson(string $method, string $url, string $token): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => ["Authorization: Bearer $token", 'Accept: application/json'],
        CURLOPT_TIMEOUT => 15,
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    if ($error) {
        return [0, ['error' => $error]];
    }
    return [$code, json_decode((string) $body, true)];
}

out('== Sparkle & Slay :: soft-delete / report diagnostic ==');
out('');

$db = getDb();

/* 1. Schema ------------------------------------------------------------- */
out('1. Schema');
foreach (['collections', 'orders', 'payments'] as $table) {
    $exists = (bool) $db->query("SHOW COLUMNS FROM $table LIKE 'deleted_at'")->fetch();
    check($exists, "$table.deleted_at exists");
    if (!$exists) {
        out('');
        out('  Migration 006 has not been applied. Run:  php migrate.php');
        exit(1);
    }
}
out('');

/* 2. Baseline --------------------------------------------------------- */
$baseline = submittedTotal($db);
out(sprintf('2. Baseline submitted total: $%.2f', $baseline));
out('');

/* 3. Create a throwaway order + payment ------------------------------ */
out('3. Insert sample transaction');
$reference = 'DIAG-' . strtoupper(bin2hex(random_bytes(4)));
$db->prepare(
    "INSERT INTO orders (collection_id, item_name, customer_name, phone, ecocash_reference, amount, address, status)
     VALUES (NULL, 'Diagnostic item', 'Diagnostic Tester', '263770000000', :ref, :amount, '', 'pending')"
)->execute(['ref' => $reference, 'amount' => (string) $SAMPLE_AMOUNT]);
$orderId = (int) $db->lastInsertId();

$db->prepare(
    "INSERT INTO order_items (order_id, collection_id, item_name, quantity)
     VALUES (:order_id, NULL, 'Diagnostic item', 1)"
)->execute(['order_id' => $orderId]);

$db->prepare(
    "INSERT INTO payments (order_id, method, reference, amount, currency, merchant_number, status)
     VALUES (:order_id, 'ecocash', :ref, :amount, 'USD', '0000000', 'verified')"
)->execute(['order_id' => $orderId, 'ref' => $reference, 'amount' => $SAMPLE_AMOUNT]);
$paymentId = (int) $db->lastInsertId();

out("  order #$orderId, payment #$paymentId, reference $reference, \$$SAMPLE_AMOUNT verified");
check(near(submittedTotal($db), $baseline + $SAMPLE_AMOUNT), 'sample payment is counted in the report');
out('');

/* 4. Soft-delete the payment --------------------------------------- */
out('4. Archive the payment (DELETE /payments/{id} semantics)');
$db->prepare('UPDATE payments SET deleted_at = NOW() WHERE id = :id')->execute(['id' => $paymentId]);
check(near(submittedTotal($db), $baseline), 'archived payment drops out of the report');
out('');

/* 5. Restore ------------------------------------------------------- */
out('5. Restore the payment');
$db->prepare('UPDATE payments SET deleted_at = NULL WHERE id = :id')->execute(['id' => $paymentId]);
check(near(submittedTotal($db), $baseline + $SAMPLE_AMOUNT), 'restored payment is back in the report');
out('');

/* 6. Archive the order (cascades to its payment) ------------------ */
out('6. Archive the order (DELETE /orders/{id} semantics)');
$db->beginTransaction();
$db->prepare('UPDATE orders SET deleted_at = NOW() WHERE id = :id')->execute(['id' => $orderId]);
$db->prepare('UPDATE payments SET deleted_at = NOW() WHERE order_id = :id')->execute(['id' => $orderId]);
$db->commit();
check(near(submittedTotal($db), $baseline), 'archiving the order removes its payment from the report');
$db->prepare('UPDATE orders SET deleted_at = NULL WHERE id = :id')->execute(['id' => $orderId]);
$db->prepare('UPDATE payments SET deleted_at = NULL WHERE order_id = :id')->execute(['id' => $orderId]);
out('');

/* 7. Optional: live HTTP API round-trip -------------------------- */
$token = getenv('DIAG_TOKEN') ?: '';
if ($token !== '') {
    $base = rtrim(getenv('DIAG_API_BASE') ?: 'http://127.0.0.1:4001/api', '/');
    out("7. Live API round-trip against $base");

    [$code, $report] = httpJson('GET', "$base/reports/sales?groupBy=period&interval=week", $token);
    check($code === 200 && isset($report['summary']), "GET /reports/sales -> 200 (got $code)");
    $apiBefore = (float) ($report['summary']['totalAmount'] ?? 0);
    out(sprintf('   summary.totalAmount = $%.2f', $apiBefore));

    [$code] = httpJson('DELETE', "$base/payments/$paymentId", $token);
    check($code === 204, "DELETE /payments/$paymentId -> 204 (got $code)");

    [$code, $report] = httpJson('GET', "$base/reports/sales?groupBy=period&interval=week", $token);
    $apiAfter = (float) ($report['summary']['totalAmount'] ?? 0);
    check(near($apiAfter, $apiBefore - $SAMPLE_AMOUNT), sprintf('report total dropped by $%.2f (%.2f -> %.2f)', $SAMPLE_AMOUNT, $apiBefore, $apiAfter));

    [$code, $restored] = httpJson('POST', "$base/payments/$paymentId/restore", $token);
    check($code === 200, "POST /payments/$paymentId/restore -> 200 (got $code)");

    [$code, $report] = httpJson('GET', "$base/reports/sales?groupBy=period&interval=week", $token);
    $apiRestored = (float) ($report['summary']['totalAmount'] ?? 0);
    check(near($apiRestored, $apiBefore), 'report total is back to the starting value after restore');
    out('');
} else {
    out('7. Live API round-trip skipped (set DIAG_TOKEN=<admin jwt> to run it)');
    out('');
}

/* 8. Clean up --------------------------------------------------- */
out('8. Clean up sample rows');
$db->prepare('DELETE FROM payments WHERE id = :id')->execute(['id' => $paymentId]);
$db->prepare('DELETE FROM order_items WHERE order_id = :id')->execute(['id' => $orderId]);
$db->prepare('DELETE FROM orders WHERE id = :id')->execute(['id' => $orderId]);
check(near(submittedTotal($db), $baseline), 'report total is back to baseline, no residue left');
out('');

out($failures === 0 ? 'RESULT: ALL CHECKS PASSED' : "RESULT: $failures CHECK(S) FAILED");
exit($failures === 0 ? 0 : 1);
