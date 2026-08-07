// ============================================================
// admin/js/admin.js — Admin dashboard SPA logic
// Views: dashboard, products, orders, categories, content, users
// ============================================================
const API = new AdminAPI();

// ---- Auth guard: no token → login page ----
if (!API.isAuthed()) {
  window.location.replace('login.html');
}

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const state = {
  view: 'dashboard',
  products: { items: [], page: 1, total: 0, search: '', category: '' },
  orders: { items: [], page: 1, total: 0, status: '' },
  users: { items: [], page: 1, total: 0, search: '' },
  categories: [],
  content: [],
};

// ============================================================
// Utilities
// ============================================================
function money(n) {
  return '₦' + Number(n || 0).toLocaleString('en-NG');
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

let toastTimer = null;
function toast(msg, type = 'ok') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

function openModal(html) {
  $('#modalBox').innerHTML = html;
  $('#modalOverlay').classList.add('open');
}
function closeModal() {
  $('#modalOverlay').classList.remove('open');
}
$('#modalOverlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});

// ============================================================
// Router
// ============================================================
const VIEWS = {
  dashboard: { title: 'Dashboard', desc: 'Store overview at a glance', load: renderDashboard },
  products: { title: 'Products', desc: 'Manage your catalogue', load: renderProducts, actions: productActions },
  orders: { title: 'Orders', desc: 'Track and update customer orders', load: renderOrders, actions: orderActions },
  categories: { title: 'Categories', desc: 'Organise your store', load: renderCategories, actions: categoryActions },
  content: { title: 'Site Content', desc: 'Edit hero, about, banners & newsletter text', load: renderContent, actions: contentActions },
  shipping: { title: 'Shipping Settings', desc: 'Free-shipping threshold & flat shipping rate', load: renderShipping },
  coupons: { title: 'Coupons', desc: 'Create & manage discount codes', load: renderCoupons, actions: couponActions },
  users: { title: 'Customers', desc: 'Registered customer accounts', load: renderUsers, actions: userActions },
};

function switchView(view) {
  if (!VIEWS[view]) view = 'dashboard';
  state.view = view;
  $$('#sidebarNav button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  const v = VIEWS[view];
  $('#viewTitle').textContent = v.title;
  $('#viewDesc').textContent = v.desc;
  $('#viewActions').innerHTML = v.actions ? v.actions() : '';
  v.load();
}

$('#sidebarNav').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-view]');
  if (btn) switchView(btn.dataset.view);
});

$('#logoutBtn').addEventListener('click', () => API.logout());

// ============================================================
// Dashboard
// ============================================================
async function renderDashboard() {
  const body = $('#viewBody');
  body.innerHTML = '<div class="card card-pad">Loading…</div>';
  try {
    const [products, orders, users, cats] = await Promise.all([
      API.getProducts({ limit: 1 }),
      API.getOrders({ limit: 1 }),
      API.getUsers({ limit: 1 }),
      API.getCategories(),
    ]);
    const totalOrders = orders?.pagination?.total ?? 0;
    const totalUsers = users?.pagination?.total ?? 0;
    const totalProducts = products?.pagination?.total ?? 0;

    body.innerHTML = `
      <div class="stats-grid">
        <div class="card stat-card"><div class="label">Products</div><div class="value">${totalProducts}</div><div class="hint">${cats.length} categories</div></div>
        <div class="card stat-card"><div class="label">Orders</div><div class="value">${totalOrders}</div><div class="hint">all time</div></div>
        <div class="card stat-card"><div class="label">Customers</div><div class="value">${totalUsers}</div><div class="hint">registered accounts</div></div>
        <div class="card stat-card"><div class="label">Content blocks</div><div class="value">${state.content.length || '—'}</div><div class="hint">editable site content</div></div>
      </div>
      <div class="card card-pad">
        <h3 style="font-family:var(--font-serif);margin-bottom:12px">Quick links</h3>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-pink" onclick="switchView('products')">Manage products</button>
          <button class="btn" onclick="switchView('orders')">View orders</button>
          <button class="btn" onclick="switchView('content')">Edit site content</button>
          <button class="btn" onclick="switchView('shipping')">Shipping settings</button>
          <a class="btn" href="/" target="_blank" rel="noopener">View store ↗</a>
        </div>
        <p style="color:var(--ink-500);font-size:13px;margin-top:16px">
          💡 Add products, edit the hero text, update orders — all changes appear on the store instantly.
        </p>
      </div>`;
  } catch (err) {
    body.innerHTML = `<div class="card card-pad empty"><div class="empty-icon">⚠️</div>${esc(err.message)}</div>`;
  }
}

// ============================================================
// PRODUCTS
// ============================================================
function productActions() {
  return `<button class="btn btn-pink" onclick="openProductModal()">+ Add product</button>`;
}

async function renderProducts() {
  const body = $('#viewBody');
  const { items, page, total, search, category } = state.products;
  body.innerHTML = `
    <div class="toolbar">
      <input type="search" placeholder="Search products…" value="${esc(search)}" id="prodSearch" />
      <select id="prodCatFilter"><option value="">All categories</option></select>
      <button class="btn" onclick="loadProducts(1)">Apply</button>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Product</th><th>Category</th><th>Price</th><th>Sale</th><th>Badge</th><th>Featured</th><th style="text-align:right">Actions</th>
          </tr></thead>
          <tbody id="prodRows">
            <tr><td colspan="7" class="empty">Loading…</td></tr>
          </tbody>
        </table>
      </div>
      <div class="pagination" id="prodPager"></div>
    </div>`;

  // populate category filter
  const catSel = $('#prodCatFilter');
  state.categories.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id; opt.textContent = c.name;
    if (c.id === category) opt.selected = true;
    catSel.appendChild(opt);
  });

  $('#prodSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadProducts(1); });
  $('#prodCatFilter').addEventListener('change', (e) => {
    state.products.category = e.target.value;
    loadProducts(1);
  });

  await loadProducts(page);
}

async function loadProducts(page = 1) {
  state.products.page = page;
  state.products.search = $('#prodSearch')?.value || state.products.search;
  const rows = $('#prodRows');
  const pager = $('#prodPager');
  try {
    const params = { page, limit: 15 };
    if (state.products.search) params.search = state.products.search;
    if (state.products.category) params.category = state.products.category;
    const res = await API.getProducts(params);
    state.products.items = res.items;
    state.products.total = res.pagination.total;

    if (!res.items.length) {
      rows.innerHTML = `<tr><td colspan="7" class="empty"><div class="empty-icon">🛍️</div>No products yet — click "Add product".</td></tr>`;
      pager.innerHTML = '';
      return;
    }

    rows.innerHTML = res.items.map((p) => `
      <tr>
        <td><div class="cell-product">
          <img src="${esc(p.image || '')}" alt="" onerror="this.style.visibility='hidden'" />
          <div><div class="p-name">${esc(p.name)}</div><div class="p-brand">${esc(p.brand)}</div></div>
        </div></td>
        <td>${esc(p.category?.name || '—')}</td>
        <td>${money(p.price)}</td>
        <td>${p.originalPrice ? `<s style="color:var(--ink-300)">${money(p.originalPrice)}</s>` : '—'}</td>
        <td><span class="badge-pill ${p.badge || 'none'}">${esc(p.badge || '—')}</span></td>
        <td>${p.featured ? '⭐' : '—'}</td>
        <td><div class="cell-actions">
          <button class="btn btn-sm" onclick="openProductModal('${p.id}')">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteProduct('${p.id}','${esc(p.name)}')">Delete</button>
        </div></td>
      </tr>`).join('');

    const pages = Math.max(1, Math.ceil(res.pagination.total / 15));
    pager.innerHTML = `
      <span>Page ${page} of ${pages} · ${res.pagination.total} items</span>
      <button class="btn btn-sm" ${page <= 1 ? 'disabled' : ''} onclick="loadProducts(${page - 1})">← Prev</button>
      <button class="btn btn-sm" ${page >= pages ? 'disabled' : ''} onclick="loadProducts(${page + 1})">Next →</button>`;
  } catch (err) {
    rows.innerHTML = `<tr><td colspan="7" class="empty">${esc(err.message)}</td></tr>`;
  }
}

const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'One Size', '25', '26', '27', '28', '29', '36', '37', '38', '39'];

function openProductModal(id = null) {
  const p = id ? state.products.items.find((x) => x.id === id) : null;
  const sizes = p?.sizes || ['S', 'M', 'L'];
  const chip = (s) =>
    `<span class="size-chip ${sizes.includes(s) ? 'active' : ''}" data-size="${s}" onclick="this.classList.toggle('active')">${s}</span>`;
  const sizeRow = SIZE_OPTIONS.map((s) => `${chip(s)}${['One Size', '29', '39'].includes(s) ? '<br>' : ''}`).join('');

  openModal(`
    <div class="modal-head"><h3>${p ? 'Edit product' : 'Add product'}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button></div>
    <form id="productForm" class="modal-body">
      <input type="hidden" name="id" value="${p?.id || ''}" />
      <div class="form-grid">
        <div class="field"><label>Product name *</label><input name="name" required value="${esc(p?.name || '')}" placeholder="Floral Wrap Midi Dress" /></div>
        <div class="field"><label>Brand *</label><input name="brand" required value="${esc(p?.brand || '')}" placeholder="Zara" /></div>
        <div class="field"><label>Price (₦) *</label><input name="price" type="number" min="0" required value="${p?.price ?? ''}" /></div>
        <div class="field"><label>Original price (₦)</label><input name="originalPrice" type="number" min="0" value="${p?.originalPrice ?? 0}" /></div>
        <div class="field"><label>Category</label>
          <select name="categoryId">
            <option value="">— None —</option>
            ${state.categories.map((c) => `<option value="${c.id}" ${p?.categoryId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Badge</label>
          <select name="badge">
            ${['', 'sale', 'new', 'sold'].map((b) => `<option value="${b}" ${p?.badge === b ? 'selected' : ''}>${b || 'none'}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Rating (0–5)</label><input name="rating" type="number" min="0" max="5" step="0.1" value="${p?.rating ?? 0}" /></div>
        <div class="field"><label>Reviews</label><input name="reviews" type="number" min="0" value="${p?.reviews ?? 0}" /></div>
        <div class="field span-2"><label>Condition note</label><input name="condition" value="${esc(p?.condition || '')}" placeholder="Excellent — pristine" /></div>
        <div class="field span-full"><label>Description</label><textarea name="description" rows="3">${esc(p?.description || '')}</textarea></div>
        <div class="field span-full"><label>Available sizes</label><div class="size-chips" id="sizeChips">${sizeRow}</div></div>
        <div class="field span-full"><label>Main image</label>
          <input type="file" name="images" accept="image/*" />
          <p class="file-hint">Upload a photo — or keep the current one by leaving this empty.</p>
          ${p?.image ? `<img class="preview-img" src="${esc(p.image)}" alt="current" />` : ''}
        </div>
        <label class="checkbox span-2" style="color:var(--ink-700)"><input type="checkbox" name="featured" ${p?.featured ? 'checked' : ''} /> Featured on home page</label>
      </div>
      <div class="form-actions">
        <button type="button" class="btn" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-pink">${p ? 'Save changes' : 'Create product'}</button>
      </div>
    </form>`);

  $('#productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    // gather selected sizes
    const sizes = $$('.size-chip.active', $('#sizeChips')).map((c) => c.dataset.size);
    fd.set('sizes', JSON.stringify(sizes));
    if (fd.get('featured') === null) fd.set('featured', 'false');
    if (!fd.get('originalPrice')) fd.set('originalPrice', '0');
    if (!fd.get('rating')) fd.set('rating', '0');
    if (!fd.get('reviews')) fd.set('reviews', '0');

    const submitBtn = form.querySelector('button[type=submit]');
    submitBtn.disabled = true; submitBtn.textContent = 'Saving…';
    try {
      if (p) await API.updateProduct(p.id, fd);
      else await API.createProduct(fd);
      toast(p ? 'Product updated ✨' : 'Product created ✨');
      closeModal();
      loadProducts(state.products.page);
    } catch (err) {
      toast(err.message, 'err');
      submitBtn.disabled = false; submitBtn.textContent = p ? 'Save changes' : 'Create product';
    }
  });
}

async function deleteProduct(id, name) {
  if (!confirm(`Delete "${name}"? The product will be hidden from the store.`)) return;
  try {
    await API.deleteProduct(id);
    toast('Product removed');
    loadProducts(state.products.page);
  } catch (err) {
    toast(err.message, 'err');
  }
}

// ============================================================
// ORDERS
// ============================================================
function orderActions() {
  const statuses = ['', 'PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
  return `<select id="orderStatusFilter" onchange="state.orders.status=this.value;loadOrders(1)">
    ${statuses.map((s) => `<option value="${s}" ${state.orders.status === s ? 'selected' : ''}>${s || 'All statuses'}</option>`).join('')}
  </select>`;
}

function paymentMethodLabel(m) {
  if (m === 'TRANSFER') return '🏦 Bank transfer';
  if (m === 'WHATSAPP') return '💬 WhatsApp';
  if (m === 'CARD') return '💳 Card (Paystack)';
  return m || '—';
}

async function renderOrders() {
  const body = $('#viewBody');
  body.innerHTML = `
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Order #</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Payment</th><th>Method</th><th>Date</th><th style="text-align:right">Actions</th></tr></thead>
      <tbody id="orderRows"><tr><td colspan="9" class="empty">Loading…</td></tr></tbody>
    </table></div><div class="pagination" id="orderPager"></div></div>`;
  await loadOrders(1);
}

async function loadOrders(page = 1) {
  state.orders.page = page;
  const rows = $('#orderRows');
  const pager = $('#orderPager');
  try {
    const params = { page, limit: 15 };
    if (state.orders.status) params.status = state.orders.status;
    const res = await API.getOrders(params);
    state.orders.items = res.items;
    if (!res.items.length) {
      rows.innerHTML = `<tr><td colspan="9" class="empty"><div class="empty-icon">📦</div>No orders yet.</td></tr>`;
      pager.innerHTML = '';
      return;
    }
    rows.innerHTML = res.items.map((o) => `
      <tr>
        <td><strong>${esc(o.orderNumber)}</strong></td>
        <td>${esc(o.shipFirstName)} ${esc(o.shipLastName)}<br/><span style="color:var(--ink-500);font-size:12px">${esc(o.shipEmail)}</span></td>
        <td>${o.items.reduce((s, i) => s + i.qty, 0)}</td>
        <td><strong>${money(o.total)}</strong></td>
        <td><span class="status ${o.status}">${o.status}</span></td>
        <td><span class="badge-pill none">${o.paymentStatus}</span></td>
        <td>${paymentMethodLabel(o.paymentMethod)}</td>
        <td style="white-space:nowrap">${new Date(o.createdAt).toLocaleDateString()}</td>
        <td><div class="cell-actions">
          <button class="btn btn-sm" onclick="openOrderModal('${o.id}')">View</button>
          <button class="btn btn-sm" onclick="updateOrderStatus('${o.id}','${o.status === 'PAID' ? 'SHIPPED' : o.status === 'SHIPPED' ? 'DELIVERED' : 'PAID'}')">Advance →</button>
        </div></td>
      </tr>`).join('');

    const pages = Math.max(1, Math.ceil(res.pagination.total / 15));
    pager.innerHTML = `<span>Page ${page} of ${pages} · ${res.pagination.total} orders</span>
      <button class="btn btn-sm" ${page <= 1 ? 'disabled' : ''} onclick="loadOrders(${page - 1})">← Prev</button>
      <button class="btn btn-sm" ${page >= pages ? 'disabled' : ''} onclick="loadOrders(${page + 1})">Next →</button>`;
  } catch (err) {
    rows.innerHTML = `<tr><td colspan="9" class="empty">${esc(err.message)}</td></tr>`;
  }
}

async function openOrderModal(id) {
  try {
    const o = await API.getOrder(id);
    const itemsHtml = o.items.map((i) => `
      <tr><td>${esc(i.name)}<br/><span style="color:var(--ink-500);font-size:12px">${esc(i.brand)} · Size ${esc(i.size)}</span></td>
      <td style="text-align:center">${i.qty}</td><td style="text-align:right">${money(i.price)}</td>
      <td style="text-align:right"><strong>${money(i.subtotal)}</strong></td></tr>`).join('');
    openModal(`
      <div class="modal-head"><h3>Order ${esc(o.orderNumber)}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
      <div class="modal-body">
        <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">
          <div class="card stat-card"><div class="label">Status</div><div class="value" style="font-size:18px"><span class="status ${o.status}">${o.status}</span></div></div>
          <div class="card stat-card"><div class="label">Total</div><div class="value" style="font-size:20px">${money(o.total)}</div></div>
          <div class="card stat-card"><div class="label">Payment</div><div class="value" style="font-size:18px"><span class="badge-pill none">${o.paymentStatus}</span></div></div>
          <div class="card stat-card"><div class="label">Method</div><div class="value" style="font-size:16px">${paymentMethodLabel(o.paymentMethod)}</div></div>
        </div>
        <h4 style="font-family:var(--font-serif);margin:6px 0 10px">Items</h4>
        <table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit</th><th style="text-align:right">Subtotal</th></tr></thead>
        <tbody>${itemsHtml}</tbody></table>
        <div style="display:grid;gap:4px;margin-top:14px;font-size:13.5px;color:var(--ink-700)">
          <div><strong>Ship to:</strong> ${esc(o.shipFirstName)} ${esc(o.shipLastName)}, ${esc(o.shipAddress)}, ${esc(o.shipCity)}, ${esc(o.shipState)}, ${esc(o.shipCountry)}</div>
          <div><strong>Phone:</strong> ${esc(o.shipPhone)} · <strong>Email:</strong> ${esc(o.shipEmail)}</div>
          <div><strong>Placed:</strong> ${new Date(o.createdAt).toLocaleString()}</div>
          ${o.notes ? `<div><strong>Notes:</strong> ${esc(o.notes)}</div>` : ''}
        </div>
        <div class="form-actions">
          <button class="btn" onclick="closeModal()">Close</button>
          <button class="btn btn-pink" onclick="updateOrderStatus('${o.id}','${o.status === 'PENDING' ? 'PAID' : o.status === 'PAID' ? 'SHIPPED' : o.status === 'SHIPPED' ? 'DELIVERED' : 'PAID'}')">Mark ${o.status === 'PENDING' ? 'Paid' : o.status === 'PAID' ? 'Shipped' : o.status === 'SHIPPED' ? 'Delivered' : 'Paid'} →</button>
        </div>
      </div>`);
  } catch (err) {
    toast(err.message, 'err');
  }
}

async function updateOrderStatus(id, status) {
  try {
    await API.updateOrderStatus(id, { status });
    toast(`Order marked ${status}`);
    closeModal();
    loadOrders(state.orders.page);
  } catch (err) {
    toast(err.message, 'err');
  }
}

// ============================================================
// CATEGORIES
// ============================================================
function categoryActions() {
  return `<button class="btn btn-pink" onclick="openCategoryModal()">+ Add category</button>`;
}

async function renderCategories() {
  const body = $('#viewBody');
  body.innerHTML = '<div class="card card-pad">Loading…</div>';
  try {
    const res = await API.getCategories();
    state.categories = res;
    if (!res.length) {
      body.innerHTML = `<div class="card card-pad empty"><div class="empty-icon">🏷️</div>No categories yet.</div>`;
      return;
    }
    body.innerHTML = `<div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Category</th><th>Slug</th><th>Products</th><th>Order</th><th style="text-align:right">Actions</th></tr></thead>
      <tbody>${res.map((c) => `
        <tr>
          <td><div class="cell-product">${c.image ? `<img src="${esc(c.image)}" alt="" onerror="this.style.visibility='hidden'"/>` : ''}<span class="p-name">${esc(c.name)}</span></div></td>
          <td><code>${esc(c.slug)}</code></td>
          <td>${c._count?.products ?? 0}</td>
          <td>${c.order}</td>
          <td><div class="cell-actions">
            <button class="btn btn-sm" onclick="openCategoryModal('${c.id}')">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deleteCategory('${c.id}','${esc(c.name)}')">Delete</button>
          </div></td>
        </tr>`).join('')}
      </tbody></table></div></div>`;
  } catch (err) {
    body.innerHTML = `<div class="card card-pad empty">${esc(err.message)}</div>`;
  }
}

function openCategoryModal(id = null) {
  const c = id ? state.categories.find((x) => x.id === id) : null;
  openModal(`
    <div class="modal-head"><h3>${c ? 'Edit category' : 'Add category'}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <form id="catForm" class="modal-body">
      <input type="hidden" name="id" value="${c?.id || ''}" />
      <div class="form-grid">
        <div class="field"><label>Name *</label><input name="name" required value="${esc(c?.name || '')}" placeholder="Dresses" /></div>
        <div class="field"><label>Slug (optional)</label><input name="slug" value="${esc(c?.slug || '')}" placeholder="dresses" /></div>
        <div class="field"><label>Display order</label><input name="order" type="number" value="${c?.order ?? 0}" /></div>
        <div class="field"><label>Image</label><input type="file" name="image" accept="image/*" />
          <p class="file-hint">Leave empty to keep current.</p></div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-pink">${c ? 'Save' : 'Create'}</button>
      </div>
    </form>`);

  $('#catForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const submitBtn = e.target.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    try {
      if (c) await API.updateCategory(c.id, fd);
      else await API.createCategory(fd);
      toast('Category saved ✨');
      closeModal();
      renderCategories();
    } catch (err) {
      toast(err.message, 'err');
      submitBtn.disabled = false;
    }
  });
}

async function deleteCategory(id, name) {
  if (!confirm(`Delete category "${name}"? Products in it will become uncategorised.`)) return;
  try {
    await API.deleteCategory(id);
    toast('Category deleted');
    renderCategories();
  } catch (err) {
    toast(err.message, 'err');
  }
}

// ============================================================
// CONTENT (hero, about, banners…)
// ============================================================

// Known "heading" / marketing image slots the storefront looks up
// via data-content-key — see frontend/js/site-images.js. Until an
// image is uploaded here, the storefront shows a placeholder.
const IMAGE_SLOTS = [
  { key: 'home.hero.image', label: 'Homepage hero' },
  { key: 'home.category.dresses.image', label: 'Category card — Dresses' },
  { key: 'home.category.tops.image', label: 'Category card — Tops & Blouses' },
  { key: 'home.category.outerwear.image', label: 'Category card — Outerwear' },
  { key: 'home.story.image', label: 'Homepage "Luxury without the Guilt" banner' },
  { key: 'home.instagram.1', label: 'Instagram strip — 1' },
  { key: 'home.instagram.2', label: 'Instagram strip — 2' },
  { key: 'home.instagram.3', label: 'Instagram strip — 3' },
  { key: 'home.instagram.4', label: 'Instagram strip — 4' },
  { key: 'home.instagram.5', label: 'Instagram strip — 5' },
  { key: 'about.story.image', label: 'About page — "Born From One Endless Wishlist"' },
  { key: 'about.sustainability.image', label: 'About page — "The Considered Wardrobe"' },
];
const IMAGE_SLOT_KEYS = new Set(IMAGE_SLOTS.map((s) => s.key));
const PLACEHOLDER_THUMB =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150"><rect width="200" height="150" fill="%23fdf2f7"/><text x="100" y="80" text-anchor="middle" font-family="sans-serif" font-size="13" fill="%23b04a74">No image set</text></svg>'
      .replace(/%23/g, '#')
  );

function contentActions() {
  return `<button class="btn" onclick="addContentBlock()">+ Add block</button>`;
}

async function renderContent() {
  const body = $('#viewBody');
  body.innerHTML = '<div class="card card-pad">Loading…</div>';
  try {
    const res = await API.getContent();
    state.content = res;
    const byKey = {};
    res.forEach((b) => { byKey[b.key] = b; });
    const otherBlocks = res.filter((b) => !IMAGE_SLOT_KEYS.has(b.key));

    const imageSlotsHtml = `
      <h3 style="margin:0 0 4px">Homepage Images</h3>
      <p style="color:var(--ink-500);font-size:12.5px;margin:0 0 14px">
        Upload a photo for each spot below and it appears on the storefront instantly.
        Anything left empty shows a placeholder until you upload one.
      </p>
      <div class="image-slots">
        ${IMAGE_SLOTS.map((slot) => {
          const block = byKey[slot.key];
          const isSet = block && block.value;
          return `
          <div class="image-slot">
            <div class="is-thumb"><img src="${isSet ? esc(block.value) : PLACEHOLDER_THUMB}" alt="" onerror="this.src='${PLACEHOLDER_THUMB}'" /></div>
            <div class="is-label">${esc(slot.label)}</div>
            <span class="is-key">${esc(slot.key)}</span>
            <span class="is-status ${isSet ? '' : 'unset'}">${isSet ? 'Image set' : 'Not set — placeholder showing'}</span>
            <input type="file" accept="image/*" data-slot-key="${esc(slot.key)}" />
            <div class="is-actions">
              <button class="btn btn-sm btn-pink" onclick="saveImageSlot(this, '${esc(slot.key)}')">Upload</button>
              ${isSet ? `<button class="btn btn-sm btn-danger" onclick="deleteContentBlock('${esc(slot.key)}')">Remove</button>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>`;

    const otherBlocksHtml = otherBlocks.length
      ? `<h3 style="margin:26px 0 12px">Other Site Content</h3>
      <div class="content-blocks">
      ${otherBlocks.map((b) => `
        <div class="content-block">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
            <span class="cb-key">${esc(b.key)}</span>
            <span class="badge-pill none">${esc(b.type)}</span>
          </div>
          <textarea data-key="${esc(b.key)}" data-type="${esc(b.type)}" rows="${b.type === 'json' ? 5 : 3}">${esc(b.value)}</textarea>
          <div class="cb-actions">
            <button class="btn btn-sm btn-danger" onclick="deleteContentBlock('${esc(b.key)}')">Delete</button>
            <button class="btn btn-sm btn-pink" onclick="saveContentBlock(this)">Save</button>
          </div>
        </div>`).join('')}
      </div>
      <p style="color:var(--ink-500);font-size:12.5px;margin-top:14px">
        Keys are looked up by the storefront (e.g. <code>hero.title</code>, <code>hero.subtitle</code>, <code>about.story</code>).
        JSON blocks store structured data (banners, values, contact info).
      </p>`
      : '';

    body.innerHTML = imageSlotsHtml + otherBlocksHtml;
  } catch (err) {
    body.innerHTML = `<div class="card card-pad empty">${esc(err.message)}</div>`;
  }
}

async function saveImageSlot(btn, key) {
  const slot = btn.closest('.image-slot');
  const input = slot.querySelector(`input[type="file"][data-slot-key="${CSS.escape(key)}"]`);
  const file = input.files && input.files[0];
  if (!file) { toast('Choose an image first', 'err'); return; }

  const fd = new FormData();
  fd.append('key', key);
  fd.append('type', 'image');
  fd.append('image', file);

  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = 'Uploading…';
  try {
    await API.saveContentBlock(fd);
    toast('Image saved — store updates instantly ✨');
    renderContent();
  } catch (err) {
    toast(err.message, 'err');
    btn.disabled = false;
    btn.textContent = original;
  }
}

async function saveContentBlock(btn) {
  const block = btn.closest('.content-block');
  const key = block.querySelector('textarea').dataset.key;
  const type = block.querySelector('textarea').dataset.type;
  const value = block.querySelector('textarea').value.trim();
  if (!value) { toast('Value cannot be empty', 'err'); return; }
  btn.disabled = true;
  try {
    await API.saveContentBlock({ key, value, type });
    toast('Content saved — store updates instantly ✨');
  } catch (err) {
    toast(err.message, 'err');
  } finally {
    btn.disabled = false;
  }
}

function addContentBlock() {
  openModal(`
    <div class="modal-head"><h3>Add content block</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <form id="newBlockForm" class="modal-body">
      <div class="field"><label>Key *</label><input name="key" required placeholder="hero.title" pattern="[a-z0-9.]+" title="lowercase letters, numbers, dots" /></div>
      <div class="field"><label>Type</label>
        <select name="type"><option value="text">text</option><option value="image">image</option><option value="json">json</option></select>
      </div>
      <div class="field"><label>Value *</label><textarea name="value" rows="4" required placeholder="Text, image path, or JSON"></textarea></div>
      <div class="form-actions">
        <button type="button" class="btn" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-pink">Add block</button>
      </div>
    </form>`);
  $('#newBlockForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = { key: fd.get('key').trim(), type: fd.get('type'), value: fd.get('value').trim() };
    try {
      await API.saveContentBlock(data);
      toast('Block added ✨');
      closeModal();
      renderContent();
    } catch (err) {
      toast(err.message, 'err');
    }
  });
}

async function deleteContentBlock(key) {
  if (!confirm(`Delete content block "${key}"?`)) return;
  try {
    await API.deleteContentBlock(key);
    toast('Block deleted');
    renderContent();
  } catch (err) {
    toast(err.message, 'err');
  }
}

// ============================================================
// SHIPPING SETTINGS
//   Stored as ContentBlock rows (shipping.freeThreshold /
//   shipping.flatRate) — same store the storefront reads via
//   GET /api/content (see frontend/js/settings.js). This view
//   just gives the raw key/value content editor a friendlier,
//   purpose-built face for these two numbers.
// ============================================================
const SHIPPING_KEYS = {
  freeThreshold: 'shipping.freeThreshold',
  flatRate: 'shipping.flatRate',
};
const SHIPPING_DEFAULTS = { freeThreshold: 550000, flatRate: 5000 };

async function renderShipping() {
  const body = $('#viewBody');
  body.innerHTML = '<div class="card card-pad">Loading…</div>';
  try {
    const blocks = await API.getContent();
    const byKey = Object.fromEntries(blocks.map((b) => [b.key, b.value]));
    const freeThreshold = Number(byKey[SHIPPING_KEYS.freeThreshold]);
    const flatRate = Number(byKey[SHIPPING_KEYS.flatRate]);
    const current = {
      freeThreshold: Number.isFinite(freeThreshold) ? freeThreshold : SHIPPING_DEFAULTS.freeThreshold,
      flatRate: Number.isFinite(flatRate) ? flatRate : SHIPPING_DEFAULTS.flatRate,
    };

    body.innerHTML = `
      <div class="card card-pad" style="max-width:480px">
        <h3 style="font-family:var(--font-serif);margin-bottom:4px">Shipping</h3>
        <p style="color:var(--ink-500);font-size:13px;margin-bottom:20px">
          Controls the free-shipping banner, cart progress bar, and checkout totals
          across the whole store — no code changes needed.
        </p>
        <form id="shippingForm">
          <div class="field">
            <label>Free shipping threshold (₦)</label>
            <input type="number" name="freeThreshold" min="0" step="1" required value="${current.freeThreshold}" />
            <p style="color:var(--ink-500);font-size:12px;margin-top:4px">
              Orders at or above this subtotal ship free.
            </p>
          </div>
          <div class="field" style="margin-top:14px">
            <label>Flat shipping rate (₦)</label>
            <input type="number" name="flatRate" min="0" step="1" required value="${current.flatRate}" />
            <p style="color:var(--ink-500);font-size:12px;margin-top:4px">
              Charged on orders below the free-shipping threshold.
            </p>
          </div>
          <div class="form-actions" style="margin-top:20px">
            <button type="submit" class="btn btn-pink">Save shipping settings</button>
          </div>
        </form>
      </div>`;

    $('#shippingForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const freeThreshold = Number(fd.get('freeThreshold'));
      const flatRate = Number(fd.get('flatRate'));
      if (!Number.isFinite(freeThreshold) || freeThreshold < 0 || !Number.isFinite(flatRate) || flatRate < 0) {
        toast('Enter valid, non-negative amounts', 'err');
        return;
      }
      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        await Promise.all([
          API.saveContentBlock({ key: SHIPPING_KEYS.freeThreshold, value: String(freeThreshold), type: 'text' }),
          API.saveContentBlock({ key: SHIPPING_KEYS.flatRate, value: String(flatRate), type: 'text' }),
        ]);
        toast('Shipping settings saved — store updates instantly ✨');
      } catch (err) {
        toast(err.message, 'err');
      } finally {
        btn.disabled = false;
      }
    });
  } catch (err) {
    body.innerHTML = `<div class="card card-pad empty">${esc(err.message)}</div>`;
  }
}

// ============================================================
// COUPONS
// ============================================================
function couponActions() {
  return `<button class="btn btn-pink" onclick="openCouponModal()">+ Add coupon</button>`;
}

async function renderCoupons() {
  const body = $('#viewBody');
  body.innerHTML = `
    <div class="toolbar">
      <input type="search" placeholder="Search coupons…" value="${esc(state.coupons.search)}" id="couponSearch" />
      <button class="btn" onclick="state.coupons.search=document.getElementById('couponSearch').value;loadCoupons(1)">Search</button>
    </div>
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Min order</th><th>Used / Limit</th><th>Valid until</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead>
      <tbody id="couponRows"><tr><td colspan="8" class="empty">Loading…</td></tr></tbody>
    </table></div><div class="pagination" id="couponPager"></div></div>
    <p style="color:var(--ink-500);font-size:12.5px;margin-top:12px">
      💡 Coupons are validated at checkout with <code>POST /api/coupons/validate</code> and applied to the order total.
    </p>`;
  await loadCoupons(1);
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString();
}

async function loadCoupons(page = 1) {
  state.coupons.page = page;
  const rows = $('#couponRows');
  const pager = $('#couponPager');
  try {
    const params = { page, limit: 50 };
    if (state.coupons.search) params.search = state.coupons.search;
    const res = await API.getCoupons(params);
    state.coupons.items = res.items;
    if (!res.items.length) {
      rows.innerHTML = `<tr><td colspan="8" class="empty"><div class="empty-icon">🎁</div>No coupons yet — click "Add coupon".</td></tr>`;
      pager.innerHTML = '';
      return;
    }
    rows.innerHTML = res.items.map((c) => `
      <tr>
        <td><strong style="letter-spacing:.4px">${esc(c.code)}</strong></td>
        <td><span class="badge-pill none">${c.type}</span></td>
        <td>${c.type === 'PERCENTAGE' ? c.value + '%' : money(c.value)}</td>
        <td>${c.minOrderAmount ? money(c.minOrderAmount) : '—'}</td>
        <td>${c.usedCount}${c.usageLimit ? ' / ' + c.usageLimit : ' / ∞'}</td>
        <td>${fmtDate(c.validUntil)}</td>
        <td><span class="badge-pill ${c.isActive ? 'new' : 'sold'}">${c.isActive ? 'Active' : 'Inactive'}</span></td>
        <td><div class="cell-actions">
          <button class="btn btn-sm" onclick="openCouponModal('${c.id}')">Edit</button>
          <button class="btn btn-sm" onclick="toggleCoupon('${c.id}','${esc(c.code)}')">${c.isActive ? 'Deactivate' : 'Activate'}</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCoupon('${c.id}','${esc(c.code)}')">Delete</button>
        </div></td>
      </tr>`).join('');
    const pages = Math.max(1, Math.ceil(res.pagination.total / 50));
    pager.innerHTML = `<span>Page ${page} of ${pages} · ${res.pagination.total} coupons</span>
      <button class="btn btn-sm" ${page <= 1 ? 'disabled' : ''} onclick="loadCoupons(${page - 1})">← Prev</button>
      <button class="btn btn-sm" ${page >= pages ? 'disabled' : ''} onclick="loadCoupons(${page + 1})">Next →</button>`;
  } catch (err) {
    rows.innerHTML = `<tr><td colspan="8" class="empty">${esc(err.message)}</td></tr>`;
  }
}

function openCouponModal(id = null) {
  const c = id ? state.coupons.items.find((x) => x.id === id) : null;
  const iso = (d) => (d ? new Date(d).toISOString().slice(0, 16) : '');
  openModal(`
    <div class="modal-head"><h3>${c ? 'Edit coupon' : 'Add coupon'}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <form id="couponForm" class="modal-body">
      <input type="hidden" name="id" value="${c?.id || ''}" />
      <div class="form-grid">
        <div class="field"><label>Code *</label><input name="code" required value="${esc(c?.code || '')}" placeholder="WELCOME10" style="text-transform:uppercase" /></div>
        <div class="field"><label>Type</label>
          <select name="type">
            <option value="PERCENTAGE" ${c?.type === 'PERCENTAGE' ? 'selected' : ''}>Percentage (%)</option>
            <option value="FIXED" ${c?.type === 'FIXED' ? 'selected' : ''}>Fixed amount (₦)</option>
          </select>
        </div>
        <div class="field"><label>Value *</label><input name="value" type="number" min="0" required value="${c?.value ?? ''}" placeholder="${c?.type === 'FIXED' ? '5000' : '10'}" /></div>
        <div class="field"><label>Min order (₦)</label><input name="minOrderAmount" type="number" min="0" value="${c?.minOrderAmount ?? 0}" /></div>
        <div class="field"><label>Max discount (₦, 0 = none)</label><input name="maxDiscount" type="number" min="0" value="${c?.maxDiscount ?? 0}" /></div>
        <div class="field"><label>Usage limit (0 = unlimited)</label><input name="usageLimit" type="number" min="0" value="${c?.usageLimit ?? 0}" /></div>
        <div class="field"><label>Valid from</label><input name="validFrom" type="datetime-local" value="${iso(c?.validFrom)}" /></div>
        <div class="field"><label>Valid until</label><input name="validUntil" type="datetime-local" value="${iso(c?.validUntil)}" /></div>
        <label class="checkbox span-2" style="color:var(--ink-700)"><input type="checkbox" name="isActive" ${c?.isActive === false ? '' : 'checked'} /> Active (accepts redemptions)</label>
      </div>
      <div class="form-actions">
        <button type="button" class="btn" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-pink">${c ? 'Save changes' : 'Create coupon'}</button>
      </div>
    </form>`);

  $('#couponForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      code: fd.get('code').trim().toUpperCase(),
      type: fd.get('type'),
      value: Number(fd.get('value')),
      minOrderAmount: Number(fd.get('minOrderAmount')) || 0,
      maxDiscount: Number(fd.get('maxDiscount')) || 0,
      usageLimit: Number(fd.get('usageLimit')) || 0,
      validFrom: fd.get('validFrom') ? new Date(fd.get('validFrom')).toISOString() : null,
      validUntil: fd.get('validUntil') ? new Date(fd.get('validUntil')).toISOString() : null,
      isActive: fd.get('isActive') !== null,
    };
    if (!data.code || !(data.value > 0)) {
      toast('Enter a code and a positive value', 'err');
      return;
    }
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      if (c) await API.updateCoupon(c.id, data);
      else await API.createCoupon(data);
      toast(c ? 'Coupon updated ✨' : 'Coupon created ✨');
      closeModal();
      loadCoupons(state.coupons.page);
    } catch (err) {
      toast(err.message, 'err');
      btn.disabled = false;
    }
  });
}

async function toggleCoupon(id, code) {
  try {
    await API.toggleCoupon(id);
    toast(`Coupon ${code} ${state.coupons.items.find((c) => c.id === id)?.isActive ? 'deactivated' : 'activated'}`);
    loadCoupons(state.coupons.page);
  } catch (err) {
    toast(err.message, 'err');
  }
}

async function deleteCoupon(id, code) {
  if (!confirm(`Delete coupon "${code}"? Existing orders keep their discount.`)) return;
  try {
    await API.deleteCoupon(id);
    toast('Coupon deleted');
    loadCoupons(state.coupons.page);
  } catch (err) {
    toast(err.message, 'err');
  }
}

// ============================================================
// USERS
// ============================================================
function userActions() {
  return `<input type="search" id="userSearch" placeholder="Search customers…" style="padding:9px 13px;border:1.5px solid var(--line);border-radius:10px;font-family:inherit" />
    <button class="btn" onclick="state.users.search=document.getElementById('userSearch').value;loadUsers(1)">Search</button>`;
}

async function renderUsers() {
  const body = $('#viewBody');
  body.innerHTML = `
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th>Orders</th><th>Joined</th><th>Status</th></tr></thead>
      <tbody id="userRows"><tr><td colspan="6" class="empty">Loading…</td></tr></tbody>
    </table></div><div class="pagination" id="userPager"></div></div>`;
  await loadUsers(1);
}

async function loadUsers(page = 1) {
  state.users.page = page;
  const rows = $('#userRows');
  const pager = $('#userPager');
  try {
    const params = { page, limit: 15 };
    if (state.users.search) params.search = state.users.search;
    const res = await API.getUsers(params);
    if (!res.items.length) {
      rows.innerHTML = `<tr><td colspan="6" class="empty"><div class="empty-icon">👤</div>No customers yet.</td></tr>`;
      pager.innerHTML = '';
      return;
    }
    rows.innerHTML = res.items.map((u) => `
      <tr>
        <td><strong>${esc(u.firstName || '—')} ${esc(u.lastName || '')}</strong></td>
        <td>${esc(u.email)}</td>
        <td>${esc(u.phone || '—')}</td>
        <td>${u._count?.orders ?? 0}</td>
        <td>${new Date(u.createdAt).toLocaleDateString()}</td>
        <td><span class="badge-pill ${u.isActive ? 'new' : 'sold'}">${u.isActive ? 'Active' : 'Disabled'}</span></td>
      </tr>`).join('');
    const pages = Math.max(1, Math.ceil(res.pagination.total / 15));
    pager.innerHTML = `<span>Page ${page} of ${pages} · ${res.pagination.total} customers</span>
      <button class="btn btn-sm" ${page <= 1 ? 'disabled' : ''} onclick="loadUsers(${page - 1})">← Prev</button>
      <button class="btn btn-sm" ${page >= pages ? 'disabled' : ''} onclick="loadUsers(${page + 1})">Next →</button>`;
  } catch (err) {
    rows.innerHTML = `<tr><td colspan="6" class="empty">${esc(err.message)}</td></tr>`;
  }
}

// ============================================================
// Boot
// ============================================================
(async function boot() {
  try {
    const me = await API.me();
    $('#adminEmail').textContent = me.admin?.email || 'Admin';
  } catch {
    API.logout();
    return;
  }
  switchView('dashboard');
})();