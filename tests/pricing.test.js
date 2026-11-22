// Prüft die Preislogik gegen Werte, die am 22.11.2026 im allbuyone-Konfigurator gemessen wurden.
// Ausführen: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const cat = require('../app/catalog.js');
const P = require('../app/pricing.js');

const pos = (widthCm, heightCm, extra = {}) => Object.assign({
  material: 'GAZE_203_B1', color: 'SCHWARZ', widthCm, heightCm, quantity: 1,
  edges: { top: 'OESEN_50', right: 'OESEN_50', bottom: 'OESEN_50', left: 'OESEN_50' },
}, extra);

test('Gaze 203 B1: Stückpreise wie im Shop', () => {
  const cases = [
    [100, 100, 15.71], [300, 200, 94.25], [400, 250, 157.08], [100, 80, 12.57],
    [200, 1000, 244.81], [1000, 300, 367.21], [1000, 1000, 1070.88], [3000, 500, 1606.32],
  ];
  for (const [w, h, expected] of cases) {
    assert.equal(P.pricePosition(cat, pos(w, h)).unitGross, expected, `${w} x ${h} cm`);
  }
});

test('Kantenart ist heute preisneutral', () => {
  const a = P.pricePosition(cat, pos(300, 200)).unitGross;
  const b = P.pricePosition(cat, pos(300, 200, { edges: { top: 'SCHNITT', right: 'SCHNITT', bottom: 'SCHNITT', left: 'SCHNITT' } })).unitGross;
  const c = P.pricePosition(cat, pos(300, 200, { edges: { top: 'HOHLSAUM_10', right: 'HOHLSAUM_10', bottom: 'HOHLSAUM_10', left: 'HOHLSAUM_10' } })).unitGross;
  assert.equal(a, 94.25); assert.equal(b, 94.25); assert.equal(c, 94.25);
});

test('Staffel je Stück: 25 × 1 m² bleibt beim Grundpreis', () => {
  const r = P.priceOrder(cat, [pos(100, 100, { quantity: 25 })]);
  assert.equal(r.lines[0].price.unitGross, 15.71);
  assert.equal(r.totalGross, 392.75);
});

test('Staffel je Auftrag (Option): 25 × 1 m² erreicht Stufe ab 20 m²', () => {
  const r = P.priceOrder(cat, [pos(100, 100, { quantity: 25 })], { tierBasis: 'order' });
  assert.equal(r.lines[0].price.tier.fromM2, 20);
  assert.equal(r.lines[0].price.unitGross, 12.24);
});

test('Validierung: Mindest- und Höchstmaße', () => {
  assert.equal(P.validate(cat, pos(100, 80)).length, 0);
  assert.ok(P.validate(cat, pos(80, 100)).some((e) => e.field === 'widthCm'));
  assert.ok(P.validate(cat, pos(5000, 300)).some((e) => e.field === 'widthCm'));
  assert.ok(P.validate(cat, pos(300, 1900)).some((e) => e.field === 'heightCm'));
  assert.ok(P.validate(cat, pos(300, 200, { color: 'ROT' })).some((e) => e.field === 'color'));
});

test('Ösen: 300 × 200 cm rundum alle 50 cm = 20 Ösen', () => {
  assert.equal(P.eyelets(cat, pos(300, 200)).count, 20);
  const corners = pos(300, 200, { edges: { top: 'OESEN_ECKEN', right: 'SAUM', bottom: 'OESEN_ECKEN', left: 'SAUM' } });
  assert.equal(P.eyelets(cat, corners).count, 4);
  const none = pos(300, 200, { edges: { top: 'HOHLSAUM_4', right: 'SAUM', bottom: 'SCHNITT', left: 'SAUM' } });
  assert.equal(P.eyelets(cat, none).count, 0);
});

test('Export enthält Codes, SKU und Summen', () => {
  const ex = P.exportOrder(cat, [pos(300, 200, { name: 'Bauzaun Feld 1', quantity: 2 })]);
  assert.equal(ex.positions[0].product.sku, '2513012');
  assert.equal(ex.positions[0].price.lineGross, 188.5);
  assert.equal(ex.totals.gross, 188.5);
});
