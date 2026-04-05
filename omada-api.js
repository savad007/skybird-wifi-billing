/**
 * Omada Open API Integration Module
 * Handles OAuth 2.0 authentication and API calls to Omada Controller
 */

class OmadaAPI {
  constructor(config) {
    this.baseUrl = config.baseUrl || 'https://192.168.1.4:443';
    this.clientId = config.clientId || '21d1de0f4b014ed3aeccc923164d1a3c';
    this.clientSecret = config.clientSecret || '4f4bd103166ce59bde98891b14e1b270';
    this.loginUrl = config.loginUrl || 'https://192.168.1.4:443/openapi/login';
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Get OAuth 2.0 access token using Client Credentials flow
   */
  async getAccessToken() {
    try {
      // Check if token is still valid
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      const response = await fetch(`${this.baseUrl}/openapi/authorize/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token request failed: ${response.statusText}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      // Set expiry to 5 minutes before actual expiry for safety
      this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 300000;

      return this.accessToken;
    } catch (error) {
      console.error('Failed to get Omada access token:', error);
      throw error;
    }
  }

  /**
   * Make authenticated API request to Omada
   */
  async apiRequest(endpoint, options = {}) {
    try {
      const token = await this.getAccessToken();

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Omada API request failed:', error);
      throw error;
    }
  }

  /**
   * Get all sites from Omada controller
   */
  async getSites() {
    return this.apiRequest('/openapi/v1/sites');
  }

  /**
   * Get all clients/devices connected to a site
   */
  async getClients(siteId) {
    return this.apiRequest(`/openapi/v1/sites/${siteId}/clients`);
  }

  /**
   * Get hotspot/voucher information
   */
  async getHotspotVouchers(siteId) {
    return this.apiRequest(`/openapi/v1/sites/${siteId}/hotspot/vouchers`);
  }

  /**
   * Get active hotspot sessions
   */
  async getHotspotSessions(siteId) {
    return this.apiRequest(`/openapi/v1/sites/${siteId}/hotspot/sessions`);
  }

  /**
   * Get device/client details
   */
  async getClientDetails(siteId, clientId) {
    return this.apiRequest(`/openapi/v1/sites/${siteId}/clients/${clientId}`);
  }

  /**
   * Get bandwidth usage for a client
   */
  async getClientBandwidth(siteId, clientId) {
    return this.apiRequest(`/openapi/v1/sites/${siteId}/clients/${clientId}/bandwidth`);
  }

  /**
   * Get all networks/SSIDs in a site
   */
  async getNetworks(siteId) {
    return this.apiRequest(`/openapi/v1/sites/${siteId}/networks`);
  }

  /**
   * Get network statistics
   */
  async getNetworkStats(siteId, networkId) {
    return this.apiRequest(`/openapi/v1/sites/${siteId}/networks/${networkId}/stats`);
  }

  /**
   * Disconnect a client
   */
  async disconnectClient(siteId, clientId) {
    return this.apiRequest(`/openapi/v1/sites/${siteId}/clients/${clientId}/disconnect`, {
      method: 'POST',
    });
  }

  /**
   * Create a hotspot voucher
   */
  async createVoucher(siteId, voucherData) {
    return this.apiRequest(`/openapi/v1/sites/${siteId}/hotspot/vouchers`, {
      method: 'POST',
      body: JSON.stringify(voucherData),
    });
  }

  /**
   * Delete a hotspot voucher
   */
  async deleteVoucher(siteId, voucherId) {
    return this.apiRequest(`/openapi/v1/sites/${siteId}/hotspot/vouchers/${voucherId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get real-time client activity
   */
  async getClientActivity(siteId, clientId) {
    return this.apiRequest(`/openapi/v1/sites/${siteId}/clients/${clientId}/activity`);
  }

  /**
   * Sync voucher data with Supabase
   */
  async syncVouchersToSupabase(supabaseUrl, supabaseKey, siteId) {
    try {
      const vouchers = await this.getHotspotVouchers(siteId);
      const sessions = await this.getHotspotSessions(siteId);

      // Transform Omada data to match your customer schema
      const syncData = {
        vouchers: vouchers.data || [],
        sessions: sessions.data || [],
        lastSync: new Date().toISOString(),
      };

      // Store sync data in Supabase
      const response = await fetch(`${supabaseUrl}/rest/v1/omada_sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(syncData),
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to sync vouchers to Supabase:', error);
      throw error;
    }
  }
}

// Export for use in browser
if (typeof window !== 'undefined') {
  window.OmadaAPI = OmadaAPI;
}
