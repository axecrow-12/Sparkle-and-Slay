const listEl = document.getElementById('collection-list');
const emptyMessage = document.getElementById('empty-message');
const addForm = document.getElementById('add-collection-form');
const showAddBtn = document.getElementById('show-add-form');
const cancelAddBtn = document.getElementById('cancel-add');
const form = document.getElementById('collection-form');

let collections = [];
let cart = JSON.parse(localStorage.getItem('sparkleCart') || '[]').map((item) => ({
  ...item,
  quantity: Math.max(1, Number(item.quantity) || 1),
}));
const cartCount = document.getElementById('cart-count');
const viewCartBtn = document.getElementById('view-cart');
const cartPanel = document.getElementById('cart-panel');
const cartItems = document.getElementById('cart-items');
const closeCartBtn = document.getElementById('close-cart');
const checkoutCartBtn = document.getElementById('checkout-cart');
const cartToast = document.getElementById('cart-toast');
const toastCount = document.getElementById('toast-count');
const cartBackdrop = document.getElementById('cart-backdrop');
const cartTotal = document.getElementById('cart-total');
const currency = 'USD';
const ECOCASH_FEE_RATE = 0.013;
const IMTT_RATE = 0.02;

function formatPrice(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
    : 'Price on request';
}

function resolveMediaUrl(value) {
  if (!value) return '';
  if (value.startsWith('/uploads/')) return new URL(value, new URL(API_BASE).origin).href;
  return value;
}

function getCartQuantity() {
  return cart.reduce((total, item) => total + item.quantity, 0);
}

function calculateCartTotals() {
  const subtotal = cart.reduce((total, item) => total + (Number(item.price) || 0) * item.quantity, 0);
  const ecocashFee = subtotal * ECOCASH_FEE_RATE;
  const imttFee = subtotal * IMTT_RATE;

  return {
    subtotal,
    ecocashFee,
    imttFee,
    total: subtotal + ecocashFee + imttFee,
  };
}

function saveCart() {
  localStorage.setItem('sparkleCart', JSON.stringify(cart));
  renderCart();
}

function renderCart() {
  const quantity = getCartQuantity();
  const totals = calculateCartTotals();
  cartCount.textContent = quantity;
  toastCount.textContent = quantity;
  cartTotal.textContent = formatPrice(totals.total);
  cartItems.innerHTML = '';
  checkoutCartBtn.disabled = cart.length === 0;

  if (cart.length === 0) {
    cartItems.innerHTML = '<p class="cart-empty">Your cart is empty.</p>';
    return;
  }

  cart.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'cart-item';

    if (item.image) {
      const image = document.createElement('img');
      image.src = item.image;
      image.alt = `${item.name} preview`;
      row.appendChild(image);
    }

    const details = document.createElement('div');
    details.className = 'cart-item-details';

    const name = document.createElement('span');
    name.textContent = item.name;

    const itemSubtotal = document.createElement('small');
    itemSubtotal.className = 'cart-item-subtotal';
    itemSubtotal.textContent = formatPrice((Number(item.price) || 0) * item.quantity);

    const quantityControls = document.createElement('div');
    quantityControls.className = 'quantity-controls';

    const decreaseBtn = document.createElement('button');
    decreaseBtn.type = 'button';
    decreaseBtn.textContent = '-';
    decreaseBtn.setAttribute('aria-label', `Decrease ${item.name} quantity`);
    decreaseBtn.addEventListener('click', () => updateQuantity(index, -1));

    const quantityValue = document.createElement('span');
    quantityValue.textContent = item.quantity;
    quantityValue.setAttribute('aria-live', 'polite');

    const increaseBtn = document.createElement('button');
    increaseBtn.type = 'button';
    increaseBtn.textContent = '+';
    increaseBtn.setAttribute('aria-label', `Increase ${item.name} quantity`);
    increaseBtn.addEventListener('click', () => updateQuantity(index, 1));

    quantityControls.append(decreaseBtn, quantityValue, increaseBtn);
    details.append(name, itemSubtotal, quantityControls);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-cart-item';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => removeCartItem(index));

    row.append(details, removeBtn);
    cartItems.appendChild(row);
  });
}

function updateQuantity(index, change) {
  cart[index].quantity += change;
  if (cart[index].quantity <= 0) {
    cart.splice(index, 1);
  }
  saveCart();
  renderCollections();
}

function removeCartItem(index) {
  cart.splice(index, 1);
  saveCart();
  renderCollections();
}

function addToCart(item, toggle = true) {
  if (toggle && cart.some((cartItem) => String(cartItem.id) === String(item.id))) {
    cart = cart.filter((cartItem) => String(cartItem.id) !== String(item.id));
    saveCart();
    renderCollections();
    return;
  }

  cart.push({ id: item.id, name: item.name, image: item.image || '', price: Number(item.price) || 0, quantity: 1 });
  saveCart();
  renderCollections();
}

function openCartPanel() {
  cartPanel.hidden = false;
  cartBackdrop.hidden = false;
  cartPanel.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => {
    cartPanel.classList.add('is-open');
    cartBackdrop.classList.add('is-visible');
  });
}

function closeCartPanel() {
  cartPanel.classList.remove('is-open');
  cartBackdrop.classList.remove('is-visible');
  cartPanel.setAttribute('aria-hidden', 'true');
  setTimeout(() => {
    cartPanel.hidden = true;
    cartBackdrop.hidden = true;
  }, 240);
}

function addDraggedItem(event) {
  event.preventDefault();
  const item = JSON.parse(event.dataTransfer.getData('application/json'));
  if (item) {
    addToCart(item, false);
    openCartPanel();
  }
}

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
    card.draggable = true;
    card.addEventListener('dragstart', (event) => {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('application/json', JSON.stringify({
        id: item.id,
        name: item.name,
        image: item.image || '',
        price: Number(item.price) || 0,
      }));
      card.classList.add('is-dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('is-dragging'));

    // Media container
    const mediaContainer = document.createElement('div');
    mediaContainer.className = 'media-container';

    if (item.image) {
      const img = document.createElement('img');
      img.src = resolveMediaUrl(item.image);
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
      source.src = resolveMediaUrl(item.video);
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
    const price = document.createElement('p');
    price.className = 'product-price';
    price.textContent = formatPrice(item.price);
    card.appendChild(description);
    card.appendChild(price);

    const cartBtn = document.createElement('button');
    cartBtn.className = 'buy-button';
    const inCart = cart.some((cartItem) => String(cartItem.id) === String(item.id));
    cartBtn.textContent = inCart ? 'Remove from Cart' : 'Add to Cart';
    cartBtn.addEventListener('click', () => addToCart(item));
    card.appendChild(cartBtn);

    listEl.appendChild(card);
  });
}

let currentOrderItems = [];
const orderModal = document.getElementById('ecocash-order-modal');
const closeOrderModalBtn = document.getElementById('close-order-modal');
const cancelOrderBtn = document.getElementById('cancel-order');
const orderForm = document.getElementById('order-form');
const orderItemName = document.getElementById('order-item-name');
const orderConfirmation = document.getElementById('order-confirmation');

function openOrderModal() {
  currentOrderItems = [...cart];
  const totals = calculateCartTotals();
  orderItemName.textContent = `Selected items: ${currentOrderItems.map((item) => `${item.name} x${item.quantity}`).join(', ')}`;
  orderForm.style.display = 'block';
  orderConfirmation.style.display = 'none';
  orderForm.reset();
  document.getElementById('order-amount').value = formatPrice(totals.total);
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
  showAddBtn.style.display = '';
} else {
  showAddBtn.style.display = 'none';
}

listEl.innerHTML = '<div class="page-note"><p>Loading collections...</p></div>';
emptyMessage.style.display = 'none';

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
  const price = Number(document.getElementById('collection-price').value);

  if (!name || !description || !Number.isFinite(price) || price < 0) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/collections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, description, image, video, price }),
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
  if (currentOrderItems.length === 0) {
    return;
  }

  if (!USE_BACKEND) {
    orderForm.style.display = 'none';
    orderConfirmation.style.display = 'block';
    cart = [];
    currentOrderItems = [];
    saveCart();
    renderCollections();
    return;
  }

  const payload = {
    collectionId: currentOrderItems.length === 1 ? currentOrderItems[0].id : null,
    itemName: currentOrderItems.map((item) => `${item.name} x${item.quantity}`).join(', '),
    name: document.getElementById('order-name').value.trim(),
    phone: document.getElementById('order-phone').value.trim(),
    reference: document.getElementById('order-reference').value.trim(),
    amount: formatPrice(calculateCartTotals().total),
    address: document.getElementById('order-address').value.trim(),
    items: currentOrderItems.map((item) => ({
      collectionId: item.id,
      name: item.name,
      quantity: item.quantity,
    })),
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
    cart = [];
    currentOrderItems = [];
    saveCart();
    renderCollections();
  } catch (err) {
    alert('Could not reach the server. Is the backend running?');
  }
});

closeOrderModalBtn.addEventListener('click', closeOrderModal);
cancelOrderBtn.addEventListener('click', closeOrderModal);
viewCartBtn.addEventListener('click', openCartPanel);
closeCartBtn.addEventListener('click', () => {
  closeCartPanel();
});
cartToast.addEventListener('click', openCartPanel);
cartBackdrop.addEventListener('click', closeCartPanel);
viewCartBtn.addEventListener('dragover', (event) => event.preventDefault());
viewCartBtn.addEventListener('drop', addDraggedItem);
cartToast.addEventListener('dragover', (event) => {
  event.preventDefault();
  cartToast.classList.add('is-drag-over');
});
cartToast.addEventListener('dragleave', () => cartToast.classList.remove('is-drag-over'));
cartToast.addEventListener('drop', (event) => {
  cartToast.classList.remove('is-drag-over');
  addDraggedItem(event);
});
cartPanel.addEventListener('dragover', (event) => event.preventDefault());
cartPanel.addEventListener('drop', addDraggedItem);
checkoutCartBtn.addEventListener('click', () => {
  if (cart.length === 0) {
    return;
  }
  closeCartPanel();
  openOrderModal();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !cartPanel.hidden) {
    closeCartPanel();
  }
});
orderModal.addEventListener('click', (event) => {
  if (event.target === orderModal) {
    closeOrderModal();
  }
});

async function loadCollections() {
  if (!USE_BACKEND) {
    try {
      const fallbackResponse = await fetch('collections.json');
      if (!fallbackResponse.ok) {
        throw new Error('Could not load local collections.');
      }
      collections = await fallbackResponse.json();
      renderCollections();
    } catch (fallbackError) {
      showError('Could not load collections. Please try again later.');
    }
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/collections`);
    if (!response.ok) {
      throw new Error('Could not load collections.');
    }
    collections = await response.json();
    cart = cart.map((cartItem) => {
      const collection = collections.find((item) => String(item.id) === String(cartItem.id));
      return collection ? { ...cartItem, image: collection.image || cartItem.image || '', price: Number(collection.price) || 0 } : cartItem;
    });
    localStorage.setItem('sparkleCart', JSON.stringify(cart));
    renderCollections();
  } catch (err) {
    try {
      const fallbackResponse = await fetch('collections.json');
      if (!fallbackResponse.ok) {
        throw new Error('Could not load local collections.');
      }
      collections = await fallbackResponse.json();
      cart = cart.map((cartItem) => {
        const collection = collections.find((item) => String(item.id) === String(cartItem.id));
        return collection ? { ...cartItem, image: collection.image || cartItem.image || '', price: Number(collection.price) || 0 } : cartItem;
      });
      localStorage.setItem('sparkleCart', JSON.stringify(cart));
      renderCollections();
    } catch (fallbackError) {
      showError('Could not load collections. Please try again later.');
    }
  }
}

loadCollections();
renderCart();
