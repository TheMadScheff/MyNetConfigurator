#!/usr/bin/env sh
# Baut die Vorschau-Version für claude.ai-Artifacts nach dist/artifact/.
# Das Artifact-Hosting setzt doctype, <html>, <head> und <body> selbst, daher werden diese Zeilen entfernt.
set -e
cd "$(dirname "$0")/.."
out=dist/artifact
mkdir -p "$out"
grep -v -E '^\s*(<!doctype html>|<html|</html>|<head>|</head>|<body>|</body>|<meta charset|<meta name="viewport")' app/index.html > "$out/index.html"
cp app/styles.css app/catalog.js app/pricing.js app/app.js "$out/"
echo "OK: $out"
