window.SparkleUI = (() => {
  const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function announce(element, message, type = 'info') {
    if (!element) return;
    element.textContent = message;
    element.dataset.status = type;
    element.hidden = !message;
  }

  function setBusy(button, busy, busyText) {
    if (!button) return;
    if (busy) {
      button.dataset.label = button.textContent;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      if (busyText) button.textContent = busyText;
      return;
    }

    button.disabled = false;
    button.removeAttribute('aria-busy');
    if (button.dataset.label) {
      button.textContent = button.dataset.label;
      delete button.dataset.label;
    }
  }

  function clearFieldError(input) {
    if (!input) return;
    input.removeAttribute('aria-invalid');
    const error = document.getElementById(`${input.id}-error`);
    if (error) {
      error.textContent = '';
      error.hidden = true;
    }
  }

  function setFieldError(input, message) {
    if (!input) return;
    const error = document.getElementById(`${input.id}-error`);
    input.setAttribute('aria-invalid', 'true');
    if (error) {
      error.textContent = message;
      error.hidden = false;
      input.setAttribute('aria-describedby', error.id);
    }
  }

  function validateRequired(inputs) {
    let firstInvalid = null;
    inputs.forEach((input) => {
      clearFieldError(input);
      if (!input.checkValidity()) {
        const message = input.validationMessage || 'Please complete this field.';
        setFieldError(input, message);
        firstInvalid ||= input;
      }
    });
    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  }

  function createDialog(dialog, { onClose } = {}) {
    let opener = null;
    let active = false;

    function getFocusable() {
      return Array.from(dialog.querySelectorAll(focusableSelector)).filter((element) => !element.hidden);
    }

    function handleKeydown(event) {
      if (!active) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = getFocusable();
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function open(nextOpener = document.activeElement) {
      opener = nextOpener;
      active = true;
      dialog.hidden = false;
      dialog.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(() => {
        dialog.classList.add('is-open');
        const [first] = getFocusable();
        first?.focus();
      });
      document.addEventListener('keydown', handleKeydown);
    }

    function close() {
      if (!active) return;
      active = false;
      dialog.classList.remove('is-open');
      dialog.setAttribute('aria-hidden', 'true');
      document.removeEventListener('keydown', handleKeydown);
      window.setTimeout(() => {
        dialog.hidden = true;
        opener?.focus();
      }, 200);
      onClose?.();
    }

    return { open, close };
  }

  function setupMenu(toggle, menu) {
    if (!toggle || !menu) return;
    const close = () => {
      menu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    };
    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', close));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });
  }
  
  return { announce, setBusy, clearFieldError, setFieldError, validateRequired, createDialog, setupMenu };
})();

/* =========================================================
   SPARKLE & SLAY — SKELETON HELPERS
   ========================================================= */

function showSkeleton(container, html) {
  if (!container) return;

  container.innerHTML = html;
  container.classList.remove("is-hidden");
}

function hideSkeleton(container) {
  if (!container) return;

  container.classList.add("is-hidden");

  setTimeout(() => {
    if (container) {
      container.innerHTML = "";
      container.classList.remove("is-hidden");
    }
  }, 300);
}

function productSkeleton(count = 4) {
  return Array.from({ length: count }, () => `
    <article class="product-skeleton">
      <div class="skeleton product-skeleton-image"></div>
      <div class="skeleton product-skeleton-title"></div>
      <div class="skeleton product-skeleton-description"></div>
      <div class="skeleton product-skeleton-price"></div>
    </article>
  `).join("");
}

function collectionSkeleton(count = 4) {
  return Array.from({ length: count }, () => `
    <article class="collection-skeleton">
      <div class="skeleton collection-skeleton-image"></div>
      <div class="skeleton collection-skeleton-title"></div>
      <div class="skeleton collection-skeleton-text"></div>
      <div class="skeleton collection-skeleton-text"></div>
    </article>
  `).join("");
}

function adminProductSkeleton(count = 5) {
  return Array.from({ length: count }, () => `
    <div class="admin-product-skeleton">
      <div class="skeleton admin-product-skeleton-image"></div>

      <div class="admin-product-skeleton-content">
        <div class="skeleton admin-product-skeleton-title"></div>
        <div class="skeleton admin-product-skeleton-text"></div>
      </div>

      <div class="skeleton admin-product-skeleton-action"></div>
    </div>
  `).join("");
}
