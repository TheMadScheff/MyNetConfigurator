// Ösenoptionen, Befestigungszubehör und Speichern per Link. Ausführen: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const cat = require('../app/catalog.js');
const P = require('../app/pricing.js');
const S = require('../app/share.js');

const E = (v) => ({ top: v, right: v, bottom: v, left: v });
const pos = (extra = {}) => Object.assign({
  shape: 'RECT', material: 'GAZE_203_B1', color: 'SCHWARZ', widthCm: 300, heightCm: 200, quantity: 1, edges: E('OESEN_50'),
}, extra);

test('Ösen alle 30 cm: 300 × 200 = 4 Ecken + 2·9 + 2·6 = 34', () => {
  assert.equal(P.eyelets(cat, pos({ edges: E('OESEN_30') })).count, 34);
});

test('Eigener Abstand: 60 cm ergibt 4 Ecken + 2·4 + 2·3 = 18, Abstand wird geprüft', () => {
  const p = pos({ edges: E('OESEN_EIGEN'), eyeletSpacingCm: 60 });
  assert.equal(P.eyelets(cat, p).count, 18);
  assert.equal(P.validate(cat, p).length, 0);
  assert.ok(P.validate(cat, pos({ edges: E('OESEN_EIGEN') })).some((e) => e.field === 'eyeletSpacingCm'), 'ohne Abstand ungültig');
  assert.ok(P.validate(cat, pos({ edges: E('OESEN_EIGEN'), eyeletSpacingCm: 5 })).some((e) => e.field === 'eyeletSpacingCm'));
  assert.ok(P.validate(cat, pos({ edges: E('OESEN_EIGEN'), eyeletSpacingCm: 250 })).some((e) => e.field === 'eyeletSpacingCm'));
  assert.equal(P.validate(cat, pos()).length, 0, 'ohne eigenen Abstand wird das Feld nicht verlangt');
});

test('Edelstahl: Mehrpreis je Öse, Standard bleibt gleich', () => {
  const std = P.pricePosition(cat, pos());
  const niro = P.pricePosition(cat, pos({ eyeletMaterial: 'EDELSTAHL' }));
  assert.equal(std.eyeletSurchargeNet, 0);
  const per = cat.eyeletOptions.materials.find((m) => m.code === 'EDELSTAHL').surchargeNetPerEyelet;
  assert.ok(Math.abs(niro.eyeletSurchargeNet - 20 * per) < 1e-9);
  assert.ok(Math.abs(niro.unitNet - (std.unitNet + 20 * per)) < 1e-9);
  assert.ok(P.validate(cat, pos({ eyeletMaterial: 'GOLD' })).some((e) => e.field === 'eyeletMaterial'));
});

test('Deckungsgleich: gegenüberliegende Seiten bekommen gleich viele Ösen', () => {
  const t = pos({ shape: 'TRAPEZ_SYM', widthCm: 400, topCm: 200, heightCm: 180 });
  const plain = P.eyelets(cat, t);
  assert.notEqual(plain.interiorBySide.top, plain.interiorBySide.bottom);
  const al = P.eyelets(cat, Object.assign({}, t, { eyeletAligned: true }));
  assert.equal(al.interiorBySide.top, al.interiorBySide.bottom);
  assert.equal(al.interiorBySide.left, al.interiorBySide.right);
  assert.ok(al.count >= plain.count);
  // Rechteck mit gleichen Kanten: keine Änderung
  assert.equal(P.eyelets(cat, pos({ eyeletAligned: true })).count, P.eyelets(cat, pos()).count);
  // Unterschiedliche Abstände oben/unten: die dichtere Seite gilt für beide
  const mixed = pos({ edges: { top: 'OESEN_30', right: 'OESEN_50', bottom: 'OESEN_50', left: 'OESEN_50' }, eyeletAligned: true });
  const m = P.eyelets(cat, mixed);
  assert.equal(m.interiorBySide.top, 9);
  assert.equal(m.interiorBySide.bottom, 9);
});

test('Befestigungszubehör: Preis je Stück brutto, Summe im Auftrag, Unbekanntes wird ignoriert', () => {
  const extras = [{ code: 'GUMMISEIL', quantity: 20 }, { code: 'GIBTS_NICHT', quantity: 5 }, { code: 'HAKEN', quantity: 0 }];
  const lines = P.priceExtras(cat, extras);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].unitGross, P.round2(0.65 * 1.2));
  assert.equal(lines[0].lineGross, P.round2(lines[0].unitGross * 20));
  const base = P.priceOrder(cat, [pos()]);
  const withExtras = P.priceOrder(cat, [pos()], {}, extras);
  assert.equal(withExtras.extrasGross, lines[0].lineGross);
  assert.equal(withExtras.totalGross, P.round2(base.totalGross + lines[0].lineGross));
  assert.equal(P.round2(withExtras.totalNet + withExtras.vat), withExtras.totalGross);
  assert.equal(base.extrasGross, 0);
});

test('Export enthält Ösenoptionen und Zubehör', () => {
  const ex = P.exportOrder(cat, [pos({ eyeletMaterial: 'EDELSTAHL', eyeletAligned: true })], {}, [{ code: 'KABELBINDER', quantity: 20 }]);
  assert.equal(ex.positions[0].eyeletOptions.material, 'EDELSTAHL');
  assert.equal(ex.positions[0].eyeletOptions.aligned, true);
  assert.deepEqual(ex.accessories.map((a) => [a.code, a.sku, a.quantity]), [['KABELBINDER', 'DEMO-ZUB-KB', 20]]);
});

test('Link: Positionen, Regeln und Zubehör überleben Hin- und Rückweg', () => {
  const positions = [
    pos({ name: 'Bauzaun Nordseite ÄÖÜ ß', quantity: 12, eyeletMaterial: 'EDELSTAHL', eyeletAligned: true }),
    pos({ shape: 'DREIECK_FREI', widthCm: 300, sideLeftCm: 500, sideRightCm: 400, heightCm: 999, edges: { right: 'SAUM', bottom: 'OESEN_EIGEN', left: 'SCHNITT' }, eyeletSpacingCm: 40 }),
  ];
  const rules = { tierBasis: 'order', edgePricing: 'proposed', shapePricing: 'bbox' };
  const extras = [{ code: 'GUMMISEIL', quantity: 24 }];
  const text = S.encode({ positions, rules, extras });
  assert.match(text, /^[A-Za-z0-9_-]+$/, 'nur URL-taugliche Zeichen');
  const back = S.decode(text);
  assert.equal(back.positions.length, 2);
  assert.equal(back.positions[0].name, 'Bauzaun Nordseite ÄÖÜ ß');
  assert.equal(back.positions[0].quantity, 12);
  assert.equal(back.positions[0].eyeletMaterial, 'EDELSTAHL');
  assert.equal(back.positions[0].eyeletAligned, true);
  assert.equal(back.positions[1].shape, 'DREIECK_FREI');
  assert.equal(back.positions[1].heightCm, undefined, 'unbenutzte Maße der Form werden nicht mitgeführt');
  assert.deepEqual(back.positions[1].edges, { right: 'SAUM', bottom: 'OESEN_EIGEN', left: 'SCHNITT' });
  assert.deepEqual(back.rules, rules);
  assert.deepEqual(back.extras, extras);
  // Die zurückgelesenen Positionen rechnen gleich wie die Originale
  const a = P.priceOrder(cat, positions, rules, extras).totalGross;
  const b = P.priceOrder(cat, back.positions, back.rules, back.extras).totalGross;
  assert.equal(a, b);
});

test('Link: Unsinn ergibt null, Längen werden begrenzt', () => {
  assert.equal(S.decode(''), null);
  assert.equal(S.decode('!!!kein base64!!!'), null);
  assert.equal(S.decode(Buffer.from('{"v":2,"p":[]}').toString('base64url')), null);
  assert.equal(S.decode(Buffer.from('[1,2,3]').toString('base64url')), null);
  const many = S.encode({ positions: Array.from({ length: 80 }, () => pos()), rules: {}, extras: [] });
  assert.equal(S.decode(many).positions.length, 50);
  const evil = Buffer.from(JSON.stringify({ v: 1, p: [{ n: '<img src=x onerror=alert(1)>'.repeat(10), w: 'abc', q: 1e999, e: { top: 5 } }], r: { tierBasis: 7 }, a: [['X', 'y'], 'z'] })).toString('base64url');
  const d = S.decode(evil);
  assert.equal(d.positions[0].name.length, 60);
  assert.equal(d.positions[0].widthCm, undefined);
  assert.equal(d.positions[0].quantity, undefined);
  assert.deepEqual(d.positions[0].edges, {});
  assert.deepEqual(d.rules, {});
  assert.deepEqual(d.extras, []);
});
