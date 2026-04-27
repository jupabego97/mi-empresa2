/* Cart Drawer - mi-empresa2
 * Maneja apertura del drawer, AJAX add/change/remove y feedback con toast.
 */
(function () {
  'use strict';

  const ROUTES = (window.Shopify && Shopify.routes && Shopify.routes.root) ? Shopify.routes.root : '/';
  const FREE_SHIPPING_THRESHOLD_CENTS = 10000000; // $100.000 en cents

  const state = {
    drawer: null,
    panel:  null,
    toast:  null,
    isOpen: false,
  };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function moneyFmt(cents) {
    if (window.Shopify && Shopify.formatMoney) {
      return Shopify.formatMoney(cents, '${{amount}}');
    }
    return '$' + (cents / 100).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  // ───────────────────────────────────────
  // Drawer open/close
  // ───────────────────────────────────────
  function openDrawer() {
    if (!state.drawer) return;
    state.drawer.classList.add('is-open');
    state.drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('cd-open');
    state.isOpen = true;
  }
  function closeDrawer() {
    if (!state.drawer) return;
    state.drawer.classList.remove('is-open');
    state.drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('cd-open');
    state.isOpen = false;
  }

  // ───────────────────────────────────────
  // Toast
  // ───────────────────────────────────────
  function showToast(message, variant) {
    if (!state.toast) {
      state.toast = document.createElement('div');
      state.toast.className = 'cd-toast';
      state.toast.setAttribute('role', 'status');
      state.toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(state.toast);
    }
    state.toast.className = 'cd-toast' + (variant ? ' cd-toast--' + variant : '');
    state.toast.textContent = message;
    requestAnimationFrame(() => state.toast.classList.add('is-show'));
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => state.toast.classList.remove('is-show'), 2400);
  }

  // ───────────────────────────────────────
  // Render carrito
  // ───────────────────────────────────────
  function renderEmpty() {
    const body = $('[data-cd-body]', state.drawer);
    const footer = $('[data-cd-footer]', state.drawer);
    const progress = $('[data-cd-progress]', state.drawer);
    if (body) {
      body.innerHTML = `
        <div class="cd__empty" data-cd-empty>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          <p class="cd__empty-title">Tu carrito está vacío</p>
          <p class="cd__empty-text">Explora nuestros productos y agrégalos al carrito.</p>
          <a href="${ROUTES}collections/all" class="cd__empty-cta" data-cd-close>Ver catálogo</a>
        </div>`;
    }
    if (footer) footer.hidden = true;
    if (progress) progress.setAttribute('aria-hidden', 'true');
  }

  function renderItems(cart) {
    const body = $('[data-cd-body]', state.drawer);
    if (!body) return;
    if (cart.item_count === 0) { renderEmpty(); return; }
    const itemsHTML = cart.items.map((item, idx) => {
      const img = item.image ? `<img src="${item.image.replace(/(\.[^./]+)(\?.*)?$/, '_160x$1$2')}" alt="${escapeHtml(item.product_title)}" width="80" height="80" loading="lazy">` : '';
      const variant = (item.variant_title && !/Default/i.test(item.variant_title)) ? `<span class="cd-item__variant">${escapeHtml(item.variant_title)}</span>` : '';
      return `<li class="cd-item" data-cd-item data-key="${item.key}" data-line="${idx + 1}">
        <a href="${item.url}" class="cd-item__media">${img}</a>
        <div class="cd-item__body">
          <a href="${item.url}" class="cd-item__title">${escapeHtml(item.product_title)}</a>
          ${variant}
          <div class="cd-item__row">
            <div class="cd-item__qty">
              <button type="button" class="cd-item__qty-btn" data-cd-decrease aria-label="Disminuir">−</button>
              <input type="number" class="cd-item__qty-input" value="${item.quantity}" min="0" data-cd-qty>
              <button type="button" class="cd-item__qty-btn" data-cd-increase aria-label="Aumentar">+</button>
            </div>
            <span class="cd-item__price">${moneyFmt(item.final_line_price)}</span>
          </div>
        </div>
        <button type="button" class="cd-item__remove" data-cd-remove aria-label="Eliminar producto">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
        </button>
      </li>`;
    }).join('');
    body.innerHTML = `<ul class="cd__items" data-cd-items>${itemsHTML}</ul>`;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, s => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[s]));
  }

  function updateProgress(cart) {
    const progress  = $('[data-cd-progress]', state.drawer);
    const text      = $('[data-cd-progress-text]', state.drawer);
    const fill      = $('[data-cd-progress-fill]', state.drawer);
    if (!progress) return;
    if (cart.item_count === 0) {
      progress.setAttribute('aria-hidden', 'true');
      return;
    }
    progress.setAttribute('aria-hidden', 'false');
    const total = cart.total_price;
    const pct = Math.min(100, Math.round((total / FREE_SHIPPING_THRESHOLD_CENTS) * 100));
    if (fill) fill.style.width = pct + '%';
    if (text) {
      const falta = FREE_SHIPPING_THRESHOLD_CENTS - total;
      if (falta > 0) {
        text.innerHTML = `Te faltan <strong>${moneyFmt(falta)}</strong> para envío gratis`;
      } else {
        text.innerHTML = `¡Felicidades! Tienes <strong>envío gratis</strong>`;
      }
    }
  }

  function updateCount(cart) {
    const headerCounts = $$('[data-cart-count]');
    headerCounts.forEach(el => {
      el.textContent = cart.item_count;
      el.classList.toggle('hidden', cart.item_count === 0);
    });
    const drawerCount = $('[data-cd-count]', state.drawer);
    if (drawerCount) drawerCount.textContent = cart.item_count;
  }

  function updateFooter(cart) {
    const footer = $('[data-cd-footer]', state.drawer);
    const subtotal = $('[data-cd-subtotal]', state.drawer);
    if (!footer) return;
    if (cart.item_count === 0) {
      footer.hidden = true;
    } else {
      footer.hidden = false;
      if (subtotal) subtotal.textContent = moneyFmt(cart.total_price);
    }
  }

  function refresh(cart) {
    renderItems(cart);
    updateProgress(cart);
    updateFooter(cart);
    updateCount(cart);
  }

  // ───────────────────────────────────────
  // API requests
  // ───────────────────────────────────────
  function fetchCart() {
    return fetch(`${ROUTES}cart.js`, { headers: { 'Accept': 'application/json' } }).then(r => r.json());
  }

  function changeQty(line, quantity) {
    return fetch(`${ROUTES}cart/change.js`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ line: line, quantity: quantity })
    }).then(r => r.json());
  }

  function addItem(formData) {
    return fetch(`${ROUTES}cart/add.js`, {
      method: 'POST',
      headers: { 'Accept': 'application/javascript', 'X-Requested-With': 'XMLHttpRequest' },
      body: formData
    }).then(r => r.ok ? r.json() : r.json().then(err => Promise.reject(err)));
  }

  // ───────────────────────────────────────
  // Bind item interactions (event delegation)
  // ───────────────────────────────────────
  function onBodyClick(e) {
    const item = e.target.closest('[data-cd-item]');
    if (!item) return;
    const line = parseInt(item.dataset.line, 10);
    const input = $('[data-cd-qty]', item);
    if (!input) return;

    if (e.target.closest('[data-cd-remove]')) {
      e.preventDefault();
      changeQty(line, 0).then(refresh);
      return;
    }
    if (e.target.closest('[data-cd-increase]')) {
      e.preventDefault();
      const next = parseInt(input.value, 10) + 1;
      input.value = next;
      changeQty(line, next).then(refresh);
      return;
    }
    if (e.target.closest('[data-cd-decrease]')) {
      e.preventDefault();
      const next = Math.max(0, parseInt(input.value, 10) - 1);
      input.value = next;
      changeQty(line, next).then(refresh);
      return;
    }
  }

  function onBodyChange(e) {
    if (!e.target.matches('[data-cd-qty]')) return;
    const item = e.target.closest('[data-cd-item]');
    if (!item) return;
    const line = parseInt(item.dataset.line, 10);
    const next = Math.max(0, parseInt(e.target.value, 10) || 0);
    changeQty(line, next).then(refresh);
  }

  // ───────────────────────────────────────
  // Intercept add-to-cart forms
  // ───────────────────────────────────────
  function bindAddToCartForms() {
    document.addEventListener('submit', (e) => {
      const form = e.target;
      if (!form.matches('form[action*="/cart/add"]')) return;
      e.preventDefault();
      const submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) {
        submitBtn.dataset._origText = submitBtn.dataset._origText || submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.classList.add('is-loading');
      }
      addItem(new FormData(form))
        .then(() => fetchCart())
        .then(cart => {
          refresh(cart);
          openDrawer();
          showToast('Producto agregado al carrito', 'success');
        })
        .catch(err => {
          const msg = (err && err.description) ? err.description : 'No se pudo agregar al carrito';
          showToast(msg, 'error');
        })
        .finally(() => {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('is-loading');
            if (submitBtn.dataset._origText) submitBtn.innerHTML = submitBtn.dataset._origText;
          }
        });
    });
  }

  // ───────────────────────────────────────
  // Boot
  // ───────────────────────────────────────
  function boot() {
    state.drawer = $('[data-cart-drawer]');
    if (!state.drawer) return;
    state.panel = $('[data-cd-panel]', state.drawer);

    // Triggers
    document.addEventListener('click', (e) => {
      // Abrir desde el icono de carrito en header o botones marcados
      const cartLink = e.target.closest('a.header__cart, [data-cart-open]');
      if (cartLink) {
        e.preventDefault();
        fetchCart().then(refresh).then(openDrawer);
        return;
      }
      // Cerrar
      if (e.target.closest('[data-cd-close]')) {
        e.preventDefault();
        closeDrawer();
        return;
      }
    });

    // Body interactions del drawer
    state.drawer.addEventListener('click', onBodyClick);
    state.drawer.addEventListener('change', onBodyChange);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.isOpen) closeDrawer();
    });

    bindAddToCartForms();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
