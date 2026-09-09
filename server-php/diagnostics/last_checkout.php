<?php

/**
 * Shows what actually happened on the most recent EcoCash checkout attempt:
 * the payment row plus the decoded provider_response from the gateway.
 *
 *   php diagnostics/last_checkout.php          # newest attempt
 *   php diagnostics/last_checkout.php 5        # newest 5 attempts
 */

require __DIR__ . '/../vendor/autoload.php';
loadEnv(__DIR__ . '/../.env');

$limit = max(1, (int) ($argv[1] ?? 1));
$db = getDb();

function out(string $m = ''): void { fwrite(STDOUT, $m . PHP_EOL); }

$rows = $db->query(
    "SELECT p.id, p.reference, p.client_correlation, p.amount, p.currency,
            p.status, p.provider, p.provider_status, p.provider_reference,
            p.provider_response, p.created_at, p.completed_at,
            o.id AS order_id, o.customer_name, o.phone, o.status AS order_status
     FROM payments p JOIN orders o ON o.id = p.order_id
     ORDER BY p.id DESC LIMIT $limit"
)->fetchAll();

if (!$rows) { out('No checkout attempts found.'); exit(0); }

out('EcoCash endpoint : ' . (getenv('ECOCASH_API_URL') ?: '(not set)'));
out('Notify URL       : ' . (getenv('ECOCASH_NOTIFY_URL') ?: '(not set)'));
out(str_repeat('-', 60));

foreach ($rows as $r) {
    out("payment #{$r['id']}  (order #{$r['order_id']})   {$r['created_at']}");
    out("  customer         : {$r['customer_name']}  {$r['phone']}");
    out("  amount           : {$r['amount']} {$r['currency']}");
    out("  payment.status   : {$r['status']}");
    out("  provider_status  : {$r['provider_status']}");
    out("  provider_reference: " . ($r['provider_reference'] ?: '(none)'));
    out("  clientCorrelator : {$r['client_correlation']}");
    out("  order.status     : {$r['order_status']}");

    $decoded = json_decode((string) $r['provider_response'], true);
    out('  provider_response:');
    out('    ' . json_encode($decoded ?? $r['provider_response'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

    out('  --- interpretation ---');
    switch ($r['provider_status']) {
        case 'FAILED_TO_INITIATE':
            out('  The POST to ECOCASH_API_URL threw. The error text is in provider_response above');
            out('  (bad credentials, wrong URL, endpoint unreachable, or a 4xx/5xx from EcoCash).');
            break;
        case 'INITIATED':
            out('  Row was created but the gateway response never updated it — the POST likely');
            out('  timed out or the process died before the UPDATE. Check ECOCASH_TIMEOUT_SECONDS.');
            break;
        case 'PENDING':
        case 'CHARGED':
        case 'PENDING SUBSCRIBER VALIDATION':
        case 'PENDING VALIDATION':
            out('  Gateway ACCEPTED the request — the integration works. It is now waiting for');
            out('  the subscriber to approve. On the pre-prod endpoint this is advanced through');
            out("  EcoCash's simulator/test portal, not a real phone prompt. Poll the authoritative");
            out('  status with:  php diagnostics/ecocash_query.php');
            break;
        case 'COMPLETED':
            out('  Charge completed. If payment.status is still "pending", the /ecocash/notify');
            out('  callback has not run — EcoCash could not reach ECOCASH_NOTIFY_URL (needs a public HTTPS URL).');
            break;
        case 'FAILED':
            out('  Gateway explicitly failed the transaction. See provider_response for the reason.');
            break;
        default:
            out('  Unrecognised provider_status.');
    }
    out(str_repeat('-', 60));
}
