// Browser-side OmadaAPI wrapper that talks to a proxy server.
// IMPORTANT: This does NOT talk directly to the OC200 controller.
// It calls your proxy (omada-proxy-server.js) which lives on the same LAN as the controller.

class OmadaAPI {
  constructor({ baseUrl }) {
    this.baseUrl = (baseUrl || '').replace(/\/+$/, '');
  }

  async _get(path, params = {}) {
    const url = new URL(this.baseUrl + path);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });

    const r = await fetch(url.toString(), { method: 'GET' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Request failed');
    return j;
  }

  async getSites() {
    return this._get('/api/sites');
  }

  async getClients(siteId) {
    return this._get('/api/clients', { siteId });
  }

  async getHotspotVouchers(siteId) {
    return this._get('/api/hotspot/vouchers', { siteId });
  }

  async getHotspotSessions(siteId) {
    return this._get('/api/hotspot/sessions', { siteId });
  }
}
