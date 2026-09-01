const listEl = document.getElementById('collection-list');
const emptyMessage = document.getElementById('empty-message');
const addForm = document.getElementById('add-collection-form');
const showAddBtn = document.getElementById('show-add-form');
const cancelAddBtn = document.getElementById('cancel-add');
const form = document.getElementById('collection-form');
const searchInput = document.getElementById('collection-search');
const resultsMessage = document.getElementById('collection-results');

SparkleUI.setupMenu(document.getElementById('shop-menu-toggle'), document.getElementById('shop-nav'));

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
const apiCheckoutCartBtn = document.getElementById('api-checkout-cart');
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

function parseVariantList(value) {
  return String(value || '').split(',').map((part) => part.trim()).filter(Boolean);
}

const COLOR_KEYWORDS = {
  charcoal: '#36454f',
  'charcoal gray': '#36454f',
  'charcoal grey': '#36454f',
  navy: '#1b2a4a',
  ivory: '#fffff0',
  cream: '#fffdd0',
  blush: '#f4c2c2',
  olive: '#708238',
  mustard: '#e1ad01',
  khaki: '#c3b091',
  camel: '#c19a6b',
  denim: '#1f4287',
  mint: '#98ff98',
};

function resolveSwatchColor(name) {
  const key = name.trim().toLowerCase();
  if (COLOR_KEYWORDS[key]) return COLOR_KEYWORDS[key];
  if (typeof CSS !== 'undefined' && CSS.supports && CSS.supports('color', key)) return key;
  return '#c7d0cb';
}

function renderStarIcons(rating) {
  const rounded = Math.round(Number(rating) || 0);
  return Array.from({ length: 5 }, (_, index) => (
    index < rounded
      ? '<i class="fa-solid fa-star" aria-hidden="true"></i>'
      : '<i class="fa-regular fa-star is-empty" aria-hidden="true"></i>'
  )).join('');
}

function cartLineMatches(cartItem, id, color, size) {
  return String(cartItem.id) === String(id)
    && (cartItem.color || '') === (color || '')
    && (cartItem.size || '') === (size || '');
}

function findCartIndex(item, color = '', size = '') {
  return cart.findIndex((cartItem) => cartLineMatches(cartItem, item.id, color, size));
}

function cartItemLabel(item) {
  const variant = [item.color, item.size].filter(Boolean).join(' / ');
  return variant ? `${item.name} (${variant})` : item.name;
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
  apiCheckoutCartBtn.disabled = cart.length === 0;

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

    const variantParts = [item.color, item.size].filter(Boolean);
    const variantCaption = variantParts.length ? document.createElement('small') : null;
    if (variantCaption) {
      variantCaption.className = 'cart-item-variant';
      variantCaption.textContent = variantParts.join(' · ');
    }

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
    details.append(name);
    if (variantCaption) details.append(variantCaption);
    details.append(itemSubtotal, quantityControls);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-cart-item';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => removeCartItem(index));

    row.append(details, removeBtn);
    cartItems.appendChild(row);
  });
}

function getFilteredCollections() {
  const query = searchInput?.value.trim().toLowerCase() || '';
  if (!query) return collections;
  return collections.filter((item) => `${item.name || ''} ${item.description || ''}`.toLowerCase().includes(query));
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

function addToCart(item, toggle = true, color = '', size = '') {
  const existingIndex = findCartIndex(item, color, size);
  if (toggle && existingIndex !== -1) {
    cart.splice(existingIndex, 1);
    saveCart();
    renderCollections();
    SparkleUI.announce(resultsMessage, `${item.name} removed from your cart.`, 'info');
    return;
  }

  cart.push({ id: item.id, name: item.name, image: item.image || '', price: Number(item.price) || 0, quantity: 1, color: color || '', size: size || '' });
  saveCart();
  renderCollections();
  SparkleUI.announce(resultsMessage, `${item.name} added to your cart. ${getCartQuantity()} item${getCartQuantity() === 1 ? '' : 's'} selected.`, 'success');
}

function openCartPanel() {
  activeDialogOpener = document.activeElement;
  cartPanel.hidden = false;
  cartBackdrop.hidden = false;
  cartPanel.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => {
    cartPanel.classList.add('is-open');
    cartBackdrop.classList.add('is-visible');
    closeCartBtn.focus();
  });
}

function closeCartPanel(restoreFocus = true) {
  cartPanel.classList.remove('is-open');
  cartBackdrop.classList.remove('is-visible');
  cartPanel.setAttribute('aria-hidden', 'true');
  setTimeout(() => {
    cartPanel.hidden = true;
    cartBackdrop.hidden = true;
    if (restoreFocus) restoreDialogFocus();
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
  const filteredCollections = getFilteredCollections();
  const query = searchInput?.value.trim() || '';
  if (collections.length === 0) {
    emptyMessage.style.display = 'block';
    SparkleUI.announce(resultsMessage, 'No products are available yet.', 'info');
    return;
  }

  emptyMessage.style.display = 'none';
  if (!filteredCollections.length) {
    listEl.innerHTML = '<div class="page-note"><p>No products match that search. Try a different name or description.</p></div>';
    SparkleUI.announce(resultsMessage, `No products match "${query}".`, 'info');
    return;
  }

  SparkleUI.announce(resultsMessage, `${filteredCollections.length} product${filteredCollections.length === 1 ? '' : 's'} shown${query ? ` for "${query}"` : ''}.`, 'info');
  filteredCollections.forEach((item) => {
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

    const quickviewHint = document.createElement('span');
    quickviewHint.className = 'quickview-hint';
    quickviewHint.setAttribute('aria-hidden', 'true');
    quickviewHint.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>';
    if (mediaContainer.children.length > 0) {
      mediaContainer.appendChild(quickviewHint);
    }

    const quickviewTrigger = document.createElement('button');
    quickviewTrigger.type = 'button';
    quickviewTrigger.className = 'card-quickview-trigger';
    quickviewTrigger.setAttribute('aria-label', `View details for ${item.name || 'this product'}`);
    quickviewTrigger.addEventListener('click', () => openQuickview(item));

    const title = document.createElement('h4');
    title.textContent = item.name || 'Untitled Collection';

    const description = document.createElement('p');
    description.textContent = item.description || 'No description provided.';

    if (mediaContainer.children.length > 0) {
      quickviewTrigger.appendChild(mediaContainer);
    }
    quickviewTrigger.appendChild(title);

    if (Number(item.rating_count) > 0) {
      const ratingRow = document.createElement('div');
      ratingRow.className = 'rating-row';
      const stars = document.createElement('span');
      stars.className = 'rating-stars';
      stars.setAttribute('aria-hidden', 'true');
      stars.innerHTML = renderStarIcons(item.rating_average);
      const ratingText = document.createElement('span');
      ratingText.textContent = `(${item.rating_count})`;
      ratingRow.append(stars, ratingText);
      quickviewTrigger.appendChild(ratingRow);
    }

    const price = document.createElement('p');
    price.className = 'product-price';
    price.textContent = formatPrice(item.price);
    quickviewTrigger.appendChild(description);
    quickviewTrigger.appendChild(price);
    card.appendChild(quickviewTrigger);

    const colors = parseVariantList(item.colors);
    const sizes = parseVariantList(item.sizes);
    const hasVariants = colors.length > 0 || sizes.length > 0;
    card.draggable = !hasVariants;

    const cartBtn = document.createElement('button');
    cartBtn.className = 'buy-button';
    if (hasVariants) {
      cartBtn.textContent = 'Select options';
      cartBtn.dataset.selectOptions = 'true';
      cartBtn.addEventListener('click', () => openQuickview(item));
    } else {
      const inCart = findCartIndex(item) !== -1;
      cartBtn.textContent = inCart ? 'Remove from Cart' : 'Add to Cart';
      cartBtn.addEventListener('click', () => addToCart(item));
    }
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
const apiOrderModal = document.getElementById('ecocash-api-modal');
const apiOrderForm = document.getElementById('api-order-form');
const apiOrderItemName = document.getElementById('api-order-item-name');
const apiOrderAmount = document.getElementById('api-order-amount');
const apiOrderStatus = document.getElementById('api-order-status');
const apiOrderSubmit = document.getElementById('api-order-submit');
let apiCheckoutTimer;
let activeDialogOpener = null;
let quickviewItem = null;
const quickviewModal = document.getElementById('quickview-modal');
const quickviewMedia = document.getElementById('quickview-media');
const quickviewTitleEl = document.getElementById('quickview-title');
const quickviewPriceEl = document.getElementById('quickview-price');
const quickviewDescriptionEl = document.getElementById('quickview-description');
const quickviewStockEl = document.getElementById('quickview-stock');
const quickviewCartBtn = document.getElementById('quickview-cart-btn');
const quickviewQuantityRow = document.getElementById('quickview-quantity-row');
const quickviewQuantityEl = document.getElementById('quickview-quantity');
const quickviewRatingRow = document.getElementById('quickview-rating');
const quickviewRatingStars = quickviewRatingRow.querySelector('.rating-stars');
const quickviewRatingText = document.getElementById('quickview-rating-text');
const quickviewColorsGroup = document.getElementById('quickview-colors');
const quickviewColorValue = document.getElementById('quickview-color-value');
const quickviewColorOptions = document.getElementById('quickview-color-options');
const quickviewSizesGroup = document.getElementById('quickview-sizes');
const quickviewSizeValue = document.getElementById('quickview-size-value');
const quickviewSizeOptions = document.getElementById('quickview-size-options');
const quickviewSelectionHint = document.getElementById('quickview-selection-hint');
let quickviewSelectedColor = '';
let quickviewSelectedSize = '';

function updateQuickviewCartButton() {
  if (!quickviewItem) return;
  const index = findCartIndex(quickviewItem, quickviewSelectedColor, quickviewSelectedSize);
  quickviewCartBtn.textContent = index === -1 ? 'Add to Cart' : 'Remove from Cart';
  quickviewQuantityRow.hidden = index === -1;
  if (index !== -1) {
    quickviewQuantityEl.textContent = cart[index].quantity;
  }
}

function renderQuickviewVariantGroup(group, valueEl, optionsEl, values, selected, optionClass, onSelect) {
  if (!values.length) {
    group.hidden = true;
    return;
  }
  group.hidden = false;
  valueEl.textContent = selected;
  optionsEl.innerHTML = '';
  values.forEach((value) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = optionClass;
    if (optionClass === 'color-swatch') {
      option.style.backgroundColor = resolveSwatchColor(value);
      option.title = value;
      option.setAttribute('aria-label', `Select color ${value}`);
    } else {
      option.textContent = value;
    }
    option.setAttribute('aria-pressed', String(value === selected));
    option.classList.toggle('is-selected', value === selected);
    option.addEventListener('click', () => {
      valueEl.textContent = value;
      optionsEl.querySelectorAll(`.${optionClass}`).forEach((el) => {
        const isSelected = el === option;
        el.classList.toggle('is-selected', isSelected);
        el.setAttribute('aria-pressed', String(isSelected));
      });
      onSelect(value);
    });
    optionsEl.appendChild(option);
  });
}

function openQuickview(item) {
  quickviewItem = item;
  quickviewMedia.innerHTML = '';

  if (item.image) {
    const img = document.createElement('img');
    img.src = resolveMediaUrl(item.image);
    img.alt = item.name || 'Product photo';
    img.onerror = () => img.style.display = 'none';
    quickviewMedia.appendChild(img);
  }

  if (item.video) {
    const video = document.createElement('video');
    video.controls = true;
    const source = document.createElement('source');
    source.src = resolveMediaUrl(item.video);
    source.type = 'video/mp4';
    video.appendChild(source);
    quickviewMedia.appendChild(video);
  }

  quickviewTitleEl.textContent = item.name || 'Untitled Collection';
  quickviewPriceEl.textContent = formatPrice(item.price);
  quickviewDescriptionEl.textContent = item.description || 'No description provided.';
  quickviewSelectionHint.hidden = true;

  if (Number(item.rating_count) > 0) {
    quickviewRatingRow.hidden = false;
    quickviewRatingStars.innerHTML = renderStarIcons(item.rating_average);
    const count = Number(item.rating_count);
    quickviewRatingText.textContent = `${Number(item.rating_average).toFixed(1)} (${count} rating${count === 1 ? '' : 's'})`;
  } else {
    quickviewRatingRow.hidden = true;
  }

  const colors = parseVariantList(item.colors);
  const sizes = parseVariantList(item.sizes);
  quickviewSelectedColor = colors[0] || '';
  quickviewSelectedSize = sizes[0] || '';

  renderQuickviewVariantGroup(quickviewColorsGroup, quickviewColorValue, quickviewColorOptions, colors, quickviewSelectedColor, 'color-swatch', (value) => {
    quickviewSelectedColor = value;
    updateQuickviewCartButton();
  });
  renderQuickviewVariantGroup(quickviewSizesGroup, quickviewSizeValue, quickviewSizeOptions, sizes, quickviewSelectedSize, 'size-option', (value) => {
    quickviewSelectedSize = value;
    updateQuickviewCartButton();
  });

  if (item.stock_status === 'out_of_stock') {
    quickviewStockEl.hidden = false;
    quickviewStockEl.textContent = 'Out of stock';
    quickviewStockEl.dataset.tone = 'out';
  } else if (item.stock_status === 'low_stock') {
    quickviewStockEl.hidden = false;
    quickviewStockEl.textContent = 'Low stock';
    quickviewStockEl.dataset.tone = 'low';
  } else {
    quickviewStockEl.hidden = true;
  }

  updateQuickviewCartButton();
  quickviewModal.classList.add('active');
  quickviewModal.setAttribute('aria-hidden', 'false');
  focusDialog(quickviewModal);
}

function closeQuickview() {
  quickviewModal.classList.remove('active');
  quickviewModal.setAttribute('aria-hidden', 'true');
  restoreDialogFocus();
}

quickviewCartBtn.addEventListener('click', () => {
  if (!quickviewItem) return;
  const colors = parseVariantList(quickviewItem.colors);
  const sizes = parseVariantList(quickviewItem.sizes);
  if (colors.length && !quickviewSelectedColor) {
    quickviewSelectionHint.hidden = false;
    quickviewSelectionHint.textContent = 'Please select a color.';
    return;
  }
  if (sizes.length && !quickviewSelectedSize) {
    quickviewSelectionHint.hidden = false;
    quickviewSelectionHint.textContent = 'Please select a size.';
    return;
  }
  quickviewSelectionHint.hidden = true;
  addToCart(quickviewItem, true, quickviewSelectedColor, quickviewSelectedSize);
  updateQuickviewCartButton();
});
document.getElementById('quickview-increase').addEventListener('click', () => {
  if (!quickviewItem) return;
  const index = findCartIndex(quickviewItem, quickviewSelectedColor, quickviewSelectedSize);
  if (index !== -1) {
    updateQuantity(index, 1);
    updateQuickviewCartButton();
  }
});
document.getElementById('quickview-decrease').addEventListener('click', () => {
  if (!quickviewItem) return;
  const index = findCartIndex(quickviewItem, quickviewSelectedColor, quickviewSelectedSize);
  if (index !== -1) {
    updateQuantity(index, -1);
    updateQuickviewCartButton();
  }
});
document.getElementById('close-quickview-modal').addEventListener('click', closeQuickview);
quickviewModal.addEventListener('click', (event) => {
  if (event.target === quickviewModal) closeQuickview();
});

function focusDialog(dialog) {
  activeDialogOpener ||= document.activeElement;
  requestAnimationFrame(() => dialog.querySelector('.modal-close')?.focus());
}

function restoreDialogFocus() {
  activeDialogOpener?.focus();
  activeDialogOpener = null;
}

function openOrderModal() {
  currentOrderItems = [...cart];
  const totals = calculateCartTotals();
  orderItemName.textContent = `Selected items: ${currentOrderItems.map((item) => `${cartItemLabel(item)} x${item.quantity}`).join(', ')}`;
  orderForm.style.display = 'block';
  orderConfirmation.style.display = 'none';
  orderForm.reset();
  document.getElementById('order-amount').value = formatPrice(totals.total);
  orderModal.classList.add('active');
  orderModal.setAttribute('aria-hidden', 'false');
  focusDialog(orderModal);
}

function closeOrderModal() {
  orderModal.classList.remove('active');
  orderModal.setAttribute('aria-hidden', 'true');
  restoreDialogFocus();
}

function openApiOrderModal() {
  currentOrderItems = [...cart];
  const totals = calculateCartTotals();
  apiOrderItemName.textContent = `Selected items: ${currentOrderItems.map((item) => `${cartItemLabel(item)} x${item.quantity}`).join(', ')}`;
  apiOrderAmount.textContent = formatPrice(totals.total);
  apiOrderStatus.hidden = true;
  apiOrderStatus.textContent = '';
  apiOrderSubmit.disabled = false;
  apiOrderSubmit.textContent = 'Send payment request';
  apiOrderForm.reset();
  apiOrderAmount.textContent = formatPrice(totals.total);
  apiOrderModal.classList.add('active');
  apiOrderModal.setAttribute('aria-hidden', 'false');
  focusDialog(apiOrderModal);
}

function closeApiOrderModal() {
  window.clearInterval(apiCheckoutTimer);
  apiOrderModal.classList.remove('active');
  apiOrderModal.setAttribute('aria-hidden', 'true');
  restoreDialogFocus();
}

function showApiOrderStatus(message) {
  apiOrderStatus.hidden = false;
  apiOrderStatus.textContent = message;
}

function clearCompletedCart() {
  cart = [];
  currentOrderItems = [];
  saveCart();
  renderCollections();
}

async function watchApiCheckout(checkoutToken) {
  let attempts = 0;
  window.clearInterval(apiCheckoutTimer);
  const checkStatus = async () => {
    attempts += 1;
    try {
      const response = await fetch(`${API_BASE}/checkout/${checkoutToken}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not check payment status.');
      if (data.status === 'verified') {
        window.clearInterval(apiCheckoutTimer);
        showApiOrderStatus('Payment confirmed. Thank you for your order.');
        apiOrderSubmit.disabled = true;
        clearCompletedCart();
      } else if (data.status === 'rejected') {
        window.clearInterval(apiCheckoutTimer);
        showApiOrderStatus('EcoCash could not complete this payment. Please try again or use manual payment.');
        apiOrderSubmit.disabled = false;
        apiOrderSubmit.textContent = 'Try again';
      } else if (attempts >= 30) {
        window.clearInterval(apiCheckoutTimer);
        showApiOrderStatus('Payment is still pending. Please keep your phone available and contact us if it does not complete.');
        apiOrderSubmit.disabled = false;
      } else {
        showApiOrderStatus('Payment request sent. Approve it on your phone; waiting for confirmation...');
      }
    } catch (error) {
      window.clearInterval(apiCheckoutTimer);
      showApiOrderStatus(error.message);
      apiOrderSubmit.disabled = false;
    }
  };
  await checkStatus();
  apiCheckoutTimer = window.setInterval(checkStatus, 2000);
}

function showError(message) {
  listEl.innerHTML = `<div class="page-note"><p>${message}</p></div>`;
  emptyMessage.style.display = 'none';
  SparkleUI.announce(resultsMessage, message, 'error');
}

// Event listeners for the (admin-only, token protected) add form
if (sessionStorage.getItem('sparkleAdminToken')) {
  showAddBtn.style.display = '';
} else {
  showAddBtn.style.display = 'none';
}

listEl.innerHTML = '<div class="loading-skeleton" aria-label="Loading collections"></div>';
emptyMessage.style.display = 'none';

const clearSearchBtn = document.getElementById('clear-search');
searchInput?.addEventListener('input', () => {
  if (clearSearchBtn) clearSearchBtn.hidden = !searchInput.value;
  renderCollections();
});
clearSearchBtn?.addEventListener('click', () => {
  searchInput.value = '';
  clearSearchBtn.hidden = true;
  searchInput.focus();
  renderCollections();
});

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
    SparkleUI.announce(resultsMessage, 'Please log in as admin to add a collection.', 'warning');
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
      SparkleUI.announce(resultsMessage, data.error || 'Could not add collection.', 'error');
      return;
    }

    addForm.style.display = 'none';
    showAddBtn.style.display = 'inline-block';
    form.reset();
    await loadCollections();
  } catch (err) {
    SparkleUI.announce(resultsMessage, 'Could not reach the server. Please try again shortly.', 'error');
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
    itemName: currentOrderItems.map((item) => `${cartItemLabel(item)} x${item.quantity}`).join(', '),
    name: document.getElementById('order-name').value.trim(),
    phone: document.getElementById('order-phone').value.trim(),
    reference: document.getElementById('order-reference').value.trim(),
    amount: formatPrice(calculateCartTotals().total),
    address: document.getElementById('order-address').value.trim(),
    items: currentOrderItems.map((item) => ({
      collectionId: item.id,
      name: cartItemLabel(item),
      quantity: item.quantity,
    })),
  };

  if (!payload.name || !payload.phone || !payload.reference || !payload.amount) {
    const status = document.getElementById('order-confirmation');
    status.style.display = 'block';
    status.dataset.status = 'error';
    status.textContent = 'Please complete the required order details before submitting.';
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
      const status = document.getElementById('order-confirmation');
      status.style.display = 'block';
      status.dataset.status = 'error';
      status.textContent = data.error || 'Could not submit order. Please try again.';
      return;
    }

    orderForm.style.display = 'none';
    orderConfirmation.style.display = 'block';
    cart = [];
    currentOrderItems = [];
    saveCart();
    renderCollections();
  } catch (err) {
    const status = document.getElementById('order-confirmation');
    status.style.display = 'block';
    status.dataset.status = 'error';
    status.textContent = 'Could not reach the server. Please try again shortly.';
  }
});

apiOrderForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!USE_BACKEND || currentOrderItems.length === 0) {
    showApiOrderStatus('Automated EcoCash checkout requires the PHP backend.');
    return;
  }
  apiOrderSubmit.disabled = true;
  apiOrderSubmit.textContent = 'Connecting to EcoCash...';
  showApiOrderStatus('Creating your secure payment request...');
  const idempotencyKey = `${Date.now()}-${crypto.randomUUID()}`;
  const payload = {
    name: document.getElementById('api-order-name').value.trim(),
    phone: document.getElementById('api-order-phone').value.trim(),
    address: document.getElementById('api-order-address').value.trim(),
    idempotencyKey,
    items: currentOrderItems.map((item) => ({ collectionId: item.id, quantity: item.quantity })),
  };
  try {
    const response = await fetch(`${API_BASE}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not start EcoCash payment.');
    apiOrderAmount.textContent = formatPrice(data.amount);
    apiOrderSubmit.textContent = 'Payment pending...';
    await watchApiCheckout(data.checkoutToken);
  } catch (error) {
    apiOrderSubmit.disabled = false;
    apiOrderSubmit.textContent = 'Send payment request';
    showApiOrderStatus(error.message);
  }
});

closeOrderModalBtn.addEventListener('click', closeOrderModal);
cancelOrderBtn.addEventListener('click', closeOrderModal);
document.getElementById('close-api-order-modal').addEventListener('click', closeApiOrderModal);
document.getElementById('cancel-api-order').addEventListener('click', closeApiOrderModal);
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
  closeCartPanel(false);
  openOrderModal();
});
apiCheckoutCartBtn.addEventListener('click', () => {
  if (cart.length === 0) return;
  closeCartPanel(false);
  openApiOrderModal();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !cartPanel.hidden) {
    closeCartPanel();
  }
  if (event.key === 'Escape' && orderModal.classList.contains('active')) {
    closeOrderModal();
  }
  if (event.key === 'Escape' && apiOrderModal.classList.contains('active')) {
    closeApiOrderModal();
  }
  if (event.key === 'Escape' && quickviewModal.classList.contains('active')) {
    closeQuickview();
  }
});
orderModal.addEventListener('click', (event) => {
  if (event.target === orderModal) {
    closeOrderModal();
  }
});
apiOrderModal.addEventListener('click', (event) => {
  if (event.target === apiOrderModal) closeApiOrderModal();
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
