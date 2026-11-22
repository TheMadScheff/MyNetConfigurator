# MyNetConfigurator

Produktkonfigurator für Sichtschutz-Gaze und Netze nach Maß (Prototyp, Phase 2: Ergebnisse in Odoo speichern). Statisch, ohne Build und ohne Abhängigkeiten. Details in `README.md`.

## Struktur
- `app/` – Demo: `index.html`, `share.js` (Speichern per Link), `app.js` (Bedienung, SVG-Vorschau), `catalog.js` (Produktdaten), `pricing.js` (reine Preislogik ohne DOM), `geometry.js` (Formen: Rechteck, Trapez, Dreieck, reine Funktionen), `styles.css`
- `tests/pricing.test.js` – prüft die Preislogik gegen gemessene Shop-Preise; `tests/geometry.test.js` – Formen, Ösen, Formzuschlag, Export; `tests/features.test.js` – Ösenoptionen, Zubehör, Link
- `docs/` – Analysen, `stilrichtlinien-agroflor.md`, Umsetzungsanleitungen `anleitung-*.md`
- `TODO.md` – offene Aufgaben; bei einer Aufgabe mit Anleitung zuerst die verlinkte Datei lesen
- `scripts/build-artifact.sh` – baut die Online-Vorschau nach `dist/`
- `scripts/deploy.sh` – FTP-Upload (siehe unten)

## Befehle
- Lokal starten: `cd app && python3 -m http.server 8765`
- Tests: `node --test tests/*.test.js`

## Deployment (FTP)
- `scripts/deploy.sh` führt Tests und Probelauf aus, `scripts/deploy.sh --go` lädt `app/` nach `https://scheffknecht.net/agroflor/` hoch.
- Es nutzt den globalen Skill `ftp-upload` (`~/.claude/skills/ftp-upload/scripts/ftp.sh`), Profil `scheffknecht`, Unterordner `agroflor` (überschreibbar mit `FTP_PROFILE`, `FTP_SUBDIR`).
- Upload überschreibt gleichnamige Dateien und löscht nichts. Vor `--go` Probelauf zeigen und bestätigen lassen.
- Passwörter liegen im macOS-Schlüsselbund. Nie selbst auslesen oder in Dateien schreiben. Fehlt ein Profil, `~/.claude/skills/ftp-upload/scripts/setup.sh` vom Benutzer in einem eigenen Terminal ausführen lassen.
- Das ältere `scripts/deploy-ftp.sh` (lftp, Passwort in `.env.deploy`) bleibt vorerst bestehen, wird aber nicht benutzt.

## Formen
- Fünf Formen (`geometry.js`, `SHAPES`): `RECT`, `TRAPEZ_SYM`, `TRAPEZ_RECHT`, `DREIECK_RECHT`, `DREIECK_FREI`. Positionen ohne `shape` gelten als `RECT`; ein Rechteck rechnet exakt wie vorher.
- Seitencodes bleiben `top/right/bottom/left`, beim Dreieck entfällt `top`. Seite i läuft von Ecke i zu Ecke i+1 (Uhrzeigersinn ab links oben, y nach unten).
- Preisregel `shapePricing` (Bereich „Preisregeln“): `area`, `area_surcharge` (Standard, Demo-Zuschlag 15 % in `catalog.shapeRules`), `bbox`. Die Staffel richtet sich nach der berechneten Fläche, das Gewicht nach der echten.
- Regeln in `catalog.shapeRules`: Mindestwinkel 15°, Mindestseite 30 cm, Mindest-Oberkante 30 cm (Demo-Werte). Die Maßgrenzen `catalog.limits` gelten für das umschließende Rechteck.
- Export-Schema `net-configurator/order@2` mit `shape`, `geometry.vertices` und `geometry.sides`.

## Ösenoptionen, Befestigung, Link
- Kantenarten mit Ösen: alle 50 cm, alle 30 cm, eigener Abstand (`OESEN_EIGEN`, Feld `eyeletSpacingCm`, 10–200 cm), nur Ecken. Je Position zusätzlich `eyeletMaterial` (`STANDARD`/`EDELSTAHL`, Mehrpreis Demo-Wert in `catalog.eyeletOptions`) und `eyeletAligned` (gegenüberliegende Seiten gleich viele Ösen).
- Befestigungszubehör steht in `catalog.accessories` (Demo-Preise, `DEMO-ZUB-…`). Es gilt für den ganzen Auftrag (`P.priceOrder(cat, positions, rules, extras)`), die Menge wird je Öse vorgeschlagen und ist änderbar. Es steht als eigener Block im PDF, im Export (`accessories`) und in der Kontaktmail. Das frühere Zubehör je Position (Preisregel `accessories`) gibt es nicht mehr.
- Link: `share.js` (`NetShare.encode/decode`) packt eigene Positionen, Preisregeln und Zubehör als Base64-JSON in `#k=…`. Beim Laden wird jede Position mit `NetPricing.validate` geprüft; vorhandene eigene Positionen werden nur nach Rückfrage ersetzt.
- Der Hinweis „So berechnet sich der Preis“ kommt aus `priceExplanation()` in `app.js` (Seite und PDF).

## PDF-Export
- Button „Als PDF exportieren“ (ersetzt JSON-Export/-Import) → `app/pdf.js` (`NetPdf.create`) mit jsPDF 4.2.1 aus `app/vendor/` (MIT, ohne CDN).
- Je Position ein Vorschau-Bild (`buildPreview` in `app.js`, als JPEG gerendert) plus Daten, am Ende die Summen. Titel: „Angebotsanfrage“.
- `P.exportOrder` in `pricing.js` bleibt für Odoo (Phase 2) und das Kontaktformular bestehen.

## Kontaktformular
- `app/contact.js` (Frontend) → `app/kontakt.php` (PHP, `mail()`), Positionen kommen über `window.NetConfigurator.getOrder()` aus `app.js`.
- Empfänger und Absender stehen in `app/kontakt.config.php` (in `.gitignore`, weil das Repo öffentlich ist). Vorlage: `kontakt.config.example.php`. Die Adresse trägt der Benutzer selbst ein; `deploy.sh` lädt die Datei mit hoch.
- Lokal testen mit `'dry_run' => true` in der Config: schreibt `kontakt.dry-run.txt` statt zu senden.

## Materialbilder (derzeit deaktiviert)
- Die Fotos stammen von allbuyone.com, die Rechte sind ungeklärt. Bis der Benutzer das bestätigt, sind sie aus der Demo entfernt: Dateien liegen in `_zurueckgehalten/materialbilder/` (in `.gitignore`, nie committen oder hochladen), `catalog.js` hat keine `image`-Einträge.
- Wieder aktivieren: Dateien nach `app/img/materials/<MATERIAL_CODE>.webp` und je Material `image: 'img/materials/<CODE>.webp'` in `catalog.js` (`app.js` zeigt das Bild dann in der Karte; fehlt die Datei, bleibt die Karte ohne Bild).

## Konventionen
- Sprache der Kommunikation und der UI-Texte: Deutsch.
- Branch `feature/prototyp` (PR #2), Remote `origin` = TheMadScheff/MyNetConfigurator.
