# Säkerhetsguide - Outlook-Nextcloud Integration

Detta dokument beskriver säkerhetsaspekter och best practices för Outlook-Nextcloud-integrationen.

## Säkerhetsöversikt

### Autentisering

**OAuth2 med PKCE (Proof Key for Code Exchange)**

Tillägget använder OAuth2 Authorization Code Grant med PKCE för säker autentisering:

1. **Code Verifier**: En slumpmässig 128-teckens sträng genereras på klientsidan
2. **Code Challenge**: SHA-256-hash av code verifier, base64url-kodad
3. **Authorization Request**: Skickas med code challenge till Nextcloud
4. **Token Exchange**: Code verifier skickas för att verifiera äkthet
5. **Access Token**: Kortlivad token för API-åtkomst (standard: 1 timme)
6. **Refresh Token**: Långlivad token för att förnya access token

**Fördelar med PKCE:**
- Ingen klienthemlighet behövs (säkert för publika klienter)
- Skyddar mot authorization code interception-attacker
- Rekommenderat av OAuth 2.0 Security Best Current Practice

### Token-hantering

**Lagring:**
- Tokens lagras i `localStorage` under GitHub Pages-domänen
- Skyddas av Content Security Policy (CSP)
- Ingen exponering i URL:er eller loggar
- Automatisk rensning vid utloggning

**Förnyelse:**
- Access token förnyas automatiskt 5 minuter innan utgång
- Refresh token används för att hämta ny access token
- Vid fel i förnyelse krävs ny inloggning

**Säkerhet:**
```javascript
// Tokens lagras aldrig i klartext i kod
// Endast i säker localStorage med CSP-skydd
localStorage.setItem('nextcloud_tokens', JSON.stringify({
  access_token: '...',
  refresh_token: '...',
  expires_in: 3600,
  timestamp: Date.now()
}));
```

### Content Security Policy (CSP)

**Outlook-tillägget använder strikt CSP:**

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://appsforoffice.microsoft.com;
  connect-src 'self' https://demo.hubs.se;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
">
```

**Vad detta skyddar mot:**
- **XSS (Cross-Site Scripting)**: Blockerar okända skript
- **Data exfiltration**: Begränsar nätverksanrop till kända domäner
- **Clickjacking**: Förhindrar inbäddning i iframes från okända källor

### CORS (Cross-Origin Resource Sharing)

**Nextcloud-appen begränsar CORS till kända origins:**

```php
// Endast tillåtna origins kan göra API-anrop
$allowedOrigins = [
    'https://fredrikjonassonitsb.github.io'
];

if (in_array($origin, $allowedOrigins)) {
    $response->addHeader('Access-Control-Allow-Origin', $origin);
    $response->addHeader('Access-Control-Allow-Credentials', 'true');
}
```

**Konfiguration:**
```bash
# Lägg till tillåtna origins
sudo -u www-data php /var/www/nextcloud/occ config:app:set outlook_integrator \
  allowed_origins \
  --value "https://fredrikjonassonitsb.github.io,https://annan-domän.se"
```

### Kryptering av känsliga data

**Personnummer och SMS-nummer krypteras:**

```php
// Använder Nextclouds inbyggda krypteringstjänst
$encrypted = $this->crypto->encrypt($personalNumber);
$entity->setPersonalNumber($encrypted);

// Dekryptering vid läsning
$decrypted = $this->crypto->decrypt($entity->getPersonalNumber());
```

**Krypteringsdetaljer:**
- AES-256-GCM (Galois/Counter Mode)
- Unika nycklar per Nextcloud-instans
- Lagras i `oc_outlook_participant_settings`-tabellen

### HTTPS-krav

**Alla kommunikationer måste ske över HTTPS:**

1. **GitHub Pages**: Automatiskt HTTPS via GitHub
2. **Nextcloud**: Kräver giltigt SSL-certifikat
3. **Outlook**: Office.js kräver HTTPS för add-ins

**Verifiera SSL-certifikat:**
```bash
# Kontrollera Nextcloud SSL
openssl s_client -connect demo.hubs.se:443 -servername demo.hubs.se

# Kontrollera GitHub Pages SSL
openssl s_client -connect fredrikjonassonitsb.github.io:443
```

## Säkerhetsrisker och mitigering

### Risk 1: Token-stöld

**Scenario:** Angripare får tillgång till användarens localStorage

**Mitigering:**
- CSP förhindrar tredjepartsskript från att läsa localStorage
- Tokens har begränsad livstid (1 timme för access token)
- Användaren kan återkalla tokens via Nextcloud-inställningar
- Säker utloggning rensar alla tokens

**Rekommendation:**
- Använd alltid senaste versionen av webbläsare
- Aktivera tvåfaktorsautentisering (2FA) i Nextcloud
- Logga ut från tillägget när det inte används

### Risk 2: Man-in-the-Middle (MITM)

**Scenario:** Angripare avlyssnar kommunikation mellan klient och server

**Mitigering:**
- Alla kommunikationer över HTTPS med TLS 1.2+
- Certificate pinning i Nextcloud (valfritt)
- HSTS (HTTP Strict Transport Security) aktiverat

**Rekommendation:**
```bash
# Aktivera HSTS i Nextcloud
# I /var/www/nextcloud/.htaccess eller Apache/Nginx config
Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
```

### Risk 3: CSRF (Cross-Site Request Forgery)

**Scenario:** Angripare lurar användare att göra oönskade API-anrop

**Mitigering:**
- OAuth2 state-parameter används för att verifiera requests
- CORS-begränsning förhindrar cross-origin requests från okända källor
- SameSite-cookies (om cookies används)

**Implementation:**
```javascript
// State-parameter genereras och verifieras
const state = generateRandomString(32);
sessionStorage.setItem('oauth_state', state);

// Vid callback
if (receivedState !== savedState) {
  throw new Error('State mismatch - möjlig CSRF-attack');
}
```

### Risk 4: SQL Injection

**Scenario:** Angripare injicerar SQL-kod via API-parametrar

**Mitigering:**
- Nextclouds Query Builder med prepared statements
- Parametriserade queries
- Input-validering

**Exempel:**
```php
// Säker query med prepared statements
$qb = $this->db->getQueryBuilder();
$qb->select('*')
   ->from($this->getTableName())
   ->where($qb->expr()->eq('event_id', $qb->createNamedParameter($eventId, IQueryBuilder::PARAM_STR)));
```

### Risk 5: XSS (Cross-Site Scripting)

**Scenario:** Angripare injicerar skadlig JavaScript-kod

**Mitigering:**
- Strikt CSP förhindrar inline-skript från okända källor
- Input-sanitering på både klient och server
- Output-encoding i UI

**Exempel:**
```javascript
// Säker output
const safeText = document.createTextNode(userInput);
element.appendChild(safeText);

// INTE detta (osäkert):
// element.innerHTML = userInput;
```

## Best Practices

### För användare

1. **Använd starka lösenord**
   - Minst 12 tecken
   - Kombination av stora/små bokstäver, siffror och symboler
   - Använd en lösenordshanterare

2. **Aktivera tvåfaktorsautentisering (2FA)**
   - I Nextcloud: Inställningar > Säkerhet > Tvåfaktorsautentisering
   - Använd TOTP-app (t.ex. Google Authenticator, Authy)

3. **Logga ut när du är klar**
   - Klicka "Logga ut" i tillägget
   - Stäng webbläsarflikar med känslig information

4. **Håll webbläsaren uppdaterad**
   - Installera säkerhetsuppdateringar omedelbart
   - Använd moderna webbläsare (Chrome, Edge, Firefox, Safari)

5. **Var försiktig med deltagarinställningar**
   - Ange endast personnummer när LOA-3 krävs
   - Verifiera e-postadresser innan du lägger till deltagare

### För administratörer

1. **Begränsa CORS-origins**
   ```bash
   # Endast tillåt kända domäner
   sudo -u www-data php /var/www/nextcloud/occ config:app:set outlook_integrator \
     allowed_origins \
     --value "https://fredrikjonassonitsb.github.io"
   ```

2. **Aktivera Nextcloud-säkerhetsfunktioner**
   - Tvåfaktorsautentisering för alla användare
   - Brute-force-skydd
   - Rate limiting för API-anrop

3. **Övervaka loggar**
   ```bash
   # Övervaka för misstänkt aktivitet
   tail -f /var/www/nextcloud/data/nextcloud.log | grep -E "(outlook_integrator|failed|unauthorized)"
   ```

4. **Regelbundna säkerhetsuppdateringar**
   ```bash
   # Uppdatera Nextcloud och appar
   sudo -u www-data php /var/www/nextcloud/occ update:check
   sudo -u www-data php /var/www/nextcloud/updater/updater.phar
   ```

5. **Backup av känslig data**
   ```bash
   # Backup av databas (inkl. krypterade deltagarinställningar)
   sudo -u www-data php /var/www/nextcloud/occ db:backup
   
   # Backup av krypteringsnycklar
   sudo cp /var/www/nextcloud/config/config.php /backup/config.php.$(date +%Y%m%d)
   ```

6. **Granska OAuth2-klienter regelbundet**
   - Ta bort oanvända klienter
   - Rotera klienthemligheter (om tillämpligt)
   - Kontrollera redirect URIs

7. **Implementera nätverkssegmentering**
   - Nextcloud-servern i separat VLAN
   - Brandväggsregler för att begränsa åtkomst
   - Endast nödvändiga portar öppna (443 för HTTPS)

## Incidenthantering

### Vid misstänkt säkerhetsincident

1. **Identifiera omfattning**
   - Vilka användare påverkades?
   - Vilken data exponerades?
   - När inträffade incidenten?

2. **Omedelbar åtgärd**
   ```bash
   # Inaktivera appen tillfälligt
   sudo -u www-data php /var/www/nextcloud/occ app:disable outlook_integrator
   
   # Återkalla alla OAuth2-tokens
   sudo -u www-data php /var/www/nextcloud/occ oauth2:revoke-all
   ```

3. **Undersök loggar**
   ```bash
   # Sök efter misstänkt aktivitet
   grep -E "(outlook_integrator|unauthorized|failed)" /var/www/nextcloud/data/nextcloud.log
   ```

4. **Åtgärda sårbarheten**
   - Uppdatera kod
   - Ändra konfiguration
   - Rotera nycklar/hemligheter

5. **Återaktivera**
   ```bash
   # Efter åtgärd
   sudo -u www-data php /var/www/nextcloud/occ app:enable outlook_integrator
   ```

6. **Kommunicera med användare**
   - Informera om incidenten
   - Instruera om nödvändiga åtgärder (t.ex. byta lösenord)

## Rapportera säkerhetsproblem

Om du upptäcker en säkerhetsrisk, vänligen **rapportera den privat**:

1. **Skicka e-post till**: security@itsl.se
2. **Inkludera**:
   - Beskrivning av sårbarheten
   - Steg för att reproducera
   - Potentiell påverkan
   - Förslag på åtgärd (om möjligt)

3. **Vänta på svar** innan du offentliggör

Vi strävar efter att svara inom 48 timmar och åtgärda kritiska sårbarheter inom 7 dagar.

## Compliance

### GDPR (Dataskyddsförordningen)

**Personuppgifter som hanteras:**
- E-postadresser
- Namn
- Personnummer (krypterat)
- Telefonnummer (krypterat)

**Rättslig grund:**
- Samtycke (vid användning av tillägget)
- Berättigat intresse (för mötesfunktionalitet)

**Användarrättigheter:**
- Rätt till tillgång: Användare kan se sina deltagarinställningar
- Rätt till radering: Administratör kan radera data via databas
- Rätt till dataportabilitet: Export via Nextcloud-funktioner

**Dataminimering:**
- Endast nödvändiga uppgifter samlas in
- Personnummer och SMS-nummer endast vid behov (LOA-3, SMS-notifiering)
- Data raderas när möten tas bort (implementera cleanup-jobb)

### Rekommendationer för GDPR-compliance

```bash
# Implementera automatisk rensning av gamla deltagarinställningar
# Skapa ett cron-jobb som kör:
sudo -u www-data php /var/www/nextcloud/occ outlook_integrator:cleanup --days=90
```

## Säkerhetsgranskningar

**Rekommenderade granskningar:**

1. **Kvartalsvisa säkerhetsgranskningar**
   - Granska OAuth2-klienter
   - Kontrollera CORS-konfiguration
   - Verifiera SSL-certifikat

2. **Årliga penetrationstester**
   - Anlita extern säkerhetsexpert
   - Testa autentisering, API-säkerhet, dataskydd

3. **Kontinuerlig övervakning**
   - Logga alla API-anrop
   - Övervaka för avvikande beteende
   - Automatiska varningar vid misstänkt aktivitet

## Kontakt

För säkerhetsfrågor:
- E-post: security@itsl.se
- GitHub Issues (för icke-känsliga frågor): https://github.com/FredrikJonassonItsb/ITSLyzer/issues

---

**Senast uppdaterad:** 2024-10-27
**Version:** 1.0.0

