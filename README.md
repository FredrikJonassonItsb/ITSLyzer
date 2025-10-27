# Outlook-Nextcloud Integration

Ett komplett integrationssystem mellan Microsoft Outlook och Nextcloud Talk/Calendar som möjliggör skapande av säkra videomöten direkt från Outlook.

## 📋 Översikt

Detta projekt består av två huvudkomponenter:

1. **Outlook Add-in** - Ett webbaserat Office-tillägg som integreras i Outlook
2. **Nextcloud App** - En backend-app som hanterar API-anrop och integrerar med Nextcloud Talk och Calendar

### Funktioner

✅ **Skapa Nextcloud Talk-möten från Outlook** - Med ett klick  
✅ **Automatisk kalendersynkronisering** - Möten synkas till Nextcloud Calendar  
✅ **Avancerade deltagarinställningar** - LOA-3, SMS-autentisering, säker e-post  
✅ **Teams-länk-borttagning** - Automatiskt när Nextcloud Talk väljs  
✅ **OAuth2-autentisering** - Säker inloggning med PKCE  
✅ **Flerspråksstöd** - Svenska och engelska  
✅ **Plattformsoberoende** - Fungerar i Outlook Web, Windows och Mac  

## 🏗️ Arkitektur

```
┌─────────────────────────────────────────────────────────────────┐
│                    Microsoft 365 (itsl.se)                      │
│                  Outlook (Windows/Mac/Web)                      │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              Outlook Add-in (Office.js)                   │ │
│  │  - OAuth2 PKCE Client                                     │ │
│  │  - Meeting Creation UI                                    │ │
│  │  - Participant Settings                                   │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS + CORS
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub Pages (HTTPS)                         │
│  - manifest.xml                                                 │
│  - HTML/CSS/JS (static files)                                  │
│  - OAuth callback page                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ REST API
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  Nextcloud (demo.hubs.se)                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Outlook Integrator App (PHP)                     │  │
│  │  - REST API Controller                                   │  │
│  │  - MeetingService                                        │  │
│  │  - TalkService (Talk API integration)                    │  │
│  │  - CalendarService (CalDAV integration)                  │  │
│  │  - ParticipantService (Settings + encryption)            │  │
│  │  - CORS Middleware                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Nextcloud Core                                   │  │
│  │  - Talk (spreed)                                         │  │
│  │  - Calendar                                              │  │
│  │  - OAuth2                                                │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Snabbstart

### Förutsättningar

- Nextcloud 25+ med Talk och Calendar aktiverade
- Microsoft 365-konto (itsl.se)
- GitHub-konto med Pages aktiverat
- PHP 8.0+ på Nextcloud-servern

### Installation

#### 1. Installera Nextcloud-appen

```bash
# Klona repositoriet
git clone https://github.com/FredrikJonassonItsb/ITSLyzer.git
cd ITSLyzer

# Kopiera till Nextcloud
sudo cp -r nextcloud-app/outlook_integrator /var/www/nextcloud/apps/
sudo chown -R www-data:www-data /var/www/nextcloud/apps/outlook_integrator

# Aktivera appen
sudo -u www-data php /var/www/nextcloud/occ app:enable outlook_integrator
```

#### 2. Konfigurera OAuth2

```bash
# Skapa OAuth2-klient i Nextcloud admin UI:
# Inställningar > Säkerhet > OAuth 2.0
# Namn: Outlook Integrator
# Redirect URI: https://fredrikjonassonitsb.github.io/ITSLyzer/outlook-addin/src/auth/auth-callback.html
# Klient-ID: outlook-integrator
```

#### 3. Konfigurera CORS

```bash
# Lägg till tillåtna origins
sudo -u www-data php /var/www/nextcloud/occ config:app:set outlook_integrator \
  allowed_origins \
  --value "https://fredrikjonassonitsb.github.io"
```

#### 4. Publicera till GitHub Pages

```bash
# Committa och pusha
git add .
git commit -m "Add Outlook-Nextcloud integration"
git push origin main

# Aktivera GitHub Pages i repo settings:
# Settings > Pages > Deploy from branch: main
```

#### 5. Installera i Outlook

1. Öppna Outlook Web (outlook.office.com)
2. Skapa ny kalenderhändelse
3. Gå till **Hämta tillägg** > **Mina tillägg** > **Lägg till från URL**
4. Ange: `https://fredrikjonassonitsb.github.io/ITSLyzer/outlook-addin/manifest.xml`
5. Klicka **Installera**

## 📚 Dokumentation

- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Detaljerad installationsguide
- **[SECURITY.md](SECURITY.md)** - Säkerhetsguide och best practices
- **[TESTING.md](TESTING.md)** - Testplan och testfall
- **[nextcloud-app/outlook_integrator/README.md](nextcloud-app/outlook_integrator/README.md)** - Nextcloud-app dokumentation

## 🔧 Användning

### Skapa ett Nextcloud Talk-möte

1. Öppna Outlook och skapa en ny kalenderhändelse
2. Fyll i mötesdetaljer (titel, tid, deltagare)
3. Klicka på **Nextcloud Talk**-knappen i ribbonmenyn
4. Logga in med ditt Nextcloud-konto (första gången)
5. Klicka **Skapa Talk-möte**
6. Konfigurera deltagarinställningar (valfritt):
   - Autentiseringsnivå (Ingen/SMS/LOA-3)
   - Personnummer (för LOA-3)
   - SMS-nummer (för SMS-notifiering)
   - Säker e-post
   - Notifieringstyp (E-post/E-post + SMS)
7. Klicka **Skapa möte**
8. Talk-länk läggs automatiskt till i möteskroppen

### Deltagarinställningar

**Autentiseringsnivåer:**
- **Ingen** - Ingen extra autentisering krävs
- **SMS** - Deltagare verifieras via SMS-kod
- **LOA-3** - Högsta nivå, kräver BankID eller liknande e-legitimation

**Notifieringsalternativ:**
- **E-post** - Standard e-postinbjudan
- **E-post + SMS** - E-post + SMS-påminnelse

**Säker e-post:**
- Krypterad e-postinbjudan via säker kanal

## 🔒 Säkerhet

### Autentisering

- **OAuth2 med PKCE** - Säker autentisering utan klienthemlighet
- **Token refresh** - Automatisk förnyelse av access tokens
- **Säker lagring** - Tokens skyddas av CSP

### Dataskydd

- **Kryptering** - Personnummer och SMS-nummer krypteras i databasen
- **HTTPS** - All kommunikation över säkra kanaler
- **CORS-begränsning** - Endast tillåtna origins
- **CSP** - Skydd mot XSS-attacker

### GDPR-compliance

- Personuppgifter lagras endast i Nextcloud (inte i Outlook)
- Krypterad lagring av känsliga data
- Användare kan radera sina data
- Dataminimering - endast nödvändiga uppgifter samlas in

## 🧪 Testning

Kör alla testfall i [TESTING.md](TESTING.md) innan produktionsdrift.

**Snabbtest:**

```bash
# Verifiera Nextcloud-app
sudo -u www-data php /var/www/nextcloud/occ app:list | grep outlook

# Verifiera databastabeller
sudo -u www-data php /var/www/nextcloud/occ db:show-tables | grep outlook

# Verifiera CORS
sudo -u www-data php /var/www/nextcloud/occ config:app:get outlook_integrator allowed_origins

# Testa API-endpoint
curl -H "Authorization: Bearer <token>" https://demo.hubs.se/apps/outlook_integrator/api/v1/status
```

## 🐛 Felsökning

### CORS-fel

```bash
# Kontrollera och sätt CORS
sudo -u www-data php /var/www/nextcloud/occ config:app:set outlook_integrator \
  allowed_origins \
  --value "https://fredrikjonassonitsb.github.io"
```

### OAuth2-fel

- Verifiera att redirect URI är exakt rätt
- Kontrollera att klient-ID är `outlook-integrator`
- Kontrollera att OAuth2-appen är aktiverad i Nextcloud

### Talk-rum kan inte skapas

```bash
# Kontrollera att Talk är aktiverat
sudo -u www-data php /var/www/nextcloud/occ app:list | grep spreed

# Aktivera Talk
sudo -u www-data php /var/www/nextcloud/occ app:enable spreed
```

### Loggar

```bash
# Visa Nextcloud-loggar
tail -f /var/www/nextcloud/data/nextcloud.log | grep outlook_integrator

# Aktivera debug-loggning
# I /var/www/nextcloud/config/config.php
'loglevel' => 0,  // 0 = Debug
```

## 📦 Projektstruktur

```
ITSLyzer/
├── outlook-addin/              # Outlook Add-in (frontend)
│   ├── manifest.xml            # Office Add-in manifest
│   ├── src/
│   │   ├── taskpane/           # Huvudgränssnitt
│   │   ├── auth/               # OAuth2-autentisering
│   │   ├── api/                # API-klient
│   │   ├── ui/                 # UI-komponenter
│   │   └── utils/              # Hjälpfunktioner
│   └── assets/                 # Ikoner och stilar
│
├── nextcloud-app/              # Nextcloud App (backend)
│   └── outlook_integrator/
│       ├── appinfo/            # App-metadata
│       ├── lib/
│       │   ├── Controller/     # API-controllers
│       │   ├── Service/        # Business logic
│       │   ├── Db/             # Database entities
│       │   ├── Middleware/     # CORS middleware
│       │   └── Migration/      # Database migrations
│       └── README.md
│
├── DEPLOYMENT.md               # Installationsguide
├── SECURITY.md                 # Säkerhetsguide
├── TESTING.md                  # Testplan
└── README.md                   # Denna fil
```

## 🤝 Bidra

Bidrag är välkomna! Vänligen:

1. Forka repositoriet
2. Skapa en feature branch (`git checkout -b feature/amazing-feature`)
3. Committa dina ändringar (`git commit -m 'Add amazing feature'`)
4. Pusha till branchen (`git push origin feature/amazing-feature`)
5. Öppna en Pull Request

## 🔐 Säkerhetsrapportering

Om du upptäcker en säkerhetsrisk, vänligen rapportera den privat till:
- E-post: security@itsl.se

Vänligen **publicera inte** säkerhetsproblem publikt innan de har åtgärdats.

## 📄 Licens

Detta projekt är licensierat under AGPL-3.0-licensen.

## 👥 Författare

- **ITSL** - [https://itsl.se](https://itsl.se)

## 🙏 Erkännanden

- Nextcloud-communityn för Talk och Calendar-appar
- Microsoft för Office.js och Office Add-ins-plattformen
- Alla bidragsgivare och testare

## 📞 Support

För support och buggrapporter:
- GitHub Issues: [https://github.com/FredrikJonassonItsb/ITSLyzer/issues](https://github.com/FredrikJonassonItsb/ITSLyzer/issues)
- E-post: support@itsl.se

---

**Version:** 1.0.0  
**Senast uppdaterad:** 2024-10-27  
**Status:** ✅ Produktionsklar

