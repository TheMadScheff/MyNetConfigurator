/*
 * Produktkatalog Gaze nach Maß.
 * Quelle: allbuyone.com Gaze-Konfigurator, Stand 22.11.2026 (siehe docs/analyse-konfiguratoren.md).
 *
 * Preise sind NETTO je m² (wie in Odoo üblich). Der Shop (Deutschland) zeigt brutto inkl. 19 % MwSt.,
 * der Prototyp rechnet mit dem österreichischen Satz von 20 % (vatRate unten).
 * Für Gaze 203 B1 sind die Nettopreise aus Testkonfigurationen exakt zurückgerechnet,
 * für die übrigen Typen aus den angezeigten Bruttopreisen (brutto / 1,19, Netto bleibt unverändert).
 *
 * Artikelnummern (sku) sind ausgedachte Demo-Nummern (DEMO-<Typ>-<Farbe>), keine echten Nummern.
 *
 * Alle Codes sind stabile Schlüssel und werden 1:1 in den Export (JSON) und später nach Odoo übernommen.
 */
(function (root) {
  const catalog = {
    currency: 'EUR',
    vatRate: 0.20,

    materials: [
      {
        code: 'GAZE_201_B1', name: 'Gaze 201 B1', structure: 'sehr grobmaschig',
        weightGm2: 125, windPermeabilityPct: 50, fireClass: 'B1', uvYears: '1–2', material: 'HDPE',
        openness: 0.5,
        colors: [
          { code: 'SCHWARZ', sku: 'DEMO-201-SW' },
          { code: 'WEISS', sku: 'DEMO-201-WS' },
        ],
        tiers: [
          { fromM2: 0, netPerM2: 11.916 },
          { fromM2: 20, netPerM2: 9.8571 },
          { fromM2: 100, netPerM2: 8.5714 },
        ],
      },
      {
        code: 'GAZE_202_B1', name: 'Gaze 202 B1', structure: 'grobmaschig',
        weightGm2: 140, windPermeabilityPct: 37, fireClass: 'B1', uvYears: '1–2', material: 'HDPE',
        openness: 0.37,
        colors: [
          { code: 'SCHWARZ', sku: 'DEMO-202-SW' },
          { code: 'WEISS', sku: 'DEMO-202-WS' },
        ],
        tiers: [
          { fromM2: 0, netPerM2: 12.1681 },
          { fromM2: 20, netPerM2: 9.4286 },
          { fromM2: 100, netPerM2: 8.5294 },
        ],
      },
      {
        code: 'GAZE_203_B1', name: 'Gaze 203 B1', structure: 'feinmaschig',
        weightGm2: 160, windPermeabilityPct: 27, fireClass: 'B1', uvYears: '1–2', material: 'HDPE',
        openness: 0.27,
        colors: [
          { code: 'SCHWARZ', sku: 'DEMO-203-SW' },
          { code: 'WEISS', sku: 'DEMO-203-WS' },
        ],
        tiers: [
          { fromM2: 0, netPerM2: 13.2 },
          { fromM2: 20, netPerM2: 10.286 },
          { fromM2: 100, netPerM2: 8.999 },
        ],
      },
      {
        code: 'GAZE_800_B1', name: 'Gaze 800 B1', structure: 'feinmaschig',
        weightGm2: 200, windPermeabilityPct: 20, fireClass: 'B1', uvYears: '1–2', material: 'HDPE',
        openness: 0.2,
        colors: [
          { code: 'SCHWARZ', sku: 'DEMO-800-SW' },
          { code: 'WEISS', sku: 'DEMO-800-WS' },
          { code: 'GRAU', sku: 'DEMO-800-GR' },
          { code: 'ROT', sku: null },
          { code: 'GRUEN', sku: null },
          { code: 'BLAU', sku: null },
          { code: 'ORANGE', sku: null },
          { code: 'GELB', sku: null },
          { code: 'HELLBLAU', sku: null },
        ],
        tiers: [
          { fromM2: 0, netPerM2: 16.2017 },
          { fromM2: 15, netPerM2: 9.1681 },
          { fromM2: 150, netPerM2: 8.479 },
          { fromM2: 300, netPerM2: 7.8067 },
        ],
      },
      {
        code: 'GAZE_800_UV', name: 'Gaze 800 UV', structure: 'feinmaschig',
        weightGm2: 200, windPermeabilityPct: 20, fireClass: null, uvYears: '5–7', material: 'HDPE',
        openness: 0.2,
        colors: [
          { code: 'SCHWARZ', sku: 'DEMO-800UV-SW' },
          { code: 'WEISS', sku: 'DEMO-800UV-WS' },
          { code: 'GRAU', sku: 'DEMO-800UV-GR' },
        ],
        tiers: [
          { fromM2: 0, netPerM2: 13.3697 },
          { fromM2: 15, netPerM2: 9.7647 },
          { fromM2: 150, netPerM2: 9.0 },
          { fromM2: 300, netPerM2: 8.3109 },
        ],
      },
      {
        code: 'GAZE_100_B1', name: 'Gaze 100 B1', structure: 'sehr feinmaschig',
        weightGm2: 250, windPermeabilityPct: 16, fireClass: 'B1', uvYears: '1–2', material: 'HDPE',
        openness: 0.16,
        colors: [
          { code: 'SCHWARZ', sku: 'DEMO-100-SW' },
          { code: 'WEISS', sku: 'DEMO-100-WS' },
        ],
        tiers: [
          { fromM2: 0, netPerM2: 14.1429 },
          { fromM2: 20, netPerM2: 11.1429 },
          { fromM2: 100, netPerM2: 9.4286 },
        ],
      },
    ],

    colors: {
      SCHWARZ: { name: 'schwarz', hex: '#1d1f21' },
      WEISS: { name: 'weiß', hex: '#f3f3f0' },
      GRAU: { name: 'grau', hex: '#8a8d8f' },
      ROT: { name: 'rot', hex: '#c62f2f' },
      GRUEN: { name: 'grün', hex: '#2f7d3b' },
      BLAU: { name: 'blau', hex: '#1f4fa3' },
      ORANGE: { name: 'orange', hex: '#e2731c' },
      GELB: { name: 'gelb', hex: '#f0c419' },
      HELLBLAU: { name: 'hellblau', hex: '#5fa8dc' },
    },

    // Maßgrenzen des heutigen Shops (für alle Typen gleich).
    limits: { minWidthCm: 100, minHeightCm: 80, maxWidthCm: 4000, maxHeightCm: 1800 },

    /*
     * Regeln für Trapez und Dreieck (DEMO-WERTE, von Agroflor aus Sicht der Fertigung festzulegen).
     * Die Maßgrenzen oben gelten für das umschließende Rechteck der Form.
     */
    shapeRules: { minAngleDeg: 15, minSideCm: 30, minTopCm: 30, surchargePct: 15 },

    /*
     * Kantenarten wie im heutigen Shop.
     * surchargeNetPerM: Aufpreis je Laufmeter. Heute 0 (Konfektion im m²-Preis enthalten).
     * proposedNetPerM: Vorschlag für ein verursachergerechtes Modell (DEMO-WERTE, vom Kunden festzulegen).
     */
    edges: [
      { code: 'OESEN_50', label: 'gesäumt mit Ösen (ca. alle 50 cm)', short: 'Ösen ca. alle 50 cm', hem: true, eyelets: 'spaced', eyeletSpacingCm: 50, tunnelCm: 0, surchargeNetPerM: 0, proposedNetPerM: 1.6 },
      { code: 'OESEN_ECKEN', label: 'gesäumt, nur in den Ecken geöst', short: 'Ösen nur in den Ecken', hem: true, eyelets: 'corners', tunnelCm: 0, surchargeNetPerM: 0, proposedNetPerM: 0.9 },
      { code: 'SAUM', label: 'gesäumt', short: 'gesäumt', hem: true, eyelets: 'none', tunnelCm: 0, surchargeNetPerM: 0, proposedNetPerM: 0.7 },
      { code: 'SCHNITT', label: 'geschnitten (gerade Schnittkante)', short: 'Schnittkante', hem: false, eyelets: 'none', tunnelCm: 0, surchargeNetPerM: 0, proposedNetPerM: 0 },
      { code: 'HOHLSAUM_4', label: 'Hohlsaum 4 cm flach (für Ø bis 2 cm)', short: 'Hohlsaum 4 cm (Ø bis 2 cm)', hem: true, eyelets: 'none', tunnelCm: 4, maxPipeCm: 2, surchargeNetPerM: 0, proposedNetPerM: 1.1 },
      { code: 'HOHLSAUM_8', label: 'Hohlsaum 8 cm flach (für Ø bis 4 cm)', short: 'Hohlsaum 8 cm (Ø bis 4 cm)', hem: true, eyelets: 'none', tunnelCm: 8, maxPipeCm: 4, surchargeNetPerM: 0, proposedNetPerM: 1.3 },
      { code: 'HOHLSAUM_10', label: 'Hohlsaum 10 cm flach (für Ø bis 5 cm)', short: 'Hohlsaum 10 cm (Ø bis 5 cm)', hem: true, eyelets: 'none', tunnelCm: 10, maxPipeCm: 5, surchargeNetPerM: 0, proposedNetPerM: 1.5 },
    ],

    sides: [
      { code: 'top', label: 'Oben' },
      { code: 'right', label: 'Rechts' },
      { code: 'bottom', label: 'Unten' },
      { code: 'left', label: 'Links' },
    ],

    // Zubehör-Vorschlag (DEMO-PREIS, im heutigen Shop nicht im Konfigurator).
    accessories: [
      { code: 'KABELBINDER', name: 'Kabelbinder schwarz, UV-beständig', unit: 'Stk', netPrice: 0.08, perEyelet: 1 },
    ],

    // Standardwerte für eine neue Position.
    defaults: {
      shape: 'RECT', material: 'GAZE_203_B1', color: 'SCHWARZ', widthCm: 350, heightCm: 180, quantity: 1,
      edges: { top: 'OESEN_50', right: 'OESEN_50', bottom: 'OESEN_50', left: 'OESEN_50' },
    },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = catalog;
  else root.NetCatalog = catalog;
})(typeof window !== 'undefined' ? window : globalThis);
