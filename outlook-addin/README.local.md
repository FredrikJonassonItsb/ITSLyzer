# Lokal utveckling - Outlook Add-in

Denna guide beskriver hur du kör Outlook-tillägget lokalt för utveckling och testning.

## Snabbstart

### 1. Starta lokal Nextcloud

```bash
# Från projektets rotkatalog
./setup-local.sh
```

Detta script kommer att:
- Skapa SSL-certifikat med mkcert
- Uppdatera hosts-filen
- Starta Nextcloud i Docker
- Installera Talk, Calendar och OAuth2
- Aktivera Outlook Integrator-appen
- Konfigurera CORS

### 2. Konfigurera OAuth2

1. Öppna https://nextcloud.local
2. Logga in med:
   - Användarnamn: `admin`
   - Lösenord: `admin123`
3. Gå till **Inställningar > Säkerhet > OAuth 2.0**
4. Klicka **Lägg till klient**
5. Fyll i:
   - **Namn**: Outlook Integrator Local
   - **Redirect URI**: `http://localhost:5500/outlook-addin/src/auth/auth-callback.html`
   - **Typ**: Publik klient
6. Klicka **Lägg till**

### 3. Starta lokal webbserver

**Alternativ 1: Python**
```bash
cd /path/to/ITSLyzer
python3 -m http.server 5500
```

**Alternativ 2: Node.js**
```bash
npm install -g http-server
cd /path/to/ITSLyzer
http-server -p 5500 --cors
```

**Alternativ 3: VS Code Live Server**
- Installera "Live Server"-extension
- Högerklicka på `outlook-addin/src/taskpane/taskpane.html`
- Välj "Open with Live Server"
- Ändra port till 5500 i inställningar

### 4. Installera tillägget i Outlook

**Outlook Web:**
1. Öppna https://outlook.office.com
2. Skapa eller öppna en kalenderhändelse
3. Klicka **...** > **Hämta tillägg**
4. Gå till **Mina tillägg** > **+ Lägg till ett anpassat tillägg** > **Lägg till från URL**
5. Ange: `http://localhost:5500/outlook-addin/manifest.local.xml`
6. Klicka **OK** och **Installera**

**Outlook Desktop:**
1. Öppna Outlook Desktop
2. Gå till **Arkiv** > **Hantera tillägg**
3. Klicka **+ Lägg till tillägg** > **Lägg till från URL**
4. Ange: `http://localhost:5500/outlook-addin/manifest.local.xml`
5. Klicka **OK**

## Filstruktur

```
outlook-addin/
├── manifest.xml              # Produktion (GitHub Pages)
├── manifest.local.xml        # Lokal utveckling
├── src/
│   ├── taskpane/
│   │   ├── taskpane.html     # Huvudgränssnitt
│   │   ├── taskpane.css      # Stilar
│   │   └── taskpane.js       # Huvudlogik
│   ├── auth/
│   │   ├── auth.js           # OAuth2-klient
│   │   └── auth-callback.html # OAuth callback
│   ├── api/
│   │   └── nextcloud-client.js # API-klient
│   └── utils/
│       ├── config.js         # Standardkonfiguration
│       ├── config.local.js   # Lokal override
│       ├── storage.js        # Token-hantering
│       └── i18n.js           # Översättningar
└── assets/
    └── icons/                # Ikoner
```

## Konfiguration

### config.local.js

Denna fil används för lokal utveckling och overridar `config.js`:

```javascript
const ConfigLocal = {
  nextcloudUrl: 'https://nextcloud.local',
  oauth: {
    clientId: 'outlook-integrator',
    authorizationEndpoint: 'https://nextcloud.local/apps/oauth2/authorize',
    tokenEndpoint: 'https://nextcloud.local/apps/oauth2/api/v1/token',
    redirectUri: 'http://localhost:5500/outlook-addin/src/auth/auth-callback.html',
    scope: 'openid profile email'
  },
  api: {
    baseUrl: 'https://nextcloud.local/apps/outlook_integrator/api/v1'
  },
  debug: true
};
```

### Inkludera i HTML

För att använda lokal konfiguration, inkludera `config.local.js` FÖRE `config.js`:

```html
<script src="utils/config.local.js"></script>
<script src="utils/config.js"></script>
```

## Debugging

### Webbläsarens utvecklarverktyg

1. Öppna Outlook-tillägget
2. Högerklicka > **Inspektera** (eller F12)
3. Gå till **Console** för JavaScript-fel
4. Gå till **Network** för API-anrop

### Nextcloud-loggar

```bash
# Visa loggar i realtid
docker logs -f nextcloud-app

# Visa Nextcloud-apploggar
docker exec nextcloud-app tail -f /var/www/html/data/nextcloud.log
```

### Aktivera debug-läge

I `config.local.js`, sätt `debug: true` för att logga extra information till konsolen.

## Vanliga problem

### CORS-fel

**Problem:** "Access to fetch at 'https://nextcloud.local/...' from origin 'http://localhost:5500' has been blocked by CORS policy"

**Lösning:**
```bash
docker exec -u www-data nextcloud-app php occ config:app:set outlook_integrator allowed_origins --value "http://localhost:5500,http://127.0.0.1:5500"
```

### OAuth2 redirect misslyckas

**Problem:** Efter inloggning händer ingenting

**Lösning:**
1. Kontrollera att redirect URI i OAuth2-klienten är exakt: `http://localhost:5500/outlook-addin/src/auth/auth-callback.html`
2. Kontrollera att `config.local.js` har samma redirect URI
3. Kontrollera webbläsarens konsol för fel

### Certifikatfel

**Problem:** "NET::ERR_CERT_AUTHORITY_INVALID" i webbläsaren

**Lösning:**
```bash
# Installera om mkcert CA
mkcert -install

# Starta om webbläsaren
```

### Tillägget laddas inte

**Problem:** Outlook visar fel när tillägget installeras

**Lösning:**
1. Kontrollera att webbservern körs: `curl http://localhost:5500/outlook-addin/manifest.local.xml`
2. Validera manifest-syntax: Öppna manifest.local.xml i webbläsaren
3. Kontrollera att alla URL:er i manifestet är korrekta

## Hot reload

För att automatiskt ladda om tillägget när du ändrar kod:

1. Använd VS Code Live Server (rekommenderat)
2. Eller använd `browser-sync`:
   ```bash
   npm install -g browser-sync
   cd /path/to/ITSLyzer
   browser-sync start --server --port 5500 --files "outlook-addin/**/*"
   ```

## Testa API direkt

```bash
# Hämta status (utan autentisering)
curl -k https://nextcloud.local/apps/outlook_integrator/api/v1/status

# Med autentisering (ersätt <token>)
curl -k -H "Authorization: Bearer <token>" \
  https://nextcloud.local/apps/outlook_integrator/api/v1/status

# Skapa möte (ersätt <token>)
curl -k -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Testmöte",
    "start": "2024-12-01T10:00:00Z",
    "end": "2024-12-01T11:00:00Z",
    "participants": [
      {
        "email": "test@example.com",
        "displayName": "Test User",
        "settings": {}
      }
    ]
  }' \
  https://nextcloud.local/apps/outlook_integrator/api/v1/meeting
```

## Byta till produktion

När du är redo att testa mot produktion:

1. Använd `manifest.xml` istället för `manifest.local.xml`
2. Ta bort eller kommentera ut `<script src="utils/config.local.js"></script>` i HTML-filer
3. Installera tillägget från GitHub Pages: `https://fredrikjonassonitsb.github.io/ITSLyzer/outlook-addin/manifest.xml`

## Resurser

- **Office Add-ins dokumentation**: https://learn.microsoft.com/en-us/office/dev/add-ins/
- **Office.js API**: https://learn.microsoft.com/en-us/javascript/api/office
- **Nextcloud API**: https://docs.nextcloud.com/server/latest/developer_manual/
- **OAuth2 PKCE**: https://oauth.net/2/pkce/

## Support

För frågor om lokal utveckling, skapa ett issue på GitHub:
https://github.com/FredrikJonassonItsb/ITSLyzer/issues

