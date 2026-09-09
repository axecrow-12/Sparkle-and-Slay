<?php

/**
 * Custom sales report. One endpoint, three groupings (time period / product /
 * customer), a free date range, and status/method filters. Everything is
 * aggregated from `payments` (DECIMAL amount, has status + created_at) joined to
 * `orders`; `orders.amount` is a VARCHAR and is never summed here.
 *
 * Archived (soft-deleted) payments and orders are always excluded.
 */
function salesReport(): void
{
    requireAdmin();
    $db = getDb();

    $groupBy = in_array($_GET['groupBy'] ?? 'period', ['period', 'product', 'customer'], true)
        ? $_GET['groupBy'] : 'period';
    $interval = in_array($_GET['interval'] ?? 'week', ['day', 'week', 'month'], true)
        ? $_GET['interval'] : 'week';
    $status = in_array($_GET['status'] ?? 'all', ['all', 'verified', 'pending', 'rejected'], true)
        ? $_GET['status'] : 'all';
    $method = trim((string) ($_GET['method'] ?? 'all')) ?: 'all';

    $conditions = ['p.deleted_at IS NULL', 'o.deleted_at IS NULL'];
    $params = [];

    $from = trim((string) ($_GET['from'] ?? ''));
    $to = trim((string) ($_GET['to'] ?? ''));
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $from)) {
        $conditions[] = 'p.created_at >= :from';
        $params['from'] = $from . ' 00:00:00';
    } else {
        $from = '';
    }
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $to)) {
        $conditions[] = 'p.created_at < DATE_ADD(:to, INTERVAL 1 DAY)';
        $params['to'] = $to;
    } else {
        $to = '';
    }
    if ($status !== 'all') {
        $conditions[] = 'p.status = :status';
        $params['status'] = $status;
    }
    if ($method !== 'all') {
        $conditions[] = 'p.method = :method';
        $params['method'] = $method;
    }
    $where = 'WHERE ' . implode(' AND ', $conditions);

    $summaryStmt = $db->prepare(
        "SELECT COUNT(*) AS records,
                COALESCE(SUM(p.amount), 0) AS total_amount,
                COALESCE(SUM(CASE WHEN p.status = 'verified' THEN p.amount ELSE 0 END), 0) AS verified_amount,
                COUNT(DISTINCT o.customer_name, o.phone) AS customers
         FROM payments p JOIN orders o ON o.id = p.order_id
         $where"
    );
    $summaryStmt->execute($params);
    $summary = $summaryStmt->fetch();

    if ($groupBy === 'product') {
        // revenue here is a list-price estimate: order_items store a quantity
        // but not the price paid, so it is quantity x current collection price.
        $sql =
            "SELECT COALESCE(c.name, oi.item_name) AS grp,
                    COALESCE(SUM(oi.quantity), 0) AS units,
                    COALESCE(SUM(oi.quantity * COALESCE(c.price, 0)), 0) AS revenue_estimate,
                    COUNT(DISTINCT p.id) AS payments
             FROM payments p
             JOIN orders o ON o.id = p.order_id
             JOIN order_items oi ON oi.order_id = o.id
             LEFT JOIN collections c ON c.id = oi.collection_id
             $where
             GROUP BY grp ORDER BY revenue_estimate DESC, units DESC LIMIT 200";
        $columns = [
            ['key' => 'product', 'label' => 'Product', 'type' => 'text'],
            ['key' => 'units', 'label' => 'Units', 'type' => 'number'],
            ['key' => 'revenueEstimate', 'label' => 'Revenue (est.)', 'type' => 'money'],
            ['key' => 'payments', 'label' => 'Orders', 'type' => 'number'],
        ];
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rows = array_map(static fn (array $r): array => [
            'product' => $r['grp'],
            'units' => (int) $r['units'],
            'revenueEstimate' => (float) $r['revenue_estimate'],
            'payments' => (int) $r['payments'],
        ], $stmt->fetchAll());
    } elseif ($groupBy === 'customer') {
        $sql =
            "SELECT o.customer_name AS customer, o.phone AS phone,
                    COUNT(DISTINCT o.id) AS orders,
                    COALESCE(SUM(p.amount), 0) AS total_amount,
                    COALESCE(SUM(CASE WHEN p.status = 'verified' THEN p.amount ELSE 0 END), 0) AS verified_amount
             FROM payments p JOIN orders o ON o.id = p.order_id
             $where
             GROUP BY o.customer_name, o.phone ORDER BY total_amount DESC LIMIT 200";
        $columns = [
            ['key' => 'customer', 'label' => 'Customer', 'type' => 'text'],
            ['key' => 'phone', 'label' => 'Phone', 'type' => 'text'],
            ['key' => 'orders', 'label' => 'Orders', 'type' => 'number'],
            ['key' => 'totalAmount', 'label' => 'Submitted', 'type' => 'money'],
            ['key' => 'verifiedAmount', 'label' => 'Verified', 'type' => 'money'],
        ];
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rows = array_map(static fn (array $r): array => [
            'customer' => $r['customer'],
            'phone' => $r['phone'],
            'orders' => (int) $r['orders'],
            'totalAmount' => (float) $r['total_amount'],
            'verifiedAmount' => (float) $r['verified_amount'],
        ], $stmt->fetchAll());
    } else {
        $format = ['day' => '%Y-%m-%d', 'week' => '%x-W%v', 'month' => '%Y-%m'][$interval];
        $sql =
            "SELECT DATE_FORMAT(p.created_at, '$format') AS period,
                    COUNT(*) AS payments,
                    COALESCE(SUM(p.amount), 0) AS total_amount,
                    COALESCE(SUM(CASE WHEN p.status = 'verified' THEN p.amount ELSE 0 END), 0) AS verified_amount
             FROM payments p JOIN orders o ON o.id = p.order_id
             $where
             GROUP BY period ORDER BY period DESC LIMIT 180";
        $columns = [
            ['key' => 'period', 'label' => 'Period', 'type' => 'text'],
            ['key' => 'payments', 'label' => 'Records', 'type' => 'number'],
            ['key' => 'totalAmount', 'label' => 'Submitted', 'type' => 'money'],
            ['key' => 'verifiedAmount', 'label' => 'Verified', 'type' => 'money'],
        ];
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rows = array_map(static fn (array $r): array => [
            'period' => $r['period'],
            'payments' => (int) $r['payments'],
            'totalAmount' => (float) $r['total_amount'],
            'verifiedAmount' => (float) $r['verified_amount'],
        ], $stmt->fetchAll());
    }

    jsonResponse([
        'groupBy' => $groupBy,
        'currency' => 'USD',
        'filters' => [
            'from' => $from ?: null,
            'to' => $to ?: null,
            'status' => $status,
            'method' => $method,
            'interval' => $interval,
        ],
        'summary' => [
            'records' => (int) $summary['records'],
            'totalAmount' => (float) $summary['total_amount'],
            'verifiedAmount' => (float) $summary['verified_amount'],
            'customers' => (int) $summary['customers'],
        ],
        'columns' => $columns,
        'rows' => $rows,
    ]);
}
