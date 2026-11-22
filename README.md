# MyNetConfigurator

Produktkonfigurator für Sichtschutz-Gaze und Netze nach Maß (Prototyp). Ziel: ein Konfigurator, der mindestens so gut ist wie die bestehenden Lösungen; in Phase 2 sollen die Ergebnisse in Odoo gespeichert werden.

## Inhalt

| Pfad | Zweck |
|---|---|
| `docs/` | Analysen und Konzepte (Vergleich allbuyone / easy2cover) |
| `app/index.html` | Oberfläche, im Browser öffnen |
| `app/catalog.js` | Produktdaten: Gaze-Typen, Farben, Artikelnummern, Staffelpreise (netto), Kantenarten, Maßgrenzen |
| `app/pricing.js` | Reine Preis- und Geometrielogik ohne DOM (Fläche, Staffel, Kanten, Ösen, Export) |
| `app/app.js` | Bedienung, Vorschau (SVG), Positionsliste, Export/Import |
| `tests/` | Prüft die Preislogik gegen gemessene Shop-Preise |
| `scripts/build-artifact.sh` | Baut die Online-Vorschau nach `dist/artifact/` |

## Starten

```sh
cd app && python3 -m http.server 8765   # dann http://localhost:8765 öffnen
```

Kein Build nötig, keine Abhängigkeiten.

## Tests

```sh
node --test tests/*.test.js
```

Die Tests prüfen u. a. acht Preise, die am 22.11.2026 im allbuyone-Konfigurator gemessen wurden (Gaze 203 B1); alle stimmen auf den Cent.

## Preislogik (Kurzfassung)

```
fläche_m2    = breite_cm × höhe_cm / 10 000
stück_netto  = fläche_m2 × Staffelpreis(gaze, staffelfläche) + Kantenaufpreise + Zubehör
stück_brutto = rund2(stück_netto × 1,19)
position     = stück_brutto × menge
```

Standard ist das heutige Shop-Verhalten: Staffel je Stückfläche, Kanten im m²-Preis enthalten, kein Zubehör.
Unter „Preisregeln“ lassen sich die Vorschläge aus der Analyse zuschalten (Staffel je Auftrag, Aufpreis je Laufmeter, Kabelbinder je Öse). Deren Preise sind Demo-Werte in `app/catalog.js` (`proposedNetPerM`, `accessories`).

## Export (Übergabe an Odoo, Phase 2)

„Export (JSON)“ liefert `net-configurator/order@1`: je Position Gaze-Code, Farbcode, Artikelnummer, Maße, Kanten je Seite, Ösenanzahl, Menge, Netto-/Bruttopreise und Gewicht. Alle Schlüssel sind stabile Codes, keine Anzeigetexte.

## Demo veröffentlichen (FTP)

Der Workflow `.github/workflows/deploy-ftp.yml` testet die Preislogik und lädt den Ordner `app/` per FTP hoch, bei jedem Push auf `main` (Änderungen in `app/`) oder per Hand unter *Actions → Demo per FTP veröffentlichen → Run workflow*.

Einmalig unter *Settings → Secrets and variables → Actions* anlegen: `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`, `FTP_SERVER_DIR` (z. B. `/agroflor/`). Optional `FTP_PROTOCOL` (`ftps` oder `ftp`, Standard `ftps`) und `FTP_PORT`.
