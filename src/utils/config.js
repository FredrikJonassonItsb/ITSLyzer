/**
 * Konfiguration för Outlook-Nextcloud Integration
 */

const CONFIG = {
  // Nextcloud-server
  NEXTCLOUD_URL: 'https://demo.hubs.se',
  
  // OAuth2-inställningar
  OAUTH: {
    CLIENT_ID: 'outlook-integrator',
    REDIRECT_URI: window.location.origin + '/outlook-addin/src/auth/auth-callback.html',
    AUTHORIZE_ENDPOINT: '/apps/oauth2/authorize',
    TOKEN_ENDPOINT: '/apps/oauth2/api/v1/token',
    SCOPES: [] // Nextcloud OAuth2 använder inte scopes, ger full åtkomst
  },
  
  // API-endpoints
  API: {
    BASE_PATH: '/apps/outlook_integrator/api/v1',
    ENDPOINTS: {
      CREATE_MEETING: '/meeting',
      GET_STATUS: '/status',
      VERIFY_AUTH: '/auth/verify'
    }
  },
  
  // Lokalisering
  DEFAULT_LOCALE: 'sv-SE',
  SUPPORTED_LOCALES: ['sv-SE', 'en-US'],
  
  // Token-inställningar
  TOKEN: {
    STORAGE_KEY: 'nextcloud_tokens',
    REFRESH_THRESHOLD: 300 // Förnya token 5 minuter innan den går ut
  },
  
  // UI-inställningar
  UI: {
    DIALOG_WIDTH: 30,
    DIALOG_HEIGHT: 60,
    TASKPANE_HEIGHT: 450
  }
};

// Exportera konfiguration
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
} else {
  window.CONFIG = CONFIG;
}

