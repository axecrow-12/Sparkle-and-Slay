const listEl = document.getElementById('admin-list');
const noCollections = document.getElementById('no-collections');
const form = document.getElementById('admin-form');
const logoutBtn = document.getElementById('logout-btn');

const token = sessionStorage.getItem('sparkleAdminToken');
let collections = [];
let editingId = null;

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

function handleAuthFailure(response) {
  if (response.status === 401) {
    sessionStorage.removeItem('sparkleAdminToken');
    alert('Your session has expired. Please log in again.');
    window.location.href = 'login.html';
    return true;
  }
  return false;
}

// Logout functionality
logoutBtn.addEventListener('click', (e) => {
  e.preventDefault();
  if (confirm('Are you sure you want to logout?')) {
    sessionStorage.removeItem('sparkleAdminToken');
    window.location.href = 'login.html';
  }
});

function renderAdminCollections() {
  listEl.innerHTML = '';
  if (collections.length === 0) {
    noCollections.style.display = 'block';
    return;
  }

  noCollections.style.display = 'none';
  collections.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'collection-row';

    const info = document.createElement('div');
    info.innerHTML = `
      <strong>${item.name}</strong><br>
      <small>${item.price !== null && item.price !== undefined ? `$${Number(item.price).toFixed(2)}` : 'Price on request'}</small><br>
      <small>${item.description.substring(0, 60)}${item.description.length > 60 ? '...' : ''}</small>
    `;

    const media = document.createElement('div');
    media.innerHTML = `
      <small>
        ${item.image ? '📷 Image' : ''} 
        ${item.image && item.video ? ' | ' : ''}
        ${item.video ? '🎥 Video' : ''}
      </small>
    `;

    const actions = document.createElement('div');
    actions.className = 'action-buttons';

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-button';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => editCollection(item));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-button';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => deleteCollection(item.id, item.name));

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    row.appendChild(info);
    row.appendChild(media);
    row.appendChild(actions);
    listEl.appendChild(row);
  });
}

async function deleteCollection(id, name) {
  if (!confirm(`Delete "${name}"?`)) {
    return;
  }

  const response = await fetch(`${API_BASE}/collections/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  if (handleAuthFailure(response)) return;

  if (!response.ok && response.status !== 204) {
    alert('Could not delete collection.');
    return;
  }

  await loadCollections();
}

function editCollection(item) {
  editingId = item.id;
  document.getElementById('admin-name').value = item.name;
  document.getElementById('admin-description').value = item.description;
  document.getElementById('admin-price').value = item.price ?? '';
  document.getElementById('admin-image').value = item.image || '';
  document.getElementById('admin-video').value = item.video || '';
  form.querySelector('button[type="submit"]').textContent = 'Save Changes';
  form.scrollIntoView({ behavior: 'smooth' });
}

async function loadCollections() {
  try {
    const response = await fetch(`${API_BASE}/collections`);
    if (!response.ok) {
      throw new Error('Could not load collections.');
    }
    collections = await response.json();
    renderAdminCollections();
  } catch (err) {
    listEl.innerHTML = '<p>Could not load collections. Is the backend running?</p>';
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('admin-name').value.trim();
  const description = document.getElementById('admin-description').value.trim();
  const price = Number(document.getElementById('admin-price').value);
  const image = document.getElementById('admin-image').value.trim();
  const video = document.getElementById('admin-video').value.trim();

  if (!name || !description || !Number.isFinite(price) || price < 0) {
    return;
  }

  const payload = { name, description, image, video, price };
  const isEditing = editingId !== null;
  const url = isEditing ? `${API_BASE}/collections/${editingId}` : `${API_BASE}/collections`;
  const method = isEditing ? 'PUT' : 'POST';

  try {
    const response = await fetch(url, {
      method,
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });

    if (handleAuthFailure(response)) return;

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      alert(data.error || 'Could not save collection.');
      return;
    }

    editingId = null;
    form.querySelector('button[type="submit"]').textContent = 'Add Collection';
    form.reset();
    alert(`✓ "${name}" ${isEditing ? 'updated' : 'added'} successfully!`);
    await loadCollections();
  } catch (err) {
    alert('Could not reach the server. Is the backend running?');
  }
});

// Initialize
listEl.innerHTML = '<p>Loading collections...</p>';
loadCollections();
