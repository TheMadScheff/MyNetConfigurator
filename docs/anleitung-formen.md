# Anleitung: Trapeze und Dreiecke im Konfigurator

Ziel: Der Kunde wählt zuerst die Form und gibt dann nur die Maße ein, die zu dieser Form passen. Danach wählt er wie bisher die Kanten je Seite. Preis, Ösen, Vorschau, PDF und Export funktionieren für jede Form.

Diese Anleitung ist so geschrieben, dass ein Coding-Assistent in VS Code sie Schritt für Schritt abarbeiten kann. Sie setzt auf dem lokalen Stand mit `pdf.js`, `contact.js` und den PHP-Dateien auf.

## Grundregeln

- Kein Build, weiter Vanilla JS. Neue Logik kommt als reine Funktionen in eine eigene Datei `app/geometry.js` (UMD wie `pricing.js`: `module.exports` oder `window.NetGeometry`).
- Ein **Rechteck muss exakt wie heute rechnen.** Die bestehenden Tests (`node --test tests/*.test.js`) müssen unverändert grün bleiben.
- Einheiten: Maße in ganzen cm, Fläche in m². Koordinaten in cm mit dem Ursprung **oben links**, y zeigt nach unten (wie das SVG).
- Die Seitencodes bleiben `top`, `right`, `bottom`, `left`. Beim Dreieck entfällt `top`. Damit bleiben Kantenauswahl, Export und Odoo-Schlüssel stabil.

## 1. Formen und Maße

| Code | Name im UI | Eingaben | Ecken (x, y) in cm |
|---|---|---|---|
| `RECT` | Rechteck | `widthCm`, `heightCm` | (0,0) (W,0) (W,H) (0,H) |
| `TRAPEZ_SYM` | Trapez, gleichschenklig | `widthCm` (Unterkante), `topCm` (Oberkante), `heightCm` | (o,0) (o+T,0) (W,H) (0,H), mit o = (W−T)/2 |
| `TRAPEZ_RECHT` | Trapez, eine Seite senkrecht | `widthCm`, `topCm`, `heightCm`, `slant` = `left` oder `right` (welche Seite schräg ist) | slant `right`: (0,0) (T,0) (W,H) (0,H) · slant `left`: (W−T,0) (W,0) (W,H) (0,H) |
| `DREIECK_RECHT` | Dreieck, rechtwinklig | `widthCm`, `heightCm`, `rightAngle` = `left` oder `right` | `left`: (0,0) (W,H) (0,H) · `right`: (W,0) (W,H) (0,H) |
| `DREIECK_FREI` | Dreieck, drei Seiten | `widthCm` = a (Unterkante), `sideLeftCm` = c, `sideRightCm` = b | Spitze: x = (c² − b² + a²) / (2a), h = √(c² − x²) · Ecken (x,0) (a,h) (0,h) |

Hinweise:

- Beim Trapez darf die Oberkante auch länger als die Unterkante sein. Dann ist o negativ. Verschiebe in diesem Fall alle Punkte so, dass das kleinste x gleich 0 ist.
- `widthCm` und `heightCm` behalten beim Rechteck ihre heutige Bedeutung. Alte Positionen ohne `shape` gelten als `RECT`.
- Beim freien Dreieck kann die Spitze außerhalb der Unterkante liegen (x < 0 oder x > a, stumpfer Winkel). Auch hier alle Punkte so verschieben, dass das kleinste x gleich 0 ist.

Seiten je Form (Reihenfolge im Uhrzeigersinn ab oben):

- Rechteck und Trapez: `top`, `right`, `bottom`, `left`.
- Dreieck: `right`, `bottom`, `left`. Beim rechtwinkligen Dreieck ist eine dieser Seiten senkrecht, die andere schräg.
- Labels im UI: „Oben“, „Rechts“, „Unten“, „Links“. Schräge Seiten bekommen den Zusatz „(schräg)“, zum Beispiel „Rechts (schräg)“.

## 2. `app/geometry.js` (neu)

Exportiere diese Funktionen:

```js
SHAPES                 // Liste: { code, label, inputs: ['widthCm', ...], sides: ['top', ...] }
shapeGeometry(pos)     // → { vertices:[{x,y}], sides:[{code,label,slanted,from,to,lengthCm}],
                       //     areaM2, bboxWidthCm, bboxHeightCm, anglesDeg:[...] } oder { error }
polygonAreaCm2(vertices)  // Gaußsche Trapezformel (Shoelace), Betrag
```

- `sides[i].from` und `to` sind Eckpunkte. `lengthCm` ist die euklidische Länge, auf 0,1 cm gerundet.
- `anglesDeg` enthält die Innenwinkel an jeder Ecke in derselben Reihenfolge wie `vertices`.
- Bei `DREIECK_FREI` und ungültigen Seiten (Dreiecksungleichung verletzt) gibt die Funktion `{ error: 'triangle' }` zurück und wirft keine Exception.

## 3. Validierung (`pricing.js` → `validate`)

Ergänze die Prüfung, je nach Form:

- Alle Eingaben der Form sind ganze cm ≥ 1.
- Das **umschließende Rechteck** (`bboxWidthCm`, `bboxHeightCm`) hält die heutigen Grenzen aus `catalog.limits` ein.
- Trapez: `topCm` ≥ 30 cm. Wenn kleiner, Meldung „Für eine Spitze bitte Dreieck wählen.“
- Freies Dreieck: Dreiecksungleichung. Meldung: „Diese drei Seiten ergeben kein Dreieck. Die längste Seite muss kürzer sein als die beiden anderen zusammen.“
- Kein Innenwinkel unter **15°**. Meldung: „Die Spitze wird zu schmal (unter 15°). Bitte Maße anpassen.“ Den Wert als `catalog.shapeRules.minAngleDeg` ablegen.
- Jede Seite ≥ 30 cm (`catalog.shapeRules.minSideCm`).
- Kanten nur für die Seiten der Form prüfen, also nicht für `top` beim Dreieck.

Die Fehler-`field`s sind die Eingabenamen (`widthCm`, `topCm`, `sideLeftCm` …). Beim Winkelfehler und beim Dreiecksfehler ist es `shape`.

## 4. Ösen (`eyelets`)

Verallgemeinere die heutige Funktion auf beliebige Seiten:

- Ecken: Jede Ecke wird geöst, wenn eine der beiden angrenzenden Seiten Ösen hat. Das ist dieselbe Regel wie heute.
- `spaced`: Für eine Seite mit der Länge L gilt `segments = max(1, ceil(L / spacing))`. Die Ösen liegen gleichmäßig zwischen `from` und `to` (lineare Interpolation), ohne die Ecken.
- `corners`: nur die Ecken.
- Rückgabe wie bisher: `{ points, count, spacingBySide }`. Beim Rechteck müssen die Zahlen exakt gleich bleiben wie heute.

## 5. Preis (`pricePosition`)

- `area` kommt aus `shapeGeometry(pos).areaM2`.
- Die Kantenlängen kommen aus `sides[].lengthCm`, nicht mehr aus `sideLengthCm`. Diese Funktion bleibt für das Rechteck erhalten.
- Neue Preisregel `shapePricing` in `DEFAULT_RULES`, mit Anzeige im Bereich „Preisregeln“:
  - `area`: nur die echte Fläche.
  - `area_surcharge` (**Standard**): echte Fläche × (1 + `catalog.shapeRules.surchargePct` / 100). Demo-Wert 15 %. Beim Rechteck gibt es nie einen Zuschlag.
  - `bbox`: Fläche des umschließenden Rechtecks, also Abrechnung inklusive Verschnitt.
- Gib im Ergebnis zusätzlich `shapeAreaM2` (echte Fläche), `billedAreaM2` (berechnete Fläche) und `shapeSurchargeNet` zurück. Die Staffel richtet sich nach `billedAreaM2`.
- `weightKg` aus der echten Fläche.

## 6. UI (`index.html`, `app.js`, `styles.css`)

1. **Neuer erster Schritt „Form“** vor „Gewebe“. Darin 5 Bildkarten mit kleinen SVG-Icons, aufgebaut wie die Materialkarten (role=radio, Pfeiltasten).
2. **Maße:** Die Eingabefelder entstehen aus `SHAPES[].inputs`. Labels:
   - `widthCm` heißt beim Rechteck „Breite“, sonst „Unterkante“.
   - `topCm` heißt „Oberkante“, `heightCm` heißt „Höhe“.
   - `sideLeftCm` heißt „Linke Seite“, `sideRightCm` heißt „Rechte Seite“.
   - `slant` und `rightAngle` sind Umschalter „schräge Seite: links / rechts“.
3. Solange ein Maßfeld den Fokus hat, wird das zugehörige Maß in der Vorschau hervorgehoben (Maßlinie in Akzentfarbe). Das ist der „geführte“ Teil.
4. Die Schnellwahl-Chips (Bauzaun usw.) nur bei `RECT` zeigen.
5. **Vorschau (`renderPreview`, bzw. `buildPreview` im lokalen Stand):**
   - Polygon statt Rechteck. Gewebemuster, Ösen und Kantenfarben wie heute.
   - Je Seite eine klickbare, breite, unsichtbare Trefferlinie.
   - Die Maßbeschriftung steht parallel zur Seite. Bei schrägen Seiten wird der Text gedreht, aber nie auf den Kopf.
   - Beim freien Dreieck stehen zusätzlich die Winkel an den Ecken.
6. **Kanten:** Die Auswahlliste zeigt nur die Seiten der Form. „Auswahl … auf alle Seiten übernehmen“ wirkt nur auf diese Seiten.
7. **Positionsliste:** Das Vorschaubild zeigt das Polygon. Der Text lautet zum Beispiel „Trapez 400/200 × 180 cm“ oder „Dreieck 300 · 400 · 500 cm“.
8. Beim Formwechsel bleiben die vorhandenen Maße erhalten, soweit sie passen. Für neue Felder gelten sinnvolle Startwerte: `topCm` = Hälfte der Breite, freie Seiten = Höhe.
9. Die Handyansicht bei 375 px muss ohne Querscrollen funktionieren.

## 7. PDF (`pdf.js`)

- Die Zeichnung je Position kommt aus derselben Polygon-Vorschau.
- Unter der Zeichnung steht eine kleine Tabelle „Zuschnitt“ mit allen Seiten: Seite, Länge in cm, Kante, Ösen. Beim freien Dreieck und beim Trapez kommen die Winkel dazu.
- Wenn ein Formzuschlag anfällt, erscheint er als eigene Zeile.

## 8. Export (`exportOrder`) und Import

- Erhöhe das Schema auf `net-configurator/order@2`.
- Neu je Position:

```json
"shape": "TRAPEZ_SYM",
"dimensions": { "widthCm": 400, "topCm": 200, "heightCm": 180,
                "areaM2": 5.4, "billedAreaM2": 6.21, "bboxWidthCm": 400, "bboxHeightCm": 180 },
"geometry": { "vertices": [[100,0],[300,0],[400,180],[0,180]],
              "sides": [{ "side": "top", "lengthCm": 200, "edge": "OESEN_50" }, ...] }
```

- `exportOrder` wird von `contact.js`/`kontakt.php` und später für Odoo genutzt. Beide müssen die neuen Felder mitnehmen (Mailtext: Form und Seitenlängen).
- Den gespeicherten Stand in localStorage (`netcfg.v1`) beim Laden genauso behandeln: Positionen ohne `shape` gelten als `RECT`.

## 9. Tests (`tests/geometry.test.js`, neu; `tests/pricing.test.js` ergänzen)

Mindestens diese Fälle:

| Fall | Erwartung |
|---|---|
| RECT 341 × 176 | Fläche 6,0016 m². Alle bestehenden Preis-Tests unverändert grün. |
| TRAPEZ_SYM 400 / 200 / 180 | Fläche 5,4 m². Schräge Seiten je 205,9 cm. |
| TRAPEZ_RECHT 400 / 200 / 180, slant right | Fläche 5,4 m². Links 180 cm, rechts 269,1 cm. |
| DREIECK_RECHT 300 × 200 | Fläche 3,0 m². Schräge Seite 360,6 cm. Ein Winkel 90°. |
| DREIECK_FREI 300 / 400 / 500 (a / b / c) | Fläche 6,0 m². Ein Winkel 90°. |
| DREIECK_FREI 100 / 100 / 300 | Fehler „kein Dreieck“, keine Exception. |
| DREIECK_FREI 400 / 202 / 202 | Fehler Winkel < 15°. |
| Ösen alle 50 cm, DREIECK_RECHT 300 × 200 | Unten 6 Segmente, senkrecht 4, schräg ceil(360,6/50) = 8 Segmente. Ösen = 3 Ecken + 5 + 3 + 7 = 18. |
| Preisregel `area_surcharge` 15 % bei Trapez | `billedAreaM2` = 5,4 × 1,15 = 6,21. Beim Rechteck kein Zuschlag. |
| Export `@2` | Enthält `shape`, `geometry.vertices` und alle Seiten. Alte Positionen aus localStorage ohne `shape` werden als RECT gelesen. |

## 10. Fertig, wenn

- `node --test tests/*.test.js` grün ist.
- Alle 5 Formen in der Vorschau korrekt aussehen und die Kanten anklickbar sind. Desktop und 375 px prüfen.
- Ein PDF mit einer Position je Form erzeugt werden kann. Lokal testen, ohne dass `angebot.php` dabei eine Mail versendet.
- Die Preisregel „Form“ im Bereich Preisregeln umschaltbar ist und der Preis sich sichtbar ändert.

## Offen, für Agroflor zu klären

- Abrechnung: echte Fläche, echte Fläche mit Zuschlag oder umschließendes Rechteck? Und wie hoch ist der Zuschlag?
- Mindestwinkel und Mindestseitenlänge aus Sicht der Fertigung.
- Weitere Formen später: freies Viereck (4 Seiten und 1 Diagonale), Rundbogen, Ausschnitte. Bis dahin laufen diese über „Sonderanfertigung auf Anfrage“.
