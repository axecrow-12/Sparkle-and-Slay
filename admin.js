const listEl = document.getElementById('admin-list');
const noCollections = document.getElementById('no-collections');
const form = document.getElementById('admin-form');
const formPanel = document.getElementById('product-form-panel');
const logoutBtn = document.getElementById('logout-btn');
const token = sessionStorage.getItem('sparkleAdminToken');
const adminStatus = document.getElementById('admin-status');
let collections = [];
let editingId = null;
document.getElementById('admin-logo').addEventListener('error', function handleLogoError() {
    this.removeEventListener('error', handleLogoError);
    this.src = 'photos/slay.jpeg';
}, { once: true });

function showStatus(message, type = 'info') {
  SparkleUI.announce(adminStatus, message, type);
}

function clearMediaPreviews() {
  ['admin-image-preview', 'admin-video-preview'].forEach((id) => {
    const preview = document.getElementById(id);
    preview.hidden = true;
    preview.removeAttribute('src');
  });
}

function previewSelectedFile(inputId, previewId) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  const file = input.files[0];
  if (!file) {
    preview.hidden = true;
    preview.removeAttribute('src');
    return;
  }
  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
}

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function handleAuthFailure(response) {
  if (response.status !== 401) return false;
  sessionStorage.removeItem('sparkleAdminToken');
  window.location.href = 'login.html';
  return true;
}

function showView(viewName) {
  document.querySelectorAll('[data-view-panel]').forEach((panel) => {
    const active = panel.dataset.viewPanel === viewName;
    panel.hidden = !active;
    panel.classList.toggle('is-active', active);
  });
  document.querySelectorAll('[data-view]').forEach((link) => {
    const active = link.dataset.view === viewName;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  const title = document.getElementById('page-title');
  title.textContent = viewName === 'shop' ? 'Shop management' : viewName[0].toUpperCase() + viewName.slice(1);
  if (viewName === 'payments') {
    loadPayments();
    loadSalesReport();
  }
  if (viewName === 'orders') {
    loadOrders();
  }
  closeSidebar();
}

function closeSidebar() {
  document.getElementById('admin-sidebar').classList.remove('is-open');
  document.getElementById('sidebar-backdrop').hidden = true;
  document.getElementById('menu-toggle').setAttribute('aria-expanded', 'false');
}

document.querySelectorAll('[data-view]').forEach((link) => link.addEventListener('click', () => showView(link.dataset.view)));
document.querySelectorAll('[data-open-view]').forEach((button) => button.addEventListener('click', () => { showView(button.dataset.openView); openProductForm(); }));
document.getElementById('menu-toggle').addEventListener('click', () => {
  const sidebar = document.getElementById('admin-sidebar');
  const open = sidebar.classList.toggle('is-open');
  document.getElementById('sidebar-backdrop').hidden = !open;
  document.getElementById('menu-toggle').setAttribute('aria-expanded', String(open));
});
document.getElementById('sidebar-backdrop').addEventListener('click', closeSidebar);

logoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem('sparkleAdminToken');
  window.location.href = 'login.html';
});

function openProductForm(item = null) {
  editingId = item ? item.id : null;
  formPanel.hidden = false;
  document.getElementById('product-form-title').textContent = item ? 'Edit product' : 'Add a product';
  form.querySelector('button[type="submit"]').textContent = item ? 'Save changes' : 'Add product';
  document.getElementById('admin-name').value = item?.name || '';
  document.getElementById('admin-description').value = item?.description || '';
  document.getElementById('admin-price').value = item?.price ?? '';
  document.getElementById('admin-stock-status').value = item?.stock_status || 'in_stock';
  document.getElementById('admin-image').value = item?.image || '';
  document.getElementById('admin-video').value = item?.video || '';
  document.getElementById('admin-colors').value = item?.colors || '';
  document.getElementById('admin-sizes').value = item?.sizes || '';
  document.getElementById('admin-rating-average').value = item?.rating_average ?? '';
  document.getElementById('admin-rating-count').value = item?.rating_count ?? '';
  clearMediaPreviews();
  formPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeProductForm() {
  editingId = null;
  form.reset();
  clearMediaPreviews();
  formPanel.hidden = true;
}

document.getElementById('new-product-btn').addEventListener('click', () => openProductForm());
document.getElementById('cancel-product').addEventListener('click', closeProductForm);
document.getElementById('admin-image-file').addEventListener('change', () => previewSelectedFile('admin-image-file', 'admin-image-preview'));
document.getElementById('admin-video-file').addEventListener('change', () => previewSelectedFile('admin-video-file', 'admin-video-preview'));

const settingFields = {
  store_name: 'setting-store-name', email: 'setting-email', phone: 'setting-phone',
  whatsapp: 'setting-whatsapp', ecocash_merchant_number: 'setting-ecocash', address: 'setting-address',
};

async function loadSettings() {
  try {
    const response = await fetch(`${API_BASE}/settings`, { headers: authHeaders() });
    if (handleAuthFailure(response) || !response.ok) return;
    const settings = await response.json();
    Object.entries(settingFields).forEach(([key, id]) => { if (settings[key] !== undefined) document.getElementById(id).value = settings[key]; });
  } catch (error) {
    // The form keeps its useful fallback values when the API is unavailable.
  }
}

document.getElementById('store-settings-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(Object.entries(settingFields).map(([key, id]) => [key, document.getElementById(id).value.trim()]));
  const button = event.currentTarget.querySelector('button[type="submit"]');
  SparkleUI.setBusy(button, true, 'Saving...');
  try {
    const response = await fetch(`${API_BASE}/settings`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(payload) });
    if (handleAuthFailure(response)) return;
    showStatus(response.ok ? 'Store details saved.' : 'Could not save store details.', response.ok ? 'success' : 'error');
  } catch (error) {
    showStatus('Could not reach the server. Please try again shortly.', 'error');
  } finally {
    SparkleUI.setBusy(button, false);
  }
});

document.getElementById('password-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const next = document.getElementById('new-password').value;
  if (next !== document.getElementById('confirm-password').value) { showStatus('New passwords do not match.', 'error'); return; }
  const button = event.currentTarget.querySelector('button[type="submit"]');
  SparkleUI.setBusy(button, true, 'Updating...');
  try {
    const response = await fetch(`${API_BASE}/auth/password`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ currentPassword: document.getElementById('current-password').value, newPassword: next }) });
    if (handleAuthFailure(response)) return;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { showStatus(data.error || 'Could not update password.', 'error'); return; }
    sessionStorage.setItem('sparkleAdminToken', data.token);
    document.getElementById('password-form').reset();
    showStatus('Password updated.', 'success');
  } catch (error) {
    showStatus('Could not reach the server. Please try again shortly.', 'error');
  } finally {
    SparkleUI.setBusy(button, false);
  }
});

function makeSmall(text) {
  const element = document.createElement('small');
  element.textContent = text;
  return element;
}

function resolveMediaUrl(value) {
  if (!value) return '';
  if (value.startsWith('/uploads/')) return new URL(value, new URL(API_BASE).origin).href;
  return value;
}

/* =========================================================
   Shared record-view helpers (tables, badges, dialogs)
   ========================================================= */

function formatDate(value) {
  if (!value) return '';
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const STATUS_LABELS = {
  in_stock: 'In stock', low_stock: 'Low stock', out_of_stock: 'Out of stock',
};

function statusBadge(status) {
  const value = String(status || 'pending').toLowerCase();
  const badge = document.createElement('span');
  badge.className = `status-badge is-${value}`;
  badge.textContent = STATUS_LABELS[value] || value[0].toUpperCase() + value.slice(1);
  return badge;
}

// Builds a <table class="record-table"> from a column spec. Each column is
// { label, key?, render?(row)->Node|string, className? }. Rows carrying a
// truthy deleted_at get the .is-archived treatment.
function recordTable({ columns, rows, emptyText = 'Nothing to show yet.' }) {
  if (!rows.length) {
    const empty = document.createElement('p');
    empty.className = 'record-table-empty';
    empty.textContent = emptyText;
    return empty;
  }
  const table = document.createElement('table');
  table.className = 'record-table';

  const headRow = document.createElement('tr');
  columns.forEach((col) => {
    const th = document.createElement('th');
    th.textContent = col.label;
    if (col.className) th.className = col.className;
    headRow.appendChild(th);
  });
  const thead = document.createElement('thead');
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    if (row.deleted_at) tr.className = 'is-archived';
    columns.forEach((col) => {
      const td = document.createElement('td');
      if (col.className) td.className = col.className;
      td.dataset.label = col.label;
      const value = col.render ? col.render(row) : row[col.key];
      if (value instanceof Node) td.appendChild(value);
      else td.textContent = value === null || value === undefined || value === '' ? '—' : String(value);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

function iconButton(label, className, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function rowActions(...buttons) {
  const wrap = document.createElement('div');
  wrap.className = 'record-row-actions';
  buttons.filter(Boolean).forEach((button) => wrap.appendChild(button));
  return wrap;
}

// --- Confirm dialog -------------------------------------------------------
const confirmDialogEl = document.getElementById('confirm-dialog');
let confirmResolver = null;
const confirmDialog = SparkleUI.createDialog(confirmDialogEl, {
  onClose() { if (confirmResolver) { confirmResolver(false); confirmResolver = null; } },
});
confirmDialogEl.addEventListener('click', (event) => {
  if (event.target === confirmDialogEl) confirmDialog.close();
});
document.getElementById('confirm-dialog-cancel').addEventListener('click', () => confirmDialog.close());
document.getElementById('confirm-dialog-ok').addEventListener('click', () => {
  const resolve = confirmResolver;
  confirmResolver = null;
  confirmDialog.close();
  resolve?.(true);
});

function confirmAction(message, { title = 'Please confirm', confirmLabel = 'Confirm' } = {}) {
  document.getElementById('confirm-dialog-title').textContent = title;
  document.getElementById('confirm-dialog-message').textContent = message;
  document.getElementById('confirm-dialog-ok').textContent = confirmLabel;
  confirmDialog.open();
  return new Promise((resolve) => { confirmResolver = resolve; });
}

// --- Record detail dialog ----------------------------------------------------
const recordDetailEl = document.getElementById('record-detail-dialog');
const recordDetail = SparkleUI.createDialog(recordDetailEl);
recordDetailEl.addEventListener('click', (event) => {
  if (event.target === recordDetailEl) recordDetail.close();
});
document.getElementById('record-detail-close').addEventListener('click', () => recordDetail.close());

function openRecordDetail(title, fields) {
  document.getElementById('record-detail-title').textContent = title;
  const body = document.getElementById('record-detail-body');
  body.replaceChildren();
  fields.forEach(([label, value]) => {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    if (value instanceof Node) dd.appendChild(value);
    else dd.textContent = value === null || value === undefined || value === '' ? '—' : String(value);
    body.append(dt, dd);
  });
  recordDetail.open();
}

// --- Generic archive / restore --------------------------------------------
async function archiveRecord(kind, id, label, reload) {
  const confirmed = await confirmAction(
    `Archive ${label}? It will be hidden from lists and reports, but you can restore it later.`,
    { title: 'Archive record', confirmLabel: 'Archive' },
  );
  if (!confirmed) return;
  const response = await fetch(`${API_BASE}/${kind}/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (handleAuthFailure(response)) return;
  if (!response.ok && response.status !== 204) { showStatus('Could not archive that record.', 'error'); return; }
  showStatus('Record archived.', 'success');
  await reload();
}

async function restoreRecord(kind, id, reload) {
  const response = await fetch(`${API_BASE}/${kind}/${id}/restore`, { method: 'POST', headers: authHeaders() });
  if (handleAuthFailure(response)) return;
  if (!response.ok) { showStatus('Could not restore that record.', 'error'); return; }
  showStatus('Record restored.', 'success');
  await reload();
}

function statusSelect(current, options, onChange, ariaLabel) {
  const select = document.createElement('select');
  select.setAttribute('aria-label', ariaLabel);
  const values = options.includes(current) ? options : [current, ...options];
  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value[0].toUpperCase() + value.slice(1);
    option.selected = value === current;
    select.append(option);
  });
  select.addEventListener('change', () => onChange(select.value));
  return select;
}

function productThumb(item) {
  const cell = document.createElement('div');
  cell.className = 'record-product-cell';
  if (item.image) {
    const thumbnail = document.createElement('img');
    thumbnail.className = 'admin-product-thumbnail';
    thumbnail.src = resolveMediaUrl(item.image);
    thumbnail.alt = '';
    thumbnail.width = 46;
    thumbnail.height = 46;
    thumbnail.loading = 'lazy';
    thumbnail.decoding = 'async';
    thumbnail.addEventListener('error', () => { thumbnail.hidden = true; });
    cell.append(thumbnail);
  }
  const text = document.createElement('div');
  const name = document.createElement('strong');
  name.textContent = item.name || 'Untitled product';
  text.append(name, makeSmall((item.description || 'No description').slice(0, 80)));
  cell.append(text);
  return cell;
}

function renderAdminCollections() {
  const active = collections.filter((item) => !item.deleted_at);
  noCollections.hidden = collections.length > 0;
  document.getElementById('product-count').textContent = `${active.length} product${active.length === 1 ? '' : 's'}`;
  document.getElementById('metric-products').textContent = active.length;

  const table = recordTable({
    emptyText: 'No products to show.',
    rows: collections,
    columns: [
      { label: 'Product', render: productThumb },
      { label: 'Price', className: 'col-num', render: (item) => (item.price !== null && item.price !== undefined ? `$${Number(item.price).toFixed(2)}` : 'On request') },
      { label: 'Availability', render: (item) => statusBadge(item.deleted_at ? 'archived' : item.stock_status || 'in_stock') },
      {
        label: 'Actions',
        className: 'col-actions',
        render: (item) => (item.deleted_at
          ? rowActions(iconButton('Restore', 'edit-button', () => restoreRecord('collections', item.id, loadCollections)))
          : rowActions(
            iconButton('Edit', 'edit-button', () => openProductForm(item)),
            iconButton('Archive', 'delete-button', () => archiveRecord('collections', item.id, `"${item.name}"`, loadCollections)),
          )),
      },
    ],
  });
  listEl.replaceChildren(table);
  renderInventorySummary(active);
}

function renderInventorySummary(items = collections) {
  const counts = items.reduce((summary, item) => { const status = item.stock_status || 'in_stock'; summary[status] = (summary[status] || 0) + 1; return summary; }, {});
  const summary = document.getElementById('inventory-summary');
  summary.replaceChildren();
  [['In stock', counts.in_stock || 0], ['Low stock', counts.low_stock || 0], ['Out of stock', counts.out_of_stock || 0]].forEach(([label, value]) => { const line = document.createElement('div'); line.className = 'inventory-line'; const name = document.createElement('span'); name.textContent = label; const count = document.createElement('strong'); count.textContent = value; line.append(name, count); summary.append(line); });
}

function renderTrendItems(items) {
  const trendList = document.getElementById('trend-list');
  trendList.replaceChildren();
  if (!items.length) {
    trendList.textContent = 'No completed orders yet.';
    return;
  }
  const maximum = Math.max(...items.map((item) => item.quantity), 1);
  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'trend-item';
    const details = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = item.name;
    const bar = document.createElement('div');
    bar.className = 'trend-bar';
    const fill = document.createElement('span');
    fill.style.width = `${Math.round((item.quantity / maximum) * 100)}%`;
    bar.append(fill);
    details.append(name, bar);
    const count = document.createElement('small');
    count.textContent = `${item.quantity} unit${item.quantity === 1 ? '' : 's'}`;
    row.append(details, count);
    trendList.append(row);
  });
}

async function loadDashboardSummary() {
  showSkeleton(document.getElementById('trend-list'), `
    <div class="trend-skeleton" aria-hidden="true"><div class="trend-skeleton-main"><span class="skeleton trend-skeleton-name"></span><span class="skeleton trend-skeleton-bar"></span></div><span class="skeleton" style="width:45px;height:14px;"></span></div>
    <div class="trend-skeleton" aria-hidden="true"><div class="trend-skeleton-main"><span class="skeleton trend-skeleton-name"></span><span class="skeleton trend-skeleton-bar"></span></div><span class="skeleton" style="width:45px;height:14px;"></span></div>
    <div class="trend-skeleton" aria-hidden="true"><div class="trend-skeleton-main"><span class="skeleton trend-skeleton-name"></span><span class="skeleton trend-skeleton-bar"></span></div><span class="skeleton" style="width:45px;height:14px;"></span></div>
  `);
  try {
    const response = await fetch(`${API_BASE}/orders/summary`, { headers: authHeaders() });
    if (handleAuthFailure(response)) return;
    if (!response.ok) throw new Error('Could not load summary.');
    const summary = await response.json();
    document.getElementById('metric-units').textContent = summary.units;
    document.getElementById('metric-orders').textContent = summary.pendingOrders;
    renderTrendItems(summary.topItems || []);
  } catch (error) {
    document.getElementById('trend-list').textContent = 'Sales insight is unavailable right now.';
    document.getElementById('metric-units').textContent = '—';
    document.getElementById('metric-orders').textContent = '—';
  }
}

function formatPaymentAmount(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount) || 0);
}

/* ---------------- Payments ---------------- */

// Archiving/restoring a payment or an order changes the sales figures, so the
// report panel is re-fetched too once it has been loaded at least once.
function refreshPaymentsView() {
  loadPayments();
  if (lastReport) loadSalesReport();
  loadDashboardSummary();
}

function refreshOrdersView() {
  loadOrders();
  if (lastReport) loadSalesReport();
  loadDashboardSummary();
}

function paymentDetailFields(payment) {
  return [
    ['Reference', payment.reference],
    ['Customer', payment.customer_name],
    ['Phone', payment.phone],
    ['Item', payment.item_name],
    ['Amount', formatPaymentAmount(payment.amount)],
    ['Currency', payment.currency],
    ['Method', payment.method],
    ['Status', statusBadge(payment.status)],
    ['Provider status', payment.provider_status],
    ['Merchant number', payment.merchant_number],
    ['Created', formatDate(payment.created_at)],
    ['Verified', formatDate(payment.verified_at)],
    ['Order ID', payment.order_id],
    payment.deleted_at ? ['Archived', formatDate(payment.deleted_at)] : null,
  ].filter(Boolean);
}

function renderPayments(payments) {
  const table = recordTable({
    emptyText: 'No payment records yet.',
    rows: payments,
    columns: [
      { label: 'Date', render: (p) => formatDate(p.created_at) },
      { label: 'Customer', render: (p) => p.customer_name || 'Customer' },
      { label: 'Phone', key: 'phone' },
      { label: 'Item', key: 'item_name' },
      { label: 'Reference', key: 'reference' },
      { label: 'Amount', className: 'col-num', render: (p) => formatPaymentAmount(p.amount) },
      {
        label: 'Status',
        render: (p) => (p.deleted_at
          ? statusBadge('archived')
          : statusSelect(p.status, ['pending', 'verified', 'rejected'], (value) => updatePaymentStatus(p.id, value), `Payment status for ${p.reference}`)),
      },
      {
        label: 'Actions',
        className: 'col-actions',
        render: (p) => rowActions(
          iconButton('View', 'edit-button', () => openRecordDetail(`Payment ${p.reference}`, paymentDetailFields(p))),
          p.deleted_at
            ? iconButton('Restore', 'edit-button', () => restoreRecord('payments', p.id, refreshPaymentsView))
            : iconButton('Archive', 'delete-button', () => archiveRecord('payments', p.id, `payment ${p.reference}`, refreshPaymentsView)),
        ),
      },
    ],
  });
  document.getElementById('payment-list').replaceChildren(table);
}

let paymentsPage = 1;
const paymentsPerPage = 20;

async function loadPayments(page = paymentsPage) {
  const includeArchived = document.getElementById('payments-archived')?.checked;
  showSkeleton(document.getElementById('payment-list'), `
    <div class="payment-skeleton skeleton" aria-hidden="true"></div>
    <div class="payment-skeleton skeleton" aria-hidden="true"></div>
    <div class="payment-skeleton skeleton" aria-hidden="true"></div>
  `);
  try {
    const response = await fetch(`${API_BASE}/payments?page=${page}&perPage=${paymentsPerPage}${includeArchived ? '&includeArchived=1' : ''}`, { headers: authHeaders() });
    if (handleAuthFailure(response) || !response.ok) throw new Error('Could not load payments.');
    const result = await response.json();
    paymentsPage = result.page;
    renderPayments(result.data);
    document.getElementById('payment-count').textContent = `${result.total} record${result.total === 1 ? '' : 's'}`;
    updatePager('payment', paymentsPage, Math.max(1, Math.ceil(result.total / result.perPage)));
  } catch (error) { document.getElementById('payment-list').textContent = 'Payments are unavailable right now.'; }
}

async function updatePaymentStatus(id, status) {
  const response = await fetch(`${API_BASE}/payments/${id}/status`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ status }) });
  if (handleAuthFailure(response) || !response.ok) { showStatus('Could not update payment status.', 'error'); loadPayments(); return; }
  showStatus('Payment status updated.', 'success');
}

document.getElementById('payment-prev').addEventListener('click', () => loadPayments(paymentsPage - 1));
document.getElementById('payment-next').addEventListener('click', () => loadPayments(paymentsPage + 1));
document.getElementById('payments-archived').addEventListener('change', () => loadPayments(1));

/* ---------------- Orders ---------------- */

const ORDER_STATUSES = ['pending', 'paid', 'packed', 'shipped', 'completed', 'cancelled'];
let ordersPage = 1;
const ordersPerPage = 20;

function orderDetailFields(order) {
  return [
    ['Order ID', order.id],
    ['Customer', order.customer_name],
    ['Phone', order.phone],
    ['Item', order.item_name],
    ['Amount', order.amount],
    ['EcoCash reference', order.ecocash_reference],
    ['Address', order.address],
    ['Status', statusBadge(order.status)],
    ['Created', formatDate(order.created_at)],
    order.deleted_at ? ['Archived', formatDate(order.deleted_at)] : null,
  ].filter(Boolean);
}

function renderOrders(orders) {
  const table = recordTable({
    emptyText: 'No orders yet.',
    rows: orders,
    columns: [
      { label: 'Date', render: (o) => formatDate(o.created_at) },
      { label: 'Customer', render: (o) => o.customer_name || 'Customer' },
      { label: 'Phone', key: 'phone' },
      { label: 'Item', key: 'item_name' },
      { label: 'Amount', className: 'col-num', key: 'amount' },
      {
        label: 'Status',
        render: (o) => (o.deleted_at
          ? statusBadge('archived')
          : statusSelect(o.status || 'pending', ORDER_STATUSES, (value) => updateOrderStatus(o.id, value), `Order status for order ${o.id}`)),
      },
      {
        label: 'Actions',
        className: 'col-actions',
        render: (o) => rowActions(
          iconButton('View', 'edit-button', () => openRecordDetail(`Order #${o.id}`, orderDetailFields(o))),
          o.deleted_at
            ? iconButton('Restore', 'edit-button', () => restoreRecord('orders', o.id, refreshOrdersView))
            : iconButton('Archive', 'delete-button', () => archiveRecord('orders', o.id, `order #${o.id}`, refreshOrdersView)),
        ),
      },
    ],
  });
  document.getElementById('orders-table').replaceChildren(table);
}

async function loadOrders(page = ordersPage) {
  const includeArchived = document.getElementById('orders-archived')?.checked;
  showSkeleton(document.getElementById('orders-table'), `
    <div class="payment-skeleton skeleton" aria-hidden="true"></div>
    <div class="payment-skeleton skeleton" aria-hidden="true"></div>
    <div class="payment-skeleton skeleton" aria-hidden="true"></div>
  `);
  try {
    const response = await fetch(`${API_BASE}/orders?page=${page}&perPage=${ordersPerPage}${includeArchived ? '&includeArchived=1' : ''}`, { headers: authHeaders() });
    if (handleAuthFailure(response) || !response.ok) throw new Error('Could not load orders.');
    const result = await response.json();
    ordersPage = result.page;
    renderOrders(result.data);
    document.getElementById('orders-count').textContent = `${result.total} order${result.total === 1 ? '' : 's'}`;
    updatePager('orders', ordersPage, Math.max(1, Math.ceil(result.total / result.perPage)));
  } catch (error) { document.getElementById('orders-table').textContent = 'Orders are unavailable right now.'; }
}

async function updateOrderStatus(id, status) {
  const response = await fetch(`${API_BASE}/orders/${id}/status`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ status }) });
  if (handleAuthFailure(response) || !response.ok) { showStatus('Could not update order status.', 'error'); loadOrders(); return; }
  showStatus('Order status updated.', 'success');
}

document.getElementById('orders-prev').addEventListener('click', () => loadOrders(ordersPage - 1));
document.getElementById('orders-next').addEventListener('click', () => loadOrders(ordersPage + 1));
document.getElementById('orders-archived').addEventListener('change', () => loadOrders(1));

function updatePager(prefix, page, totalPages) {
  const pager = document.getElementById(`${prefix}-pager`);
  pager.hidden = totalPages <= 1;
  document.getElementById(`${prefix}-page-label`).textContent = `Page ${page} of ${totalPages}`;
  document.getElementById(`${prefix}-prev`).disabled = page <= 1;
  document.getElementById(`${prefix}-next`).disabled = page >= totalPages;
}

/* ---------------- Custom sales report ---------------- */

let lastReport = null;

function reportQuery() {
  const params = new URLSearchParams();
  const from = document.getElementById('report-from').value;
  const to = document.getElementById('report-to').value;
  const group = document.getElementById('report-group').value;
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  params.set('groupBy', group);
  if (group === 'period') params.set('interval', document.getElementById('report-interval').value);
  params.set('status', document.getElementById('report-status').value);
  params.set('method', document.getElementById('report-method').value);
  return params.toString();
}

function syncReportControls() {
  const isPeriod = document.getElementById('report-group').value === 'period';
  document.getElementById('report-interval-wrap').hidden = !isPeriod;
}

async function loadSalesReport() {
  syncReportControls();
  const table = document.getElementById('report-table');
  showSkeleton(table, `
    <div class="payment-skeleton skeleton" aria-hidden="true"></div>
    <div class="payment-skeleton skeleton" aria-hidden="true"></div>
    <div class="payment-skeleton skeleton" aria-hidden="true"></div>
  `);
  try {
    const response = await fetch(`${API_BASE}/reports/sales?${reportQuery()}`, { headers: authHeaders() });
    if (handleAuthFailure(response) || !response.ok) throw new Error('Could not load report.');
    const report = await response.json();
    lastReport = report;

    const summary = report.summary;
    const summaryEl = document.getElementById('report-summary');
    summaryEl.hidden = false;
    summaryEl.textContent = `${summary.records} record${summary.records === 1 ? '' : 's'} · `
      + `${formatPaymentAmount(summary.totalAmount)} submitted · `
      + `${formatPaymentAmount(summary.verifiedAmount)} verified · `
      + `${summary.customers} customer${summary.customers === 1 ? '' : 's'}`;
    document.getElementById('report-total').textContent = `${formatPaymentAmount(summary.verifiedAmount)} verified`;

    table.replaceChildren(recordTable({
      emptyText: 'No records match those filters.',
      rows: report.rows,
      columns: report.columns.map((col) => ({
        label: col.label,
        className: col.type === 'money' || col.type === 'number' ? 'col-num' : undefined,
        render: (row) => (col.type === 'money' ? formatPaymentAmount(row[col.key]) : row[col.key]),
      })),
    }));
  } catch (error) {
    table.textContent = 'Report is unavailable right now.';
  }
}

function exportReportCsv() {
  if (!lastReport || !lastReport.rows.length) { showStatus('Load a report before exporting.', 'info'); return; }
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const header = lastReport.columns.map((col) => escape(col.label)).join(',');
  const lines = lastReport.rows.map((row) => lastReport.columns.map((col) => escape(row[col.key])).join(','));
  const csv = [header, ...lines].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sparkle-sales-${lastReport.groupBy}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

document.getElementById('report-controls').addEventListener('submit', (event) => { event.preventDefault(); loadSalesReport(); });
document.getElementById('report-group').addEventListener('change', syncReportControls);
document.getElementById('export-report').addEventListener('click', exportReportCsv);
document.getElementById('print-report').addEventListener('click', () => window.print());
syncReportControls();


async function uploadSelectedFile(inputId) {
  const input = document.getElementById(inputId);
  if (!input.files.length) return '';
  const body = new FormData();
  body.append('file', input.files[0]);
  const response = await fetch(`${API_BASE}/uploads`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Could not upload media.');
  return new URL(data.path, new URL(API_BASE).origin).href;
}

async function loadCollections() {
  showSkeleton(listEl, adminProductSkeleton(5));
  noCollections.hidden = true;
  const includeArchived = document.getElementById('products-archived')?.checked;
  try {
    const response = await fetch(`${API_BASE}/collections${includeArchived ? '?includeArchived=1' : ''}`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Could not load products.');
    collections = await response.json();
    renderAdminCollections();
  } catch (error) {
    listEl.textContent = 'Could not load products. Is the backend running?';
    document.getElementById('metric-products').textContent = '—';
    document.getElementById('inventory-summary').textContent = 'Inventory is unavailable right now.';
    noCollections.hidden = true;
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = document.getElementById('admin-name').value.trim();
  const description = document.getElementById('admin-description').value.trim();
  const price = Number(document.getElementById('admin-price').value);
  const requiredInputs = ['admin-name', 'admin-description', 'admin-price'].map((id) => document.getElementById(id));
  if (!SparkleUI.validateRequired(requiredInputs) || !Number.isFinite(price) || price < 0) return;
  let image = document.getElementById('admin-image').value.trim();
  let video = document.getElementById('admin-video').value.trim();
  const button = form.querySelector('button[type="submit"]');
  SparkleUI.setBusy(button, true, editingId !== null ? 'Saving...' : 'Adding...');
  try {
    image = await uploadSelectedFile('admin-image-file') || image;
    video = await uploadSelectedFile('admin-video-file') || video;
  } catch (error) {
    showStatus(error.message, 'error');
    SparkleUI.setBusy(button, false);
    return;
  }
  const payload = {
    name, description, image, video, price,
    stock_status: document.getElementById('admin-stock-status').value,
    colors: document.getElementById('admin-colors').value.trim(),
    sizes: document.getElementById('admin-sizes').value.trim(),
    rating_average: document.getElementById('admin-rating-average').value === '' ? null : Number(document.getElementById('admin-rating-average').value),
    rating_count: document.getElementById('admin-rating-count').value === '' ? 0 : Number(document.getElementById('admin-rating-count').value),
  };
  const isEditing = editingId !== null;
  try {
    const response = await fetch(isEditing ? `${API_BASE}/collections/${editingId}` : `${API_BASE}/collections`, { method: isEditing ? 'PUT' : 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
    if (handleAuthFailure(response)) return;
    if (!response.ok) { const data = await response.json().catch(() => ({})); showStatus(data.error || 'Could not save product.', 'error'); return; }
    closeProductForm();
    await loadCollections();
    showStatus(isEditing ? 'Product updated.' : 'Product added.', 'success');
  } catch (error) {
    showStatus('Could not reach the server. Please try again shortly.', 'error');
  } finally {
    SparkleUI.setBusy(button, false);
  }
});

document.getElementById('products-archived').addEventListener('change', loadCollections);

loadCollections();
loadDashboardSummary();
loadSettings();
