#!/usr/bin/env bash
# Lädt die Demo (app/) per FTP nach scheffknecht.net/agroflor hoch.
# Nutzt den globalen Skill ftp-upload: Zugangsdaten liegen im macOS-Schlüsselbund, nicht im Projekt.
# Aufruf:  scripts/deploy.sh         Tests + Probelauf
#          scripts/deploy.sh --go    Tests + echter Upload
# Ziel überschreibbar über FTP_PROFILE / FTP_SUBDIR.
set -euo pipefail
cd "$(dirname "$0")/.."

FTP="$HOME/.claude/skills/ftp-upload/scripts/ftp.sh"
PROFILE="${FTP_PROFILE:-scheffknecht}"
SUBDIR="${FTP_SUBDIR:-agroflor}"

[ -f app/index.html ] || { echo "app/index.html fehlt" >&2; exit 1; }

echo "▸ Preislogik testen"
node --test tests/*.test.js >/dev/null && echo "  Tests grün"

if [ "${1:-}" = "--go" ]; then
  "$FTP" upload "$PROFILE" app "$SUBDIR"
  "$FTP" ls "$PROFILE" "$SUBDIR"
  echo "✓ Fertig: https://scheffknecht.net/$SUBDIR/"
else
  "$FTP" upload "$PROFILE" app "$SUBDIR" --dry-run
  echo "Probelauf. Echter Upload: scripts/deploy.sh --go"
fi
