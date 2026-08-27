const listEl = document.getElementById('admin-list');
const noCollections = document.getElementById('no-collections');
const form = document.getElementById('admin-form');
const logoutBtn = document.getElementById('logout-btn');

let collections = [];

// Logout functionality
logoutBtn.addEventListener('click', (e) => {
  e.preventDefault();
  if (confirm('Are you sure you want to logout?')) {
    sessionStorage.removeItem('sparkleAdminSession');
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
  collections.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'collection-row';

    const info = document.createElement('div');
    info.innerHTML = `
      <strong>${item.name}</strong><br>
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
    editBtn.addEventListener('click', () => editCollection(index));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-button';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => deleteCollection(index));

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    row.appendChild(info);
    row.appendChild(media);
    row.appendChild(actions);
    listEl.appendChild(row);
  });
}

function deleteCollection(index) {
  if (confirm(`Delete "${collections[index].name}"?`)) {
    collections.splice(index, 1);
    saveToLocalStorage();
    renderAdminCollections();
  }
}

function editCollection(index) {
  const item = collections[index];
  document.getElementById('admin-name').value = item.name;
  document.getElementById('admin-description').value = item.description;
  document.getElementById('admin-image').value = item.image || '';
  document.getElementById('admin-video').value = item.video || '';
  
  // Remove old item and reposition form
  collections.splice(index, 1);
  saveToLocalStorage();
  renderAdminCollections();
  
  // Scroll to form
  form.scrollIntoView({ behavior: 'smooth' });
}

function saveToLocalStorage() {
  localStorage.setItem('sparkleCollections', JSON.stringify(collections));
}

function loadFromLocalStorage() {
  const stored = localStorage.getItem('sparkleCollections');
  if (stored) {
    collections = JSON.parse(stored);
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const name = document.getElementById('admin-name').value.trim();
  const description = document.getElementById('admin-description').value.trim();
  const image = document.getElementById('admin-image').value.trim();
  const video = document.getElementById('admin-video').value.trim();
  
  if (name && description) {
    collections.push({ 
      name, 
      description, 
      image: image || '', 
      video: video || '' 
    });
    
    saveToLocalStorage();
    renderAdminCollections();
    form.reset();
    alert(`✓ "${name}" added successfully!`);
  }
});

// Initialize
loadFromLocalStorage();
renderAdminCollections();
