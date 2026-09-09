<?php

/**
 * Polls EcoCash's authoritative transaction-query API for an existing payment
 * — the same call /ecocash/notify uses to confirm. Read-only: it does not
 * change the payment row.
 *
 *   php diagnostics/ecocash_query.php                 # newest pending payment
 *   php diagnostics/ecocash_query.php 7               # payment #7
 *   php diagnostics/ecocash_query.php 7 --watch       # poll every 4s until final
 */

require __DIR__ . '/../vendor/autoload.php';
loadEnv(__DIR__ . '/../.env');

$db = getDb();
$watch = in_array('--watch', $argv, true);
$idArg = null;
foreach (array_slice($argv, 1) as $arg) {
    if (ctype_digit($arg)) { $idArg = (int) $arg; }
}

function out(string $m = ''): void { fwrite(STDOUT, $m . PHP_EOL); }

$sql = 'SELECT p.id, p.reference, p.client_correlation, p.amount, p.currency,
               p.status, p.provider_status, o.phone
        FROM payments p JOIN orders o ON o.id = p.order_id ';
$sql .= $idArg ? 'WHERE p.id = :id' : "WHERE p.status = 'pending' ORDER BY p.id DESC";
$sql .= ' LIMIT 1';
$stmt = $db->prepare($sql);
$stmt->execute($idArg ? ['id' => $idArg] : []);
$payment = $stmt->fetch();

if (!$payment) { out('No matching payment found.'); exit(1); }

out("payment #{$payment['id']}  {$payment['reference']}");
out("  phone            : {$payment['phone']}");
out("  clientCorrelator : {$payment['client_correlation']}");
out("  db status        : {$payment['status']} / {$payment['provider_status']}");
out('  query endpoint   : ' . rtrim((string) getenv('ECOCASH_QUERY_BASE_URL'), '/')
    . '/' . rawurlencode($payment['phone']) . '/transactions/amount/' . rawurlencode($payment['client_correlation']));
out(str_repeat('-', 60));

$attempt = 0;
do {
    $attempt++;
    try {
        $result = ecocashQueryTransaction($payment['phone'], $payment['client_correlation']);
        $status = ecocashProviderStatus($result);
        $amount = $result['paymentAmount']['charginginformation']['amount'] ?? '?';
        $currency = $result['paymentAmount']['charginginformation']['currency'] ?? '?';
        out("attempt $attempt: $status   (amount $amount $currency, ecocashReference "
            . ($result['ecocashReference'] ?? '(none)') . ')');

        if (in_array($status, ['COMPLETED', 'FAILED'], true)) {
            out(str_repeat('-', 60));
            out('full result: ' . json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
            out('');
            out($status === 'COMPLETED'
                ? 'FINAL: COMPLETED. If the payment row is still "pending", the ngrok notify'
                  . ' callback did not fire — hit /api/ecocash/notify yourself with this'
                  . " clientCorrelator, or check that the tunnel is up."
                : 'FINAL: FAILED. The transaction was declined / not approved.');
            exit($status === 'COMPLETED' ? 0 : 1);
        }
    } catch (Throwable $e) {
        out("attempt $attempt: query error — " . $e->getMessage());
    }
    if ($watch) { sleep(4); }
} while ($watch && $attempt < 30);

out(str_repeat('-', 60));
out('Not final yet (still pending subscriber validation). On pre-prod, approve the');
out("transaction in EcoCash's simulator/merchant test portal, then run this again.");
exit(2);
