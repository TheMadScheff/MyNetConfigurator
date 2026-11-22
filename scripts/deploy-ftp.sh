#!/usr/bin/env bash
# Lädt die Demo (Ordner app/) per FTP hoch, z. B. nach scheffknecht.net/agroflor.
#
# Einmalig:  cp .env.deploy.example .env.deploy   und Zugangsdaten eintragen (Datei bleibt lokal, ist in .gitignore).
# Benötigt:  lftp  (macOS: brew install lftp · Debian/Ubuntu: sudo apt install lftp · Windows: in WSL)
#
# Aufruf:    ./scripts/deploy-ftp.sh            Tests ausführen und hochladen
#            ./scripts/deploy-ftp.sh --dry-run  nur anzeigen, was hochgeladen würde
#            ./scripts/deploy-ftp.sh --delete   zusätzlich Dateien im Zielordner löschen, die es lokal nicht mehr gibt
set -euo pipefail
cd "$(dirname "$0")/.."

DRY=""; DELETE=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY="--dry-run" ;;
    --delete) DELETE="--delete" ;;
    *) echo "Unbekannte Option: $arg" >&2; exit 2 ;;
  esac
done

if [ ! -f .env.deploy ]; then
  echo "Fehlt: .env.deploy  →  cp .env.deploy.example .env.deploy  und ausfüllen." >&2
  exit 1
fi
set -a; . ./.env.deploy; set +a

for v in FTP_HOST FTP_USER FTP_PASS FTP_DIR; do
  if [ -z "${!v:-}" ]; then echo "In .env.deploy fehlt $v." >&2; exit 1; fi
done
FTP_PROTOCOL="${FTP_PROTOCOL:-ftps}"
FTP_PORT="${FTP_PORT:-21}"

command -v lftp >/dev/null || { echo "lftp ist nicht installiert (macOS: brew install lftp)." >&2; exit 1; }

if command -v node >/dev/null; then
  echo "▸ Preislogik testen"
  node --test tests/*.test.js >/dev/null && echo "  Tests grün"
else
  echo "▸ node nicht gefunden, Tests übersprungen"
fi

if [ "$FTP_PROTOCOL" = "ftps" ]; then
  SSL="set ftp:ssl-force true; set ftp:ssl-protect-data true;"
else
  SSL="set ftp:ssl-allow false;"
fi

echo "▸ Lade app/ nach ${FTP_HOST}${FTP_DIR} ${DRY:+(Probelauf)}"
# Passwort über Umgebungsvariable, damit es nicht in der Prozessliste steht.
export LFTP_PASSWORD="$FTP_PASS"
lftp --env-password -u "$FTP_USER" -p "$FTP_PORT" "ftp://$FTP_HOST" -e "
  set net:max-retries 2; set net:timeout 20; $SSL
  mkdir -p -f $FTP_DIR;
  mirror --reverse --verbose --only-newer $DRY $DELETE --exclude-glob .DS_Store app/ $FTP_DIR;
  bye
"
echo "✓ Fertig${FTP_URL:+: $FTP_URL}"
