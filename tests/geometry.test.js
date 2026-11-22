// Prüft die Formen Rechteck, Trapez und Dreieck. Ausführen: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../app/geometry.js');
const cat = require('../app/catalog.js');
const P = require('../app/pricing.js');

const near = (a, b, eps = 0.05) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);
const E = (v) => ({ top: v, right: v, bottom: v, left: v });
const pos = (shape, dims, extra = {}) => Object.assign({
  shape, material: 'GAZE_203_B1', color: 'SCHWARZ', quantity: 1, edges: E('OESEN_50'),
}, dims, extra);
const side = (g, code) => g.sides.find((s) => s.code === code);

test('RECT 341 × 176: Fläche 6,0016 m²', () => {
  const g = G.shapeGeometry(pos('RECT', { widthCm: 341, heightCm: 176 }));
  near(g.areaM2, 6.0016, 1e-9);
  assert.equal(g.sides.length, 4);
  assert.ok(g.sides.every((s) => !s.slanted));
});

test('Position ohne shape gilt als Rechteck', () => {
  const g = G.shapeGeometry({ widthCm: 300, heightCm: 200 });
  assert.equal(g.shape, 'RECT');
  near(g.areaM2, 6, 1e-9);
});

test('TRAPEZ_SYM 400 / 200 / 180: Fläche 5,4 m², schräge Seiten je 205,9 cm', () => {
  const g = G.shapeGeometry(pos('TRAPEZ_SYM', { widthCm: 400, topCm: 200, heightCm: 180 }));
  near(g.areaM2, 5.4, 1e-9);
  assert.equal(side(g, 'left').lengthCm, 205.9);
  assert.equal(side(g, 'right').lengthCm, 205.9);
  assert.ok(side(g, 'left').slanted && side(g, 'right').slanted);
  assert.equal(side(g, 'top').lengthCm, 200);
  assert.equal(side(g, 'bottom').lengthCm, 400);
});

test('TRAPEZ_RECHT 400 / 200 / 180, schräg rechts: links 180 cm, rechts 269,1 cm', () => {
  const g = G.shapeGeometry(pos('TRAPEZ_RECHT', { widthCm: 400, topCm: 200, heightCm: 180, slant: 'right' }));
  near(g.areaM2, 5.4, 1e-9);
  assert.equal(side(g, 'left').lengthCm, 180);
  assert.equal(side(g, 'right').lengthCm, 269.1);
  assert.ok(!side(g, 'left').slanted && side(g, 'right').slanted);
  const l = G.shapeGeometry(pos('TRAPEZ_RECHT', { widthCm: 400, topCm: 200, heightCm: 180, slant: 'left' }));
  assert.equal(side(l, 'right').lengthCm, 180);
  assert.equal(side(l, 'left').lengthCm, 269.1);
});

test('Trapez mit längerer Oberkante: Punkte werden so verschoben, dass x ≥ 0', () => {
  const g = G.shapeGeometry(pos('TRAPEZ_SYM', { widthCm: 200, topCm: 400, heightCm: 180 }));
  assert.equal(Math.min(...g.vertices.map((v) => v.x)), 0);
  near(g.bboxWidthCm, 400, 1e-9);
  near(g.areaM2, 5.4, 1e-9);
});

test('DREIECK_RECHT 300 × 200: Fläche 3,0 m², schräge Seite 360,6 cm, ein Winkel 90°', () => {
  for (const rightAngle of ['left', 'right']) {
    const g = G.shapeGeometry(pos('DREIECK_RECHT', { widthCm: 300, heightCm: 200, rightAngle }));
    near(g.areaM2, 3, 1e-9);
    assert.equal(g.sides.length, 3);
    assert.equal(g.sides.filter((s) => s.slanted).length, 1);
    assert.equal(g.sides.find((s) => s.slanted).lengthCm, 360.6);
    assert.equal(g.anglesDeg.filter((a) => a === 90).length, 1);
    assert.equal(g.sides.some((s) => s.code === 'top'), false);
  }
});

test('DREIECK_FREI 300 / 400 / 500: Fläche 6,0 m², ein Winkel 90°', () => {
  const g = G.shapeGeometry(pos('DREIECK_FREI', { widthCm: 300, sideRightCm: 400, sideLeftCm: 500 }));
  near(g.areaM2, 6, 1e-9);
  assert.equal(g.anglesDeg.filter((a) => a === 90).length, 1);
  assert.equal(side(g, 'right').lengthCm, 400);
  assert.equal(side(g, 'left').lengthCm, 500);
});

test('DREIECK_FREI 100 / 100 / 300: Fehler „kein Dreieck“ ohne Exception', () => {
  const p = pos('DREIECK_FREI', { widthCm: 100, sideRightCm: 100, sideLeftCm: 300 });
  assert.deepEqual(G.shapeGeometry(p), { error: 'triangle' });
  const errs = P.validate(cat, p);
  assert.ok(errs.some((e) => e.field === 'shape' && /kein Dreieck/.test(e.message)));
});

test('DREIECK_FREI 400 / 202 / 202: Fehler Winkel unter 15°', () => {
  const p = pos('DREIECK_FREI', { widthCm: 400, sideRightCm: 202, sideLeftCm: 202 });
  assert.ok(P.validate(cat, p).some((e) => e.field === 'shape' && /unter 15°/.test(e.message)));
});

test('Validierung: Eingaben, umschließendes Rechteck, Oberkante, Kanten nur der Form', () => {
  const ok = pos('TRAPEZ_SYM', { widthCm: 400, topCm: 200, heightCm: 180 });
  assert.equal(P.validate(cat, ok).length, 0);
  assert.ok(P.validate(cat, Object.assign({}, ok, { topCm: 20 })).some((e) => e.field === 'topCm'));
  assert.ok(P.validate(cat, Object.assign({}, ok, { widthCm: 5000 })).some((e) => e.field === 'widthCm'));
  assert.ok(P.validate(cat, Object.assign({}, ok, { topCm: 5000 })).some((e) => e.field === 'topCm'));
  assert.ok(P.validate(cat, Object.assign({}, ok, { heightCm: 20 })).some((e) => e.field === 'heightCm'));
  assert.ok(P.validate(cat, Object.assign({}, ok, { heightCm: 180.5 })).some((e) => e.field === 'heightCm'));
  const tri = pos('DREIECK_RECHT', { widthCm: 300, heightCm: 200, rightAngle: 'left' }, { edges: { right: 'SAUM', bottom: 'SAUM', left: 'SAUM' } });
  assert.equal(P.validate(cat, tri).length, 0, 'beim Dreieck braucht es keine Kante „oben“');
});

test('Ösen alle 50 cm, DREIECK_RECHT 300 × 200: 3 Ecken + 5 + 3 + 7 = 18', () => {
  const e = P.eyelets(cat, pos('DREIECK_RECHT', { widthCm: 300, heightCm: 200, rightAngle: 'left' }));
  assert.equal(e.count, 18);
  assert.equal(e.points.filter((p) => p.corner).length, 3);
  assert.equal(e.interiorBySide.bottom, 5);
  assert.equal(e.interiorBySide.left, 3);
  assert.equal(e.interiorBySide.right, 7);
});

test('Rechteck: Ösen wie bisher (300 × 200 rundum = 20)', () => {
  assert.equal(P.eyelets(cat, pos('RECT', { widthCm: 300, heightCm: 200 })).count, 20);
  assert.equal(P.eyelets(cat, { widthCm: 300, heightCm: 200, edges: E('OESEN_50') }).count, 20);
});

test('Preisregel area_surcharge: Trapez 5,4 m² → berechnet 6,21 m², Rechteck ohne Zuschlag', () => {
  const t = pos('TRAPEZ_SYM', { widthCm: 400, topCm: 200, heightCm: 180 });
  const r = P.pricePosition(cat, t, { shapePricing: 'area_surcharge' });
  near(r.shapeAreaM2, 5.4, 1e-9);
  near(r.billedAreaM2, 6.21, 1e-9);
  assert.ok(r.shapeSurchargeNet > 0);
  near(r.materialNet, 6.21 * r.netPerM2, 1e-9);
  const plain = P.pricePosition(cat, t, { shapePricing: 'area' });
  near(plain.billedAreaM2, 5.4, 1e-9);
  assert.equal(plain.shapeSurchargeNet, 0);
  const box = P.pricePosition(cat, t, { shapePricing: 'bbox' });
  near(box.billedAreaM2, 7.2, 1e-9);
  assert.ok(plain.unitGross < r.unitGross && r.unitGross < box.unitGross);
  const rect = P.pricePosition(cat, pos('RECT', { widthCm: 300, heightCm: 200 }), { shapePricing: 'area_surcharge' });
  assert.equal(rect.billedAreaM2, rect.shapeAreaM2);
  assert.equal(rect.shapeSurchargeNet, 0);
});

test('Staffel richtet sich nach der berechneten Fläche, Gewicht nach der echten', () => {
  const t = pos('TRAPEZ_SYM', { widthCm: 400, topCm: 200, heightCm: 180 });
  const r = P.pricePosition(cat, t, { shapePricing: 'bbox' });
  assert.equal(r.tierAreaM2, r.billedAreaM2);
  near(r.weightKg, (5.4 * cat.materials.find((m) => m.code === 'GAZE_203_B1').weightGm2) / 1000, 1e-9);
});

test('Export @2: Form, Eckpunkte, Seiten; alte Positionen werden als RECT gelesen', () => {
  const ex = P.exportOrder(cat, [
    pos('TRAPEZ_SYM', { widthCm: 400, topCm: 200, heightCm: 180 }),
    { material: 'GAZE_203_B1', color: 'SCHWARZ', widthCm: 300, heightCm: 200, quantity: 1, edges: E('SAUM') },
  ]);
  assert.equal(ex.schema, 'net-configurator/order@2');
  const [t, r] = ex.positions;
  assert.equal(t.shape, 'TRAPEZ_SYM');
  assert.deepEqual(t.geometry.vertices, [[100, 0], [300, 0], [400, 180], [0, 180]]);
  assert.equal(t.geometry.sides.length, 4);
  assert.deepEqual(t.geometry.sides[0], { side: 'top', lengthCm: 200, edge: 'OESEN_50' });
  assert.equal(t.dimensions.topCm, 200);
  assert.equal(t.dimensions.areaM2, 5.4);
  assert.equal(t.dimensions.billedAreaM2, 6.21);
  assert.equal(t.dimensions.bboxWidthCm, 400);
  assert.equal(r.shape, 'RECT');
  assert.equal(r.dimensions.widthCm, 300);
  assert.equal(r.geometry.sides.length, 4);
});
