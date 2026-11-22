/*
 * Formen für Gaze nach Maß: Rechteck, Trapez, Dreieck.
 * Reine Funktionen ohne DOM (UMD wie pricing.js). Koordinaten in cm, Ursprung oben links, y nach unten.
 * Die Ecken laufen im Uhrzeigersinn ab links oben. Seitencodes bleiben top/right/bottom/left;
 * beim Dreieck entfällt top. Seite i verläuft von Ecke i zur Ecke i+1.
 */
(function (root) {
  const round1 = (n) => Math.round(n * 10) / 10;
  const clean = (n) => Math.round(n * 1e6) / 1e6;

  const SIDES4 = ['top', 'right', 'bottom', 'left'];
  const SIDES3 = ['right', 'bottom', 'left'];
  const SIDE_LABEL = { top: 'Oben', right: 'Rechts', bottom: 'Unten', left: 'Links' };

  const SHAPES = [
    { code: 'RECT', label: 'Rechteck', inputs: ['widthCm', 'heightCm'], sides: SIDES4 },
    { code: 'TRAPEZ_SYM', label: 'Trapez, gleichschenklig', inputs: ['widthCm', 'topCm', 'heightCm'], sides: SIDES4 },
    { code: 'TRAPEZ_RECHT', label: 'Trapez, eine Seite senkrecht', inputs: ['widthCm', 'topCm', 'heightCm', 'slant'], sides: SIDES4 },
    { code: 'DREIECK_RECHT', label: 'Dreieck, rechtwinklig', inputs: ['widthCm', 'heightCm', 'rightAngle'], sides: SIDES3 },
    { code: 'DREIECK_FREI', label: 'Dreieck, drei Seiten', inputs: ['widthCm', 'sideLeftCm', 'sideRightCm'], sides: SIDES3 },
  ];

  const shapeCode = (pos) => (pos && pos.shape) || 'RECT';
  const findShape = (code) => SHAPES.find((s) => s.code === code) || null;
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

  /** Gaußsche Trapezformel, Betrag in cm². */
  function polygonAreaCm2(vertices) {
    let a = 0;
    for (let i = 0; i < vertices.length; i++) {
      const p = vertices[i], q = vertices[(i + 1) % vertices.length];
      a += p.x * q.y - q.x * p.y;
    }
    return Math.abs(a) / 2;
  }

  function rawVertices(pos) {
    const code = shapeCode(pos);
    const W = pos.widthCm, H = pos.heightCm, T = pos.topCm;
    switch (code) {
      case 'RECT':
        if (!isNum(W) || !isNum(H)) return { error: 'input' };
        return { v: [[0, 0], [W, 0], [W, H], [0, H]] };
      case 'TRAPEZ_SYM': {
        if (!isNum(W) || !isNum(H) || !isNum(T)) return { error: 'input' };
        const o = (W - T) / 2;
        return { v: [[o, 0], [o + T, 0], [W, H], [0, H]] };
      }
      case 'TRAPEZ_RECHT':
        if (!isNum(W) || !isNum(H) || !isNum(T)) return { error: 'input' };
        return { v: pos.slant === 'left' ? [[W - T, 0], [W, 0], [W, H], [0, H]] : [[0, 0], [T, 0], [W, H], [0, H]] };
      case 'DREIECK_RECHT':
        if (!isNum(W) || !isNum(H)) return { error: 'input' };
        return { v: pos.rightAngle === 'right' ? [[W, 0], [W, H], [0, H]] : [[0, 0], [W, H], [0, H]] };
      case 'DREIECK_FREI': {
        const a = W, b = pos.sideRightCm, c = pos.sideLeftCm;
        if (!isNum(a) || !isNum(b) || !isNum(c) || a <= 0 || b <= 0 || c <= 0) return { error: 'input' };
        if (!(a < b + c && b < a + c && c < a + b)) return { error: 'triangle' };
        const x = (c * c - b * b + a * a) / (2 * a);
        const h = Math.sqrt(Math.max(0, c * c - x * x));
        return { v: [[x, 0], [a, h], [0, h]] };
      }
      default:
        return { error: 'shape' };
    }
  }

  /**
   * Geometrie einer Position. Alte Positionen ohne `shape` gelten als Rechteck.
   * Rückgabe: { shape, vertices, sides, areaM2, bboxWidthCm, bboxHeightCm, anglesDeg } oder { error }.
   */
  function shapeGeometry(pos) {
    const code = shapeCode(pos);
    const shape = findShape(code);
    if (!shape) return { error: 'shape' };
    const r = rawVertices(pos);
    if (r.error) return { error: r.error };

    // Alle Punkte so verschieben, dass das kleinste x gleich 0 ist (Oberkante länger als Unterkante, stumpfer Winkel).
    const minX = Math.min(...r.v.map((p) => p[0]));
    const vertices = r.v.map((p) => ({ x: clean(p[0] - minX), y: clean(p[1]) }));
    const n = vertices.length;

    const sides = shape.sides.map((side, i) => {
      const a = vertices[i], b = vertices[(i + 1) % n];
      const dx = b.x - a.x, dy = b.y - a.y;
      const exact = Math.hypot(dx, dy);
      const slanted = Math.abs(dx) > 1e-9 && Math.abs(dy) > 1e-9;
      return {
        code: side, slanted,
        label: SIDE_LABEL[side] + (slanted ? ' (schräg)' : ''),
        from: a, to: b,
        lengthCm: round1(exact), lengthExactCm: exact,
      };
    });

    const anglesDeg = vertices.map((v, i) => {
      const p = vertices[(i - 1 + n) % n], q = vertices[(i + 1) % n];
      const ux = p.x - v.x, uy = p.y - v.y, wx = q.x - v.x, wy = q.y - v.y;
      const cos = (ux * wx + uy * wy) / (Math.hypot(ux, uy) * Math.hypot(wx, wy));
      return round1((Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI);
    });

    const xs = vertices.map((p) => p.x), ys = vertices.map((p) => p.y);
    return {
      shape: code,
      vertices,
      sides,
      areaM2: code === 'RECT' ? (pos.widthCm * pos.heightCm) / 10000 : polygonAreaCm2(vertices) / 10000,
      bboxWidthCm: Math.max(...xs) - Math.min(...xs),
      bboxHeightCm: Math.max(...ys) - Math.min(...ys),
      anglesDeg,
    };
  }

  const api = { SHAPES, SIDE_LABEL, shapeCode, findShape, shapeGeometry, polygonAreaCm2 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NetGeometry = api;
})(typeof window !== 'undefined' ? window : globalThis);
