/*
 * Speichern und Teilen per Link: Positionen, Preisregeln und Zubehör als kompaktes JSON im Link-Anker (#k=…).
 * Reine Funktionen ohne DOM (UMD wie pricing.js). Der Server sieht den Anker nie.
 * decode() prüft nur Typen und Längen; ob die Maße gültig sind, entscheidet NetPricing.validate.
 */
(function (root) {
  const G = typeof module !== 'undefined' && module.exports ? require('./geometry.js') : root.NetGeometry;

  const MAX_POSITIONS = 50, MAX_EXTRAS = 20;
  const NUM = { widthCm: 'w', heightCm: 'h', topCm: 't', sideLeftCm: 'l', sideRightCm: 'r', quantity: 'q', eyeletSpacingCm: 'os' };
  const STR = { shape: 's', material: 'm', color: 'c', slant: 'sl', rightAngle: 'ra', eyeletMaterial: 'om', name: 'n' };
  const SIDES = ['top', 'right', 'bottom', 'left'];
  const RULE_KEYS = ['tierBasis', 'edgePricing', 'shapePricing'];

  function toB64Url(text) {
    const b64 = typeof Buffer !== 'undefined'
      ? Buffer.from(text, 'utf8').toString('base64')
      : btoa(String.fromCharCode(...new TextEncoder().encode(text)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromB64Url(str) {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
    if (typeof Buffer !== 'undefined') return Buffer.from(b64, 'base64').toString('utf8');
    return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
  }

  /** { positions, rules, extras } → kurzer Text für den Link-Anker. */
  function encode(data) {
    const dims = { widthCm: 1, heightCm: 1, topCm: 1, sideLeftCm: 1, sideRightCm: 1, slant: 1, rightAngle: 1 };
    const positions = (data.positions || []).slice(0, MAX_POSITIONS).map((p) => {
      const shape = G.findShape(G.shapeCode(p));
      const o = {};
      for (const [k, short] of Object.entries(NUM)) if (Number.isFinite(p[k]) && (!(k in dims) || !shape || shape.inputs.includes(k))) o[short] = p[k];
      for (const [k, short] of Object.entries(STR)) if (typeof p[k] === 'string' && p[k] !== '' && (!(k in dims) || !shape || shape.inputs.includes(k))) o[short] = p[k];
      if (p.eyeletAligned) o.oa = 1;
      o.e = {};
      for (const s of (shape ? shape.sides : SIDES)) if (p.edges && p.edges[s]) o.e[s] = p.edges[s];
      return o;
    });
    const rules = {};
    for (const k of RULE_KEYS) if (data.rules && typeof data.rules[k] === 'string') rules[k] = data.rules[k];
    const extras = (data.extras || []).filter((x) => x.quantity >= 1).slice(0, MAX_EXTRAS).map((x) => [x.code, Math.round(x.quantity)]);
    return toB64Url(JSON.stringify({ v: 1, p: positions, r: rules, a: extras }));
  }

  /** Link-Anker (ohne „#k=“) → { positions, rules, extras } oder null, wenn der Text nicht lesbar ist. */
  function decode(text) {
    let raw;
    try { raw = JSON.parse(fromB64Url(String(text || '').slice(0, 20000))); } catch (e) { return null; }
    if (!raw || raw.v !== 1 || !Array.isArray(raw.p)) return null;
    const positions = [];
    for (const o of raw.p.slice(0, MAX_POSITIONS)) {
      if (!o || typeof o !== 'object') continue;
      const p = {};
      for (const [k, short] of Object.entries(NUM)) if (typeof o[short] === 'number' && Number.isFinite(o[short])) p[k] = o[short];
      for (const [k, short] of Object.entries(STR)) if (typeof o[short] === 'string') p[k] = o[short].slice(0, k === 'name' ? 60 : 40);
      if (o.oa === 1) p.eyeletAligned = true;
      p.edges = {};
      for (const s of SIDES) if (o.e && typeof o.e[s] === 'string') p.edges[s] = o.e[s].slice(0, 30);
      positions.push(p);
    }
    const rules = {};
    for (const k of RULE_KEYS) if (raw.r && typeof raw.r[k] === 'string') rules[k] = raw.r[k].slice(0, 30);
    const extras = [];
    for (const x of Array.isArray(raw.a) ? raw.a.slice(0, MAX_EXTRAS) : []) {
      if (Array.isArray(x) && typeof x[0] === 'string' && Number.isFinite(x[1])) extras.push({ code: x[0].slice(0, 30), quantity: Math.round(x[1]) });
    }
    return { positions, rules, extras };
  }

  const api = { encode, decode };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NetShare = api;
})(typeof window !== 'undefined' ? window : globalThis);
