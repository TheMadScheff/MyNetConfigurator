# Stilrichtlinien agro-flor.com (ausgelesen)

Stand 22.11.2026, ausgelesen aus den berechneten Styles der Startseite https://agro-flor.com/ (TYPO3). Es gibt dort keine CSS-Variablen; die Werte stammen aus Buttons, Überschriften, Kopfleiste, Links und Footer.

## Farben

| Rolle | Wert | Verwendung auf agro-flor.com | Token im Prototyp |
|---|---|---|---|
| Primärgrün | `#497D32` | Hauptbutton „Kontaktieren Sie uns“ | `--accent` |
| Dunkelgrün | `#265A0F` | obere Leiste, Cookie-Button „Akzeptieren“ | `--accent-strong`, `--topbar` |
| Oliv | `#A6A861` | Links („» Lesen Sie mehr“), Zweitbutton | `--olive` (Text: `--olive-ink` `#6F7135`) |
| Überschrift | `#242424` | H2 dunkel | `--ink` |
| Text dunkel | `#373737` | Navigation, Texte | `--text` |
| Text grau | `#777777` | Fließtext, Kartentexte | `--muted` (`#6E6E6E`, etwas dunkler für Kontrast) |
| Flächen | `#FFFFFF` | Karten, Hintergrund | `--surface` |
| Footer | `#191919` | Footer | (nicht genutzt) |

Ergänzt für den Konfigurator: `--eyelet` `#A88A43` (Messing für Ösen in der Vorschau), Fehler `#B3261E`.

Die Seite ist immer hell mit weißem Hintergrund, wie agro-flor.com, auch wenn das Gerät auf dunkel steht (Wunsch Markus, 22.11.2026). Es gibt kein dunkles Farbschema.

## Schriften

| Rolle | Schrift | Werte auf agro-flor.com |
|---|---|---|
| Überschriften | Poppins | H2 52 px / 700 (Hero), 22 px / 500, Kartentitel 20 px / 600, keine Großbuchstaben |
| Fließtext | Lato | 15 px, Zeilenhöhe 27 px |
| Buttons | Lato 600 | Pillenform, Radius 50 px, Innenabstand 11 × 43 px |

## Formen

- Buttons: Pillenform (`border-radius: 50px`), Primär grün, Sekundär oliv.
- Karten: weiß, eckig mit weichem Schatten, Bilder ohne Rundung.
- Viel Weißraum, keine Versalien in Überschriften.

## Bewusst nicht übernommen

Logo und Firmenname stehen nicht in der Online-Vorschau, damit die private Vorschau nicht wie eine offizielle Agroflor-Seite wirkt. Das Logo lässt sich für eine Präsentation in `app/index.html` im Kopf einsetzen.
