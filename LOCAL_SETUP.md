# Lokal Nextcloud-installation för Outlook-integration

Denna guide beskriver hur du sätter upp en lokal Nextcloud-instans på din dator för att testa och utveckla Outlook-integrationen.

## Översikt

För att köra integrationen lokalt behöver du:

1. **Lokal Nextcloud-server** (via Docker eller XAMPP/MAMP)
2. **HTTPS med giltigt certifikat** (krävs för OAuth2 och Office.js)
3. **Lokalt DNS eller hosts-fil** för att nå servern
4. **Outlook-tillägget** (hostat lokalt eller via GitHub Pages)

## Metod 1: Docker (Rekommenderat)

### Förutsättningar

- Docker och Docker Compose installerat
- Minst 4GB RAM tillgängligt
- Port 80 och 443 lediga

### Steg 1: Skapa Docker-miljö

```bash
# Skapa projektmapp
mkdir ~/nextcloud-local
cd ~/nextcloud-local

# Skapa docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3'

services:
  db:
    image: mariadb:10.11
    restart: always
    command: --transaction-isolation=READ-COMMITTED --log-bin=binlog --binlog-format=ROW
    volumes:
      - db:/var/lib/mysql
    environment:
      - MYSQL_ROOT_PASSWORD=nextcloud
      - MYSQL_PASSWORD=nextcloud
      - MYSQL_DATABASE=nextcloud
      - MYSQL_USER=nextcloud
    networks:
      - nextcloud

  redis:
    image: redis:alpine
    restart: always
    networks:
      - nextcloud

  nextcloud:
    image: nextcloud:28-apache
    restart: always
    ports:
      - 8080:80
    volumes:
      - nextcloud:/var/www/html
      - ./custom_apps:/var/www/html/custom_apps
    environment:
      - MYSQL_HOST=db
      - MYSQL_PASSWORD=nextcloud
      - MYSQL_DATABASE=nextcloud
      - MYSQL_USER=nextcloud
      - REDIS_HOST=redis
      - NEXTCLOUD_ADMIN_USER=admin
      - NEXTCLOUD_ADMIN_PASSWORD=admin123
      - NEXTCLOUD_TRUSTED_DOMAINS=localhost nextcloud.local
      - OVERWRITEPROTOCOL=https
      - OVERWRITEHOST=nextcloud.local
    depends_on:
      - db
      - redis
    networks:
      - nextcloud

volumes:
  db:
  nextcloud:

networks:
  nextcloud:
EOF

# Starta Nextcloud
docker-compose up -d
```

### Steg 2: Vänta på att Nextcloud startar

```bash
# Följ loggarna
docker-compose logs -f nextcloud

# Vänta tills du ser: "Apache/2.4.x configured -- resuming normal operations"
# Tryck Ctrl+C för att avsluta loggvisning
```

### Steg 3: Konfigurera hosts-fil

**Windows:**
```powershell
# Öppna Notepad som administratör
# Öppna: C:\Windows\System32\drivers\etc\hosts
# Lägg till:
127.0.0.1 nextcloud.local
```

**macOS/Linux:**
```bash
sudo nano /etc/hosts
# Lägg till:
127.0.0.1 nextcloud.local
```

### Steg 4: Installera Outlook Integrator-appen

```bash
# Kopiera appen till custom_apps
cd ~/nextcloud-local
mkdir -p custom_apps
cp -r /path/to/ITSLyzer/nextcloud-app/outlook_integrator custom_apps/

# Gå in i Nextcloud-containern
docker exec -it nextcloud-local-nextcloud-1 bash

# Installera beroenden (om PHP-composer behövs)
apt-get update && apt-get install -y unzip

# Aktivera appen
su -s /bin/bash www-data -c "php occ app:enable outlook_integrator"

# Aktivera Talk och Calendar
su -s /bin/bash www-data -c "php occ app:install spreed"
su -s /bin/bash www-data -c "php occ app:install calendar"
su -s /bin/bash www-data -c "php occ app:enable spreed"
su -s /bin/bash www-data -c "php occ app:enable calendar"

# Avsluta containern
exit
```

### Steg 5: Konfigurera HTTPS med mkcert

**Installera mkcert:**

```bash
# macOS
brew install mkcert
brew install nss # för Firefox

# Linux
sudo apt install libnss3-tools
wget https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64
chmod +x mkcert-v1.4.4-linux-amd64
sudo mv mkcert-v1.4.4-linux-amd64 /usr/local/bin/mkcert

# Windows (via Chocolatey)
choco install mkcert
```

**Skapa certifikat:**

```bash
# Installera lokal CA
mkcert -install

# Skapa certifikat för nextcloud.local
cd ~/nextcloud-local
mkdir certs
cd certs
mkcert nextcloud.local localhost 127.0.0.1 ::1

# Detta skapar:
# - nextcloud.local+3.pem (certifikat)
# - nextcloud.local+3-key.pem (privat nyckel)
```

**Uppdatera docker-compose.yml:**

```bash
cd ~/nextcloud-local
cat > docker-compose.yml << 'EOF'
version: '3'

services:
  db:
    image: mariadb:10.11
    restart: always
    command: --transaction-isolation=READ-COMMITTED --log-bin=binlog --binlog-format=ROW
    volumes:
      - db:/var/lib/mysql
    environment:
      - MYSQL_ROOT_PASSWORD=nextcloud
      - MYSQL_PASSWORD=nextcloud
      - MYSQL_DATABASE=nextcloud
      - MYSQL_USER=nextcloud
    networks:
      - nextcloud

  redis:
    image: redis:alpine
    restart: always
    networks:
      - nextcloud

  nextcloud:
    image: nextcloud:28-apache
    restart: always
    ports:
      - 443:443
      - 80:80
    volumes:
      - nextcloud:/var/www/html
      - ./custom_apps:/var/www/html/custom_apps
      - ./certs:/certs:ro
      - ./apache-ssl.conf:/etc/apache2/sites-available/default-ssl.conf:ro
    environment:
      - MYSQL_HOST=db
      - MYSQL_PASSWORD=nextcloud
      - MYSQL_DATABASE=nextcloud
      - MYSQL_USER=nextcloud
      - REDIS_HOST=redis
      - NEXTCLOUD_ADMIN_USER=admin
      - NEXTCLOUD_ADMIN_PASSWORD=admin123
      - NEXTCLOUD_TRUSTED_DOMAINS=localhost nextcloud.local
      - OVERWRITEPROTOCOL=https
      - OVERWRITEHOST=nextcloud.local
    depends_on:
      - db
      - redis
    networks:
      - nextcloud

volumes:
  db:
  nextcloud:

networks:
  nextcloud:
EOF

# Skapa Apache SSL-konfiguration
cat > apache-ssl.conf << 'EOF'
<VirtualHost *:443>
    ServerName nextcloud.local
    DocumentRoot /var/www/html

    SSLEngine on
    SSLCertificateFile /certs/nextcloud.local+3.pem
    SSLCertificateKeyFile /certs/nextcloud.local+3-key.pem

    <Directory /var/www/html>
        Options +FollowSymlinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
EOF

# Starta om med HTTPS
docker-compose down
docker-compose up -d

# Aktivera SSL i containern
docker exec -it nextcloud-local-nextcloud-1 bash
a2enmod ssl
a2ensite default-ssl
service apache2 reload
exit
```

### Steg 6: Verifiera installation

Öppna webbläsaren och gå till:
- **HTTP**: http://nextcloud.local
- **HTTPS**: https://nextcloud.local

Logga in med:
- **Användarnamn**: admin
- **Lösenord**: admin123

## Metod 2: XAMPP/MAMP (Windows/Mac)

### För Windows (XAMPP)

1. **Ladda ner XAMPP**: https://www.apachefriends.org/
2. **Installera** med Apache, MySQL och PHP 8.0+
3. **Ladda ner Nextcloud**: https://nextcloud.com/install/#instructions-server
4. **Extrahera** till `C:\xampp\htdocs\nextcloud`
5. **Starta** Apache och MySQL i XAMPP Control Panel
6. **Öppna**: http://localhost/nextcloud
7. **Följ** installationsguiden

### För macOS (MAMP)

1. **Ladda ner MAMP**: https://www.mamp.info/
2. **Installera** och starta MAMP
3. **Ladda ner Nextcloud**
4. **Extrahera** till `/Applications/MAMP/htdocs/nextcloud`
5. **Öppna**: http://localhost:8888/nextcloud
6. **Följ** installationsguiden

## Konfigurera OAuth2 för lokal utveckling

### Steg 1: Installera OAuth2-appen

```bash
# I Nextcloud-containern
docker exec -it nextcloud-local-nextcloud-1 bash
su -s /bin/bash www-data -c "php occ app:install oauth2"
su -s /bin/bash www-data -c "php occ app:enable oauth2"
exit
```

### Steg 2: Skapa OAuth2-klient

1. Logga in på https://nextcloud.local som admin
2. Gå till **Inställningar > Säkerhet**
3. Scrolla ner till **OAuth 2.0**
4. Klicka **Lägg till klient**
5. Fyll i:
   - **Namn**: Outlook Integrator Local
   - **Redirect URI**: 
     - För lokal utveckling: `http://localhost:5500/outlook-addin/src/auth/auth-callback.html`
     - För GitHub Pages: `https://fredrikjonassonitsb.github.io/ITSLyzer/outlook-addin/src/auth/auth-callback.html`
   - **Typ**: Publik klient (för PKCE)
6. Klicka **Lägg till**
7. **Kopiera klient-ID**

### Steg 3: Konfigurera CORS

```bash
# I Nextcloud-containern
docker exec -it nextcloud-local-nextcloud-1 bash

# Lägg till tillåtna origins
su -s /bin/bash www-data -c "php occ config:app:set outlook_integrator allowed_origins --value 'http://localhost:5500,https://fredrikjonassonitsb.github.io'"

# Verifiera
su -s /bin/bash www-data -c "php occ config:app:get outlook_integrator allowed_origins"

exit
```

## Konfigurera Outlook-tillägget för lokal utveckling

### Steg 1: Uppdatera konfiguration

```bash
cd /path/to/ITSLyzer/outlook-addin/src/utils

# Skapa en lokal konfigurationsfil
cat > config.local.js << 'EOF'
/**
 * Lokal konfiguration för utveckling
 */
const Config = {
  // Nextcloud-server
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
  }
};
EOF
```

### Steg 2: Uppdatera config.js

```javascript
// I outlook-addin/src/utils/config.js
// Lägg till i början av filen:

// Ladda lokal config om den finns
if (typeof ConfigLocal !== 'undefined') {
  Object.assign(Config, ConfigLocal);
}
```

### Steg 3: Uppdatera manifest.xml för lokal utveckling

```bash
cd /path/to/ITSLyzer/outlook-addin

# Skapa en lokal version av manifest
cp manifest.xml manifest.local.xml

# Redigera manifest.local.xml och ändra alla URL:er:
# Från: https://fredrikjonassonitsb.github.io/ITSLyzer/outlook-addin/
# Till: http://localhost:5500/outlook-addin/
```

### Steg 4: Starta lokal webbserver

**Alternativ 1: Python**
```bash
cd /path/to/ITSLyzer
python3 -m http.server 5500
```

**Alternativ 2: Node.js (http-server)**
```bash
npm install -g http-server
cd /path/to/ITSLyzer
http-server -p 5500 --cors
```

**Alternativ 3: VS Code Live Server**
1. Installera "Live Server"-extension i VS Code
2. Högerklicka på `outlook-addin/src/taskpane/taskpane.html`
3. Välj "Open with Live Server"

## Installera tillägget i Outlook för lokal testning

### Outlook Web (OWA)

1. Öppna https://outlook.office.com
2. Skapa eller öppna en kalenderhändelse
3. Klicka **...** > **Hämta tillägg**
4. Gå till **Mina tillägg** > **+ Lägg till ett anpassat tillägg** > **Lägg till från URL**
5. Ange: `http://localhost:5500/outlook-addin/manifest.local.xml`
6. Klicka **OK** och **Installera**

### Outlook Desktop (Windows)

1. Öppna Outlook Desktop
2. Gå till **Arkiv** > **Hantera tillägg**
3. Klicka **+ Lägg till tillägg** > **Lägg till från URL**
4. Ange: `http://localhost:5500/outlook-addin/manifest.local.xml`
5. Klicka **OK**

**OBS:** Outlook Desktop kan kräva HTTPS även för lokal utveckling. I så fall, använd GitHub Pages-versionen eller sätt upp lokal HTTPS.

## Felsökning

### Problem: "Mixed Content" fel

**Orsak:** Outlook-tillägget körs över HTTP men försöker anropa HTTPS Nextcloud

**Lösning:**
- Använd HTTPS för både Outlook-tillägget och Nextcloud
- Eller använd HTTP för båda (ej rekommenderat)

### Problem: CORS-fel

**Orsak:** Nextcloud blockerar requests från localhost

**Lösning:**
```bash
docker exec -it nextcloud-local-nextcloud-1 bash
su -s /bin/bash www-data -c "php occ config:app:set outlook_integrator allowed_origins --value 'http://localhost:5500,http://127.0.0.1:5500'"
exit
```

### Problem: OAuth2 redirect misslyckas

**Orsak:** Redirect URI matchar inte konfigurationen

**Lösning:**
1. Kontrollera att redirect URI i OAuth2-klienten är exakt: `http://localhost:5500/outlook-addin/src/auth/auth-callback.html`
2. Kontrollera att `config.local.js` har samma redirect URI

### Problem: Nextcloud Talk-appen saknas

**Lösning:**
```bash
docker exec -it nextcloud-local-nextcloud-1 bash
su -s /bin/bash www-data -c "php occ app:install spreed"
su -s /bin/bash www-data -c "php occ app:enable spreed"
exit
```

### Problem: Certifikatfel i webbläsaren

**Lösning:**
- Kontrollera att mkcert är korrekt installerat: `mkcert -install`
- Starta om webbläsaren efter installation
- För Firefox: Kontrollera att `nss` är installerat

### Problem: Outlook-tillägget laddas inte

**Lösning:**
1. Kontrollera att webbservern körs: `curl http://localhost:5500/outlook-addin/manifest.local.xml`
2. Kontrollera manifest-syntax: Öppna manifest.local.xml i webbläsaren
3. Kontrollera Outlook-loggarna:
   - Windows: `%LOCALAPPDATA%\Microsoft\Office\16.0\Wef\`
   - Mac: `~/Library/Containers/com.microsoft.Outlook/Data/Library/Logs/`

## Debug-tips

### Aktivera verbose logging i Nextcloud

```bash
docker exec -it nextcloud-local-nextcloud-1 bash
su -s /bin/bash www-data -c "php occ config:system:set loglevel --value=0"
exit

# Visa loggar
docker exec -it nextcloud-local-nextcloud-1 tail -f /var/www/html/data/nextcloud.log
```

### Använd webbläsarens utvecklarverktyg

1. Öppna Outlook-tillägget
2. Högerklicka > **Inspektera** (eller F12)
3. Gå till **Console** för JavaScript-fel
4. Gå till **Network** för API-anrop
5. Filtrera på "outlook_integrator" för att se API-requests

### Testa API direkt

```bash
# Hämta status
curl -k https://nextcloud.local/apps/outlook_integrator/api/v1/status

# Med autentisering (ersätt <token> med riktig access token)
curl -k -H "Authorization: Bearer <token>" https://nextcloud.local/apps/outlook_integrator/api/v1/status
```

## Produktionsdrift

När du är redo att gå till produktion:

1. **Byt till demo.hubs.se** i konfigurationen
2. **Använd GitHub Pages** för Outlook-tillägget
3. **Uppdatera OAuth2-klient** med GitHub Pages redirect URI
4. **Uppdatera CORS** med GitHub Pages origin
5. **Följ DEPLOYMENT.md** för fullständig produktionsinstallation

## Resurser

- **Nextcloud Docker**: https://hub.docker.com/_/nextcloud
- **mkcert**: https://github.com/FiloSottile/mkcert
- **Office Add-ins debugging**: https://learn.microsoft.com/en-us/office/dev/add-ins/testing/debug-add-ins-overview
- **Nextcloud OCC commands**: https://docs.nextcloud.com/server/latest/admin_manual/configuration_server/occ_command.html

## Support

För frågor om lokal installation, skapa ett issue på GitHub:
https://github.com/FredrikJonassonItsb/ITSLyzer/issues

