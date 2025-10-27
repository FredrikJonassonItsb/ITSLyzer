/**
 * Säker lagring av tokens och användardata
 */

class SecureStorage {
  constructor() {
    this.storageKey = CONFIG.TOKEN.STORAGE_KEY;
  }

  /**
   * Spara tokens säkert
   */
  saveTokens(tokens) {
    try {
      const data = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        token_type: tokens.token_type,
        timestamp: Date.now()
      };
      
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Fel vid lagring av tokens:', error);
      return false;
    }
  }

  /**
   * Hämta tokens
   */
  getTokens() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (!data) return null;
      
      return JSON.parse(data);
    } catch (error) {
      console.error('Fel vid hämtning av tokens:', error);
      return null;
    }
  }

  /**
   * Hämta access token
   */
  getAccessToken() {
    const tokens = this.getTokens();
    return tokens ? tokens.access_token : null;
  }

  /**
   * Hämta refresh token
   */
  getRefreshToken() {
    const tokens = this.getTokens();
    return tokens ? tokens.refresh_token : null;
  }

  /**
   * Kontrollera om token har gått ut
   */
  isTokenExpired() {
    const tokens = this.getTokens();
    if (!tokens) return true;
    
    const expirationTime = tokens.timestamp + (tokens.expires_in * 1000);
    const now = Date.now();
    const threshold = CONFIG.TOKEN.REFRESH_THRESHOLD * 1000;
    
    // Returnera true om token har gått ut eller är nära att gå ut
    return (expirationTime - now) < threshold;
  }

  /**
   * Rensa tokens (vid utloggning)
   */
  clearTokens() {
    try {
      localStorage.removeItem(this.storageKey);
      return true;
    } catch (error) {
      console.error('Fel vid rensning av tokens:', error);
      return false;
    }
  }

  /**
   * Kontrollera om användaren är inloggad
   */
  isAuthenticated() {
    const tokens = this.getTokens();
    return tokens !== null && tokens.access_token !== undefined;
  }
}

// Skapa singleton-instans
const storage = new SecureStorage();

// Exportera
if (typeof module !== 'undefined' && module.exports) {
  module.exports = storage;
} else {
  window.SecureStorage = storage;
}

