/**
 * API-klient för Nextcloud Outlook Integrator
 */

class NextcloudAPIClient {
  constructor() {
    this.baseUrl = CONFIG.NEXTCLOUD_URL;
    this.apiBasePath = CONFIG.API.BASE_PATH;
  }

  /**
   * Gör ett autentiserat API-anrop
   */
  async request(endpoint, options = {}) {
    try {
      // Hämta giltig access token
      const token = await OAuth2Client.getValidAccessToken();
      
      // Bygg URL
      const url = this.baseUrl + this.apiBasePath + endpoint;
      
      // Förbered request
      const requestOptions = {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers
        }
      };
      
      // Gör request
      const response = await fetch(url, requestOptions);
      
      // Hantera 401 (token expired) - försök förnya
      if (response.status === 401) {
        try {
          // Försök förnya token
          const newToken = await OAuth2Client.refreshAccessToken();
          
          // Försök igen med ny token
          requestOptions.headers['Authorization'] = `Bearer ${newToken}`;
          const retryResponse = await fetch(url, requestOptions);
          
          if (!retryResponse.ok) {
            throw new Error(`API request failed: ${retryResponse.status} ${retryResponse.statusText}`);
          }
          
          return await retryResponse.json();
        } catch (refreshError) {
          // Token refresh misslyckades, kräv ny inloggning
          throw new Error('Authentication expired. Please log in again.');
        }
      }
      
      // Hantera andra fel
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`API request failed: ${response.status} - ${errorData}`);
      }
      
      // Returnera JSON-svar
      return await response.json();
      
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }

  /**
   * Skapa Nextcloud Talk-möte med kalenderintegration
   */
  async createMeeting(meetingData) {
    try {
      const response = await this.request(CONFIG.API.ENDPOINTS.CREATE_MEETING, {
        method: 'POST',
        body: JSON.stringify(meetingData)
      });
      
      return response;
    } catch (error) {
      console.error('Create meeting error:', error);
      throw error;
    }
  }

  /**
   * Verifiera autentisering och hämta användarinfo
   */
  async verifyAuth() {
    try {
      const response = await this.request(CONFIG.API.ENDPOINTS.VERIFY_AUTH, {
        method: 'POST'
      });
      
      return response;
    } catch (error) {
      console.error('Verify auth error:', error);
      throw error;
    }
  }

  /**
   * Hämta status för Nextcloud-appen
   */
  async getStatus() {
    try {
      const response = await this.request(CONFIG.API.ENDPOINTS.GET_STATUS, {
        method: 'GET'
      });
      
      return response;
    } catch (error) {
      console.error('Get status error:', error);
      throw error;
    }
  }
}

// Skapa singleton-instans
const apiClient = new NextcloudAPIClient();

// Exportera
if (typeof module !== 'undefined' && module.exports) {
  module.exports = apiClient;
} else {
  window.NextcloudAPIClient = apiClient;
}

