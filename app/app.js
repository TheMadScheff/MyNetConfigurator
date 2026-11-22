/* Oberfläche des Gaze-Konfigurators. Rechnet ausschließlich über NetPricing (pricing.js). */
(function () {
  'use strict';
  const cat = window.NetCatalog;
  const P = window.NetPricing;
  const G = window.NetGeometry;
  const STORE_KEY = 'netcfg.v1';

  const vatPct = Math.round(cat.vatRate * 100);
  const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
  const num = (n, d = 2) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  const int = (n) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(n);
  const $ = (id) => document.getElementById(id);
  const el = (tag, attrs = {}, children = []) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined && v !== false) e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of [].concat(children)) if (c != null) e.append(c);
    return e;
  };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const uid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // ---------- Zustand ----------
  const state = {
    draft: newDraft(),
    editingId: null,
    activeSide: 'top',
    positions: [],
    rules: Object.assign({}, P.DEFAULT_RULES),
    touched: {},
    edited: new Set(),   // Eingabefelder, die der Benutzer selbst geändert hat (Startwerte bei Formwechsel nur für die übrigen)
    focus: null,         // Eingabefeld mit Fokus (für die Hervorhebung in der Vorschau)
  };

  function newDraft() {
    const d = clone(cat.defaults);
    return normalizeDraft({ shape: d.shape || 'RECT', material: d.material, color: d.color, widthCm: d.widthCm, heightCm: d.heightCm, quantity: d.quantity, edges: d.edges, name: '' });
  }

  /** Ergänzt fehlende Maßfelder mit sinnvollen Startwerten (Oberkante = halbe Breite, freie Seiten = 75 % der Breite, mindestens die Höhe). */
  function normalizeDraft(d) {
    const W = Number.isFinite(d.widthCm) ? d.widthCm : 350, H = Number.isFinite(d.heightCm) ? d.heightCm : 180;
    d.shape = d.shape || 'RECT';
    if (!Number.isFinite(d.topCm)) d.topCm = Math.round(W / 2);
    const side = Math.max(Math.round(H), Math.round(W * 0.75));
    if (!Number.isFinite(d.sideLeftCm)) d.sideLeftCm = side;
    if (!Number.isFinite(d.sideRightCm)) d.sideRightCm = side;
    if (d.slant !== 'left' && d.slant !== 'right') d.slant = 'right';
    if (d.rightAngle !== 'left' && d.rightAngle !== 'right') d.rightAngle = 'left';
    return d;
  }
  const shapeDef = () => G.findShape(state.draft.shape) || G.findShape('RECT');
  const shapeSides = () => shapeDef().sides;

  function examplePositions() {
    return [
      { id: uid(), example: true, name: 'Bauzaun Nordseite', material: 'GAZE_203_B1', color: 'SCHWARZ', widthCm: 341, heightCm: 176, quantity: 12,
        edges: { top: 'OESEN_50', right: 'OESEN_50', bottom: 'OESEN_50', left: 'OESEN_50' } },
      { id: uid(), example: true, name: 'Bühnenblende', material: 'GAZE_800_B1', color: 'GRAU', widthCm: 600, heightCm: 120, quantity: 2,
        edges: { top: 'HOHLSAUM_8', right: 'SAUM', bottom: 'SAUM', left: 'SAUM' } },
    ];
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (Array.isArray(s.positions)) state.positions = s.positions.filter((p) => P.validate(cat, p).length === 0);
        if (s.rules) state.rules = Object.assign({}, P.DEFAULT_RULES, s.rules);
        return;
      }
    } catch (e) { /* Speicher nicht verfügbar: mit Beispielen starten */ }
    state.positions = examplePositions();
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ positions: state.positions, rules: state.rules })); } catch (e) { /* egal */ }
  }

  // ---------- Hilfen ----------
  const mat = () => P.findMaterial(cat, state.draft.material);
  const colorHex = (code) => (cat.colors[code] || {}).hex || '#777';
  const colorName = (code) => (cat.colors[code] || {}).name || code;
  const edgeShort = (code) => (P.findEdge(cat, code) || {}).short || code;
  const sideLabel = (code) => cat.sides.find((s) => s.code === code).label;

  function luminance(hex) {
    const h = hex.replace('#', '');
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function shade(hex, f) {
    const h = hex.replace('#', '');
    const c = [0, 2, 4].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * f))));
    return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  }

  /** Staffelfläche für den Entwurf: bei Auftragsstaffel inkl. der übrigen Positionen gleicher Gaze. */
  function draftTierArea() {
    if (state.rules.tierBasis !== 'order') return null;
    const d = state.draft;
    let a = P.billedAreaM2(cat, d, state.rules) * (d.quantity || 1);
    for (const p of state.positions) if (p.id !== state.editingId && p.material === d.material) a += P.billedAreaM2(cat, p, state.rules) * p.quantity;
    return a;
  }

  // ---------- Formular ----------
  // ---------- Form ----------
  const ICON_SAMPLES = {
    RECT: { shape: 'RECT', widthCm: 100, heightCm: 60 },
    TRAPEZ_SYM: { shape: 'TRAPEZ_SYM', widthCm: 100, topCm: 50, heightCm: 60 },
    TRAPEZ_RECHT: { shape: 'TRAPEZ_RECHT', widthCm: 100, topCm: 50, heightCm: 60, slant: 'right' },
    DREIECK_RECHT: { shape: 'DREIECK_RECHT', widthCm: 100, heightCm: 60, rightAngle: 'left' },
    DREIECK_FREI: { shape: 'DREIECK_FREI', widthCm: 100, sideLeftCm: 80, sideRightCm: 70 },
  };
  function renderShapes() {
    const box = $('shapes');
    box.replaceChildren();
    for (const sh of G.SHAPES) {
      const checked = sh.code === state.draft.shape;
      const verts = G.shapeGeometry(ICON_SAMPLES[sh.code]).vertices;
      box.append(el('button', {
        type: 'button', class: 'shape', role: 'radio', 'aria-checked': String(checked), tabindex: checked ? '0' : '-1', 'data-code': sh.code,
        onclick: () => setShape(sh.code),
        onkeydown: (ev) => radioKeys(ev, box),
      }, [
        svg('svg', { viewBox: '0 0 56 40', 'aria-hidden': 'true' }, svg('polygon', { class: 'shape__icon', points: fitPoints(verts, 56, 40, 4) })),
        el('span', { text: sh.label }),
      ]));
    }
    $('shape-name').textContent = shapeDef().label;
  }

  function setShape(code) {
    const d = state.draft;
    d.shape = code;
    // Startwerte für Felder, die der Benutzer noch nicht selbst geändert hat
    const W = Number.isFinite(d.widthCm) ? d.widthCm : 350, H = Number.isFinite(d.heightCm) ? d.heightCm : 180;
    if (!state.edited.has('topCm')) d.topCm = Math.round(W / 2);
    const side = Math.max(Math.round(H), Math.round(W * 0.75));
    if (!state.edited.has('sideLeftCm')) d.sideLeftCm = side;
    if (!state.edited.has('sideRightCm')) d.sideRightCm = side;
    normalizeDraft(d);
    if (!shapeSides().includes(state.activeSide)) state.activeSide = shapeSides()[0];
    renderShapes();
    syncInputs();
    update();
  }

  /** Schemabild eines Gewebes: Maschenweite und Dichte nach Katalogdaten, Farbe = gewählte Farbe (sonst erste Farbe des Gewebes). */
  function schemeSvg(m) {
    const code = m.colors.some((c) => c.code === state.draft.color) ? state.draft.color : m.colors[0].code;
    const hex = colorHex(code);
    const light = luminance(hex) > 0.75;
    const thread = light ? shade(hex, 0.8) : shade(hex, 1.35);
    const cell = 4 + m.openness * 16;
    const id = 'sch-' + m.code;
    return svg('svg', { class: 'mat__scheme', viewBox: '0 0 120 80', 'aria-hidden': 'true', focusable: 'false' }, [
      svg('defs', {}, svg('pattern', { id, width: cell, height: cell, patternUnits: 'userSpaceOnUse' }, [
        svg('rect', { width: cell, height: cell, fill: hex, 'fill-opacity': (0.95 - m.openness).toFixed(2) }),
        svg('path', { d: `M0 0H${cell}M0 0V${cell}`, stroke: thread, 'stroke-width': 1.3, fill: 'none' }),
      ])),
      svg('rect', { width: 120, height: 80, fill: 'var(--surface-2)' }),
      svg('rect', { x: 10, y: 8, width: 100, height: 64, fill: `url(#${id})`, stroke: 'var(--muted)', 'stroke-opacity': 0.4 }),
      svg('text', { x: 114, y: 76, 'text-anchor': 'end', class: 'edge-tag', style: 'font-size:6px' }, 'Schema'),
    ]);
  }
  /** Schemabilder an die gewählte Farbe anpassen, ohne die Karten neu aufzubauen. */
  function refreshSchemes() {
    document.querySelectorAll('#materials .mat__img').forEach((box) => {
      if (box.querySelector('img')) return;
      const m = P.findMaterial(cat, box.dataset.mat);
      if (m) box.replaceChildren(schemeSvg(m));
    });
  }

  function renderMaterials() {
    const box = $('materials');
    box.replaceChildren();
    for (const m of cat.materials) {
      const from = P.grossPerM2(cat, m.tiers[0].netPerM2);
      const min = P.grossPerM2(cat, m.tiers[m.tiers.length - 1].netPerM2);
      const checked = m.code === state.draft.material;
      box.append(el('button', {
        type: 'button', class: 'mat', role: 'radio', 'aria-checked': String(checked), tabindex: checked ? '0' : '-1',
        'data-code': m.code,
        onclick: () => setMaterial(m.code),
        onkeydown: (ev) => radioKeys(ev, box),
      }, [
        el('span', { class: 'mat__img', 'data-mat': m.code }, m.image
          ? el('img', { src: m.image, alt: '', loading: 'lazy', width: 300, height: 200, onerror: (ev) => ev.target.replaceWith(schemeSvg(m)) })
          : schemeSvg(m)),
        el('span', { class: 'mat__name', text: m.name }),
        el('span', { class: 'mat__badges' }, [
          m.fireClass ? el('span', { class: 'badge badge--b1', text: m.fireClass + ' schwer entflammbar' }) : null,
          el('span', { class: 'badge', text: 'UV ' + m.uvYears + ' J.' }),
        ]),
        el('span', { class: 'mat__specs', text: m.weightGm2 + ' g/m² · ' + m.structure + '\nWind durchlässig ' + m.windPermeabilityPct + ' %' }),
        el('span', { class: 'wind', title: 'Winddurchlässigkeit ' + m.windPermeabilityPct + ' %' }, el('span', { style: 'width:' + m.windPermeabilityPct * 2 + '%' })),
        el('span', { class: 'mat__price' }, [eur.format(from) + ' /m² ', el('small', { text: 'ab ' + eur.format(min) })]),
      ]));
    }
    // Zeilenumbruch in den Specs sichtbar machen
    box.querySelectorAll('.mat__specs').forEach((s) => { s.style.whiteSpace = 'pre-line'; });
  }

  function renderColors() {
    const box = $('colors');
    box.replaceChildren();
    for (const c of mat().colors) {
      const checked = c.code === state.draft.color;
      box.append(el('button', {
        type: 'button', class: 'swatch', role: 'radio', 'aria-checked': String(checked), tabindex: checked ? '0' : '-1',
        'aria-label': colorName(c.code), title: colorName(c.code) + (c.sku ? ' · Art.-Nr. ' + c.sku : ''),
        style: 'background:' + colorHex(c.code),
        onclick: () => { state.draft.color = c.code; update(); },
        onkeydown: (ev) => radioKeys(ev, box),
      }));
    }
    const c = mat().colors.find((x) => x.code === state.draft.color);
    $('color-name').textContent = colorName(state.draft.color) + (c && c.sku ? ' · Art.-Nr. ' + c.sku : '');
  }

  function radioKeys(ev, box) {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(ev.key in keys)) return;
    ev.preventDefault();
    const items = [...box.querySelectorAll('[role="radio"]')];
    const i = items.indexOf(ev.currentTarget);
    const next = items[(i + keys[ev.key] + items.length) % items.length];
    next.click();
    const again = [...box.querySelectorAll('[role="radio"]')][items.indexOf(next)];
    if (again) again.focus();
  }

  function setMaterial(code) {
    state.draft.material = code;
    if (!mat().colors.some((c) => c.code === state.draft.color)) state.draft.color = mat().colors[0].code;
    renderMaterials();
    update();
  }

  function renderEdges() {
    const box = $('edges');
    box.replaceChildren();
    const geo = G.shapeGeometry(state.draft);
    for (const s of cat.sides.filter((x) => shapeSides().includes(x.code))) {
      const gs = geo.error ? null : geo.sides.find((x) => x.code === s.code);
      const sel = el('select', {
        id: 'edge-' + s.code, 'aria-label': 'Kante ' + s.label,
        onchange: (ev) => { state.draft.edges[s.code] = ev.target.value; setActiveSide(s.code, false); update(); },
        onfocus: () => setActiveSide(s.code, false),
      }, cat.edges.map((e) => el('option', { value: e.code, text: e.short, title: e.label })));
      sel.value = state.draft.edges[s.code];
      const lenM = gs ? gs.lengthExactCm / 100 : NaN;
      box.append(el('label', { class: 'edge' + (state.activeSide === s.code ? ' is-active' : ''), for: 'edge-' + s.code, 'data-side': s.code }, [
        el('span', { class: 'edge__label' }, [el('span', { text: gs ? gs.label : s.label }), el('span', { text: Number.isFinite(lenM) ? num(lenM) + ' m' : '' })]),
        sel,
      ]));
    }
    $('edges-all-side').textContent = sideLabel(state.activeSide);
  }

  function setActiveSide(side, focusSelect) {
    state.activeSide = side;
    document.querySelectorAll('.edge').forEach((n) => n.classList.toggle('is-active', n.dataset.side === side));
    document.querySelectorAll('.edge-hit').forEach((n) => n.classList.toggle('is-active', n.dataset.side === side));
    $('edges-all-side').textContent = sideLabel(side);
    if (focusSelect) $('edge-' + side).focus();
  }

  function syncInputs() {
    const d = state.draft;
    $('width').value = Number.isFinite(d.widthCm) ? d.widthCm : '';
    $('height').value = Number.isFinite(d.heightCm) ? d.heightCm : '';
    $('top').value = Number.isFinite(d.topCm) ? d.topCm : '';
    $('side-left').value = Number.isFinite(d.sideLeftCm) ? d.sideLeftCm : '';
    $('side-right').value = Number.isFinite(d.sideRightCm) ? d.sideRightCm : '';
    const sh = shapeDef(), has = (k) => sh.inputs.includes(k);
    $('f-top').hidden = !has('topCm');
    $('f-height').hidden = !has('heightCm');
    $('f-side-left').hidden = !has('sideLeftCm');
    $('f-side-right').hidden = !has('sideRightCm');
    $('dims-x').hidden = sh.code !== 'RECT';
    $('width-label').textContent = sh.code === 'RECT' ? 'Breite' : 'Unterkante';
    $('presets').hidden = sh.code !== 'RECT';
    const orientKey = has('slant') ? 'slant' : has('rightAngle') ? 'rightAngle' : null;
    $('orient').hidden = !orientKey;
    if (orientKey) {
      $('orient-label').textContent = orientKey === 'slant' ? 'Schräge Seite' : 'Rechter Winkel';
      document.querySelectorAll('#orient [data-orient]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.orient === d[orientKey])));
    }
    $('quantity').value = Number.isFinite(d.quantity) ? d.quantity : '';
    $('pos-name').value = d.name || '';
    const L = cat.limits;
    $('limits-hint').textContent = sh.code === 'RECT'
      ? 'Möglich: ' + int(L.minWidthCm) + '–' + int(L.maxWidthCm) + ' cm breit, ' + int(L.minHeightCm) + '–' + int(L.maxHeightCm) + ' cm hoch. Maßtoleranz ±5 %.'
      : 'Das umschließende Rechteck der Form darf ' + int(L.minWidthCm) + '–' + int(L.maxWidthCm) + ' cm breit und ' + int(L.minHeightCm) + '–' + int(L.maxHeightCm) + ' cm hoch sein. Jede Seite mindestens ' + cat.shapeRules.minSideCm + ' cm, Winkel mindestens ' + cat.shapeRules.minAngleDeg + '°. Maßtoleranz ±5 %.';
  }

  function readNumber(id) {
    const v = $(id).value.trim();
    return v === '' ? NaN : Number(v);
  }

  // ---------- Vorschau ----------
  const SVGNS = 'http://www.w3.org/2000/svg';
  const svg = (tag, attrs = {}, children = []) => {
    const e = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) e.setAttribute(k, v);
    for (const c of [].concat(children)) if (c != null) e.append(c);
    return e;
  };

  /** Eckpunkte als SVG-Punktliste, eingepasst in eine Box (Symbole und Vorschaubilder). */
  function fitPoints(vertices, boxW, boxH, pad) {
    const minX = Math.min(...vertices.map((v) => v.x)), minY = Math.min(...vertices.map((v) => v.y));
    const w = (Math.max(...vertices.map((v) => v.x)) - minX) || 1, h = (Math.max(...vertices.map((v) => v.y)) - minY) || 1;
    const s = Math.min((boxW - 2 * pad) / w, (boxH - 2 * pad) / h);
    const ox = (boxW - w * s) / 2, oy = (boxH - h * s) / 2;
    return vertices.map((v) => (ox + (v.x - minX) * s).toFixed(1) + ',' + (oy + (v.y - minY) * s).toFixed(1)).join(' ');
  }

  /** Kurztext der Maße, z. B. „341 × 176 cm“ oder „Trapez 400/200 × 180 cm, rechts schräg“. */
  function dimsText(p) {
    const f = int;
    switch (G.shapeCode(p)) {
      case 'TRAPEZ_SYM': return 'Trapez ' + f(p.widthCm) + '/' + f(p.topCm) + ' × ' + f(p.heightCm) + ' cm';
      case 'TRAPEZ_RECHT': return 'Trapez ' + f(p.widthCm) + '/' + f(p.topCm) + ' × ' + f(p.heightCm) + ' cm, ' + (p.slant === 'left' ? 'links' : 'rechts') + ' schräg';
      case 'DREIECK_RECHT': return 'Dreieck ' + f(p.widthCm) + ' × ' + f(p.heightCm) + ' cm, rechter Winkel ' + (p.rightAngle === 'right' ? 'rechts' : 'links');
      case 'DREIECK_FREI': return 'Dreieck ' + f(p.widthCm) + ' · ' + f(p.sideLeftCm) + ' · ' + f(p.sideRightCm) + ' cm (unten · links · rechts)';
      default: return f(p.widthCm) + ' × ' + f(p.heightCm) + ' cm';
    }
  }

  /**
   * Baut die SVG-Vorschau für eine Konfiguration (Rechteck, Trapez, Dreieck).
   * o.interactive: klickbare Kanten (Bildschirm), sonst statisch (PDF). o.focus: Eingabefeld mit Fokus, dessen Maß hervorgehoben wird.
   */
  function buildPreview(d, o) {
    const errors = o.errors || [];
    const narrow = !!o.narrow;
    const VW = o.vw || (narrow ? 400 : 720), VH = o.vh || (narrow ? 320 : 430);
    const M = { t: 34, r: 78, b: 64, l: 34 };
    const pos0 = (v) => (Number.isFinite(v) && v > 0 ? v : null);
    let geo = G.shapeGeometry(d);
    if (geo.error) geo = G.shapeGeometry({ shape: 'RECT', widthCm: pos0(d.widthCm) || 100, heightCm: pos0(d.heightCm) || 100 });
    const isRect = geo.shape === 'RECT';
    const W = geo.bboxWidthCm, H = geo.bboxHeightCm;
    const availW = VW - M.l - M.r, availH = VH - M.t - M.b;

    // Seitenverhältnis begrenzen, damit sehr lange Netze lesbar bleiben
    let ratio = W / H, squeezed = false;
    if (ratio > 7) { ratio = 7; squeezed = true; }
    if (ratio < 1 / 3) { ratio = 1 / 3; squeezed = true; }
    let dw = availW, dh = dw / ratio;
    if (dh > availH) { dh = availH; dw = dh * ratio; }
    const x0 = M.l + (availW - dw) / 2, y0 = M.t + (availH - dh) / 2, x1 = x0 + dw, y1 = y0 + dh;
    const sx = dw / W, sy = dh / H;

    const pts = geo.vertices.map((v) => ({ x: x0 + v.x * sx, y: y0 + v.y * sy }));
    const n = pts.length;
    const polyStr = pts.map((p) => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');

    const m = P.findMaterial(cat, d.material);
    const hex = colorHex(d.color);
    const light = luminance(hex) > 0.75;
    const thread = light ? shade(hex, 0.86) : hex;
    const cell = 5 + m.openness * 14;

    const root = svg('svg', { viewBox: `0 0 ${VW} ${VH}`, role: 'img', 'aria-label': `Vorschau ${m.name} ${colorName(d.color)}, ${dimsText(d)}` });
    const defs = svg('defs', {}, [
      svg('pattern', { id: 'mesh', width: cell, height: cell, patternUnits: 'userSpaceOnUse' }, [
        svg('rect', { width: cell, height: cell, fill: hex, 'fill-opacity': (0.92 - m.openness).toFixed(2) }),
        svg('path', { d: `M0 0H${cell}M0 0V${cell}`, stroke: thread, 'stroke-width': 1.4, fill: 'none' }),
      ]),
      svg('pattern', { id: 'grid', width: 24, height: 24, patternUnits: 'userSpaceOnUse' }, [
        svg('path', { d: 'M24 0H0V24', stroke: 'var(--grid)', 'stroke-width': 1, fill: 'none' }),
      ]),
      svg('clipPath', { id: 'shape-clip' }, svg('polygon', { points: polyStr })),
    ]);
    root.append(defs, svg('rect', { x: 0, y: 0, width: VW, height: VH, fill: 'url(#grid)' }));

    // Netzfläche
    root.append(svg('polygon', { points: polyStr, fill: 'url(#mesh)' }));

    // Seiten mit Lage im Bild und Normale nach innen (Ecken laufen im Uhrzeigersinn)
    const sideInfo = geo.sides.map((s, i) => {
      const a = pts[i], b = pts[(i + 1) % n];
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      const horizontal = Math.abs(dy) < 1e-6, vertical = Math.abs(dx) < 1e-6;
      return { s, a, b, dx, dy, len, nx: -dy / len, ny: dx / len, horizontal, vertical, scale: horizontal ? sy : vertical ? sx : (sx + sy) / 2 };
    });
    const flat = (deg) => { let a = deg; while (a >= 90) a -= 180; while (a < -90) a += 180; return a; };  // Text nie auf dem Kopf

    // Kanten: Saum, Hohlsaum, Schnittkante (am Polygon beschnitten, damit der Saum innen liegt)
    const hemColor = light ? shade(hex, 0.8) : shade(hex, 1.25);
    for (const si of sideInfo) {
      const e = P.findEdge(cat, d.edges[si.s.code]);
      if (!e) continue;
      if (!e.hem) {
        root.append(svg('line', { x1: si.a.x, y1: si.a.y, x2: si.b.x, y2: si.b.y, stroke: 'var(--muted)', 'stroke-width': 1.2, 'stroke-dasharray': '2 3' }));
        continue;
      }
      const band = e.tunnelCm ? Math.max(8, Math.min(22, e.tunnelCm * si.scale)) : Math.max(4, Math.min(10, 3 * si.scale));
      root.append(svg('line', {
        x1: si.a.x, y1: si.a.y, x2: si.b.x, y2: si.b.y, stroke: e.tunnelCm ? hemColor : hex,
        'stroke-width': band * 2, 'clip-path': 'url(#shape-clip)',
      }));
      const so = e.tunnelCm ? band - 1.5 : band - 1;
      root.append(svg('line', {
        x1: si.a.x + si.nx * so, y1: si.a.y + si.ny * so, x2: si.b.x + si.nx * so, y2: si.b.y + si.ny * so,
        stroke: light ? shade(hex, 0.6) : shade(hex, 1.9), 'stroke-width': 0.9, 'stroke-dasharray': '3 2', 'clip-path': 'url(#shape-clip)',
      }));
      if (e.tunnelCm) {
        const cx = (si.a.x + si.b.x) / 2 + si.nx * band / 2, cy = (si.a.y + si.b.y) / 2 + si.ny * band / 2;
        const rot = si.horizontal ? 0 : flat((Math.atan2(si.dy, si.dx) * 180) / Math.PI);
        root.append(svg('text', {
          x: cx, y: cy, class: 'edge-tag', 'text-anchor': 'middle', 'dominant-baseline': 'central',
          transform: rot ? `rotate(${rot} ${cx} ${cy})` : null,
          style: `fill:${light ? '#333' : '#eee'}; font-size:10px`,
        }, 'Hohlsaum ' + e.tunnelCm + ' cm'));
      }
    }
    root.append(svg('polygon', { points: polyStr, fill: 'none', stroke: 'var(--muted)', 'stroke-opacity': 0.5, 'stroke-width': 1 }));

    // Maß des fokussierten Eingabefelds hervorheben (Seitenlängen als Akzentlinie)
    const hiSide = { widthCm: 'bottom', topCm: 'top', sideLeftCm: 'left', sideRightCm: 'right' }[o.focus];
    const hi = hiSide && sideInfo.find((si) => si.s.code === hiSide);
    if (hi) root.append(svg('line', { x1: hi.a.x, y1: hi.a.y, x2: hi.b.x, y2: hi.b.y, stroke: 'var(--accent)', 'stroke-width': 3.5, 'stroke-linecap': 'round' }));

    // Ösen
    const dimErr = errors.some((e) => ['widthCm', 'heightCm', 'topCm', 'sideLeftCm', 'sideRightCm', 'shape'].includes(e.field));
    if (!dimErr) {
      const ey = P.eyelets(cat, d);
      const r = Math.max(3.2, Math.min(6, 1.6 * Math.min(sx, sy)));
      const inset = Math.max(3, Math.min(7, 2.5 * Math.min(sx, sy)));
      for (const p of ey.points) {
        let ox = 0, oy = 0;
        for (const code of p.sides) { const si = sideInfo.find((q) => q.s.code === code); if (si) { ox += si.nx; oy += si.ny; } }
        const cx = x0 + p.x * sx + ox * inset, cy = y0 + p.y * sy + oy * inset;
        root.append(svg('circle', { cx, cy, r, fill: 'var(--eyelet)' }), svg('circle', { cx, cy, r: r * 0.45, fill: 'var(--canvas)' }));
      }
    }

    // Maßlinien: Unterkante unten, Höhe rechts (umschließendes Rechteck)
    const bottom = sideInfo.find((si) => si.s.code === 'bottom');
    const bx0 = Math.min(bottom.a.x, bottom.b.x), bx1 = Math.max(bottom.a.x, bottom.b.x);
    const dimY = y1 + 22, dimX = x1 + 20;
    const hw = o.focus === 'widthCm' ? ' is-hi' : '', hh = o.focus === 'heightCm' ? ' is-hi' : '';
    root.append(
      svg('line', { x1: bx0, y1: dimY, x2: bx1, y2: dimY, class: 'dimline' + hw }),
      svg('line', { x1: bx0, y1: dimY - 5, x2: bx0, y2: dimY + 5, class: 'dimline' + hw }),
      svg('line', { x1: bx1, y1: dimY - 5, x2: bx1, y2: dimY + 5, class: 'dimline' + hw }),
      svg('text', { x: (bx0 + bx1) / 2, y: dimY - 6, class: 'dimtext' + hw, 'text-anchor': 'middle' }, int(bottom.s.lengthCm) + ' cm'),
      svg('line', { x1: dimX, y1: y0, x2: dimX, y2: y1, class: 'dimline' + hh }),
      svg('line', { x1: dimX - 5, y1: y0, x2: dimX + 5, y2: y0, class: 'dimline' + hh }),
      svg('line', { x1: dimX - 5, y1: y1, x2: dimX + 5, y2: y1, class: 'dimline' + hh }),
      svg('text', { x: dimX + 8, y: (y0 + y1) / 2, class: 'dimtext' + hh, 'text-anchor': 'middle', transform: `rotate(90 ${dimX + 8} ${(y0 + y1) / 2})` }, int(H) + ' cm'),
    );

    // Winkel beim freien Dreieck
    if (geo.shape === 'DREIECK_FREI') {
      const cxm = pts.reduce((a, p) => a + p.x, 0) / n, cym = pts.reduce((a, p) => a + p.y, 0) / n;
      pts.forEach((p, i) => {
        root.append(svg('text', {
          x: p.x + (cxm - p.x) * 0.2, y: p.y + (cym - p.y) * 0.2, class: 'edge-tag', 'text-anchor': 'middle', 'dominant-baseline': 'central',
          style: 'font-size:10px; fill:' + (light ? '#333' : '#eee'),
        }, Math.round(geo.anglesDeg[i]) + '°'));
      });
    }

    // Klickbare Kanten mit Beschriftung (Text parallel zur Seite, bei schrägen Seiten gedreht)
    for (const si of sideInfo) {
      const s = si.s;
      const edgeTxt = edgeShort(d.edges[s.code]);
      const label = isRect ? sideLabel(s.code) + ': ' + edgeTxt
        : !(si.horizontal || si.vertical) ? int(s.lengthCm) + ' cm · ' + edgeTxt
        : sideLabel(s.code) + ' ' + int(s.lengthCm) + ' cm: ' + edgeTxt;
      let tx, ty, rot = 0;
      if (si.horizontal) { tx = (si.a.x + si.b.x) / 2; ty = si.ny > 0 ? si.a.y - 10 : dimY + 22; }
      else if (si.vertical) { ty = (si.a.y + si.b.y) / 2; if (si.nx > 0) { tx = x0 - 12; rot = -90; } else { tx = dimX + 34; rot = 90; } }
      else {
        tx = (si.a.x + si.b.x) / 2 - si.nx * 14; ty = (si.a.y + si.b.y) / 2 - si.ny * 14;
        rot = flat((Math.atan2(si.dy, si.dx) * 180) / Math.PI);
      }
      const hit = svg('g', o.interactive ? {
        class: 'edge-hit' + (state.activeSide === s.code ? ' is-active' : ''), tabindex: 0, role: 'button',
        'aria-label': 'Kante ' + s.label + ': ' + edgeTxt + ' ändern', 'data-side': s.code,
      } : { class: 'edge-hit' }, [
        svg('line', { class: 'edge-glow', x1: si.a.x, y1: si.a.y, x2: si.b.x, y2: si.b.y, stroke: 'transparent', 'stroke-width': 10, 'stroke-linecap': 'round' }),
        svg('text', { class: 'edge-tag', x: tx, y: ty, 'text-anchor': 'middle', 'dominant-baseline': 'central', transform: rot ? `rotate(${rot} ${tx} ${ty})` : null }, label),
      ]);
      if (o.interactive) {
        const act = () => setActiveSide(s.code, true);
        hit.addEventListener('click', act);
        hit.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); act(); } });
      }
      root.append(hit);
    }

    if (squeezed) {
      root.append(svg('text', { x: 12, y: VH - 10, class: 'edge-tag' }, 'Darstellung gestaucht, Maße stimmen'));
    }
    return root;
  }

  function renderPreview(errors) {
    const host = $('preview');
    const narrow = host.clientWidth > 0 && host.clientWidth < 560;
    host.replaceChildren(buildPreview(state.draft, { narrow, errors, interactive: true, focus: state.focus }));
  }

  // ---------- Preis ----------
  function renderPrice(errors) {
    const d = state.draft;
    const add = $('add-btn'), mb = $('mb-add');
    const editing = !!state.editingId;
    add.textContent = editing ? 'Änderung speichern' : 'Position hinzufügen';
    mb.textContent = editing ? 'Speichern' : 'Hinzufügen';
    $('cancel-btn').hidden = !editing;
    $('price-label').textContent = editing ? 'Position wird geändert' : 'Diese Position';

    if (errors.length) {
      add.disabled = mb.disabled = true;
      $('price-value').textContent = '–';
      $('price-sub').textContent = 'Bitte Eingaben prüfen';
      $('mb-price').textContent = '–';
      $('mb-sub').textContent = 'Eingaben prüfen';
      $('breakdown').replaceChildren();
      $('ladder').replaceChildren();
      $('facts').replaceChildren(el('span', { text: errors[0].message }));
      return;
    }
    add.disabled = mb.disabled = false;
    const r = P.pricePosition(cat, d, state.rules, draftTierArea());

    $('price-value').textContent = eur.format(r.lineGross);
    $('price-sub').textContent = d.quantity > 1 ? d.quantity + ' × ' + eur.format(r.unitGross) + ' je Stück' : 'je Stück, inkl. MwSt.';
    $('mb-price').textContent = eur.format(r.lineGross);
    $('mb-sub').textContent = d.quantity > 1 ? d.quantity + ' × ' + eur.format(r.unitGross) : 'inkl. MwSt.';

    const vat = 1 + cat.vatRate;
    const rows = [
      [areaLabel(r) + ' × ' + eur.format(r.grossPerM2) + '/m²', eur.format(r.materialNet * vat)],
    ];
    if (state.rules.edgePricing === 'proposed') {
      for (const l of r.edgeLines) if (l.net > 0) rows.push(['Kante ' + sideLabel(l.side) + ': ' + edgeShort(l.edge) + ', ' + num(l.lengthM) + ' m', eur.format(l.net * vat)]);
    } else {
      rows.push(['Kantenverarbeitung', 'inklusive']);
    }
    for (const a of r.accessoryLines) rows.push([a.name + ', ' + a.quantity + ' Stk', eur.format(a.net * vat)]);
    rows.push(['sep']);
    rows.push(['Stückpreis inkl. ' + vatPct + ' % MwSt.', eur.format(r.unitGross)]);
    rows.push(['davon MwSt.', eur.format(r.unitGross - r.unitGross / vat)]);
    $('breakdown').replaceChildren(...rows.flatMap(([k, v]) => k === 'sep' ? [el('div', { class: 'sep' })] : [el('dt', { text: k }), el('dd', { text: v })]));

    // Staffel
    const m = mat();
    const steps = m.tiers.map((t, i) => el('div', { class: 'ladder__step' + (i === r.tierIndex ? ' is-active' : '') }, [
      el('b', { text: eur.format(P.grossPerM2(cat, t.netPerM2)) }),
      t.fromM2 === 0 ? 'bis ' + int(m.tiers[1] ? m.tiers[1].fromM2 : 0) + ' m²' : 'ab ' + int(t.fromM2) + ' m²',
    ]));
    const basis = state.rules.tierBasis === 'order' ? 'Auftragsfläche ' + num(r.tierAreaM2, 1) + ' m² ' + m.name : 'Fläche je Stück';
    const hint = r.nextTier
      ? el('div', { class: 'ladder__hint', text: 'Noch ' + num(r.toNextTierM2, 1) + ' m² bis ' + eur.format(P.grossPerM2(cat, r.nextTier.netPerM2)) + '/m² (Staffel nach ' + basis + ')' })
      : el('div', { class: 'ladder__hint', text: 'Bester Staffelpreis erreicht (' + basis + ')' });
    $('ladder').replaceChildren(el('div', { class: 'ladder__row' }, steps), hint);

    // Fakten unter der Vorschau
    const sp = Object.values(r.eyeletSpacingBySide);
    const facts = [
      el('span', {}, ['Fläche ', el('b', { text: num(r.areaM2) + ' m²' }), r.billedAreaM2 !== r.areaM2 ? ' (berechnet ' + num(r.billedAreaM2) + ' m²)' : '']),
      el('span', {}, ['Ösen ', el('b', { text: String(r.eyeletCount) }), sp.length ? ' (Abstand ≈ ' + int(Math.min(...sp)) + (Math.max(...sp) - Math.min(...sp) >= 1 ? '–' + int(Math.max(...sp)) : '') + ' cm)' : '']),
      el('span', {}, ['Gewicht ', el('b', { text: num(r.weightKg / d.quantity, 2) + ' kg' }), ' je Stück']),
    ];
    $('facts').replaceChildren(...facts);
  }

  /** „Fläche 6,21 m² (Form 5,40 m² + 15 % Zuschnitt)“ bzw. einfach die Fläche. */
  function areaLabel(r) {
    if (r.billedAreaM2 === r.areaM2) return 'Fläche ' + num(r.areaM2) + ' m²';
    return 'Fläche ' + num(r.billedAreaM2) + ' m² (Form ' + num(r.areaM2) + ' m²' + (state.rules.shapePricing === 'bbox' ? ', umschließendes Rechteck)' : ' + ' + cat.shapeRules.surchargePct + ' % Zuschnitt)');
  }

  function renderFieldErrors(errors) {
    const se = errors.find((e) => e.field === 'shape');
    $('shape-error').textContent = se ? se.message : '';
    const map = { widthCm: 'width', topCm: 'top', heightCm: 'height', sideLeftCm: 'side-left', sideRightCm: 'side-right', quantity: 'quantity' };
    for (const [field, id] of Object.entries(map)) {
      const err = errors.find((e) => e.field === field);
      const show = err && (state.touched[id] || $(id).value !== '');
      $(id + '-error').textContent = show ? err.message : '';
      $(id).closest('.field').classList.toggle('is-invalid', !!show);
      $(id).setAttribute('aria-invalid', show ? 'true' : 'false');
    }
  }

  // ---------- Auftrag ----------
  function thumb(p) {
    const g = G.shapeGeometry(p);
    const ratio = g.error ? 1.4 : Math.max(0.5, Math.min(3, g.bboxWidthCm / g.bboxHeightCm));
    const bw = ratio >= 56 / 40 ? 52 : 36 * ratio, bh = ratio >= 56 / 40 ? 52 / ratio : 36;
    const verts = g.error ? [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] : g.vertices;
    // Eckpunkte auf das umschließende Rechteck bw × bh strecken, mittig im Bild
    const minX = Math.min(...verts.map((v) => v.x)), maxX = Math.max(...verts.map((v) => v.x)), maxY = Math.max(...verts.map((v) => v.y));
    const pts = verts.map((v) => ((56 - bw) / 2 + ((v.x - minX) / ((maxX - minX) || 1)) * bw).toFixed(1) + ',' + ((40 - bh) / 2 + (v.y / (maxY || 1)) * bh).toFixed(1)).join(' ');
    return svg('svg', { class: 'pos__thumb', viewBox: '0 0 56 40', 'aria-hidden': 'true' }, [
      svg('polygon', { points: pts, fill: colorHex(p.color), stroke: 'var(--muted)', 'stroke-width': 0.8, 'stroke-linejoin': 'round' }),
    ]);
  }

  function renderOrder() {
    const order = P.priceOrder(cat, state.positions, state.rules);
    const box = $('positions');
    if (!state.positions.length) {
      box.replaceChildren(el('div', { class: 'empty', text: 'Noch keine Positionen. Netz oben zusammenstellen und „Position hinzufügen“ wählen.' }));
    } else {
      box.replaceChildren(...order.lines.map(({ position: p, price: r }, i) => {
        const m = P.findMaterial(cat, p.material);
        const gsides = r.geometry.sides;
        const edges = gsides.map((s) => s.label[0] + ': ' + edgeShort(p.edges[s.code]));
        const sameEdges = new Set(gsides.map((s) => p.edges[s.code])).size === 1;
        return el('article', { class: 'pos' + (p.id === state.editingId ? ' is-editing' : '') }, [
          thumb(p),
          el('div', { class: 'pos__main' }, [
            el('div', { class: 'pos__name' }, [(i + 1) + '. ' + (p.name || m.name), p.example ? el('span', { class: 'pos__example', text: 'Beispiel' }) : null]),
            el('div', { class: 'pos__meta', text: m.name + ' ' + colorName(p.color) + ' · ' + dimsText(p) + ' · ' + num(r.areaM2) + ' m²' + (r.billedAreaM2 !== r.areaM2 ? ' (berechnet ' + num(r.billedAreaM2) + ' m²)' : '') }),
            el('div', { class: 'pos__meta', text: (sameEdges ? 'rundum ' + edgeShort(p.edges[gsides[0].code]) : edges.join(' · ')) + (r.eyeletCount ? ' · ' + r.eyeletCount + ' Ösen' : '') }),
          ]),
          el('div', { class: 'pos__price' }, [el('b', { text: eur.format(r.lineGross) }), el('small', { text: p.quantity + ' × ' + eur.format(r.unitGross) })]),
          el('div', { class: 'pos__actions' }, [
            el('button', { type: 'button', class: 'link-btn', text: 'Ändern', onclick: () => editPosition(p.id) }),
            el('button', { type: 'button', class: 'link-btn', text: 'Duplizieren', onclick: () => duplicatePosition(p.id) }),
            el('button', { type: 'button', class: 'link-btn', text: 'Entfernen', onclick: () => removePosition(p.id) }),
          ]),
        ]);
      }));
    }
    const pieces = state.positions.reduce((a, p) => a + p.quantity, 0);
    $('totals').replaceChildren(
      el('dt', { text: 'Fläche gesamt' }), el('dd', { text: num(order.totalAreaM2) + ' m² · ' + pieces + ' Stk' }),
      el('dt', { text: 'Versandgewicht' }), el('dd', { text: num(order.weightKg, 1) + ' kg' }),
      el('dt', { text: 'Netto' }), el('dd', { text: eur.format(order.totalNet) }),
      el('dt', { text: 'MwSt. ' + vatPct + ' %' }), el('dd', { text: eur.format(order.vat) }),
      el('dt', { class: 'grand', text: 'Gesamt' }), el('dd', { class: 'grand', text: eur.format(order.totalGross) }),
    );
  }

  function commitDraft() {
    const errors = P.validate(cat, state.draft);
    if (errors.length) { state.touched = { width: true, height: true, top: true, 'side-left': true, 'side-right': true, quantity: true }; update(); return; }
    const data = clone(state.draft);
    if (state.editingId) {
      const i = state.positions.findIndex((p) => p.id === state.editingId);
      if (i >= 0) state.positions[i] = Object.assign({ id: state.editingId }, data);
    } else {
      state.positions.push(Object.assign({ id: uid() }, data));
    }
    state.editingId = null;
    state.draft.name = '';
    save();
    update();
    $('positions').lastElementChild && $('positions').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  }

  function editPosition(id) {
    const p = state.positions.find((x) => x.id === id);
    if (!p) return;
    state.editingId = id;
    state.draft = normalizeDraft({
      shape: p.shape || 'RECT', material: p.material, color: p.color, widthCm: p.widthCm, heightCm: p.heightCm,
      topCm: p.topCm, sideLeftCm: p.sideLeftCm, sideRightCm: p.sideRightCm, slant: p.slant, rightAngle: p.rightAngle,
      quantity: p.quantity, edges: clone(p.edges), name: p.name || '',
    });
    state.edited = new Set(['topCm', 'sideLeftCm', 'sideRightCm']);
    if (!shapeSides().includes(state.activeSide)) state.activeSide = shapeSides()[0];
    renderShapes();
    renderMaterials();
    syncInputs();
    update();
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  function duplicatePosition(id) {
    const i = state.positions.findIndex((x) => x.id === id);
    if (i < 0) return;
    const copy = Object.assign(clone(state.positions[i]), { id: uid() });
    delete copy.example;
    state.positions.splice(i + 1, 0, copy);
    save(); update();
  }
  function removePosition(id) {
    state.positions = state.positions.filter((x) => x.id !== id);
    if (state.editingId === id) cancelEdit();
    save(); update();
  }
  function cancelEdit() {
    state.editingId = null;
    state.draft.name = '';
    syncInputs();
    update();
  }

  // ---------- PDF-Export ----------
  /** Legt das PDF auf dem Server ab (mit Zeitstempel) und löst dort die Mail an die Angebotsliste aus. */
  async function saveOnServer(pdf, positions, gross) {
    try {
      const fd = new FormData();
      fd.append('pdf', pdf.blob, pdf.filename);
      fd.append('positions', String(positions));
      fd.append('gross', String(gross));
      const res = await fetch('angebot.php', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) return 'PDF erstellt und gespeichert' + (data.mailed ? ', Angebot wurde per E-Mail gemeldet.' : ' (E-Mail konnte nicht gesendet werden).');
      return 'PDF erstellt, aber nicht auf dem Server gespeichert' + (data.error ? ': ' + data.error : '.');
    } catch (e) {
      return 'PDF erstellt, aber nicht auf dem Server gespeichert (keine Verbindung).';
    }
  }

  async function exportPdf() {
    const btn = $('pdf-btn'), status = $('pdf-status');
    const own = state.positions.filter((p) => !p.example);   // Beispielpositionen werden nicht gedruckt
    if (!own.length) { status.textContent = 'Bitte zuerst eigene Positionen anlegen. Die Beispiele werden nicht exportiert.'; status.classList.add('is-error'); return; }
    btn.disabled = true;
    status.classList.remove('is-error');
    status.textContent = 'PDF wird erstellt …';
    try {
      const order = P.priceOrder(cat, own, state.rules);
      const items = order.lines.map(({ position: p, price: r }, i) => {
        const m = P.findMaterial(cat, p.material);
        const color = m.colors.find((c) => c.code === p.color);
        const svgEl = buildPreview(p, { vw: 480, vh: 300, errors: [], interactive: false });
        const ey = P.eyelets(cat, p);
        const geo = r.geometry;
        return {
          nr: i + 1, title: p.name || m.name, svg: svgEl,
          material: m.name, color: colorName(p.color), sku: color && color.sku ? color.sku : '',
          dimsText: dimsText(p), areaM2: r.areaM2, billedAreaM2: r.billedAreaM2, areaNote: r.billedAreaM2 !== r.areaM2 ? areaLabel(r).replace(/^Fläche /, '') : '',
          shapeSurchargeNet: r.shapeSurchargeNet, quantity: p.quantity,
          table: geo.sides.map((s) => {
            const e = P.findEdge(cat, p.edges[s.code]);
            const eye = e.eyelets === 'spaced' ? (ey.interiorBySide[s.code] || 0) + ' + Ecken (ca. alle ' + int(ey.spacingBySide[s.code]) + ' cm)' : e.eyelets === 'corners' ? 'nur Ecken' : '–';
            return [s.label, s.lengthCm, e.short, eye];
          }),
          angles: geo.shape === 'RECT' ? null : geo.anglesDeg,
          eyelets: r.eyeletCount, unitNet: r.unitNet, unitGross: r.unitGross,
          lineNet: P.round2(r.lineGross / (1 + cat.vatRate)), lineGross: r.lineGross,
        };
      });
      const pieces = own.reduce((a, p) => a + p.quantity, 0);
      const pdf = await window.NetPdf.create({
        title: 'Angebotsanfrage', items,
        totals: { areaM2: order.totalAreaM2, pieces, weightKg: order.weightKg, net: order.totalNet, vat: order.vat, gross: order.totalGross },
        vatPct,
      });
      status.textContent = 'PDF erstellt, wird auf dem Server gespeichert …';
      status.textContent = await saveOnServer(pdf, items.length, order.totalGross);
    } catch (e) {
      console.error(e);
      status.classList.add('is-error');
      status.textContent = 'Das PDF konnte nicht erstellt werden.';
    } finally {
      btn.disabled = false;
    }
  }

  // ---------- Preisregeln ----------
  function syncRules() {
    $('tier-piece').checked = state.rules.tierBasis === 'piece';
    $('tier-order').checked = state.rules.tierBasis === 'order';
    $('edge-included').checked = state.rules.edgePricing === 'included';
    $('edge-proposed').checked = state.rules.edgePricing === 'proposed';
    $('acc').checked = !!state.rules.accessories;
    $('shape-area').checked = state.rules.shapePricing === 'area';
    $('shape-surcharge').checked = state.rules.shapePricing === 'area_surcharge';
    $('shape-bbox').checked = state.rules.shapePricing === 'bbox';
    $('shape-pct').textContent = cat.shapeRules.surchargePct;
  }

  // ---------- Ablauf ----------
  function update() {
    const errors = P.validate(cat, state.draft);
    renderColors();
    refreshSchemes();
    renderEdges();
    renderFieldErrors(errors);
    renderPreview(errors);
    renderPrice(errors);
    renderOrder();
    document.dispatchEvent(new Event('netcfg:update'));
  }

  // Schnittstelle für das Kontaktformular (contact.js): nur eigene Positionen, keine Beispiele.
  window.NetConfigurator = {
    getOrder() {
      const own = state.positions.filter((p) => !p.example);
      return own.length ? P.exportOrder(cat, own, state.rules) : null;
    },
  };

  function bind() {
    const onNum = (id, key) => {
      $(id).addEventListener('input', () => { state.draft[key] = readNumber(id); state.edited.add(key); update(); });
      $(id).addEventListener('focus', () => { state.focus = key; update(); });
      $(id).addEventListener('blur', () => { state.touched[id] = true; if (state.focus === key) state.focus = null; update(); });
    };
    onNum('width', 'widthCm');
    onNum('height', 'heightCm');
    onNum('top', 'topCm');
    onNum('side-left', 'sideLeftCm');
    onNum('side-right', 'sideRightCm');
    onNum('quantity', 'quantity');
    document.querySelectorAll('#orient [data-orient]').forEach((b) => b.addEventListener('click', () => {
      state.draft[shapeDef().inputs.includes('slant') ? 'slant' : 'rightAngle'] = b.dataset.orient;
      syncInputs(); update();
    }));
    $('pos-name').addEventListener('input', (e) => { state.draft.name = e.target.value; });
    document.querySelectorAll('.presets .chip').forEach((b) => b.addEventListener('click', () => {
      state.draft.widthCm = Number(b.dataset.w);
      state.draft.heightCm = Number(b.dataset.h);
      syncInputs(); update();
    }));
    $('edges-all').addEventListener('click', () => {
      const v = state.draft.edges[state.activeSide];
      for (const s of cat.sides.filter((x) => shapeSides().includes(x.code))) state.draft.edges[s.code] = v;
      update();
    });
    $('config-form').addEventListener('submit', (e) => { e.preventDefault(); commitDraft(); });
    $('add-btn').addEventListener('click', commitDraft);
    $('mb-add').addEventListener('click', commitDraft);
    $('cancel-btn').addEventListener('click', cancelEdit);
    $('pdf-btn').addEventListener('click', exportPdf);
    document.querySelectorAll('input[name="tierBasis"]').forEach((r) => r.addEventListener('change', () => { state.rules.tierBasis = r.value; save(); update(); }));
    document.querySelectorAll('input[name="edgePricing"]').forEach((r) => r.addEventListener('change', () => { state.rules.edgePricing = r.value; save(); update(); }));
    $('acc').addEventListener('change', (e) => { state.rules.accessories = e.target.checked; save(); update(); });
    document.querySelectorAll('input[name="shapePricing"]').forEach((r) => r.addEventListener('change', () => { state.rules.shapePricing = r.value; save(); update(); }));
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => renderPreview(P.validate(cat, state.draft)), 120); });

  $('vat-note').textContent = 'Beispielsortiment und -preise, inkl. ' + vatPct + ' % MwSt., zzgl. Versand';
  load();
  renderShapes();
  renderMaterials();
  syncInputs();
  syncRules();
  bind();
  update();
})();
