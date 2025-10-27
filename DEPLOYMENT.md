# Deployment Guide - Outlook-Nextcloud Integration

Detta dokument beskriver hur du installerar och konfigurerar Outlook-tillägget och Nextcloud-appen.

## Förutsättningar

- Nextcloud-server (version 25+) med administratörsåtkomst
- GitHub-konto med Pages aktiverat
- Nextcloud Talk och Calendar-appar aktiverade
- PHP 8.0+ på Nextcloud-servern

## Del 1: Nextcloud-konfiguration

### 1.1 Installera Nextcloud-appen

```bash
# Klona repositoriet
git clone https://github.com/FredrikJonassonItsb/ITSLyzer.git
cd ITSLyzer

# Kopiera appen till Nextcloud
sudo cp -r nextcloud-app/outlook_integrator /var/www/nextcloud/apps/

# Sätt rätt ägare och rättigheter
sudo chown -R www-data:www-data /var/www/nextcloud/apps/outlook_integrator
sudo chmod -R 755 /var/www/nextcloud/apps/outlook_integrator
```

### 1.2 Aktivera appen

```bash
# Via kommandoraden
sudo -u www-data php /var/www/nextcloud/occ app:enable outlook_integrator

# Verifiera att appen är aktiverad
sudo -u www-data php /var/www/nextcloud/occ app:list | grep outlook
```

### 1.3 Konfigurera OAuth2

#### Via Nextcloud Admin UI:

1. Logga in som administratör på **demo.hubs.se**
2. Gå till **Inställningar > Säkerhet**
3. Scrolla ner till **OAuth 2.0**
4. Klicka på **Lägg till klient**
5. Fyll i:
   - **Namn**: `Outlook Integrator`
   - **Redirect URI**: `https://fredrikjonassonitsb.github.io/ITSLyzer/outlook-addin/src/auth/auth-callback.html`
   - **Typ**: Konfidentiell klient (om PKCE inte stöds), annars Publik klient
6. Klicka **Lägg till**
7. **Kopiera klient-ID** (ska vara `outlook-integrator`)

#### Via kommandoraden (alternativ):

```bash
# Skapa OAuth2-klient
sudo -u www-data php /var/www/nextcloud/occ config:app:set oauth2 \
  --value '{"name":"Outlook Integrator","redirect_uri":"https://fredrikjonassonitsb.github.io/ITSLyzer/outlook-addin/src/auth/auth-callback.html","client_id":"outlook-integrator"}' \
  clients
```

### 1.4 Konfigurera CORS

```bash
# Lägg till tillåtna origins
sudo -u www-data php /var/www/nextcloud/occ config:app:set outlook_integrator \
  allowed_origins \
  --value "https://fredrikjonassonitsb.github.io"

# Verifiera
sudo -u www-data php /var/www/nextcloud/occ config:app:get outlook_integrator allowed_origins
```

### 1.5 Verifiera installation

```bash
# Kontrollera att tabellerna skapats
sudo -u www-data php /var/www/nextcloud/occ db:show-tables | grep outlook

# Förväntat resultat:
# oc_outlook_participant_settings
# oc_outlook_meeting_metadata
```

## Del 2: GitHub Pages-deployment

### 2.1 Förbered repository

```bash
# Gå till outlook-addin-katalogen
cd outlook-addin

# Skapa placeholder-ikoner (om de inte finns)
mkdir -p assets/icons
# Ladda ner eller skapa ikoner:
# - icon-16.png (16x16)
# - icon-32.png (32x32)
# - icon-64.png (64x64)
# - icon-128.png (128x128)
```

### 2.2 Publicera till GitHub Pages

```bash
# Committa alla ändringar
git add .
git commit -m "Add Outlook add-in and Nextcloud app"

# Pusha till main branch
git push origin main

# Aktivera GitHub Pages via GitHub UI:
# 1. Gå till repository settings
# 2. Scrolla ner till "Pages"
# 3. Välj "Deploy from branch"
# 4. Välj "main" branch och "/outlook-addin" folder (eller root)
# 5. Klicka "Save"
```

### 2.3 Verifiera deployment

Efter några minuter, verifiera att följande URL:er fungerar:

- Manifest: `https://fredrikjonassonitsb.github.io/ITSLyzer/outlook-addin/manifest.xml`
- Taskpane: `https://fredrikjonassonitsb.github.io/ITSLyzer/outlook-addin/src/taskpane/taskpane.html`
- Callback: `https://fredrikjonassonitsb.github.io/ITSLyzer/outlook-addin/src/auth/auth-callback.html`

## Del 3: Outlook-installation

### 3.1 Sideload i Outlook Web (OWA)

1. Öppna **Outlook Web** (outlook.office.com) med ditt **itsl.se**-konto
2. Skapa eller öppna en kalenderhändelse
3. Klicka på **...** (Fler åtgärder) > **Hämta tillägg**
4. Klicka på **Mina tillägg** i vänstermenyn
5. Scrolla ner och klicka på **+ Lägg till ett anpassat tillägg** > **Lägg till från URL**
6. Ange manifest-URL:
   ```
   https://fredrikjonassonitsb.github.io/ITSLyzer/outlook-addin/manifest.xml
   ```
7. Klicka **OK** och sedan **Installera**

### 3.2 Sideload i Outlook Desktop (Windows/Mac)

#### Windows:

1. Öppna Outlook Desktop
2. Gå till **Arkiv** > **Hantera tillägg**
3. Klicka på **+ Lägg till tillägg**
4. Välj **Lägg till från URL**
5. Ange manifest-URL och klicka **OK**

#### Mac:

1. Öppna Outlook för Mac
2. Gå till **Verktyg** > **Hämta tillägg**
3. Följ samma steg som för Windows

### 3.3 Central deployment (för administratörer)

För att distribuera tillägget till alla användare i organisationen:

1. Logga in på **Microsoft 365 Admin Center**
2. Gå till **Inställningar** > **Integrerade appar**
3. Klicka **Ladda upp anpassade appar**
4. Välj **Ange URL till manifestfil**
5. Ange:
   ```
   https://fredrikjonassonitsb.github.io/ITSLyzer/outlook-addin/manifest.xml
   ```
6. Klicka **Validera**
7. Välj användare/grupper som ska få tillägget
8. Klicka **Distribuera**

## Del 4: Testning

### 4.1 Testa autentisering

1. Öppna Outlook och skapa en ny kalenderhändelse
2. Klicka på **Nextcloud Talk**-knappen i ribbonmenyn
3. Klicka **Logga in med Nextcloud**
4. Du bör omdirigeras till **demo.hubs.se** för inloggning
5. Logga in med ditt Nextcloud-konto
6. Godkänn behörigheter för Outlook Integrator
7. Du bör omdirigeras tillbaka till Outlook med lyckad inloggning

### 4.2 Testa mötesskapa

1. Fyll i mötesdetaljer i Outlook:
   - Titel: "Testmöte"
   - Starttid: Välj en framtida tid
   - Sluttid: Välj sluttid
   - Deltagare: Lägg till minst en deltagare
2. Klicka **Skapa Talk-möte** i tillägget
3. Konfigurera deltagarinställningar (valfritt)
4. Klicka **Skapa möte**
5. Verifiera att:
   - Talk-länk läggs till i möteskroppen
   - Plats ändras till "Nextcloud Talk (online)"
   - Teams-länk tas bort (om det fanns en)

### 4.3 Verifiera i Nextcloud

1. Logga in på **demo.hubs.se**
2. Öppna **Nextcloud Talk**
3. Verifiera att ett nytt Talk-rum skapats med mötets namn
4. Öppna **Nextcloud Calendar**
5. Verifiera att en kalenderhändelse skapats med samma detaljer

## Del 5: Felsökning

### Problem: CORS-fel

**Symptom:** Fel i webbläsarkonsolen: "Access-Control-Allow-Origin"

**Lösning:**
```bash
# Kontrollera CORS-konfiguration
sudo -u www-data php /var/www/nextcloud/occ config:app:get outlook_integrator allowed_origins

# Om tom eller fel, sätt rätt värde:
sudo -u www-data php /var/www/nextcloud/occ config:app:set outlook_integrator \
  allowed_origins \
  --value "https://fredrikjonassonitsb.github.io"

# Rensa cache
sudo -u www-data php /var/www/nextcloud/occ maintenance:mode --on
sudo -u www-data php /var/www/nextcloud/occ maintenance:mode --off
```

### Problem: OAuth2-autentisering misslyckas

**Symptom:** Fel vid inloggning: "Invalid client" eller "Redirect URI mismatch"

**Lösning:**
1. Kontrollera OAuth2-klient i Nextcloud admin UI
2. Verifiera att redirect URI är exakt:
   ```
   https://fredrikjonassonitsb.github.io/ITSLyzer/outlook-addin/src/auth/auth-callback.html
   ```
3. Kontrollera att klient-ID är `outlook-integrator`
4. Om PKCE inte stöds, kontakta Nextcloud-administratör för att aktivera det

### Problem: Talk-rum kan inte skapas

**Symptom:** Fel: "Failed to create Talk room"

**Lösning:**
```bash
# Kontrollera att Talk-appen är aktiverad
sudo -u www-data php /var/www/nextcloud/occ app:list | grep spreed

# Om inte aktiverad:
sudo -u www-data php /var/www/nextcloud/occ app:enable spreed

# Kontrollera loggar
tail -f /var/www/nextcloud/data/nextcloud.log | grep outlook_integrator
```

### Problem: Kalenderhändelse kan inte skapas

**Symptom:** Fel: "Failed to create calendar event"

**Lösning:**
```bash
# Kontrollera att Calendar-appen är aktiverad
sudo -u www-data php /var/www/nextcloud/occ app:list | grep calendar

# Om inte aktiverad:
sudo -u www-data php /var/www/nextcloud/occ app:enable calendar

# Verifiera att användaren har en kalender
# Logga in på Nextcloud och öppna Calendar-appen
```

### Debug-loggning

För att aktivera detaljerad loggning:

```bash
# I /var/www/nextcloud/config/config.php
'loglevel' => 0,  // 0 = Debug, 1 = Info, 2 = Warning, 3 = Error

# Visa loggar i realtid
tail -f /var/www/nextcloud/data/nextcloud.log | grep -E "(outlook_integrator|spreed|calendar)"
```

## Del 6: Säkerhet

### 6.1 Säkra känsliga data

- Personnummer och SMS-nummer krypteras automatiskt i databasen
- Använd HTTPS överallt (både Nextcloud och GitHub Pages)
- Begränsa CORS till endast nödvändiga origins

### 6.2 Brandväggskonfiguration

Se till att följande är tillåtet:

- Outlook-klienter kan nå `*.github.io` (port 443)
- Outlook-klienter kan nå `demo.hubs.se` (port 443)
- Nextcloud-servern kan göra utgående HTTPS-anrop (för Talk API)

### 6.3 Regelbunden uppdatering

```bash
# Uppdatera Nextcloud och appar regelbundet
sudo -u www-data php /var/www/nextcloud/occ update:check
sudo -u www-data php /var/www/nextcloud/updater/updater.phar

# Uppdatera Outlook-tillägget via git pull
cd /path/to/ITSLyzer
git pull origin main
```

## Support

För support och buggrapporter, skapa ett issue på GitHub:
https://github.com/FredrikJonassonItsb/ITSLyzer/issues

## Licens

AGPL-3.0

