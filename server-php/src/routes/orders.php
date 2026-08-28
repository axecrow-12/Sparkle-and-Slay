<?php

function ordersCreate(): void
{
    $body = getJsonBody();

    $collectionId = $body['collectionId'] ?? null;
    $itemName = trim($body['itemName'] ?? '');
    $name = trim($body['name'] ?? '');
    $phone = trim($body['phone'] ?? '');
    $reference = trim($body['reference'] ?? '');
    $amount = trim($body['amount'] ?? '');
    $address = trim($body['address'] ?? '');
    $items = is_array($body['items'] ?? null) ? $body['items'] : [[
        'collectionId' => $collectionId,
        'name' => $itemName,
        'quantity' => 1,
    ]];

    if ($itemName === '' || $name === '' || $phone === '' || $reference === '' || $amount === '') {
        jsonResponse(['error' => 'Please complete all required order fields.'], 400);
    }

    $numericAmount = preg_replace('/[^0-9.]/', '', $amount);
    if (!is_numeric($numericAmount) || (float) $numericAmount <= 0) {
        jsonResponse(['error' => 'Order amount must be a valid positive amount.'], 400);
    }

    $db = getDb();
    $paymentCheck = $db->prepare('SELECT id FROM payments WHERE reference = :reference');
    $paymentCheck->execute(['reference' => $reference]);
    if ($paymentCheck->fetch()) {
        jsonResponse(['error' => 'This EcoCash reference has already been recorded.'], 409);
    }
    $stmt = $db->prepare(
        'INSERT INTO orders (collection_id, item_name, customer_name, phone, ecocash_reference, amount, address)
         VALUES (:collection_id, :item_name, :customer_name, :phone, :reference, :amount, :address)'
    );
    $stmt->execute([
        'collection_id' => $collectionId ?: null,
        'item_name' => $itemName,
        'customer_name' => $name,
        'phone' => $phone,
        'reference' => $reference,
        'amount' => $amount,
        'address' => $address,
    ]);

    $orderId = $db->lastInsertId();
    $itemStmt = $db->prepare(
        'INSERT INTO order_items (order_id, collection_id, item_name, quantity)
         VALUES (:order_id, :collection_id, :item_name, :quantity)'
    );
    foreach ($items as $item) {
        $quantity = filter_var($item['quantity'] ?? 1, FILTER_VALIDATE_INT);
        $itemNameValue = trim($item['name'] ?? '');
        if ($quantity === false || $quantity < 1 || $itemNameValue === '') {
            jsonResponse(['error' => 'Order items must include a valid name and quantity.'], 400);
        }
        $itemStmt->execute([
            'order_id' => $orderId,
            'collection_id' => $item['collectionId'] ?? null,
            'item_name' => $itemNameValue,
            'quantity' => $quantity,
        ]);
    }

    $merchantNumber = settingsRead()['ecocash_merchant_number'];
    $payment = $db->prepare(
        'INSERT INTO payments (order_id, method, reference, amount, currency, merchant_number)
         VALUES (:order_id, :method, :reference, :amount, :currency, :merchant_number)'
    );
    $payment->execute([
        'order_id' => $orderId,
        'method' => 'ecocash',
        'reference' => $reference,
        'amount' => $numericAmount,
        'currency' => 'USD',
        'merchant_number' => $merchantNumber,
    ]);

    $created = $db->prepare('SELECT id, created_at FROM orders WHERE id = :id');
    $created->execute(['id' => $orderId]);
    $row = $created->fetch();

    jsonResponse(['orderId' => (int) $row['id'], 'createdAt' => $row['created_at']], 201);
}

function ordersSummary(): void
{
    requireAdmin();
    $db = getDb();
    $totals = $db->query("SELECT COUNT(*) AS orders, COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_orders FROM orders")->fetch();
    $units = $db->query('SELECT COALESCE(SUM(quantity), 0) AS units FROM order_items')->fetch();
    $top = $db->query(
        'SELECT item_name AS name, SUM(quantity) AS quantity
         FROM order_items GROUP BY item_name ORDER BY quantity DESC, name ASC LIMIT 6'
    )->fetchAll();
    jsonResponse([
        'orders' => (int) $totals['orders'],
        'pendingOrders' => (int) $totals['pending_orders'],
        'units' => (int) $units['units'],
        'topItems' => array_map(static fn (array $row): array => [
            'name' => $row['name'],
            'quantity' => (int) $row['quantity'],
        ], $top),
    ]);
}

function ordersList(): void
{
    requireAdmin();

    $db = getDb();
    $rows = $db->query('SELECT * FROM orders ORDER BY created_at DESC')->fetchAll();
    jsonResponse($rows);
}

function ordersUpdateStatus(string $id): void
{
    requireAdmin();
    $body = getJsonBody();
    $status = $body['status'] ?? null;

    if (!$status) {
        jsonResponse(['error' => 'Status is required.'], 400);
    }

    $db = getDb();
    $stmt = $db->prepare('UPDATE orders SET status = :status WHERE id = :id');
    $stmt->execute(['status' => $status, 'id' => $id]);

    if ($stmt->rowCount() === 0) {
        jsonResponse(['error' => 'Order not found.'], 404);
    }

    $updated = $db->prepare('SELECT * FROM orders WHERE id = :id');
    $updated->execute(['id' => $id]);
    jsonResponse($updated->fetch());
}
