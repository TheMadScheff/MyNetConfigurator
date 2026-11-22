# Analyse: Gaze-/Netz-Konfiguratoren allbuyone vs. easy2cover

Stand: 22.11.2026. Beide Shops wurden live im Browser durchgespielt. Preise sind Endkundenpreise inkl. MwSt.; Preislogik wurde durch gezielte Testkonfigurationen nachgerechnet (nichts bestellt, nichts in den Warenkorb gelegt).

| | allbuyone (Kunde) | easy2cover (Konkurrenz) |
|---|---|---|
| Betreiber | allbuyone, Eventbedarf (DE) | Plaspack Netze GmbH (AT) |
| Analysierter Konfigurator | [Gaze-Konfigurator](https://www.allbuyone.com/de/sichtschutz-gaze/gaze-konfigurator/) | Konfigurator „Sichtschutz“ (`sicht_e2c`), erreichbar über [Home & Garden](https://easy2cover.com/e2ckonfiguratoren-home-garden) bzw. Menü „Konfigurator“ |
| Zielgruppe | Event, Bühne, Bauzaun (B1 schwer entflammbar) | Garten, Privat, Agrar |

---

## 1. allbuyone – Gaze-Konfigurator

### 1.1 Ablauf (UX)
1. Übersichtsseite mit 6 Gaze-Typen (Karten mit Gewicht, Winddurchlässigkeit, m²-Preis) und Vergleichstabelle unten.
2. Klick auf ein Produkt → Produktseite (Farbe wählen = eigene Variante/Artikelnummer).
3. „Jetzt konfigurieren“ öffnet ein Vollbild-Overlay:
   - Name der Position (optional)
   - Farbe
   - Breite und Höhe in cm, Stückzahl
   - je ein Dropdown für OBEN / UNTEN / LINKS / RECHTS
   - Vorschau: Produktfoto mit überlagerten PNG-Kantenbildern (z. B. Ösen oben), **nicht maßstäblich**
4. „Position hinzufügen“ → erst **jetzt** erscheint der Preis. Positionen lassen sich ändern, duplizieren, entfernen; mehrere Positionen (verschiedene Größen) gehen zusammen in den Warenkorb.
5. Gesamtpreis, MwSt., Gewicht für Versand, möglicher Liefertermin.

### 1.2 Materialien
| Typ | Artikel (schwarz) | Gewicht | Winddurchl. | Farben | Qualität | Preis/m² | ab 20 m² | ab 100 m² |
|---|---|---|---|---|---|---|---|---|
| Gaze 201 B1 | 2513059 | 125 g/m² | 50 % | schwarz, weiß | B1, 1–2 J. UV | 14,18 € | 11,73 € | 10,20 € |
| Gaze 202 B1 | 2513061 | 140 g/m² | 37 % | schwarz, weiß | B1, 1–2 J. UV | 14,48 € | 11,22 € | 10,15 € |
| Gaze 203 B1 | 2513012 | 160 g/m² | 27 % | schwarz, weiß | B1, 1–2 J. UV | 15,71 € | 12,24 € | 10,71 € |
| Gaze 100 B1 | 2513057 | 250 g/m² | 16 % | schwarz, weiß | B1, 1–2 J. UV | 16,83 € | 13,26 € | 11,22 € |

| Typ | Artikel (schwarz) | Gewicht | Winddurchl. | Farben | Qualität | Preis/m² | ab 15 m² | ab 150 m² | ab 300 m² |
|---|---|---|---|---|---|---|---|---|---|
| Gaze 800 B1 | 2513064 | 200 g/m² | 20 % | 9 Farben (schwarz, weiß, rot, grün, blau, orange, gelb, grau, hellblau) | B1, 1–2 J. UV | 19,28 € | 10,91 € | 10,09 € | 9,29 € |
| Gaze 800 UV | 2513073 | 200 g/m² | 20 % | schwarz, grau, weiß | UV 5–7 J. (kein B1) | 15,91 € | 11,62 € | 10,71 € | 9,89 € |

Material jeweils HDPE. Hinweis im Shop: Maßtoleranz ±5 %.

### 1.3 Kantenoptionen (pro Seite wählbar)
- gesäumt mit Ösen (ca. alle 50 cm) – Standard
- gesäumt, nur in den Ecken geöst
- gesäumt
- geschnitten (gerade Schnittkante)
- Hohlsaum 4 cm flach (für Ø bis 2 cm)
- Hohlsaum 8 cm flach (für Ø bis 4 cm)
- Hohlsaum 10 cm flach (für Ø bis 5 cm)

### 1.4 Maße
- Minimum **100 × 80 cm**, Maximum **4000 × 1800 cm** (B × H). Fehlermeldung erscheint erst beim Hinzufügen.
- Eingabe in ganzen cm.

### 1.5 Preislogik (nachgerechnet)
```
Positionspreis = Breite[m] × Höhe[m] × Staffelpreis(Fläche EINES Stücks) × Stückzahl
```
- Kantenart hat **keinen** Einfluss auf den Preis (Ösen rundum = Schnittkante = Hohlsaum; geprüft 3 × 2 m: jeweils 94,25 €). Die Konfektion ist im m²-Preis eingepreist.
- Staffel greift nach Fläche **pro Stück**, nicht nach Gesamtmenge: 25 Stück à 1 m² kosten 25 × 15,71 €, ein Stück 5 × 5 m dagegen 25 × 12,24 €.
- Kein Mindestpreis: 100 × 80 cm = 0,8 m² × 15,71 = 12,57 €.
- Testwerte Gaze 203 B1: 1×1 m 15,71 € · 3×2 m 94,25 € · 4×2,5 m 157,08 € · 2×10 m 244,81 € (12,24/m²) · 10×3 m 367,21 € · 10×10 m 1.070,88 € (10,71/m²) · 30×5 m 1.606,32 €.

### 1.6 Stärken
- Sehr einfach, wenige Schritte, schnell verständlich.
- Mehrere Positionen in einem Durchgang (Name, Duplizieren, Ändern) – ideal für Eventkunden mit vielen Bauzaunfeldern.
- Staffelpreise, Lieferdatum, Gewicht sichtbar.
- Klare B1-Positionierung, Vergleichstabelle der Gaze-Typen.

### 1.7 Schwächen
- **Kein Live-Preis**: Preis erst nach „Position hinzufügen“.
- Vorschau nicht maßstäblich, keine Maßlinien, keine Ösenanzahl.
- Validierung (Min/Max) erst nach dem Klick.
- Farbe ist eine eigene Produktvariante; Materialwechsel im Konfigurator nicht möglich (zurück zur Übersicht).
- Kantenart preisneutral → Schnittkante ist relativ zu teuer, Hohlsaum/Ösen relativ zu billig; keine Marge auf Mehraufwand.
- Staffel pro Stück statt pro Auftrag: viele kleine Felder bekommen nie einen Rabatt.
- Kein Ösenabstand/Ösentyp wählbar, kein Zubehör (Kabelbinder, Expander, Seil), keine Formen außer Rechteck.
- Kein Speichern/Teilen, kein Angebot als PDF.

---

## 2. easy2cover – Konfigurator „Sichtschutz“

### 2.1 Ablauf (UX)
1. Einstieg über Menü „Konfigurator“ oder Landingpage → Vollbild-Overlay. Direktlink `/konfigurator?cat=sicht_e2c` zeigt eine leere Seite (Einstieg nur per JS-Menü).
2. **Form wählen**: Dreieck, Rechteck, Trapez, Viereck.
3. **Maßstäbliche SVG-Zeichnung** mit Eckpunkten A–D, Maßfeldern direkt an den Kanten, „+“-Buttons an jeder Kante und in der Fläche.
4. Klick in die Fläche → Modal: Form, Material, Farbe (Kacheln mit Bild und Info-Tooltip).
5. Klick auf eine Kante → Modal pro Kante: Konfektion, Ösenart, Ösenabstand, „deckungsgleich spiegeln“ (AB↔CD), Befestigungszubehör mit Stückpreis, Button „Daten auf andere Seiten kopieren“.
6. Seitenleiste: Längenangaben + „Maße übernehmen“, Live-Preis, Warenkorb, **Konfiguration speichern (Save + Share, Code)**, **Angebot als PDF**, Zusammenfassung, Konfiguration laden.
7. Geführte Tipps (Tooltip-Tour), Hotline-Hinweis, Hinweis „±3 % Maßabweichung“.

### 2.2 Materialien
| Material | Farben | Preis/m² (abgeleitet) |
|---|---|---|
| Austronet 203 | 9 (dunkelgrün, hellgrün, blau, blau metallic, weiß, rot, orange, schwarz, saphirblau) | 4,42 € |
| Austronet 204 | 13 (u. a. jute, grau, violett) | ≈ 7,57 € |
| Austronet 940 | 17 (sunshine, mocca, anthrazit, terracotta …) | ≈ 12,86 € |

Kein B1-Material im Sichtschutz-Konfigurator; Fokus Garten.

### 2.3 Kantenoptionen (pro Kante) und Aufpreise
Gemessen an Kante AB = 5 m, Austronet 203; Aufpreis gegenüber „nur geschnitten“:

| Konfektion | Aufpreis 5 m | ≈ pro lfm |
|---|---|---|
| nur geschnitten | 0,00 € | 0,00 € |
| mit Endelnaht | 1,05 € | 0,21 € |
| schmal gesäumt | 1,52 € | 0,30 € |
| Randverstärkung | 5,66 € | 1,13 € |
| Hohlsaum | 5,66 € | 1,13 € |
| Randverstärkung und Ösen (Standard) | 9,91 € | 1,98 € |
| Klett 4 cm / Flausch 4 cm | 10,08 € | 2,02 € |
| Keder | 14,01 € | 2,80 € |
| Profirandverstärkung | 19,46 € | 3,89 € |
| Profirandverstärkung und Ösen | 23,71 € | 4,74 € |

Ösen: „Öse verzinkt 16 mm“; Abstand „auf Wunsch“, „gleichmäßig aufgeteilt (bis 50 cm)“, „alle 50 cm“, „nur Ecken“.
Zubehör je Stück: Kabelbinder 3,08 €, Gummiseil 1,55 €, Simplexhaken 0,37 €, Spannflex 1,52 €, Spannquick 1,08 €, Edelstahl-Drahtseil 3 mm 2,46 €, außerdem Karabiner, Seil.

### 2.4 Maße
- Kein hartes Maximum: ab **250 m²** nur eine Warnung („kein optimales Produkt garantiert“), Bestellung bleibt möglich.
- Mindestabrechnung **1 m²** (50 × 50 cm kostet wie 1 m²).

### 2.5 Preislogik (nachgerechnet)
```
Preis = max(Fläche, 1 m²) × m²-Preis(Material)
      + Σ Kantenlänge[m] × lfm-Preis(Konfektion der Kante)
      + Zubehör (Stück × Preis)
```
- Linear, **keine Staffel** (1 m², 15 m², 100 m², 600 m² jeweils 4,42 €/m²).
- Beispiel 5 × 3 m, Austronet 203: nur geschnitten 66,30 € · Randverstärkung + Ösen rundum 98,31 €.

### 2.6 Stärken
- Maßstäbliche Live-Zeichnung, Bearbeitung direkt an der Kante – sehr anschaulich.
- Freie Formen (Dreieck, Trapez, Viereck).
- Fein granulare, verursachergerechte Preise je Kante; Zubehör im selben Fluss (Cross-Selling).
- Speichern/Teilen per Code, PDF-Angebot, Zusammenfassung – stark für B2B und Beratung.
- Geführte Hilfe, Kopieren/Spiegeln von Kanteneinstellungen.

### 2.7 Schwächen
- Hohe Komplexität, viele Modals übereinander, wirkt technisch und veraltet; auf kleinen Bildschirmen eng.
- Maße müssen per „Maße übernehmen“ bestätigt werden (kein echtes Live-Update beim Tippen).
- Kein Deep-Link, Konfigurator lädt nur per JS-Klick.
- Preisformat „€ 98.31“ (englischer Dezimalpunkt) auf deutschsprachiger Seite.
- Keine Mengenstaffel, keine Mehrfach-Positionen (immer nur ein Stück je Konfiguration).
- Materialdaten (Gewicht, Durchlässigkeit) nur in Tooltips, kein direkter Vergleich.

---

## 3. Gegenüberstellung

| Kriterium | allbuyone | easy2cover | Ziel für unseren Konfigurator |
|---|---|---|---|
| Live-Preis | nein | ja (nach Bestätigen) | ja, bei jeder Eingabe |
| Vorschau | Foto + Kanten-Icons | maßstäbliche SVG | maßstäbliche SVG mit Ösen, Maßlinien, Farbe/Struktur |
| Formen | Rechteck | 4 Formen | Rechteck (Phase 1), Formen später |
| Kanten | 7 Optionen, preisneutral | 11 Optionen mit lfm-Preis | gleiche 7 Optionen wie heute, optional lfm-Aufpreis konfigurierbar |
| Ösen | fix 50 cm / Ecken | Typ + Abstand wählbar | Abstand wählbar, Ösenanzahl wird angezeigt |
| Staffel | pro Stück | keine | pro Auftrag (Summe aller Positionen) als Option |
| Mehrere Positionen | ja | nein | ja (übernehmen) |
| Zubehör | nein | ja | ja, passend zur Kante (Kabelbinder bei Ösen …) |
| Speichern/Teilen/PDF | nein | ja | Link mit Konfiguration + JSON-Export, PDF/Angebot |
| Validierung | nach Klick | Warnung | sofort, inline |
| Materialvergleich | Tabelle auf Übersichtsseite | Tooltips | Material-Kacheln mit Wind-/Sichtschutzwert im Konfigurator |

## 4. Empfehlungen für den Prototyp
1. **Einseitiger Ablauf** wie allbuyone (Material → Farbe → Maße → Kanten → Menge), aber mit **Live-Preis** und **maßstäblicher Vorschau** wie easy2cover.
2. **Kanten klickbar** in der Vorschau, plus „auf alle Seiten anwenden“.
3. **Preis-Aufschlüsselung** sichtbar: Fläche × m²-Preis, Staffelstufe, Kantenaufpreise, Zubehör, MwSt.
4. **Hinweis zur nächsten Staffel** („noch 4,2 m² bis 12,24 €/m²“) als Verkaufsargument.
5. **Mehrere Positionen** mit Name; Staffel wahlweise pro Stück (heute) oder pro Auftrag.
6. **Ösenanzahl berechnen** und anzeigen; Zubehörvorschlag (Kabelbinder je Öse).
7. **Ergebnis als JSON** (eindeutige Codes statt Texte) und teilbarer Link → Grundlage für Odoo in Phase 2.
8. Sofortige Validierung von Min/Max je Material.

## 5. Datenmodell (Vorschlag, Odoo-tauglich)

```text
Material          code, name, gewicht_g_m2, winddurchlaessigkeit_pct, b1, uv_jahre,
                  farben[], min_breite_cm, min_hoehe_cm, max_breite_cm, max_hoehe_cm,
                  staffel[{ab_m2, preis_m2}]
Farbe             code, name, hex, artikelnummer (je Material)
Kantenart         code, label, aufpreis_lfm, hat_oesen, oesen_abstand_cm, hohlsaum_cm
Zubehoer          code, name, preis_stk, passend_zu[kantenart]
Position          material, farbe, breite_cm, hoehe_cm, stueck, kanten{oben,unten,links,rechts}, name
Konfiguration     positionen[], staffelmodus (stueck|auftrag), summen{netto, mwst, brutto, gewicht}
```

Preisformel:
```
flaeche     = breite × hoehe / 10.000
basis_m2    = Staffelpreis(material, flaeche  bzw. Summe Auftrag)
kanten      = Σ kantenlaenge_m × aufpreis_lfm(kantenart)
position    = (flaeche × basis_m2 + kanten) × stueck
```
Mit `aufpreis_lfm = 0` für alle Kanten bildet das Modell die heutige allbuyone-Logik exakt ab.

### Ausblick Odoo (Phase 2, nur Skizze)
- Material und Farbe → `product.template` „Gaze nach Maß“ mit Attributen *Material* und *Farbe* (Varianten, Artikelnummern bleiben erhalten).
- Kanten, Ösenabstand → Attribute ohne Variantenbildung (`no_variant`); Breite/Höhe → benutzerdefinierte Werte. Da der Preis von der Fläche abhängt, reicht `price_extra` nicht: Preisberechnung entweder im Konfigurator und Übergabe des Positionspreises an die Auftragszeile, oder ein kleines Odoo-Modul, das dieselbe Formel serverseitig rechnet.
- Konfigurations-JSON am Auftrag/der Auftragszeile speichern (z. B. Feld `x_konfiguration_json`), damit Produktion und Nachbestellung exakt dieselben Daten haben.
