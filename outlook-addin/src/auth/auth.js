/**
 * OAuth2-autentisering med PKCE för Nextcloud
 */

class OAuth2Client {
  constructor() {
    this.config = CONFIG.OAUTH;
    this.baseUrl = CONFIG.NEXTCLOUD_URL;
  }

  /**
   * Generera slumpmässig sträng för PKCE
   */
  generateRandomString(length) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset[randomValues[i] % charset.length];
    }
    return result;
  }

  /**
   * Skapa SHA-256 hash
   */
  async sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return hash;
  }

  /**
   * Base64URL-kodning
   */
  base64UrlEncode(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Generera PKCE code challenge
   */
  async generateCodeChallenge(codeVerifier) {
    const hashed = await this.sha256(codeVerifier);
    return this.base64UrlEncode(hashed);
  }

  /**
   * Initiera OAuth2-inloggning
   */
  async login() {
    try {
      // Generera PKCE-parametrar
      const codeVerifier = this.generateRandomString(128);
      const codeChallenge = await this.generateCodeChallenge(codeVerifier);
      const state = this.generateRandomString(32);
      
      // Spara för senare användning
      sessionStorage.setItem('oauth_code_verifier', codeVerifier);
      sessionStorage.setItem('oauth_state', state);
      
      // Bygg authorization URL
      const authUrl = new URL(this.baseUrl + this.config.AUTHORIZE_ENDPOINT);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('client_id', this.config.CLIENT_ID);
      authUrl.searchParams.append('redirect_uri', this.config.REDIRECT_URI);
      authUrl.searchParams.append('code_challenge', codeChallenge);
      authUrl.searchParams.append('code_challenge_method', 'S256');
      authUrl.searchParams.append('state', state);
      
      // Öppna inloggningsdialog
      return new Promise((resolve, reject) => {
        Office.context.ui.displayDialogAsync(
          authUrl.toString(),
          { height: CONFIG.UI.DIALOG_HEIGHT, width: CONFIG.UI.DIALOG_WIDTH },
          (asyncResult) => {
            if (asyncResult.status === Office.AsyncResultStatus.Failed) {
              reject(new Error('Kunde inte öppna inloggningsdialog: ' + asyncResult.error.message));
              return;
            }
            
            const dialog = asyncResult.value;
            
            // Lyssna på meddelanden från dialogen
            dialog.addEventHandler(Office.EventType.DialogMessageReceived, async (arg) => {
              dialog.close();
              
              try {
                const response = JSON.parse(arg.message);
                
                if (response.error) {
                  reject(new Error(response.error));
                  return;
                }
                
                // Spara tokens
                SecureStorage.saveTokens(response);
                resolve(response);
              } catch (error) {
                reject(error);
              }
            });
            
            // Hantera stängning av dialog
            dialog.addEventHandler(Office.EventType.DialogEventReceived, (arg) => {
              if (arg.error === 12006) {
                // Användaren stängde dialogen
                reject(new Error('Inloggning avbruten av användaren'));
              } else {
                reject(new Error('Dialog-fel: ' + arg.error));
              }
            });
          }
        );
      });
    } catch (error) {
      console.error('OAuth2 login error:', error);
      throw error;
    }
  }

  /**
   * Byt authorization code mot tokens
   * (Används i callback-sidan)
   */
  async exchangeCodeForTokens(code, state) {
    try {
      // Verifiera state
      const savedState = sessionStorage.getItem('oauth_state');
      if (state !== savedState) {
        throw new Error('State mismatch - möjlig CSRF-attack');
      }
      
      // Hämta code verifier
      const codeVerifier = sessionStorage.getItem('oauth_code_verifier');
      if (!codeVerifier) {
        throw new Error('Code verifier saknas');
      }
      
      // Byt code mot tokens
      const tokenUrl = this.baseUrl + this.config.TOKEN_ENDPOINT;
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: this.config.REDIRECT_URI,
          client_id: this.config.CLIENT_ID,
          code_verifier: codeVerifier
        })
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error('Token exchange failed: ' + errorData);
      }
      
      const tokens = await response.json();
      
      // Rensa session storage
      sessionStorage.removeItem('oauth_code_verifier');
      sessionStorage.removeItem('oauth_state');
      
      return tokens;
    } catch (error) {
      console.error('Token exchange error:', error);
      throw error;
    }
  }

  /**
   * Förnya access token med refresh token
   */
  async refreshAccessToken() {
    try {
      const refreshToken = SecureStorage.getRefreshToken();
      if (!refreshToken) {
        throw new Error('Ingen refresh token tillgänglig');
      }
      
      const tokenUrl = this.baseUrl + this.config.TOKEN_ENDPOINT;
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.config.CLIENT_ID
        })
      });
      
      if (!response.ok) {
        throw new Error('Token refresh failed');
      }
      
      const tokens = await response.json();
      SecureStorage.saveTokens(tokens);
      
      return tokens.access_token;
    } catch (error) {
      console.error('Token refresh error:', error);
      // Rensa tokens och kräv ny inloggning
      SecureStorage.clearTokens();
      throw error;
    }
  }

  /**
   * Logga ut
   */
  logout() {
    SecureStorage.clearTokens();
    sessionStorage.clear();
  }

  /**
   * Kontrollera om användaren är inloggad
   */
  isAuthenticated() {
    return SecureStorage.isAuthenticated();
  }

  /**
   * Hämta giltig access token (förnya om nödvändigt)
   */
  async getValidAccessToken() {
    if (!this.isAuthenticated()) {
      throw new Error('Användaren är inte inloggad');
    }
    
    // Kontrollera om token behöver förnyas
    if (SecureStorage.isTokenExpired()) {
      return await this.refreshAccessToken();
    }
    
    return SecureStorage.getAccessToken();
  }
}

// Skapa singleton-instans
const authClient = new OAuth2Client();

// Exportera
if (typeof module !== 'undefined' && module.exports) {
  module.exports = authClient;
} else {
  window.OAuth2Client = authClient;
}

