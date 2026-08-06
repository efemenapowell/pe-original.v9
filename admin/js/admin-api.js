// ============================================================
// admin/js/admin-api.js — Admin API client
// Handles JWT storage, silent refresh, and all admin endpoints.
// Works with the Express backend (see backend/src/routes).
// ============================================================
class AdminAPI {
  constructor(baseURL) {
    // API base — same origin in production (served by Express),
    // or override with window.PEO_API_URL for separate deployments.
    this.base = baseURL || window.PEO_API_URL || '';
    this.accessKey = 'peo_admin_access';
    this.refreshKey = 'peo_admin_refresh';
    this._refreshPromise = null;
  }

  // ---- token helpers ----
  getAccess() { return localStorage.getItem(this.accessKey) || ''; }
  getRefresh() { return localStorage.getItem(this.refreshKey) || ''; }
  isAuthed() { return !!this.getAccess(); }

  saveTokens(access, refresh) {
    localStorage.setItem(this.accessKey, access);
    if (refresh) localStorage.setItem(this.refreshKey, refresh);
  }

  clearTokens() {
    localStorage.removeItem(this.accessKey);
    localStorage.removeItem(this.refreshKey);
  }

  logout() {
    this.clearTokens();
    window.location.replace('login.html');
  }

  // ---- core request with auto-refresh ----
  async request(method, path, body, isForm = false) {
    const headers = {};
    const access = this.getAccess();
    if (access) headers['Authorization'] = `Bearer ${access}`;
    if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json';

    let response;
    try {
      response = await fetch(this.base + path, {
        method,
        headers,
        body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (netErr) {
      throw new Error('Cannot reach the server. Is the backend running?');
    }

    // Token expired? Try one silent refresh, then retry once.
    if (response.status === 401 && this.getRefresh() && !path.includes('/auth/')) {
      const refreshed = await this._refresh();
      if (refreshed) {
        return this.request(method, path, body, isForm);
      }
      this.logout();
      throw new Error('Session expired — please sign in again.');
    }

    const data = await response.json().catch(() => ({ success: false, error: { message: 'Invalid server response' } }));
    if (!response.ok) {
      const msg = data?.error?.message || `Request failed (${response.status})`;
      const err = new Error(msg);
      err.details = data?.error?.details;
      throw err;
    }
    return data?.data ?? data;
  }

  async _refresh() {
    if (this._refreshPromise) return this._refreshPromise;
    this._refreshPromise = (async () => {
      try {
        const res = await fetch(this.base + '/api/admin/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: this.getRefresh() }),
        });
        const data = await res.json();
        if (!res.ok || !data?.data?.accessToken) return false;
        this.saveTokens(data.data.accessToken, data.data.refreshToken);
        return true;
      } catch {
        return false;
      } finally {
        this._refreshPromise = null;
      }
    })();
    return this._refreshPromise;
  }

  // ---- auth ----
  login(email, password) {
    return this.request('POST', '/api/admin/auth/login', { email, password });
  }
  me() { return this.request('GET', '/api/admin/auth/me'); }
  forgotPassword(email) {
    return this.request('POST', '/api/admin/auth/forgot-password', { email });
  }
  resetPassword(token, password) {
    return this.request('POST', '/api/admin/auth/reset-password', { token, password });
  }

  // ---- products ----
  getProducts(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request('GET', `/api/admin/products${qs ? '?' + qs : ''}`);
  }
  createProduct(formData) {
    return this.request('POST', '/api/admin/products', formData, true);
  }
  updateProduct(id, formData) {
    return this.request('PUT', `/api/admin/products/${id}`, formData, true);
  }
  deleteProduct(id) {
    return this.request('DELETE', `/api/admin/products/${id}`);
  }

  // ---- categories ----
  getCategories() { return this.request('GET', '/api/admin/categories'); }
  createCategory(data) { return this.request('POST', '/api/admin/categories', data, true); }
  updateCategory(id, data) { return this.request('PUT', `/api/admin/categories/${id}`, data, true); }
  deleteCategory(id) { return this.request('DELETE', `/api/admin/categories/${id}`); }

  // ---- content ----
  getContent() { return this.request('GET', '/api/admin/content'); }
  saveContentBlock(data) { return this.request('POST', '/api/admin/content', data); }
  deleteContentBlock(key) { return this.request('DELETE', `/api/admin/content/${encodeURIComponent(key)}`); }

  // ---- coupons ----
  getCoupons(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request('GET', `/api/admin/coupons${qs ? '?' + qs : ''}`);
  }
  createCoupon(data) { return this.request('POST', '/api/admin/coupons', data); }
  updateCoupon(id, data) { return this.request('PUT', `/api/admin/coupons/${id}`, data); }
  toggleCoupon(id) { return this.request('PATCH', `/api/admin/coupons/${id}/toggle`); }
  deleteCoupon(id) { return this.request('DELETE', `/api/admin/coupons/${id}`); }

  // ---- orders ----
  getOrders(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request('GET', `/api/admin/orders${qs ? '?' + qs : ''}`);
  }
  getOrder(id) { return this.request('GET', `/api/admin/orders/${id}`); }
  updateOrderStatus(id, data) {
    return this.request('PATCH', `/api/admin/orders/${id}/status`, data);
  }

  // ---- users ----
  getUsers(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request('GET', `/api/admin/users${qs ? '?' + qs : ''}`);
  }
}