<?php

function paymentsList(): void
{
    requireAdmin();
    $rows = getDb()->query(
        'SELECT p.*, o.customer_name, o.phone, o.item_name
         FROM payments p INNER JOIN orders o ON o.id = p.order_id
         ORDER BY p.created_at DESC'
    )->fetchAll();
    jsonResponse($rows);
}

function paymentsUpdateStatus(string $id): void
{
    requireAdmin();
    $body = getJsonBody();
    $status = $body['status'] ?? '';
    $providerStatus = $body['providerStatus'] ?? null;
    $allowed = ['pending', 'verified', 'rejected'];
    
    if (!in_array($status, $allowed, true)) {
        jsonResponse(['error' => 'Payment status must be pending, verified, or rejected.'], 400);
    }
    
    $db = getDb();
    $stmt = $db->prepare('SELECT id, status, provider_status FROM payments WHERE id = :id');
    $stmt->execute(['id' => $id]);
    $payment = $stmt->fetch();
    
    if (!$payment) {
        jsonResponse(['error' => 'Payment not found.'], 404);
    }
    
    // When manually approving, also update provider status for consistency
    if ($status === 'verified' && $payment['provider_status'] === 'INITIATED') {
        $providerStatus = 'COMPLETED';
    }
    
    $query = 'UPDATE payments SET status = :status';
    $params = ['status' => $status, 'id' => $id];
    
    if ($providerStatus) {
        $query .= ', provider_status = :provider_status';
        $params['provider_status'] = $providerStatus;
    }
    
    if ($status === 'verified' && $payment['status'] !== 'verified') {
        $query .= ', verified_at = CURRENT_TIMESTAMP';
    } elseif ($status !== 'verified' && $payment['status'] === 'verified') {
        $query .= ', verified_at = NULL';
    }
    
    $query .= ' WHERE id = :id';
    
    $stmt = $db->prepare($query);
    $stmt->execute($params);
    
    if ($stmt->rowCount() === 0) {
        jsonResponse(['error' => 'Payment not found.'], 404);
    }
    
    error_log("Admin updated payment $id: status=$status, provider_status=$providerStatus");
    
    $updated = $db->prepare('SELECT * FROM payments WHERE id = :id');
    $updated->execute(['id' => $id]);
    jsonResponse($updated->fetch());
}

function paymentsReport(): void
{
    requireAdmin();
    $period = ($_GET['period'] ?? 'weekly') === 'monthly' ? 'monthly' : 'weekly';
    $format = $period === 'monthly' ? '%Y-%m' : '%x-W%v';
    $db = getDb();
    $query =
        "SELECT DATE_FORMAT(created_at, '$format') AS period, COUNT(*) AS payments,
                COALESCE(SUM(amount), 0) AS total_amount,
                COALESCE(SUM(CASE WHEN status = 'verified' THEN amount ELSE 0 END), 0) AS verified_amount
         FROM payments GROUP BY DATE_FORMAT(created_at, '$format') ORDER BY period DESC LIMIT 24";
    $rows = $db->query($query)->fetchAll();
    jsonResponse([
        'period' => $period,
        'currency' => 'USD',
        'rows' => array_map(static fn (array $row): array => [
            'period' => $row['period'],
            'payments' => (int) $row['payments'],
            'totalAmount' => (float) $row['total_amount'],
            'verifiedAmount' => (float) $row['verified_amount'],
        ], $rows),
    ]);
}