# Testplan - Outlook-Nextcloud Integration

Detta dokument beskriver testfall och valideringsprocedurer för Outlook-tillägget och Nextcloud-appen.

## Testmiljö

### Förutsättningar

- **Nextcloud-server**: demo.hubs.se (version 25+)
- **M365-domän**: itsl.se
- **Testanvändare**: Minst 2 användare med konton i både M365 och Nextcloud
- **Webbläsare**: Chrome, Edge, Firefox, Safari (senaste versionerna)
- **Outlook-klienter**: 
  - Outlook Web (outlook.office.com)
  - Outlook Desktop (Windows)
  - Outlook för Mac (valfritt)

### Testdata

**Testanvändare 1:**
- E-post: testuser1@itsl.se
- Nextcloud-konto: testuser1
- Roll: Mötesorganisatör

**Testanvändare 2:**
- E-post: testuser2@itsl.se
- Nextcloud-konto: testuser2
- Roll: Mötesdeltagare

## Testfall

### 1. Installation och konfiguration

#### 1.1 Nextcloud-app installation

**Testfall ID:** INST-001  
**Beskrivning:** Verifiera att Nextcloud-appen kan installeras

**Steg:**
1. Kopiera `outlook_integrator` till `/var/www/nextcloud/apps/`
2. Kör: `sudo -u www-data php /var/www/nextcloud/occ app:enable outlook_integrator`
3. Verifiera: `sudo -u www-data php /var/www/nextcloud/occ app:list | grep outlook`

**Förväntat resultat:**
- Appen visas som aktiverad
- Inga felmeddelanden i loggen

**Status:** ⬜ Ej testad | ✅ Godkänd | ❌ Misslyckad

---

#### 1.2 Database migration

**Testfall ID:** INST-002  
**Beskrivning:** Verifiera att databastabeller skapas

**Steg:**
1. Kör: `sudo -u www-data php /var/www/nextcloud/occ db:show-tables | grep outlook`

**Förväntat resultat:**
```
oc_outlook_participant_settings
oc_outlook_meeting_metadata
```

**Status:** ⬜ Ej testad | ✅ Godkänd | ❌ Misslyckad

---

#### 1.3 OAuth2-konfiguration

**Testfall ID:** INST-003  
**Beskrivning:** Verifiera OAuth2-klient

**Steg:**
1. Logga in som admin på demo.hubs.se
2. Gå till Inställningar > Säkerhet > OAuth 2.0
3. Verifiera att "Outlook Integrator" finns
4. Kontrollera redirect URI: `https://fredrikjonassonitsb.github.io/ITSLyzer/outlook-addin/src/auth/auth-callback.html`

**Förväntat resultat:**
- OAuth2-klient finns
- Redirect URI är korrekt
- Klient-ID är `outlook-integrator`

**Status:** ⬜ Ej testad | ✅ Godkänd | ❌ Misslyckad

---

#### 1.4 CORS-konfiguration

**Testfall ID:** INST-004  
**Beskrivning:** Verifiera CORS-inställningar

**Steg:**
1. Kör: `sudo -u www-data php /var/www/nextcloud/occ config:app:get outlook_integrator allowed_origins`

**Förväntat resultat:**
```
https://fredrikjonassonitsb.github.io
```

**Status:** ⬜ Ej testad | ✅ Godkänd | ❌ Misslyckad

---

#### 1.5 Outlook-tillägg sideloading

**Testfall ID:** INST-005  
**Beskrivning:** Verifiera att tillägget kan laddas i Outlook

**Steg:**
1. Öppna Outlook Web (outlook.office.com) med testuser1@itsl.se
2. Skapa ny kalenderhändelse
3. Gå till Hämta tillägg > Mina tillägg > Lägg till från URL
4. Ange: `https://fredrikjonassonitsb.github.io/ITSLyzer/outlook-addin/manifest.xml`
5. Klicka Installera

**Förväntat resultat:**
- Tillägget installeras utan fel
- "Nextcloud Talk"-knapp visas i ribbonmenyn

**Status:** ⬜ Ej testad | ✅ Godkänd | ❌ Misslyckad

---

### 2. Autentisering

#### 2.1 OAuth2-inloggning

**Testfall ID:** AUTH-001  
**Beskrivning:** Verifiera OAuth2-inloggningsflöde

**Steg:**
1. Öppna Outlook och skapa ny kalenderhändelse
2. Klicka på "Nextcloud Talk"-knappen
3. Klicka "Logga in med Nextcloud"
4. Verifiera att popup öppnas med demo.hubs.se
5. Logga in med testuser1
6. Godkänn behörigheter

**Förväntat resultat:**
- Popup öppnas korrekt
- Inloggning lyckas
- Popup stängs automatiskt
- Användarnamn visas i tillägget
- Access token och refresh token sparas

**Status:** ⬜ Ej testad | ✅ Godkänd | ❌ Misslyckad

---

#### 2.2 Token refresh

**Testfall ID:** AUTH-002  
**Beskrivning:** Verifiera automatisk token-förnyelse

**Steg:**
1. Logga in (AUTH-001)
2. Vänta tills access token är nära att gå ut (simulera genom att ändra timestamp)
3. Gör ett API-anrop (t.ex. hämta status)

**Förväntat resultat:**
- Token förnyas automatiskt
- API-anrop lyckas
- Ingen ny inloggning krävs

**Status:** ⬜ Ej testad | ✅ Godkänd | ❌ Misslyckad

---

#### 2.3 Utloggning

**Testfall ID:** AUTH-003  
**Beskrivning:** Verifiera utloggning

**Steg:**
1. Logga in (AUTH-001)
2. Klicka "Logga ut"

**Förväntat resultat:**
- Tokens rensas från localStorage
- Login-vy visas
- Nästa API-anrop kräver ny inloggning

**Status:** ⬜ Ej testad | ✅ Godkänd | ❌ Misslyckad

---

#### 2.4 Ogiltig token

**Testfall ID:** AUTH-004  
**Beskrivning:** Hantera ogiltig eller utgången token

**Steg:**
1. Logga in (AUTH-001)
2. Manuellt ta bort refresh token från localStorage
3. Vänta tills access token går ut
4. Försök göra ett API-anrop

**Förväntat resultat:**
- Felmeddelande visas
- Användaren uppmanas logga in igen
- Login-vy visas

**Status:** ⬜ Ej testad | ✅ Godkänd | ❌ Misslyckad

---

### 3. Mötesskapa

#### 3.1 Grundläggande möte

**Testfall ID:** MEET-001  
**Beskrivning:** Skapa ett enkelt Talk-möte

**Steg:**
1. Logga in (AUTH-001)
2. Skapa ny kalenderhändelse i Outlook:
   - Titel: "Testmöte 1"
   - Start: Imorgon kl 10:00
   - Slut: Imorgon kl 11:00
   - Deltagare: testuser2@itsl.se
3. Klicka "Skapa Talk-möte"
4. Klicka "Skapa möte" (utan att ändra deltagarinställningar)

**Förväntat resultat:**
- Möte skapas utan fel
- Talk-länk läggs till i möteskroppen
- Plats ändras till "Nextcloud Talk (online)"
- Bekräftelsemeddelande visas med Talk-länk

**Status:** ⬜ Ej testad | ✅ Godkänd | ❌ Misslyckad

---

#### 3.2 Möte med flera deltagare

**Testfall ID:** MEET-002  
**Beskrivning:** Skapa möte med flera deltagare

**Steg:**
1. Skapa kalenderhändelse med 3+ deltagare
2. Klicka "Skapa Talk-möte"
3. Verifiera att alla deltagare visas i deltagarinställningar
4. Klicka "Skapa möte"

**Förväntat resultat:**
- Alla deltagare visas korrekt
- Möte skapas med alla deltagare
- Talk-rum innehåller alla deltagare (om de har Nextcloud-konton)

**Status:** ⬜ Ej testad | ✅ Godkänd | ❌ Misslyckad

---

#### 3.3 Möte med LOA-3 autentisering

**Testfall ID:** MEET-003  
**Beskrivning:** Skapa möte med LOA-3-krav för deltagare

**Steg:**
1. Skapa kalenderhändelse med testuser2@itsl.se
2. Klicka "Skapa Talk-möte"
3. Expandera deltagarinställningar för testuser2
4. Välj "LOA-3 (BankID)" som autentiseringsnivå
5. Ange personnummer: "19800101-1234"
6. Klicka "Skapa möte"

**Förväntat resultat:**
- Personnummer-fält aktiveras när LOA-3 väljs
- Möte skapas
- Deltagarinställningar sparas i databasen (krypterat)

**Status:** ⬜ Ej testad | ✅ Godkänd | ❌ Misslyckad

---

#### 3.4 Möte med SMS-notifiering

**Testfall ID:** MEET-004  
**Beskrivning:** Skapa möte med SMS-notifiering

**Steg:**
1. Skapa kalenderhändelse med testuser2@itsl.se
2. Klicka "Skapa Talk-möte"
3. Expandera deltagarinställningar för testuser2
4. Välj "E-post + SMS" som notifiering
5. Ange SMS-nummer: "+46701234567"
6. Klicka "Skapa möte"

**Förväntat resultat:**
- SMS-nummer-fält aktiveras när "E-post + SMS" väljs
- Möte skapas
- SMS-nummer sparas krypterat

**Status:** ⬜ Ej testad | ✅ Godkänd | ❌ Misslyckad

---

#### 3.5 Möte med säker e-post

**Testfall ID:** MEET-005  
**Beskrivning:** Skapa möte med säker e-post-flagga

**Steg:**
1. Skapa kalenderhändelse med testuser2@itsl.se
2. Klicka "Skapa Talk-möte"
3. Expandera deltagarinställningar för testuser2
4. Kryssa i "Skicka som säker e-post"
5. Ange personnummer: "19800101-1234"
6. Klicka "Skapa möte"

**Förväntat resultat:**
- Personnummer-fält aktiveras när säker e-post kryssas i
- Möte skapas
- Säker e-post-flagga sparas

**Status:** ⬜ Ej testad | ✅ Godkänd | ❌ Misslyckad

---

#### 3.6 Teams-länk-borttagning

**Testfall ID:** MEET-006  
**Beskrivning:** Verifiera att Teams-länk tas bort

**Steg:**
1. Skapa ny kalenderhändelse i Outlook
2. Lägg till Teams-möte (via "Teams-möte"-knappen)
3. Verifiera att Teams-länk finns i möteskroppen
4. Klicka "Skapa Talk-möte"
5. Skapa möte

**Förväntat resultat:**
- Teams-länk tas bort från möteskroppen
- Endast Nextcloud Talk-länk finns kvar
- Conference ID och andra Teams-detaljer tas bort

**Status:** ⬜ Ej testad | ✅ Godkänd | ❌ Misslyckad

---

### 4. Nextcloud-integration

#### 4.1 Talk-rum skapas

**Testfall ID:** NC-001  
**Beskrivning:** Verifiera att Talk-rum skapas i Nextcloud

**Steg:**
1. Skapa möte i Outlook (MEET-001)
2. Logga in på demo.hubs.se med testuser1
3. Öppna Nextcloud Talk
4. Sök efter "Testmöte 1"

**Förväntat resultat:**
- Talk-rum finns med rätt namn
- Användaren är medlem i rummet
- Rummet är publikt (gäster kan ansluta via länk)

**Status:** ⬜ Ej testad | ✅ Godkänd | ❌ Misslyckad

---

#### 4.2 Kalenderhändelse skapas

**Testfall ID:** NC-002  
**Beskrivning:** Verifiera att kalenderhändelse skapas i Nextcloud

**Steg:**
1. Skapa möte i Outlook (MEET-001)
2. Logga in på demo.hubs.se med testuser1
3. Öppna Nextcloud Calendar
4. Navigera till mötesdatum

**Förväntat resultat:**
- Kalenderhändelse finns med rätt titel
- Start- och sluttid är korrekt
- Talk-länk finns i beskrivning eller plats
- Deltagare är inbjudna

**Status:** ⬜ Ej testad | ✅ Godkänd | ❌ Misslyckad

---

#### 4.3 Deltagare läggs till i Talk-rum

**Testfall ID:** NC-003  
**Beskrivning:** Verifiera att deltagare läggs till i Talk-rum

**Steg:**
1. Skapa möte med testuser2 som deltagare (MEET-001)
2. Logga in på demo.hubs.se med testuser2
3. Öppna Nextcloud Talk
4. Kontrollera om "Testmöte 1" finns i rumslistan

**Förväntat resultat:**
- testuser2 är medlem i Talk-rummet
- testuser2 kan se rummet i sin lista
- testuser2 kan ansluta till mötet

**Status:** ⬜ Ej testad | ✅ Godkänd | ❌ Misslyckad

---

#### 4.4 Deltagarinställningar sparas

**Testfall ID:** NC-004  
**Beskrivning:** Verifiera att deltagarinställningar sparas i databasen

**Steg:**
1. Skapa möte med LOA-3 och personnummer (MEET-003)
2. Logga in på Nextcloud-servern via SSH
3. Kör SQL-query:
   ```sql
   SELECT * FROM oc_outlook_participant_settings WHERE email = 'testuser2@itsl.se';
   ```

**Förväntat resultat:**
- Rad finns för testuser2
- `auth_level` = 'loa3'
- `personal_number` innehåller krypterad data (inte klartext)
- `secure_email` = false (om inte ikryssad)

**Status:** ⬜ Ej testad | ✅ Godkänd | ❌ Misslyckad

---

### 5. Säkerhet

#### 5.1 CORS-skydd

**Testfall ID:** SEC-001  
**Beskrivning:** Verifiera att CORS blockerar okända origins

**Steg:**
1. Öppna webbläsarens utvecklarverktyg
2. Kör följande i konsolen från en annan domän (t.ex. google.com):
   ```javascript
   fetch('https://demo.hubs.se/apps/outlook_integrator/api/v1/status', {
     headers: { 'Authorization': 'Bearer fake-token' }
   })
   ```

**Förväntat resultat:**
- CORS-fel visas i konsolen
- Request blockeras
- Ingen data returneras

**Status:** ⬜ Ej testad | ✅ Godkänd | ❌ Misslyckad

---

#### 5.2 CSP-skydd

**Testfall ID:** SEC-002  
**Beskrivning:** Verifiera att CSP blockerar okända skript

**Steg:**
1. Öppna Outlook-tillägget
2. Öppna webbläsarens utvecklarverktyg
3. Försök köra:
   ```javascript
   eval('alert("XSS")');
   ```

**Förväntat resultat:**
- CSP-fel visas i konsolen
- Skript blockeras
- Ingen alert visas

**Status:** ⬜ Ej testad | ✅ Godkänd | ❌ Misslyckad

---

#### 5.3 Token-säkerhet

**Testfall ID:** SEC-003  
**Beskrivning:** Verifiera att tokens inte exponeras

**Steg:**
1. Logga in (AUTH-001)
2. Öppna webbläsarens utvecklarverktyg
3. Gå till Network-fliken
4. Skapa ett möte
5. Inspektera requests

**Förväntat resultat:**
- Access token skickas endast i Authorization-header
- Token visas inte i URL:er
- Token visas inte i request body
- Token loggas inte i konsolen

**Status:** ⬜ Ej testad | ✅ Godkänd | ❌ Misslyckad

---

#### 5.4 Datakryptering

**Testfall ID:** SEC-004  
**Beskrivning:** Verifiera att känslig data krypteras

**Steg:**
1. Skapa möte med personnummer (MEET-003)
2. Logga in på Nextcloud-servern via SSH
3. Kör SQL-query:
   ```sql
   SELECT personal_number FROM oc_outlook_participant_settings WHERE email = 'testuser2@itsl.se';
   ```

**Förväntat resultat:**
- `personal_number` innehåller krypterad data (inte "19800101-1234" i klartext)
- Data är base64-kodad eller liknande
- Kan inte läsas utan dekryptering

**Status:** ⬜ Ej testad | ✅ Godkänd | ❌ Misslyckad

---

### 6. Kompatibilitet

#### 6.1 Outlook Web

**Testfall ID:** COMPAT-001  
**Beskrivning:** Verifiera funktionalitet i Outlook Web

**Plattform:** Outlook Web (outlook.office.com)  
**Webbläsare:** Chrome, Edge, Firefox, Safari

**Testfall att köra:**
- AUTH-001 (Inloggning)
- MEET-001 (Skapa möte)
- MEET-006 (Teams-länk-borttagning)

**Förväntat resultat:**
- All funktionalitet fungerar i alla webbläsare

**Status:** ⬜ Ej testad | ✅ Godkänd | ❌ Misslyckad

---

#### 6.2 Outlook Desktop (Windows)

**Testfall ID:** COMPAT-002  
**Beskrivning:** Verifiera funktionalitet i Outlook Desktop för Windows

**Plattform:** Outlook Desktop (Windows)

**Testfall att köra:**
- AUTH-001 (Inloggning)
- MEET-001 (Skapa möte)

**Förväntat resultat:**
- All funktionalitet fungerar

**Status:** ⬜ Ej testad | ✅ Godkänd | ❌ Misslyckad

---

#### 6.3 Outlook för Mac

**Testfall ID:** COMPAT-003  
**Beskrivning:** Verifiera funktionalitet i Outlook för Mac

**Plattform:** Outlook för Mac

**Testfall att köra:**
- AUTH-001 (Inloggning)
- MEET-001 (Skapa möte)

**Förväntat resultat:**
- All funktionalitet fungerar

**Status:** ⬜ Ej testad | ✅ Godkänd | ❌ Misslyckad

---

### 7. Prestanda

#### 7.1 API-svarstid

**Testfall ID:** PERF-001  
**Beskrivning:** Mät API-svarstid för mötesskapa

**Steg:**
1. Öppna webbläsarens utvecklarverktyg (Network-fliken)
2. Skapa ett möte (MEET-001)
3. Mät tiden för POST-request till `/api/v1/meeting`

**Förväntat resultat:**
- Svarstid < 2 sekunder
- Ingen timeout
- 200 OK-status

**Status:** ⬜ Ej testad | ✅ Godkänd | ❌ Misslyckad

---

#### 7.2 Samtidiga användare

**Testfall ID:** PERF-002  
**Beskrivning:** Testa med flera samtidiga användare

**Steg:**
1. Logga in med 5+ användare samtidigt
2. Skapa möten från alla användare samtidigt
3. Övervaka Nextcloud-serverns prestanda

**Förväntat resultat:**
- Alla möten skapas utan fel
- Ingen märkbar fördröjning
- Servern hanterar belastningen

**Status:** ⬜ Ej testad | ✅ Godkänd | ❌ Misslyckad

---

### 8. Felhantering

#### 8.1 Nätverksfel

**Testfall ID:** ERROR-001  
**Beskrivning:** Hantera nätverksfel

**Steg:**
1. Starta mötesskapa
2. Koppla bort nätverket under processen
3. Återanslut nätverket

**Förväntat resultat:**
- Felmeddelande visas
- Användaren kan försöka igen
- Ingen data förloras

**Status:** ⬜ Ej testad | ✅ Godkänd | ❌ Misslyckad

---

#### 8.2 Nextcloud-server nere

**Testfall ID:** ERROR-002  
**Beskrivning:** Hantera när Nextcloud-servern är nere

**Steg:**
1. Stoppa Nextcloud-servern tillfälligt
2. Försök skapa möte

**Förväntat resultat:**
- Tydligt felmeddelande visas
- "Kunde inte ansluta till Nextcloud-servern"
- Användaren kan försöka igen senare

**Status:** ⬜ Ej testad | ✅ Godkänd | ❌ Misslyckad

---

#### 8.3 Ogiltiga mötesdata

**Testfall ID:** ERROR-003  
**Beskrivning:** Hantera ogiltiga mötesdata

**Steg:**
1. Skapa kalenderhändelse utan titel
2. Försök skapa Talk-möte

**Förväntat resultat:**
- Valideringsfel visas
- "Mötestitel är obligatorisk"
- Möte skapas inte

**Status:** ⬜ Ej testad | ✅ Godkänd | ❌ Misslyckad

---

## Testrapport

### Sammanfattning

| Kategori | Totalt | Godkända | Misslyckade | Ej testade |
|----------|--------|----------|-------------|------------|
| Installation | 5 | 0 | 0 | 5 |
| Autentisering | 4 | 0 | 0 | 4 |
| Mötesskapa | 6 | 0 | 0 | 6 |
| Nextcloud-integration | 4 | 0 | 0 | 4 |
| Säkerhet | 4 | 0 | 0 | 4 |
| Kompatibilitet | 3 | 0 | 0 | 3 |
| Prestanda | 2 | 0 | 0 | 2 |
| Felhantering | 3 | 0 | 0 | 3 |
| **TOTALT** | **31** | **0** | **0** | **31** |

### Kritiska buggar

Inga kritiska buggar identifierade ännu.

### Kända begränsningar

1. **Gästdeltagare**: Deltagare utan Nextcloud-konto läggs inte automatiskt till i Talk-rummet, men kan ansluta via länken
2. **Teams-länk-detektion**: Kan missa vissa varianter av Teams-länkar
3. **Offline-läge**: Ingen offline-funktionalitet, kräver internetanslutning

### Rekommendationer

1. Genomför alla testfall innan produktionsdrift
2. Testa med riktiga användare i pilotfas
3. Övervaka loggar under första veckan
4. Samla feedback från användare
5. Planera för regelbundna säkerhetsgranskningar

---

**Testare:** _________________  
**Datum:** _________________  
**Version:** 1.0.0

