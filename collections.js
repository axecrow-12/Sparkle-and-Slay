const listEl = document.getElementById('collection-list');
const emptyMessage = document.getElementById('empty-message');
const collectionsFile = 'collections.json';
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
  collections.forEach((item, index) => {
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

    const buyBtn = document.createElement('button');
    buyBtn.className = 'buy-button';
    buyBtn.textContent = 'Buy Now';
    buyBtn.addEventListener('click', () => openOrderModal(item));

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-button';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => removeCollection(index));

    if (mediaContainer.children.length > 0) {
      card.appendChild(mediaContainer);
    }
    card.appendChild(title);
    card.appendChild(description);
    card.appendChild(buyBtn);
    const orderBtn = document.createElement('button');
    orderBtn.className = 'buy-button';
    orderBtn.textContent = 'Order with Ecocash';
    orderBtn.addEventListener('click', () => openOrderModal(item));
    card.appendChild(orderBtn);
    card.appendChild(removeBtn);
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

function loadOrders() {
  try {
    return JSON.parse(localStorage.getItem('sparkleOrders') || '[]');
  } catch {
    return [];
  }
}

function saveOrder(order) {
  const orders = loadOrders();
  orders.push(order);
  localStorage.setItem('sparkleOrders', JSON.stringify(orders));
}

function removeCollection(index) {
  if (confirm('Are you sure you want to remove this collection?')) {
    collections.splice(index, 1);
    saveCollections();
    renderCollections();
  }
}

function saveCollections() {
  localStorage.setItem('sparkleCollections', JSON.stringify(collections));
}

function loadCollections() {
  const stored = localStorage.getItem('sparkleCollections');
  if (stored) {
    collections = JSON.parse(stored);
  }
}

function showError(message) {
  listEl.innerHTML = `<div class="page-note"><p>${message}</p></div>`;
  emptyMessage.style.display = 'none';
}

function mergeCollections(jsonCollections) {
  const baseCollections = Array.isArray(jsonCollections) ? jsonCollections : [];
  const storedCollections = JSON.parse(localStorage.getItem('sparkleCollections') || '[]');
  collections = [...baseCollections, ...storedCollections];
}

// Event listeners
showAddBtn.addEventListener('click', () => {
  addForm.style.display = 'block';
  showAddBtn.style.display = 'none';
});

cancelAddBtn.addEventListener('click', () => {
  addForm.style.display = 'none';
  showAddBtn.style.display = 'inline-block';
  form.reset();
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('collection-name').value.trim();
  const description = document.getElementById('collection-description').value.trim();
  const image = document.getElementById('collection-image').value.trim();
  const video = document.getElementById('collection-video').value.trim();
  if (name && description) {
    collections.push({ name, description, image, video });
    saveCollections();
    renderCollections();
    addForm.style.display = 'none';
    showAddBtn.style.display = 'inline-block';
    form.reset();
  }
});

orderForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!currentOrderItem) {
    return;
  }

  const order = {
    item: currentOrderItem.name,
    name: document.getElementById('order-name').value.trim(),
    phone: document.getElementById('order-phone').value.trim(),
    reference: document.getElementById('order-reference').value.trim(),
    amount: document.getElementById('order-amount').value.trim(),
    address: document.getElementById('order-address').value.trim(),
    timestamp: new Date().toISOString(),
  };

  if (!order.name || !order.phone || !order.reference || !order.amount) {
    alert('Please complete the order form before submitting.');
    return;
  }

  saveOrder(order);
  orderForm.style.display = 'none';
  orderConfirmation.style.display = 'block';
  currentOrderItem = null;
});

closeOrderModalBtn.addEventListener('click', closeOrderModal);
cancelOrderBtn.addEventListener('click', closeOrderModal);
orderModal.addEventListener('click', (event) => {
  if (event.target === orderModal) {
    closeOrderModal();
  }
});

// Load collections
fetch(collectionsFile)
  .then((response) => {
    if (!response.ok) {
      throw new Error('Could not load collections.json.');
    }
    return response.json();
  })
  .then((jsonCollections) => {
    mergeCollections(jsonCollections);
    renderCollections();
  })
  .catch(() => {
    loadCollections();
    renderCollections();
  });
