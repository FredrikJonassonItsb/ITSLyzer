/**
 * Lokal konfiguration för utveckling
 * 
 * Denna fil används när du kör Nextcloud lokalt.
 * Inkludera denna fil FÖRE config.js i dina HTML-filer för att override standardkonfigurationen.
 * 
 * Exempel i HTML:
 * <script src="utils/config.local.js"></script>
 * <script src="utils/config.js"></script>
 */

const ConfigLocal = {
  // Nextcloud-server (lokal)
  nextcloudUrl: 'https://nextcloud.local',
  
  // OAuth2-konfiguration
  oauth: {
    clientId: 'outlook-integrator',
    authorizationEndpoint: 'https://nextcloud.local/apps/oauth2/authorize',
    tokenEndpoint: 'https://nextcloud.local/apps/oauth2/api/v1/token',
    redirectUri: 'http://localhost:5500/outlook-addin/src/auth/auth-callback.html',
    scope: 'openid profile email'
  },
  
  // API-endpoints
  api: {
    baseUrl: 'https://nextcloud.local/apps/outlook_integrator/api/v1',
    endpoints: {
      status: '/status',
      createMeeting: '/meeting',
      verifyAuth: '/auth/verify'
    }
  },
  
  // Debug-läge
  debug: true
};

// Logga att lokal config laddats
if (typeof console !== 'undefined') {
  console.log('🔧 Lokal konfiguration laddad för utveckling');
  console.log('Nextcloud URL:', ConfigLocal.nextcloudUrl);
  console.log('Redirect URI:', ConfigLocal.oauth.redirectUri);
}

