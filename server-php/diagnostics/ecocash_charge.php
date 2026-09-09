<?php

/**
 * Diagnostic: fire a real EcoCash merchant charge and follow it to a final
 * state, using the same credentials, endpoint and payload shape as
 * ecocashCheckout(). It talks straight to the EcoCash API — it does NOT create
 * an order or a payment row, so it leaves the database untouched.
 *
 *   # dry run: prints exactly what it would send, sends nothing
 *   php diagnostics/ecocash_charge.php
 *
 *   # actually send the charge request (prompts the phone to approve)
 *   DIAG_CONFIRM=charge php diagnostics/ecocash_charge.php
 *
 * Defaults: $3.00 to 0781465862. Override:
 *   DIAG_AMOUNT=1.50 DIAG_PHONE=0771234567 DIAG_CONFIRM=charge php diagnostics/ecocash_charge.php
 *
 * WARNING: against a production ECOCASH_API_URL this moves real money. Check
 * which endpoint is configured — the script prints it before doing anything.
 */

require __DIR__ . '/../vendor/autoload.php';
loadEnv(__DIR__ . '/../.env');

$amount = number_format((float) (getenv('DIAG_AMOUNT') ?: '3.00'), 2, '.', '');
$rawPhone = getenv('DIAG_PHONE') ?: '0781465862';
$phone = ecocashPhone($rawPhone);
$confirm = getenv('DIAG_CONFIRM') === 'charge';

function out(string $message = ''): void
{
    fwrite(STDOUT, $message . PHP_EOL);
}

out('== Sparkle & Slay :: EcoCash charge diagnostic ==');
out('');

/* 1. Config -------------------------------------------------------------- */
$required = [
    'ECOCASH_API_URL', 'ECOCASH_QUERY_BASE_URL', 'ECOCASH_NOTIFY_URL',
    'ECOCASH_API_USERNAME', 'ECOCASH_API_PASSWORD',
    'ECOCASH_MERCHANT_CODE', 'ECOCASH_MERCHANT_PIN', 'ECOCASH_MERCHANT_NUMBER',
];
$missing = array_filter($required, static fn (string $key): bool => trim((string) getenv($key)) === '');
if ($missing) {
    out('[FAIL] Missing required .env keys: ' . implode(', ', $missing));
    exit(1);
}
if (!$phone) {
    out("[FAIL] '$rawPhone' is not a valid EcoCash number (expected 07XXXXXXXX / 2637XXXXXXXX).");
    exit(1);
}

$apiUrl = getenv('ECOCASH_API_URL');
$looksProd = stripos($apiUrl, 'preprod') === false && stripos($apiUrl, 'sandbox') === false && stripos($apiUrl, 'test') === false;

out('1. Configuration');
out("   API endpoint     : $apiUrl");
out('   Endpoint type    : ' . ($looksProd ? 'PRODUCTION (real money)' : 'pre-production / test'));
out('   Query base       : ' . getenv('ECOCASH_QUERY_BASE_URL'));
out('   Merchant number  : ' . getenv('ECOCASH_MERCHANT_NUMBER'));
out('   Merchant code    : ' . getenv('ECOCASH_MERCHANT_CODE'));
out('');
out('2. Charge');
out("   Amount           : USD $amount");
out("   Pay from (phone) : $phone  (input: $rawPhone)");
out('');

$reference = 'DIAG-' . date('YmdHis') . '-' . strtoupper(bin2hex(random_bytes(3)));
$correlation = 'DIAGCORR' . bin2hex(random_bytes(10));

$payload = [
    'clientCorrelator' => $correlation,
    'notifyUrl' => getenv('ECOCASH_NOTIFY_URL'),
    'referenceCode' => $reference,
    'tranType' => 'MER',
    'endUserId' => $phone,
    'remarks' => 'Sparkle and Slay diagnostic charge',
    'transactionOperationStatus' => 'CHARGED',
    'paymentAmount' => [
        'charginginformation' => ['amount' => (float) $amount, 'currency' => 'USD', 'description' => 'Diagnostic charge'],
        'chargeMetaData' => ['channel' => 'WEB', 'purchaseCategoryCode' => 'Online Payment', 'onBeHalfOf' => 'Sparkle and Slay'],
    ],
    'merchantCode' => getenv('ECOCASH_MERCHANT_CODE'),
    'merchantPin' => getenv('ECOCASH_MERCHANT_PIN'),
    'merchantNumber' => getenv('ECOCASH_MERCHANT_NUMBER'),
    'currencyCode' => 'USD',
    'countryCode' => getenv('ECOCASH_COUNTRY_CODE') ?: 'ZW',
    'terminalID' => getenv('ECOCASH_TERMINAL_ID') ?: 'WEB',
    'location' => getenv('ECOCASH_LOCATION') ?: 'Online',
    'superMerchantName' => getenv('ECOCASH_SUPER_MERCHANT_NAME') ?: 'Sparkle and Slay',
    'merchantName' => getenv('ECOCASH_MERCHANT_NAME') ?: 'Sparkle and Slay',
];

if (!$confirm) {
    out('3. DRY RUN — nothing was sent.');
    out('   Payload that would be POSTed (PIN redacted):');
    out('   ' . json_encode(array_merge($payload, ['merchantPin' => '***']), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    out('');
    out('   Re-run with  DIAG_CONFIRM=charge  to actually send it.');
    exit(0);
}

/* 3. Send the charge -------------------------------------------------- */
out("3. POST $apiUrl  (reference $reference)");
try {
    $response = ecocashApiRequest('POST', $apiUrl, $payload);
} catch (Throwable $error) {
    out('   [FAIL] ' . $error->getMessage());
    out('   (check ECOCASH_API_USERNAME / ECOCASH_API_PASSWORD and that the endpoint is reachable)');
    exit(1);
}
$initialStatus = ecocashProviderStatus($response);
out("   [OK] HTTP accepted. transactionOperationStatus = $initialStatus");
out('   serverReferenceCode: ' . ($response['serverReferenceCode'] ?? $response['id'] ?? '(none)'));
out('   full response: ' . json_encode($response, JSON_UNESCAPED_SLASHES));
out('');

/* 4. Follow it to a final state ------------------------------------- */
out('4. Polling EcoCash for the authoritative result (up to ~45s)');
$final = null;
for ($attempt = 1; $attempt <= 15; $attempt++) {
    sleep(3);
    try {
        $query = ecocashQueryTransaction($phone, $correlation);
        $status = ecocashProviderStatus($query);
        out("   attempt $attempt: $status");
        if (in_array($status, ['COMPLETED', 'FAILED'], true)) {
            $final = [$status, $query];
            break;
        }
    } catch (Throwable $error) {
        out("   attempt $attempt: query not ready (" . $error->getMessage() . ')');
    }
}
out('');

/* 5. Verdict ------------------------------------------------------- */
if ($final === null) {
    out('RESULT: INCONCLUSIVE — still pending after polling. The customer may not');
    out('have approved on their phone yet. Query again later with clientCorrelator:');
    out("  $correlation");
    exit(2);
}

[$status, $query] = $final;
$paidAmount = (float) ($query['paymentAmount']['charginginformation']['amount'] ?? 0);
$paidCurrency = strtoupper((string) ($query['paymentAmount']['charginginformation']['currency'] ?? ''));
out("   provider status : $status");
out("   amount          : $paidAmount $paidCurrency");
out('   ecocashReference: ' . ($query['ecocashReference'] ?? $query['serverReferenceCode'] ?? '(none)'));
out('   full result     : ' . json_encode($query, JSON_UNESCAPED_SLASHES));
out('');

if ($status === 'COMPLETED' && abs($paidAmount - (float) $amount) < 0.005 && $paidCurrency === 'USD') {
    out("RESULT: PASS — EcoCash charged USD $amount to $phone successfully.");
    exit(0);
}
if ($status === 'COMPLETED') {
    out('RESULT: WARN — completed, but amount/currency did not match the request.');
    exit(1);
}
out('RESULT: FAIL — EcoCash reported the transaction as FAILED.');
exit(1);
