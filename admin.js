const listEl = document.getElementById('admin-list');
const noCollections = document.getElementById('no-collections');
const form = document.getElementById('admin-form');
const formPanel = document.getElementById('product-form-panel');
const logoutBtn = document.getElementById('logout-btn');
const token = sessionStorage.getItem('sparkleAdminToken');
const adminStatus = document.getElementById('admin-status');
let collections = [];
let editingId = null;

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
    loadPaymentReport();
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

function renderAdminCollections() {
  listEl.replaceChildren();
  noCollections.hidden = collections.length > 0;
  document.getElementById('product-count').textContent = `${collections.length} product${collections.length === 1 ? '' : 's'}`;
  document.getElementById('metric-products').textContent = collections.length;
  collections.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'collection-row';
    const info = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = item.name || 'Untitled product';
    info.append(name, document.createElement('br'), makeSmall(item.price !== null && item.price !== undefined ? `$${Number(item.price).toFixed(2)}` : 'Price on request'), document.createElement('br'), makeSmall((item.description || 'No description').slice(0, 70)));
    const media = document.createElement('div');
    if (item.image) {
      const thumbnail = document.createElement('img');
      thumbnail.className = 'admin-product-thumbnail';
      thumbnail.src = resolveMediaUrl(item.image);
      thumbnail.alt = `${item.name || 'Product'} preview`;
      thumbnail.addEventListener('error', () => { thumbnail.hidden = true; });
      media.append(thumbnail);
    }
    media.append(makeSmall(item.image ? 'Image attached' : 'No image'), document.createElement('br'), makeSmall(item.stock_status === 'out_of_stock' ? 'Out of stock' : item.stock_status === 'low_stock' ? 'Low stock' : 'In stock'));
    const actions = document.createElement('div');
    actions.className = 'action-buttons';
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-button'; editBtn.type = 'button'; editBtn.textContent = 'Edit'; editBtn.addEventListener('click', () => openProductForm(item));
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-button'; deleteBtn.type = 'button'; deleteBtn.textContent = 'Delete'; deleteBtn.addEventListener('click', () => deleteCollection(item.id, item.name));
    actions.append(editBtn, deleteBtn); row.append(info, media, actions); listEl.append(row);
  });
  renderInventorySummary();
}

function renderInventorySummary() {
  const counts = collections.reduce((summary, item) => { const status = item.stock_status || 'in_stock'; summary[status] = (summary[status] || 0) + 1; return summary; }, {});
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

function renderPayments(payments) {
  const list = document.getElementById('payment-list');
  list.replaceChildren();
  document.getElementById('payment-count').textContent = `${payments.length} record${payments.length === 1 ? '' : 's'}`;
  if (!payments.length) { list.textContent = 'No payment records yet.'; return; }
  payments.forEach((payment) => {
    const row = document.createElement('div'); row.className = 'payment-row';
    const details = document.createElement('div');
    const name = document.createElement('strong'); name.textContent = payment.customer_name || 'Customer';
    const info = document.createElement('small'); info.textContent = `${payment.item_name} | Ref: ${payment.reference} | ${formatPaymentAmount(payment.amount)}`;
    details.append(name, info);
    const controls = document.createElement('div'); controls.className = 'payment-controls';
    const select = document.createElement('select'); select.setAttribute('aria-label', `Payment status for ${payment.reference}`);
    ['pending', 'verified', 'rejected'].forEach((status) => { const option = document.createElement('option'); option.value = status; option.textContent = status[0].toUpperCase() + status.slice(1); option.selected = status === payment.status; select.append(option); });
    select.addEventListener('change', () => updatePaymentStatus(payment.id, select.value));
    controls.append(select); row.append(details, controls); list.append(row);
  });
}

async function loadPayments() {
  try {
    const response = await fetch(`${API_BASE}/payments`, { headers: authHeaders() });
    if (handleAuthFailure(response) || !response.ok) throw new Error('Could not load payments.');
    renderPayments(await response.json());
  } catch (error) { document.getElementById('payment-list').textContent = 'Payments are unavailable right now.'; }
}

async function updatePaymentStatus(id, status) {
  const response = await fetch(`${API_BASE}/payments/${id}/status`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ status }) });
  if (handleAuthFailure(response) || !response.ok) { showStatus('Could not update payment status.', 'error'); loadPayments(); return; }
  showStatus('Payment status updated.', 'success');
}

async function loadPaymentReport() {
  const period = document.getElementById('report-period').value;
  const table = document.getElementById('report-table'); table.textContent = 'Loading report...';
  try {
    const response = await fetch(`${API_BASE}/payments/report?period=${period}`, { headers: authHeaders() });
    if (handleAuthFailure(response) || !response.ok) throw new Error('Could not load report.');
    const report = await response.json();
    document.getElementById('report-title').textContent = `${period[0].toUpperCase() + period.slice(1)} payments`;
    const total = report.rows.reduce((sum, row) => sum + row.verifiedAmount, 0);
    document.getElementById('report-total').textContent = `${formatPaymentAmount(total)} verified`;
    table.replaceChildren();
    if (!report.rows.length) { table.textContent = 'No payments recorded for this period.'; return; }
    const headings = ['Period', 'Records', 'Submitted', 'Verified'];
    const header = document.createElement('div'); header.className = 'report-row report-header'; headings.forEach((heading) => { const cell = document.createElement('strong'); cell.textContent = heading; header.append(cell); }); table.append(header);
    report.rows.forEach((row) => { const line = document.createElement('div'); line.className = 'report-row'; [row.period, row.payments, formatPaymentAmount(row.totalAmount), formatPaymentAmount(row.verifiedAmount)].forEach((value) => { const cell = document.createElement('span'); cell.textContent = value; line.append(cell); }); table.append(line); });
  } catch (error) { table.textContent = 'Report is unavailable right now.'; }
}

document.getElementById('load-report').addEventListener('click', loadPaymentReport);
document.getElementById('print-report').addEventListener('click', () => window.print());

async function deleteCollection(id, name) {
  if (!confirm(`Delete "${name}"?`)) return;
  const response = await fetch(`${API_BASE}/collections/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (handleAuthFailure(response)) return;
  if (!response.ok && response.status !== 204) { alert('Could not delete product.'); return; }
  await loadCollections();
}

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
  try {
    const response = await fetch(`${API_BASE}/collections`);
    if (!response.ok) throw new Error('Could not load products.');
    collections = await response.json();
    renderAdminCollections();
  } catch (error) {
    listEl.textContent = 'Could not load products. Is the backend running?';
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

loadCollections();
loadDashboardSummary();
loadSettings();