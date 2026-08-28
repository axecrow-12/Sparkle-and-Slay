const listEl = document.getElementById('collection-list');
const emptyMessage = document.getElementById('empty-message');
const addForm = document.getElementById('add-collection-form');
const showAddBtn = document.getElementById('show-add-form');
const cancelAddBtn = document.getElementById('cancel-add');
const form = document.getElementById('collection-form');

let collections = [];

function renderCollections() {
  listEl.innerHTML = '';
  if (collections.length === 0) {
    emptyMessage.style.display = 'block';
    return;
  }

  emptyMessage.style.display = 'none';
  collections.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'collection-card';

    // Media container
    const mediaContainer = document.createElement('div');
    mediaContainer.className = 'media-container';

    if (item.image) {
      const img = document.createElement('img');
      img.src = item.image;
      img.alt = item.name;
      img.onerror = () => img.style.display = 'none';
      mediaContainer.appendChild(img);
    }

    if (item.video) {
      const video = document.createElement('video');
      video.width = '100%';
      video.height = 'auto';
      video.controls = true;
      video.style.marginTop = item.image ? '0.5rem' : '0';
      const source = document.createElement('source');
      source.src = item.video;
      source.type = 'video/mp4';
      video.appendChild(source);
      video.appendChild(document.createTextNode('Your browser does not support the video tag.'));
      mediaContainer.appendChild(video);
    }

    const title = document.createElement('h4');
    title.textContent = item.name || 'Untitled Collection';

    const description = document.createElement('p');
    description.textContent = item.description || 'No description provided.';

    if (mediaContainer.children.length > 0) {
      card.appendChild(mediaContainer);
    }
    card.appendChild(title);
    card.appendChild(description);

    const orderBtn = document.createElement('button');
    orderBtn.className = 'buy-button';
    orderBtn.textContent = 'Order with Ecocash';
    orderBtn.addEventListener('click', () => openOrderModal(item));
    card.appendChild(orderBtn);

    listEl.appendChild(card);
  });
}

let currentOrderItem = null;
const orderModal = document.getElementById('ecocash-order-modal');
const closeOrderModalBtn = document.getElementById('close-order-modal');
const cancelOrderBtn = document.getElementById('cancel-order');
const orderForm = document.getElementById('order-form');
const orderItemName = document.getElementById('order-item-name');
const orderConfirmation = document.getElementById('order-confirmation');

function openOrderModal(item) {
  currentOrderItem = item;
  orderItemName.textContent = `Selected item: ${item.name}`;
  orderForm.style.display = 'block';
  orderConfirmation.style.display = 'none';
  orderForm.reset();
  orderModal.classList.add('active');
  orderModal.setAttribute('aria-hidden', 'false');
}

function closeOrderModal() {
  orderModal.classList.remove('active');
  orderModal.setAttribute('aria-hidden', 'true');
}

function showError(message) {
  listEl.innerHTML = `<div class="page-note"><p>${message}</p></div>`;
  emptyMessage.style.display = 'none';
}

// Event listeners for the (admin-only, token protected) add form
if (sessionStorage.getItem('sparkleAdminToken')) {
  document.querySelector('.section-actions').style.display = '';
} else {
  const actions = document.querySelector('.section-actions');
  if (actions) actions.style.display = 'none';
}

showAddBtn.addEventListener('click', () => {
  addForm.style.display = 'block';
  showAddBtn.style.display = 'none';
});

cancelAddBtn.addEventListener('click', () => {
  addForm.style.display = 'none';
  showAddBtn.style.display = 'inline-block';
  form.reset();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = sessionStorage.getItem('sparkleAdminToken');
  if (!token) {
    alert('Please log in as admin to add a collection.');
    window.location.href = 'login.html';
    return;
  }

  const name = document.getElementById('collection-name').value.trim();
  const description = document.getElementById('collection-description').value.trim();
  const image = document.getElementById('collection-image').value.trim();
  const video = document.getElementById('collection-video').value.trim();

  if (!name || !description) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/collections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, description, image, video }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      alert(data.error || 'Could not add collection.');
      return;
    }

    addForm.style.display = 'none';
    showAddBtn.style.display = 'inline-block';
    form.reset();
    await loadCollections();
  } catch (err) {
    alert('Could not reach the server. Is the backend running?');
  }
});

orderForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentOrderItem) {
    return;
  }

  const payload = {
    collectionId: currentOrderItem.id,
    itemName: currentOrderItem.name,
    name: document.getElementById('order-name').value.trim(),
    phone: document.getElementById('order-phone').value.trim(),
    reference: document.getElementById('order-reference').value.trim(),
    amount: document.getElementById('order-amount').value.trim(),
    address: document.getElementById('order-address').value.trim(),
  };

  if (!payload.name || !payload.phone || !payload.reference || !payload.amount) {
    alert('Please complete the order form before submitting.');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      alert(data.error || 'Could not submit order. Please try again.');
      return;
    }

    orderForm.style.display = 'none';
    orderConfirmation.style.display = 'block';
    currentOrderItem = null;
  } catch (err) {
    alert('Could not reach the server. Is the backend running?');
  }
});

closeOrderModalBtn.addEventListener('click', closeOrderModal);
cancelOrderBtn.addEventListener('click', closeOrderModal);
orderModal.addEventListener('click', (event) => {
  if (event.target === orderModal) {
    closeOrderModal();
  }
});

async function loadCollections() {
  try {
    const response = await fetch(`${API_BASE}/collections`);
    if (!response.ok) {
      throw new Error('Could not load collections.');
    }
    collections = await response.json();
    renderCollections();
  } catch (err) {
    showError('Could not load collections. Is the backend running?');
  }
}

loadCollections();
