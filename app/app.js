/* Oberfläche des Gaze-Konfigurators. Rechnet ausschließlich über NetPricing (pricing.js). */
(function () {
  'use strict';
  const cat = window.NetCatalog;
  const P = window.NetPricing;
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
  };

  function newDraft() {
    const d = clone(cat.defaults);
    return { material: d.material, color: d.color, widthCm: d.widthCm, heightCm: d.heightCm, quantity: d.quantity, edges: d.edges, name: '' };
  }

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
    let a = P.areaM2(d) * (d.quantity || 1);
    for (const p of state.positions) if (p.id !== state.editingId && p.material === d.material) a += P.areaM2(p) * p.quantity;
    return a;
  }

  // ---------- Formular ----------
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
    for (const s of cat.sides) {
      const sel = el('select', {
        id: 'edge-' + s.code, 'aria-label': 'Kante ' + s.label,
        onchange: (ev) => { state.draft.edges[s.code] = ev.target.value; setActiveSide(s.code, false); update(); },
        onfocus: () => setActiveSide(s.code, false),
      }, cat.edges.map((e) => el('option', { value: e.code, text: e.short, title: e.label })));
      sel.value = state.draft.edges[s.code];
      const lenM = P.sideLengthCm(state.draft, s.code) / 100;
      box.append(el('label', { class: 'edge' + (state.activeSide === s.code ? ' is-active' : ''), for: 'edge-' + s.code, 'data-side': s.code }, [
        el('span', { class: 'edge__label' }, [el('span', { text: s.label }), el('span', { text: Number.isFinite(lenM) ? num(lenM) + ' m' : '' })]),
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
    $('quantity').value = Number.isFinite(d.quantity) ? d.quantity : '';
    $('pos-name').value = d.name || '';
    const L = cat.limits;
    $('limits-hint').textContent = 'Möglich: ' + int(L.minWidthCm) + '–' + int(L.maxWidthCm) + ' cm breit, ' + int(L.minHeightCm) + '–' + int(L.maxHeightCm) + ' cm hoch. Maßtoleranz ±5 %.';
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

  /** Baut die SVG-Vorschau für eine Konfiguration. o.interactive: klickbare Kanten (Bildschirm), sonst statisch (PDF). */
  function buildPreview(d, o) {
    const errors = o.errors || [];
    const narrow = !!o.narrow;
    const VW = o.vw || (narrow ? 400 : 720), VH = o.vh || (narrow ? 320 : 430);
    const M = { t: 34, r: 78, b: 64, l: 34 };
    const W = Number.isFinite(d.widthCm) && d.widthCm > 0 ? d.widthCm : 100;
    const H = Number.isFinite(d.heightCm) && d.heightCm > 0 ? d.heightCm : 100;
    const availW = VW - M.l - M.r, availH = VH - M.t - M.b;

    // Seitenverhältnis begrenzen, damit sehr lange Netze lesbar bleiben
    let ratio = W / H, squeezed = false;
    if (ratio > 7) { ratio = 7; squeezed = true; }
    if (ratio < 1 / 3) { ratio = 1 / 3; squeezed = true; }
    let dw = availW, dh = dw / ratio;
    if (dh > availH) { dh = availH; dw = dh * ratio; }
    const x0 = M.l + (availW - dw) / 2, y0 = M.t + (availH - dh) / 2, x1 = x0 + dw, y1 = y0 + dh;
    const sx = dw / W, sy = dh / H;

    const m = P.findMaterial(cat, d.material);
    const hex = colorHex(d.color);
    const light = luminance(hex) > 0.75;
    const thread = light ? shade(hex, 0.86) : hex;
    const cell = 5 + m.openness * 14;

    const root = svg('svg', { viewBox: `0 0 ${VW} ${VH}`, role: 'img', 'aria-label': `Vorschau ${m.name} ${colorName(d.color)}, ${int(W)} × ${int(H)} cm` });
    const defs = svg('defs', {}, [
      svg('pattern', { id: 'mesh', width: cell, height: cell, patternUnits: 'userSpaceOnUse' }, [
        svg('rect', { width: cell, height: cell, fill: hex, 'fill-opacity': (0.92 - m.openness).toFixed(2) }),
        svg('path', { d: `M0 0H${cell}M0 0V${cell}`, stroke: thread, 'stroke-width': 1.4, fill: 'none' }),
      ]),
      svg('pattern', { id: 'grid', width: 24, height: 24, patternUnits: 'userSpaceOnUse' }, [
        svg('path', { d: 'M24 0H0V24', stroke: 'var(--grid)', 'stroke-width': 1, fill: 'none' }),
      ]),
    ]);
    root.append(defs, svg('rect', { x: 0, y: 0, width: VW, height: VH, fill: 'url(#grid)' }));

    // Netzfläche
    root.append(svg('rect', { x: x0, y: y0, width: dw, height: dh, fill: 'url(#mesh)' }));

    // Kanten: Saum, Hohlsaum, Schnittkante
    const sideGeom = {
      top: { a: [x0, y0], b: [x1, y0], n: [0, 1], scale: sy },
      bottom: { a: [x0, y1], b: [x1, y1], n: [0, -1], scale: sy },
      left: { a: [x0, y0], b: [x0, y1], n: [1, 0], scale: sx },
      right: { a: [x1, y0], b: [x1, y1], n: [-1, 0], scale: sx },
    };
    const hemColor = light ? shade(hex, 0.8) : shade(hex, 1.25);
    for (const s of cat.sides) {
      const e = P.findEdge(cat, d.edges[s.code]);
      const g = sideGeom[s.code];
      if (!e) continue;
      if (!e.hem) {
        root.append(svg('line', { x1: g.a[0], y1: g.a[1], x2: g.b[0], y2: g.b[1], stroke: 'var(--muted)', 'stroke-width': 1.2, 'stroke-dasharray': '2 3' }));
        continue;
      }
      const band = e.tunnelCm ? Math.max(8, Math.min(22, e.tunnelCm * g.scale)) : Math.max(4, Math.min(10, 3 * g.scale));
      const off = band / 2;
      const ax = g.a[0] + g.n[0] * off, ay = g.a[1] + g.n[1] * off, bx = g.b[0] + g.n[0] * off, by = g.b[1] + g.n[1] * off;
      root.append(svg('line', { x1: ax, y1: ay, x2: bx, y2: by, stroke: e.tunnelCm ? hemColor : hex, 'stroke-width': band }));
      // Naht
      const so = e.tunnelCm ? band - 1.5 : band - 1;
      root.append(svg('line', {
        x1: g.a[0] + g.n[0] * so, y1: g.a[1] + g.n[1] * so, x2: g.b[0] + g.n[0] * so, y2: g.b[1] + g.n[1] * so,
        stroke: light ? shade(hex, 0.6) : shade(hex, 1.9), 'stroke-width': 0.9, 'stroke-dasharray': '3 2',
      }));
      if (e.tunnelCm) {
        root.append(svg('text', {
          x: (ax + bx) / 2, y: (ay + by) / 2, class: 'edge-tag', 'text-anchor': 'middle', 'dominant-baseline': 'central',
          transform: s.code === 'left' || s.code === 'right' ? `rotate(-90 ${(ax + bx) / 2} ${(ay + by) / 2})` : null,
          style: `fill:${light ? '#333' : '#eee'}; font-size:10px`,
        }, 'Hohlsaum ' + e.tunnelCm + ' cm'));
      }
    }
    root.append(svg('rect', { x: x0, y: y0, width: dw, height: dh, fill: 'none', stroke: 'var(--muted)', 'stroke-opacity': 0.5, 'stroke-width': 1 }));

    // Ösen
    if (!errors.some((e) => e.field === 'widthCm' || e.field === 'heightCm')) {
      const ey = P.eyelets(cat, d);
      const r = Math.max(3.2, Math.min(6, 1.6 * Math.min(sx, sy)));
      const inset = Math.max(3, Math.min(7, 2.5 * Math.min(sx, sy)));
      for (const p of ey.points) {
        const cx = x0 + p.x * sx + (p.x === 0 ? inset : p.x === W ? -inset : 0);
        const cy = y0 + p.y * sy + (p.y === 0 ? inset : p.y === H ? -inset : 0);
        root.append(svg('circle', { cx, cy, r, fill: 'var(--eyelet)' }), svg('circle', { cx, cy, r: r * 0.45, fill: 'var(--canvas)' }));
      }
    }

    // Maßlinien
    const dimY = y1 + 22, dimX = x1 + 20;
    root.append(
      svg('line', { x1: x0, y1: dimY, x2: x1, y2: dimY, class: 'dimline' }),
      svg('line', { x1: x0, y1: dimY - 5, x2: x0, y2: dimY + 5, class: 'dimline' }),
      svg('line', { x1: x1, y1: dimY - 5, x2: x1, y2: dimY + 5, class: 'dimline' }),
      svg('text', { x: (x0 + x1) / 2, y: dimY - 6, class: 'dimtext', 'text-anchor': 'middle' }, int(W) + ' cm'),
      svg('line', { x1: dimX, y1: y0, x2: dimX, y2: y1, class: 'dimline' }),
      svg('line', { x1: dimX - 5, y1: y0, x2: dimX + 5, y2: y0, class: 'dimline' }),
      svg('line', { x1: dimX - 5, y1: y1, x2: dimX + 5, y2: y1, class: 'dimline' }),
      svg('text', { x: dimX + 8, y: (y0 + y1) / 2, class: 'dimtext', 'text-anchor': 'middle', transform: `rotate(90 ${dimX + 8} ${(y0 + y1) / 2})` }, int(H) + ' cm'),
    );

    // Klickbare Kanten mit Beschriftung
    const tagPos = {
      top: { x: (x0 + x1) / 2, y: y0 - 10, rot: 0 },
      bottom: { x: (x0 + x1) / 2, y: dimY + 22, rot: 0 },
      left: { x: x0 - 12, y: (y0 + y1) / 2, rot: -90 },
      right: { x: dimX + 34, y: (y0 + y1) / 2, rot: 90 },
    };
    for (const s of cat.sides) {
      const g = sideGeom[s.code];
      const t = tagPos[s.code];
      const label = s.label + ': ' + edgeShort(d.edges[s.code]);
      const hit = svg('g', o.interactive ? {
        class: 'edge-hit' + (state.activeSide === s.code ? ' is-active' : ''), tabindex: 0, role: 'button',
        'aria-label': 'Kante ' + label + ' ändern', 'data-side': s.code,
      } : { class: 'edge-hit' }, [
        svg('line', { class: 'edge-glow', x1: g.a[0], y1: g.a[1], x2: g.b[0], y2: g.b[1], stroke: 'transparent', 'stroke-width': 10, 'stroke-linecap': 'round' }),
        svg('text', { class: 'edge-tag', x: t.x, y: t.y, 'text-anchor': 'middle', 'dominant-baseline': 'central', transform: t.rot ? `rotate(${t.rot} ${t.x} ${t.y})` : null }, label),
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
    host.replaceChildren(buildPreview(state.draft, { narrow, errors, interactive: true }));
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
      ['Fläche ' + num(r.areaM2) + ' m² × ' + eur.format(r.grossPerM2) + '/m²', eur.format(r.materialNet * vat)],
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
      el('span', {}, ['Fläche ', el('b', { text: num(r.areaM2) + ' m²' })]),
      el('span', {}, ['Ösen ', el('b', { text: String(r.eyeletCount) }), sp.length ? ' (Abstand ≈ ' + int(Math.min(...sp)) + (Math.max(...sp) - Math.min(...sp) >= 1 ? '–' + int(Math.max(...sp)) : '') + ' cm)' : '']),
      el('span', {}, ['Gewicht ', el('b', { text: num(r.weightKg / d.quantity, 2) + ' kg' }), ' je Stück']),
    ];
    $('facts').replaceChildren(...facts);
  }

  function renderFieldErrors(errors) {
    const map = { widthCm: 'width', heightCm: 'height', quantity: 'quantity' };
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
    const ratio = Math.max(0.5, Math.min(3, p.widthCm / p.heightCm));
    const w = ratio >= 56 / 40 ? 52 : 36 * ratio, h = ratio >= 56 / 40 ? 52 / ratio : 36;
    const s = svg('svg', { class: 'pos__thumb', viewBox: '0 0 56 40', 'aria-hidden': 'true' }, [
      svg('rect', { x: (56 - w) / 2, y: (40 - h) / 2, width: w, height: h, fill: colorHex(p.color), stroke: 'var(--muted)', 'stroke-width': 0.8 }),
    ]);
    return s;
  }

  function renderOrder() {
    const order = P.priceOrder(cat, state.positions, state.rules);
    const box = $('positions');
    if (!state.positions.length) {
      box.replaceChildren(el('div', { class: 'empty', text: 'Noch keine Positionen. Netz oben zusammenstellen und „Position hinzufügen“ wählen.' }));
    } else {
      box.replaceChildren(...order.lines.map(({ position: p, price: r }, i) => {
        const m = P.findMaterial(cat, p.material);
        const edges = cat.sides.map((s) => s.label[0] + ': ' + edgeShort(p.edges[s.code]));
        const sameEdges = new Set(Object.values(p.edges)).size === 1;
        return el('article', { class: 'pos' + (p.id === state.editingId ? ' is-editing' : '') }, [
          thumb(p),
          el('div', { class: 'pos__main' }, [
            el('div', { class: 'pos__name' }, [(i + 1) + '. ' + (p.name || m.name), p.example ? el('span', { class: 'pos__example', text: 'Beispiel' }) : null]),
            el('div', { class: 'pos__meta', text: m.name + ' ' + colorName(p.color) + ' · ' + int(p.widthCm) + ' × ' + int(p.heightCm) + ' cm · ' + num(r.areaM2) + ' m²' }),
            el('div', { class: 'pos__meta', text: (sameEdges ? 'rundum ' + edgeShort(p.edges.top) : edges.join(' · ')) + (r.eyeletCount ? ' · ' + r.eyeletCount + ' Ösen' : '') }),
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
    if (errors.length) { state.touched = { width: true, height: true, quantity: true }; update(); return; }
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
    state.draft = { material: p.material, color: p.color, widthCm: p.widthCm, heightCm: p.heightCm, quantity: p.quantity, edges: clone(p.edges), name: p.name || '' };
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
        return {
          nr: i + 1, title: p.name || m.name, svg: svgEl,
          material: m.name, color: colorName(p.color), sku: color && color.sku ? color.sku : '',
          widthCm: p.widthCm, heightCm: p.heightCm, areaM2: r.areaM2, quantity: p.quantity,
          edges: cat.sides.map((sd) => [sd.label, edgeShort(p.edges[sd.code])]),
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
      $(id).addEventListener('input', () => { state.draft[key] = readNumber(id); update(); });
      $(id).addEventListener('blur', () => { state.touched[id] = true; update(); });
    };
    onNum('width', 'widthCm');
    onNum('height', 'heightCm');
    onNum('quantity', 'quantity');
    $('pos-name').addEventListener('input', (e) => { state.draft.name = e.target.value; });
    document.querySelectorAll('.presets .chip').forEach((b) => b.addEventListener('click', () => {
      state.draft.widthCm = Number(b.dataset.w);
      state.draft.heightCm = Number(b.dataset.h);
      syncInputs(); update();
    }));
    $('edges-all').addEventListener('click', () => {
      const v = state.draft.edges[state.activeSide];
      for (const s of cat.sides) state.draft.edges[s.code] = v;
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
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => renderPreview(P.validate(cat, state.draft)), 120); });

  $('vat-note').textContent = 'Beispielsortiment und -preise, inkl. ' + vatPct + ' % MwSt., zzgl. Versand';
  load();
  renderMaterials();
  syncInputs();
  syncRules();
  bind();
  update();
})();
