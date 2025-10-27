# Outlook Integrator - Nextcloud App

Integration mellan Microsoft Outlook och Nextcloud Talk/Calendar.

## Funktioner

- **REST API** för Outlook Add-in
- **Nextcloud Talk-integration** - Skapa Talk-rum automatiskt
- **Kalendersynkronisering** - Synkronisera möten med Nextcloud Calendar
- **Deltagarinställningar** - Avancerade säkerhets- och notifieringsinställningar
- **OAuth2-autentisering** - Säker autentisering via OAuth2/OIDC
- **CORS-stöd** - För webbaserade Outlook-tillägg

## Krav

- Nextcloud 25 eller senare
- PHP 8.0 eller senare
- Nextcloud Talk-appen aktiverad
- Nextcloud Calendar-appen aktiverad
- OAuth2-appen aktiverad (för autentisering)

## Installation

### 1. Kopiera appen till Nextcloud

```bash
# Kopiera till Nextcloud apps-katalog
cp -r outlook_integrator /var/www/nextcloud/apps/

# Sätt rätt ägare och rättigheter
chown -R www-data:www-data /var/www/nextcloud/apps/outlook_integrator
```

### 2. Aktivera appen

```bash
# Via kommandoraden
sudo -u www-data php /var/www/nextcloud/occ app:enable outlook_integrator

# Eller via Nextcloud admin-gränssnitt:
# Inställningar > Appar > Integration > Outlook Integrator
```

### 3. Konfigurera OAuth2

1. Gå till **Inställningar > Säkerhet > OAuth 2.0**
2. Lägg till ny klient:
   - **Namn**: Outlook Integrator
   - **Redirect URI**: `https://fredrikjonassonitsb.github.io/ITSLyzer/outlook-addin/src/auth/auth-callback.html`
   - **Klient-ID**: `outlook-integrator`
3. Spara klient-ID och hemlighet

### 4. Konfigurera CORS

1. Gå till **Inställningar > Administration > Outlook Integrator**
2. Lägg till tillåtna origins:
   ```
   https://fredrikjonassonitsb.github.io
   ```
3. Spara inställningar

## API-endpoints

### POST /apps/outlook_integrator/api/v1/meeting

Skapa ett Nextcloud Talk-möte med kalenderintegration.

**Request:**
```json
{
  "title": "Projekt X statusmöte",
  "start": "2024-03-15T10:00:00Z",
  "end": "2024-03-15T11:00:00Z",
  "participants": [
    {
      "email": "user@example.com",
      "displayName": "User Name",
      "settings": {
        "authLevel": "loa3",
        "personalNumber": "19800101-1234",
        "secureEmail": true,
        "notification": "email_sms",
        "smsNumber": "+46701234567"
      }
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "meeting": {
    "id": "abc123",
    "talkUrl": "https://demo.hubs.se/call/xyz789",
    "talkToken": "xyz789",
    "calendarEventId": "cal-event-456",
    "calendarUrl": "https://demo.hubs.se/apps/calendar/",
    "created": "2024-03-10T12:00:00Z"
  }
}
```

### GET /apps/outlook_integrator/api/v1/status

Hämta status och användarinformation.

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "nextcloud_version": "28.0.0",
  "talk_enabled": true,
  "calendar_enabled": true,
  "user": {
    "uid": "user1",
    "displayName": "User One",
    "email": "user1@example.com"
  }
}
```

### POST /apps/outlook_integrator/api/v1/auth/verify

Verifiera autentisering.

**Response:**
```json
{
  "authenticated": true,
  "user": {
    "uid": "user1",
    "displayName": "User One",
    "email": "user1@example.com"
  }
}
```

## Säkerhet

### Kryptering av känsliga data

Personnummer och SMS-nummer krypteras med Nextclouds inbyggda krypteringstjänst innan de sparas i databasen.

### CORS-begränsning

Endast tillåtna origins (konfigurerade i admin-inställningar) kan göra API-anrop.

### OAuth2-autentisering

Alla API-anrop kräver en giltig OAuth2 access token i Authorization-headern:

```
Authorization: Bearer <access_token>
```

## Databas

Appen skapar två tabeller:

### outlook_participant_settings

Lagrar deltagarspecifika inställningar för möten.

| Kolumn | Typ | Beskrivning |
|--------|-----|-------------|
| id | BIGINT | Primärnyckel |
| event_id | STRING | Kalender-event-ID |
| email | STRING | Deltagarens e-post |
| auth_level | STRING | Autentiseringsnivå (none/sms/loa3) |
| personal_number | TEXT | Personnummer (krypterat) |
| sms_number | TEXT | SMS-nummer (krypterat) |
| secure_email | BOOLEAN | Säker e-post-flagga |
| notification | STRING | Notifieringstyp (email/email_sms) |
| created_at | BIGINT | Tidsstämpel |

### outlook_meeting_metadata

Lagrar metadata om skapade möten.

| Kolumn | Typ | Beskrivning |
|--------|-----|-------------|
| id | BIGINT | Primärnyckel |
| event_id | STRING | Kalender-event-ID (unikt) |
| talk_token | STRING | Talk-rum-token |
| talk_url | TEXT | Talk-rum-URL |
| created_by | STRING | Användar-ID |
| created_at | BIGINT | Tidsstämpel |

## Felsökning

### Aktivera debug-loggning

```bash
# I Nextcloud config/config.php
'loglevel' => 0,  // 0 = Debug
```

### Visa loggar

```bash
tail -f /var/www/nextcloud/data/nextcloud.log
```

### Vanliga problem

**Problem:** CORS-fel i webbläsaren
**Lösning:** Kontrollera att GitHub Pages-domänen är tillagd i allowed_origins

**Problem:** OAuth2-autentisering misslyckas
**Lösning:** Verifiera att OAuth2-klienten är korrekt konfigurerad med rätt redirect URI

**Problem:** Talk-rum kan inte skapas
**Lösning:** Kontrollera att Talk-appen är aktiverad och att användaren har behörighet

## Support

För support, skapa ett issue på GitHub:
https://github.com/FredrikJonassonItsb/ITSLyzer/issues

## Licens

AGPL-3.0

