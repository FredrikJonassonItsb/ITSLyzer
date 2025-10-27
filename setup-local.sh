#!/bin/bash

# Setup script för lokal Nextcloud-installation med Outlook-integration
# Kör detta script för att automatiskt sätta upp utvecklingsmiljön

set -e

echo "=========================================="
echo "Outlook-Nextcloud Integration - Lokal Setup"
echo "=========================================="
echo ""

# Färger för output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Kontrollera förutsättningar
echo "Kontrollerar förutsättningar..."

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker är inte installerat${NC}"
    echo "Installera Docker från: https://docs.docker.com/get-docker/"
    exit 1
fi
echo -e "${GREEN}✓ Docker är installerat${NC}"

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose är inte installerat${NC}"
    echo "Installera Docker Compose från: https://docs.docker.com/compose/install/"
    exit 1
fi
echo -e "${GREEN}✓ Docker Compose är installerat${NC}"

# Kontrollera om mkcert finns
if ! command -v mkcert &> /dev/null; then
    echo -e "${YELLOW}⚠ mkcert är inte installerat${NC}"
    echo "För HTTPS-stöd, installera mkcert:"
    echo "  macOS: brew install mkcert"
    echo "  Linux: Se https://github.com/FiloSottile/mkcert#installation"
    echo "  Windows: choco install mkcert"
    echo ""
    read -p "Fortsätt utan HTTPS? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    USE_HTTPS=false
else
    echo -e "${GREEN}✓ mkcert är installerat${NC}"
    USE_HTTPS=true
fi

echo ""
echo "=========================================="
echo "Steg 1: Skapa SSL-certifikat (om mkcert finns)"
echo "=========================================="

if [ "$USE_HTTPS" = true ]; then
    echo "Installerar lokal CA..."
    mkcert -install
    
    echo "Skapar certifikat för nextcloud.local..."
    mkdir -p certs
    cd certs
    mkcert nextcloud.local localhost 127.0.0.1 ::1
    cd ..
    
    echo -e "${GREEN}✓ Certifikat skapade${NC}"
    
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
        
        <IfModule mod_dav.c>
            Dav off
        </IfModule>
    </Directory>
</VirtualHost>
EOF
    echo -e "${GREEN}✓ Apache SSL-konfiguration skapad${NC}"
else
    echo -e "${YELLOW}Hoppar över SSL-konfiguration${NC}"
fi

echo ""
echo "=========================================="
echo "Steg 2: Uppdatera hosts-fil"
echo "=========================================="

# Kontrollera om nextcloud.local redan finns i hosts
if grep -q "nextcloud.local" /etc/hosts 2>/dev/null; then
    echo -e "${GREEN}✓ nextcloud.local finns redan i hosts-filen${NC}"
else
    echo "Lägger till nextcloud.local i hosts-filen..."
    echo "Du kan behöva ange ditt lösenord:"
    
    if [[ "$OSTYPE" == "darwin"* ]] || [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # macOS eller Linux
        echo "127.0.0.1 nextcloud.local" | sudo tee -a /etc/hosts
        echo -e "${GREEN}✓ nextcloud.local tillagd i /etc/hosts${NC}"
    else
        # Windows (via Git Bash eller WSL)
        echo -e "${YELLOW}⚠ Lägg till följande rad manuellt i C:\\Windows\\System32\\drivers\\etc\\hosts:${NC}"
        echo "127.0.0.1 nextcloud.local"
        read -p "Tryck Enter när du har lagt till raden..."
    fi
fi

echo ""
echo "=========================================="
echo "Steg 3: Starta Docker-containrar"
echo "=========================================="

echo "Startar Nextcloud, MariaDB och Redis..."
docker-compose -f docker-compose.local.yml up -d

echo "Väntar på att Nextcloud ska starta (detta kan ta 1-2 minuter)..."
sleep 30

# Vänta tills Nextcloud är redo
echo "Kontrollerar om Nextcloud är redo..."
RETRIES=30
while [ $RETRIES -gt 0 ]; do
    if docker exec nextcloud-app php -r "echo 'OK';" &> /dev/null; then
        echo -e "${GREEN}✓ Nextcloud är redo${NC}"
        break
    fi
    echo "Väntar... ($RETRIES försök kvar)"
    sleep 5
    RETRIES=$((RETRIES-1))
done

if [ $RETRIES -eq 0 ]; then
    echo -e "${RED}❌ Nextcloud startade inte inom förväntad tid${NC}"
    echo "Kontrollera loggarna med: docker-compose -f docker-compose.local.yml logs nextcloud"
    exit 1
fi

echo ""
echo "=========================================="
echo "Steg 4: Installera och konfigurera appar"
echo "=========================================="

echo "Installerar Talk (Spreed)..."
docker exec -u www-data nextcloud-app php occ app:install spreed || echo "Talk redan installerad"
docker exec -u www-data nextcloud-app php occ app:enable spreed

echo "Installerar Calendar..."
docker exec -u www-data nextcloud-app php occ app:install calendar || echo "Calendar redan installerad"
docker exec -u www-data nextcloud-app php occ app:enable calendar

echo "Installerar OAuth2..."
docker exec -u www-data nextcloud-app php occ app:install oauth2 || echo "OAuth2 redan installerad"
docker exec -u www-data nextcloud-app php occ app:enable oauth2

echo "Aktiverar Outlook Integrator..."
docker exec -u www-data nextcloud-app php occ app:enable outlook_integrator

echo -e "${GREEN}✓ Alla appar installerade och aktiverade${NC}"

echo ""
echo "=========================================="
echo "Steg 5: Konfigurera CORS"
echo "=========================================="

echo "Konfigurerar tillåtna origins..."
docker exec -u www-data nextcloud-app php occ config:app:set outlook_integrator allowed_origins --value "http://localhost:5500,https://fredrikjonassonitsb.github.io"

echo -e "${GREEN}✓ CORS konfigurerat${NC}"

if [ "$USE_HTTPS" = true ]; then
    echo ""
    echo "=========================================="
    echo "Steg 6: Aktivera SSL i Apache"
    echo "=========================================="
    
    echo "Aktiverar SSL-modul..."
    docker exec nextcloud-app a2enmod ssl
    docker exec nextcloud-app a2ensite default-ssl
    docker exec nextcloud-app service apache2 reload
    
    echo -e "${GREEN}✓ SSL aktiverat${NC}"
fi

echo ""
echo "=========================================="
echo "✅ Installation klar!"
echo "=========================================="
echo ""
echo "Nextcloud är nu tillgänglig på:"
if [ "$USE_HTTPS" = true ]; then
    echo "  🔒 HTTPS: https://nextcloud.local"
fi
echo "  🌐 HTTP:  http://localhost:8080"
echo ""
echo "Inloggningsuppgifter:"
echo "  👤 Användarnamn: admin"
echo "  🔑 Lösenord: admin123"
echo ""
echo "Nästa steg:"
echo "  1. Logga in på Nextcloud"
echo "  2. Gå till Inställningar > Säkerhet > OAuth 2.0"
echo "  3. Skapa en OAuth2-klient med:"
echo "     - Namn: Outlook Integrator Local"
echo "     - Redirect URI: http://localhost:5500/outlook-addin/src/auth/auth-callback.html"
echo "  4. Starta en lokal webbserver för Outlook-tillägget:"
echo "     cd $(pwd)"
echo "     python3 -m http.server 5500"
echo "  5. Öppna Outlook och installera tillägget från:"
echo "     http://localhost:5500/outlook-addin/manifest.xml"
echo ""
echo "För mer information, se LOCAL_SETUP.md"
echo ""
echo "Användbara kommandon:"
echo "  Visa loggar: docker-compose -f docker-compose.local.yml logs -f"
echo "  Stoppa: docker-compose -f docker-compose.local.yml down"
echo "  Starta om: docker-compose -f docker-compose.local.yml restart"
echo ""

