<?php

const ECOCASH_FEE_RATE = 0.013;
const ECOCASH_IMTT_RATE = 0.02;

function ecocashConfig(string $key, bool $required = true): string
{
    $value = trim((string) getenv($key));
    if ($required && $value === '') {
        jsonResponse(['error' => 'EcoCash checkout is not configured.'], 503);
    }
    return $value;
}

function ecocashPhone(string $phone): ?string
{
    $digits = preg_replace('/[^0-9+]/', '', trim($phone));
    if (str_starts_with($digits, '0')) $digits = '263' . substr($digits, 1);
    if (str_starts_with($digits, '+')) $digits = substr($digits, 1);
    return preg_match('/^2637[0-9]{8}$/', $digits) ? $digits : null;
}

function ecocashCart(array $items): array
{
    if (count($items) < 1 || count($items) > 50) {
        jsonResponse(['error' => 'Your cart is empty or too large.'], 400);
    }
    $ids = [];
    $requested = [];
    foreach ($items as $item) {
        $id = filter_var($item['collectionId'] ?? null, FILTER_VALIDATE_INT);
        $quantity = filter_var($item['quantity'] ?? null, FILTER_VALIDATE_INT);
        if (!$id || $quantity === false || $quantity < 1 || $quantity > 20 || isset($requested[$id])) {
            jsonResponse(['error' => 'Cart items are invalid.'], 400);
        }
        $ids[] = $id;
        $requested[$id] = $quantity;
    }

    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = getDb()->prepare("SELECT id, name, price, stock_status FROM collections WHERE id IN ($placeholders)");
    $stmt->execute($ids);
    $collections = [];
    foreach ($stmt->fetchAll() as $row) $collections[(int) $row['id']] = $row;

    $subtotalCents = 0;
    $validated = [];
    foreach ($ids as $id) {
        $collection = $collections[$id] ?? null;
        if (!$collection || $collection['price'] === null || $collection['stock_status'] !== 'in_stock') {
            jsonResponse(['error' => 'One or more cart items are no longer available.'], 409);
        }
        $unitCents = (int) round((float) $collection['price'] * 100);
        $quantity = $requested[$id];
        $subtotalCents += $unitCents * $quantity;
        $validated[] = ['id' => $id, 'name' => $collection['name'], 'quantity' => $quantity];
    }
    $ecocashFeeCents = (int) round($subtotalCents * ECOCASH_FEE_RATE);
    $imttFeeCents = (int) round($subtotalCents * ECOCASH_IMTT_RATE);
    return [$validated, $subtotalCents, $ecocashFeeCents, $imttFeeCents, $subtotalCents + $ecocashFeeCents + $imttFeeCents];
}

function ecocashApiRequest(string $method, string $url, ?array $payload = null): array
{
    $username = ecocashConfig('ECOCASH_API_USERNAME');
    $password = ecocashConfig('ECOCASH_API_PASSWORD');

    $options = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
        CURLOPT_USERPWD => "$username:$password", // HTTP Basic Auth, per the EcoCash API spec
        CURLOPT_TIMEOUT => max(5, (int) (getenv('ECOCASH_TIMEOUT_SECONDS') ?: 20)),
    ];

    if ($method === 'POST') {
        $options[CURLOPT_POST] = true;
        $options[CURLOPT_POSTFIELDS] = json_encode($payload);
    }

    $curl = curl_init($url);
    curl_setopt_array($curl, $options);
    $response = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $error = curl_error($curl);
    curl_close($curl);
    $decoded = is_string($response) ? json_decode($response, true) : null;
    if ($error) {
        error_log("EcoCash API Error ($method $url): $error");
        throw new RuntimeException('EcoCash API connection failed: ' . $error);
    }
    if ($status < 200 || $status >= 300) {
        error_log("EcoCash API HTTP $status ($method $url): " . substr((string)$response, 0, 200));
        throw new RuntimeException("EcoCash API returned HTTP $status");
    }
    if (!is_array($decoded)) {
        error_log('EcoCash API Invalid JSON: ' . substr((string)$response, 0, 200));
        throw new RuntimeException('EcoCash API returned invalid JSON');
    }
    return $decoded;
}

/**
 * Asks EcoCash directly what actually happened to a transaction, using our
 * own API credentials. This is the source of truth. Never trust the body
 * of an inbound /ecocash/notify POST on its own, since EcoCash's API does
 * not sign or authenticate that callback in any way, anyone who discovers
 * the notify URL could POST a fabricated "COMPLETED" body to it. Calling
 * back here, authenticated with our own username and password, is what
 * actually confirms a payment.
 */
function ecocashQueryTransaction(string $endUserId, string $clientCorrelator): array
{
    $base = rtrim(ecocashConfig('ECOCASH_QUERY_BASE_URL'), '/');
    $url = $base . '/' . rawurlencode($endUserId) . '/transactions/amount/' . rawurlencode($clientCorrelator);
    return ecocashApiRequest('GET', $url);
}

function ecocashProviderStatus(array $data): string
{
    return strtoupper(trim((string) ($data['transactionOperationStatus'] ?? 'PENDING')));
}

function ecocashCheckout(): void
{
    $body = getJsonBody();
    $name = trim((string) ($body['name'] ?? ''));
    $address = trim((string) ($body['address'] ?? ''));
    $phone = ecocashPhone((string) ($body['phone'] ?? ''));
    $items = is_array($body['items'] ?? null) ? $body['items'] : [];
    $idempotency = trim((string) ($body['idempotencyKey'] ?? ''));
    if ($name === '' || strlen($name) > 255 || !$phone || strlen($address) > 500 || !preg_match('/^[A-Za-z0-9._:-]{16,120}$/', $idempotency)) {
        jsonResponse(['error' => 'Please provide a valid name, EcoCash number, address, and checkout key.'], 400);
    }

    $db = getDb();
    $existing = $db->prepare('SELECT id, order_id, amount, status FROM payments WHERE idempotency_key = :key');
    $existing->execute(['key' => $idempotency]);
    if ($row = $existing->fetch()) {
        jsonResponse(['error' => 'This checkout key has already been used. Start a new checkout.'], 409);
    }

    [$validated, $subtotalCents, $ecocashFeeCents, $imttFeeCents, $totalCents] = ecocashCart($items);
    $reference = 'SAS-' . date('YmdHis') . '-' . strtoupper(bin2hex(random_bytes(4)));
    $correlation = 'SAS-' . bin2hex(random_bytes(12));
    $checkoutToken = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $checkoutToken);
    $amount = number_format($totalCents / 100, 2, '.', '');
    $itemName = implode(', ', array_map(static fn (array $item): string => $item['name'] . ' x' . $item['quantity'], $validated));

    $db->beginTransaction();
    try {
        $order = $db->prepare('INSERT INTO orders (collection_id, item_name, customer_name, phone, ecocash_reference, amount, address) VALUES (:collection_id, :item_name, :name, :phone, :reference, :amount, :address)');
        $order->execute(['collection_id' => count($validated) === 1 ? $validated[0]['id'] : null, 'item_name' => $itemName, 'name' => $name, 'phone' => $phone, 'reference' => $reference, 'amount' => $amount, 'address' => $address]);
        $orderId = (int) $db->lastInsertId();
        $itemStmt = $db->prepare('INSERT INTO order_items (order_id, collection_id, item_name, quantity) VALUES (:order_id, :collection_id, :item_name, :quantity)');
        foreach ($validated as $item) $itemStmt->execute(['order_id' => $orderId, 'collection_id' => $item['id'], 'item_name' => $item['name'], 'quantity' => $item['quantity']]);
        $payment = $db->prepare('INSERT INTO payments (order_id, method, provider, reference, client_correlation, amount, currency, merchant_number, provider_status, checkout_token_hash, idempotency_key) VALUES (:order_id, "ecocash", "ecocash", :reference, :correlation, :amount, "USD", :merchant, "INITIATED", :token, :idempotency)');
        $payment->execute(['order_id' => $orderId, 'reference' => $reference, 'correlation' => $correlation, 'amount' => $amount, 'merchant' => ecocashConfig('ECOCASH_MERCHANT_NUMBER'), 'token' => $tokenHash, 'idempotency' => $idempotency]);
        $paymentId = (int) $db->lastInsertId();
        $db->commit();
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }

    $payload = [
        'clientCorrelator' => $correlation, 'notifyUrl' => ecocashConfig('ECOCASH_NOTIFY_URL'), 'referenceCode' => $reference,
        'tranType' => 'MER', 'endUserId' => $phone, 'remarks' => 'Sparkle and Slay purchase', 'transactionOperationStatus' => 'CHARGED',
        'paymentAmount' => ['charginginformation' => ['amount' => (float) $amount, 'currency' => 'USD', 'description' => 'Online Purchase'], 'chargeMetaData' => ['channel' => 'WEB', 'purchaseCategoryCode' => 'Online Payment', 'onBeHalfOf' => 'Sparkle and Slay']],
        'merchantCode' => ecocashConfig('ECOCASH_MERCHANT_CODE'), 'merchantPin' => ecocashConfig('ECOCASH_MERCHANT_PIN'), 'merchantNumber' => ecocashConfig('ECOCASH_MERCHANT_NUMBER'),
        'currencyCode' => 'USD', 'countryCode' => ecocashConfig('ECOCASH_COUNTRY_CODE', false) ?: 'ZW', 'terminalID' => ecocashConfig('ECOCASH_TERMINAL_ID', false) ?: 'WEB',
        'location' => ecocashConfig('ECOCASH_LOCATION', false) ?: 'Online', 'superMerchantName' => ecocashConfig('ECOCASH_SUPER_MERCHANT_NAME', false) ?: 'Sparkle and Slay', 'merchantName' => ecocashConfig('ECOCASH_MERCHANT_NAME', false) ?: 'Sparkle and Slay',
    ];
    try {
        $provider = ecocashApiRequest('POST', ecocashConfig('ECOCASH_API_URL'), $payload);
        $status = ecocashProviderStatus($provider);
        $update = $db->prepare('UPDATE payments SET provider_status = :status, provider_response = :response, provider_reference = :provider_reference WHERE id = :id');
        $update->execute(['status' => $status, 'response' => json_encode($provider), 'provider_reference' => $provider['serverReferenceCode'] ?? ($provider['id'] ?? null), 'id' => $paymentId]);
        error_log("EcoCash Checkout: Payment $paymentId initiated with status $status");
    } catch (Throwable $error) {
        $status = 'FAILED_TO_INITIATE';
        $errorMsg = $error->getMessage();
        error_log("EcoCash Checkout: Payment $paymentId failed - $errorMsg");
        $update = $db->prepare('UPDATE payments SET status = "rejected", provider_status = :status, provider_response = :response WHERE id = :id');
        $update->execute(['status' => $status, 'response' => json_encode(['error' => $errorMsg]), 'id' => $paymentId]);
    }
    jsonResponse(['orderId' => $orderId, 'paymentId' => $paymentId, 'amount' => (float) $amount, 'currency' => 'USD', 'status' => strtolower($status), 'checkoutToken' => $checkoutToken], 201);
}

function ecocashNotify(): void
{
    $body = getJsonBody();
    $correlation = trim((string) ($body['clientCorrelator'] ?? ''));

    if ($correlation === '') {
        error_log('EcoCash Notify: Missing clientCorrelator');
        jsonResponse(['error' => 'Invalid EcoCash notification: missing correlation ID.'], 400);
    }

    $db = getDb();
    $stmt = $db->prepare(
        'SELECT p.*, o.id AS order_id, o.phone FROM payments p
         INNER JOIN orders o ON o.id = p.order_id
         WHERE p.client_correlation = :correlation'
    );
    $stmt->execute(['correlation' => $correlation]);
    $payment = $stmt->fetch();

    if (!$payment) {
        error_log("EcoCash Notify: Payment not found for correlation $correlation");
        jsonResponse(['error' => 'Transaction not found.'], 404);
    }

    // Already finalized, nothing to do. Also protects against the notify
    // endpoint being hit repeatedly for the same transaction.
    if (in_array($payment['status'], ['verified', 'rejected'], true)) {
        jsonResponse(['status' => $payment['status']]);
    }

    // This is the trust boundary. Everything above just looked up which
    // payment this notification claims to be about. Everything below
    // decides what actually happened, using our own authenticated call,
    // not the untrusted body of this request.
    try {
        $authoritative = ecocashQueryTransaction($payment['phone'], $correlation);
    } catch (Throwable $error) {
        error_log("EcoCash Notify: Query confirmation failed for payment {$payment['id']}: " . $error->getMessage());
        // Do not finalize on a failed confirmation call. Leave the payment
        // pending, a later notify or a manual admin check can retry this.
        jsonResponse(['error' => 'Could not confirm transaction with EcoCash.'], 502);
    }

    $status = ecocashProviderStatus($authoritative);
    if (!in_array($status, ['COMPLETED', 'FAILED'], true)) {
        error_log("EcoCash Notify: Query returned unexpected status '$status' for payment {$payment['id']}");
        jsonResponse(['status' => $payment['status']]); // stays pending, try again later
    }

    if ($status === 'COMPLETED') {
        $providerAmount = (float) ($authoritative['paymentAmount']['charginginformation']['amount'] ?? 0);
        $providerCurrency = strtoupper((string) ($authoritative['paymentAmount']['charginginformation']['currency'] ?? ''));
        $merchant = (string) ($authoritative['merchantCode'] ?? '');
        $expectedMerchant = ecocashConfig('ECOCASH_MERCHANT_CODE');

        if (abs($providerAmount - (float) $payment['amount']) > 0.001) {
            error_log("EcoCash Notify: Amount mismatch for payment {$payment['id']}: provider=$providerAmount vs db={$payment['amount']}");
            jsonResponse(['error' => 'EcoCash confirmation does not match the payment: amount mismatch.'], 409);
        }
        if ($providerCurrency !== $payment['currency']) {
            error_log("EcoCash Notify: Currency mismatch for payment {$payment['id']}");
            jsonResponse(['error' => 'EcoCash confirmation does not match the payment: currency mismatch.'], 409);
        }
        if ($merchant !== $expectedMerchant) {
            error_log("EcoCash Notify: Merchant mismatch for payment {$payment['id']}");
            jsonResponse(['error' => 'EcoCash confirmation does not match the payment: merchant mismatch.'], 409);
        }
    }

    $db->beginTransaction();
    try {
        $newPaymentStatus = $status === 'COMPLETED' ? 'verified' : 'rejected';
        $orderStatus = $status === 'COMPLETED' ? 'processing' : 'payment_failed';

        $update = $db->prepare(
            'UPDATE payments SET status = :payment_status, provider_status = :provider_status,
             provider_response = :response, provider_reference = :provider_reference,
             verified_at = CASE WHEN :payment_status = "verified" THEN CURRENT_TIMESTAMP ELSE NULL END,
             completed_at = CURRENT_TIMESTAMP
             WHERE id = :id AND status = "pending"'
        );
        $update->execute([
            'payment_status' => $newPaymentStatus,
            'provider_status' => $status,
            'response' => json_encode($authoritative),
            'provider_reference' => $authoritative['ecocashReference'] ?? ($authoritative['serverReferenceCode'] ?? null),
            'id' => $payment['id'],
        ]);

        if ($update->rowCount() === 0) {
            $db->rollBack();
            jsonResponse(['status' => $payment['status']]); // already handled elsewhere, not an error
        }

        $order = $db->prepare('UPDATE orders SET status = :status WHERE id = :id AND status = "pending"');
        $order->execute(['status' => $orderStatus, 'id' => $payment['order_id']]);

        $db->commit();
        error_log("EcoCash Notify: Payment {$payment['id']} confirmed via query, status=$newPaymentStatus");
    } catch (Throwable $error) {
        $db->rollBack();
        throw $error;
    }

    jsonResponse(['status' => $newPaymentStatus]);
}

function ecocashCheckoutStatus(string $token): void
{
    $hash = hash('sha256', $token);
    $stmt = getDb()->prepare('SELECT amount, currency, status, provider_status FROM payments WHERE checkout_token_hash = :hash');
    $stmt->execute(['hash' => $hash]);
    $payment = $stmt->fetch();
    if (!$payment) jsonResponse(['error' => 'Checkout not found.'], 404);
    jsonResponse(['amount' => (float) $payment['amount'], 'currency' => $payment['currency'], 'status' => $payment['status'], 'providerStatus' => $payment['provider_status']]);
}