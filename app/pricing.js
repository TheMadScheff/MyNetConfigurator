/*
 * Preis- und Geometrielogik für Gaze nach Maß.
 * Reine Funktionen ohne DOM, damit sie im Browser, in Tests (Node) und später serverseitig
 * (z. B. als Python-Port in einem Odoo-Modul) identisch rechnen.
 *
 * Preisformel je Stück (netto):
 *   fläche_m2      = Fläche der Form (Rechteck: breite_cm × höhe_cm / 10 000; Trapez/Dreieck: Polygonfläche)
 *   berechnete Fläche = bei Trapez/Dreieck je nach Regel shapePricing: echte Fläche, mit Zuschlag oder umschließendes Rechteck
 *   m2_preis       = Staffelpreis(material, staffelfläche)   // staffelfläche = Stückfläche oder Auftragsfläche
 *   kanten         = Σ kantenlänge_m × aufpreis_lfm(kantenart)
 *   zubehör        = Ösen × Kabelbinder (optional)
 *   stück_netto    = fläche_m2 × m2_preis + kanten + zubehör
 *   stück_brutto   = rund2(stück_netto × (1 + MwSt.-Satz), derzeit 20 %)
 *   position       = stück_brutto × menge
 */
(function (root) {
  const G = typeof module !== 'undefined' && module.exports ? require('./geometry.js') : root.NetGeometry;
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  const DEFAULT_RULES = {
    tierBasis: 'piece',        // 'piece' = wie heute (Staffel je Stückfläche), 'order' = Summe gleicher Gaze im Auftrag
    edgePricing: 'included',   // 'included' = wie heute (Kante im m²-Preis), 'proposed' = Aufpreis je lfm
    accessories: false,        // Kabelbinder je Öse vorschlagen
    shapePricing: 'area_surcharge', // Trapez/Dreieck: 'area' = echte Fläche, 'area_surcharge' = + Zuschlag (shapeRules.surchargePct), 'bbox' = umschließendes Rechteck
  };

  function findMaterial(cat, code) {
    return cat.materials.find((m) => m.code === code) || null;
  }

  function findEdge(cat, code) {
    return cat.edges.find((e) => e.code === code) || null;
  }

  /** Seitenlänge eines Rechtecks. Für andere Formen: shapeGeometry(pos).sides. */
  function sideLengthCm(pos, side) {
    return side === 'top' || side === 'bottom' ? pos.widthCm : pos.heightCm;
  }

  /** Echte Fläche der Form in m² (NaN bei ungültigen Maßen, wie bisher beim Rechteck). */
  function areaM2(pos) {
    if (!pos.shape || pos.shape === 'RECT') return (pos.widthCm * pos.heightCm) / 10000;
    const g = G.shapeGeometry(pos);
    return g.error ? NaN : g.areaM2;
  }

  /** Berechnete Fläche: Rechteck = echte Fläche, Trapez/Dreieck nach Regel shapePricing. */
  function billedAreaM2(cat, pos, rules) {
    const area = areaM2(pos);
    if (!pos.shape || pos.shape === 'RECT') return area;
    const mode = Object.assign({}, DEFAULT_RULES, rules || {}).shapePricing;
    if (mode === 'bbox') {
      const g = G.shapeGeometry(pos);
      return g.error ? NaN : (g.bboxWidthCm * g.bboxHeightCm) / 10000;
    }
    if (mode === 'area') return area;
    return area * (1 + cat.shapeRules.surchargePct / 100);
  }

  /** Prüft eine Position. Liefert eine Liste {field, message}. */
  function validate(cat, pos) {
    const errors = [];
    const L = cat.limits;
    const code = G.shapeCode(pos);
    const shape = G.findShape(code);
    const mat = findMaterial(cat, pos.material);
    if (!mat) errors.push({ field: 'material', message: 'Bitte eine Gaze wählen.' });
    if (mat && !mat.colors.some((c) => c.code === pos.color)) {
      errors.push({ field: 'color', message: 'Diese Farbe gibt es für ' + mat.name + ' nicht.' });
    }
    const intOk = (v) => Number.isFinite(v) && Math.round(v) === v;
    if (!shape) {
      errors.push({ field: 'shape', message: 'Bitte eine Form wählen.' });
    } else if (code === 'RECT') {
      if (!intOk(pos.widthCm)) errors.push({ field: 'widthCm', message: 'Breite bitte in ganzen Zentimetern angeben.' });
      else if (pos.widthCm < L.minWidthCm) errors.push({ field: 'widthCm', message: 'Mindestens ' + L.minWidthCm + ' cm breit.' });
      else if (pos.widthCm > L.maxWidthCm) errors.push({ field: 'widthCm', message: 'Höchstens ' + L.maxWidthCm + ' cm breit.' });
      if (!intOk(pos.heightCm)) errors.push({ field: 'heightCm', message: 'Höhe bitte in ganzen Zentimetern angeben.' });
      else if (pos.heightCm < L.minHeightCm) errors.push({ field: 'heightCm', message: 'Mindestens ' + L.minHeightCm + ' cm hoch.' });
      else if (pos.heightCm > L.maxHeightCm) errors.push({ field: 'heightCm', message: 'Höchstens ' + L.maxHeightCm + ' cm hoch.' });
    } else {
      const names = { widthCm: 'Unterkante', topCm: 'Oberkante', heightCm: 'Höhe', sideLeftCm: 'Linke Seite', sideRightCm: 'Rechte Seite' };
      let inputsOk = true;
      for (const f of shape.inputs.filter((k) => names[k])) {
        if (!intOk(pos[f]) || pos[f] < 1) { errors.push({ field: f, message: names[f] + ' bitte in ganzen Zentimetern angeben.' }); inputsOk = false; }
      }
      if (inputsOk) {
        const g = G.shapeGeometry(pos);
        const R = cat.shapeRules;
        if (g.error === 'triangle') {
          errors.push({ field: 'shape', message: 'Diese drei Seiten ergeben kein Dreieck. Die längste Seite muss kürzer sein als die beiden anderen zusammen.' });
        } else if (g.error) {
          errors.push({ field: 'shape', message: 'Bitte die Maße prüfen.' });
        } else {
          const isTrapez = code.startsWith('TRAPEZ');
          if (isTrapez && pos.topCm < R.minTopCm) errors.push({ field: 'topCm', message: 'Für eine Spitze bitte Dreieck wählen.' });
          if (g.sides.some((s) => s.lengthExactCm < R.minSideCm)) errors.push({ field: 'shape', message: 'Jede Seite muss mindestens ' + R.minSideCm + ' cm lang sein.' });
          if (g.anglesDeg.some((a) => a < R.minAngleDeg)) errors.push({ field: 'shape', message: 'Die Spitze wird zu schmal (unter ' + R.minAngleDeg + '°). Bitte Maße anpassen.' });
          // Grenzen gelten für das umschließende Rechteck
          const wField = isTrapez && pos.topCm > pos.widthCm ? 'topCm' : 'widthCm';
          const hField = shape.inputs.includes('heightCm') ? 'heightCm' : 'shape';
          const bw = Math.round(g.bboxWidthCm * 10) / 10, bh = Math.round(g.bboxHeightCm * 10) / 10;
          if (bw < L.minWidthCm) errors.push({ field: wField, message: 'Die Form ist mindestens ' + L.minWidthCm + ' cm breit.' });
          else if (bw > L.maxWidthCm) errors.push({ field: wField, message: 'Die Form ist höchstens ' + L.maxWidthCm + ' cm breit.' });
          if (bh < L.minHeightCm) errors.push({ field: hField, message: 'Die Form ist mindestens ' + L.minHeightCm + ' cm hoch.' });
          else if (bh > L.maxHeightCm) errors.push({ field: hField, message: 'Die Form ist höchstens ' + L.maxHeightCm + ' cm hoch.' });
        }
      }
    }
    if (!intOk(pos.quantity) || pos.quantity < 1) errors.push({ field: 'quantity', message: 'Mindestens 1 Stück.' });
    else if (pos.quantity > 999) errors.push({ field: 'quantity', message: 'Höchstens 999 Stück je Position.' });
    for (const s of cat.sides.filter((x) => !shape || shape.sides.includes(x.code))) {
      if (!findEdge(cat, pos.edges && pos.edges[s.code])) {
        errors.push({ field: 'edge_' + s.code, message: 'Bitte Kante ' + s.label + ' wählen.' });
      }
    }
    return errors;
  }

  /**
   * Ösenpositionen in cm (Ursprung oben links) für jede Form. Ecken werden geöst, wenn eine der beiden
   * angrenzenden Kanten Ösen hat. „ca. alle 50 cm“ = gleichmäßig verteilt, Abstand ≤ 50 cm.
   * Jeder Punkt kennt seine Seiten (`sides`), damit die Vorschau ihn nach innen versetzen kann.
   */
  function eyelets(cat, pos) {
    const g = G.shapeGeometry(pos);
    const points = [];
    const spacingBySide = {};
    const interiorBySide = {};
    if (g.error) return { points, count: 0, spacingBySide, interiorBySide };
    const has = (side) => {
      const e = findEdge(cat, pos.edges[side]);
      return e && e.eyelets !== 'none';
    };
    const n = g.vertices.length;
    g.vertices.forEach((v, i) => {
      const sides = [g.sides[(i - 1 + n) % n].code, g.sides[i].code];
      if (sides.some(has)) points.push({ x: v.x, y: v.y, corner: true, sides });
    });
    for (const s of g.sides) {
      const e = findEdge(cat, pos.edges[s.code]);
      if (!e || e.eyelets !== 'spaced') continue;
      const L = s.lengthExactCm;
      const segments = Math.max(1, Math.ceil(L / e.eyeletSpacingCm - 1e-9));
      spacingBySide[s.code] = L / segments;
      interiorBySide[s.code] = segments - 1;
      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        points.push({ x: s.from.x + (s.to.x - s.from.x) * t, y: s.from.y + (s.to.y - s.from.y) * t, corner: false, sides: [s.code] });
      }
    }
    return { points, count: points.length, spacingBySide, interiorBySide };
  }

  /** Staffelstufe für eine Fläche, plus nächste Stufe (oder null). */
  function tierFor(mat, tierAreaM2) {
    let idx = 0;
    mat.tiers.forEach((t, i) => { if (tierAreaM2 >= t.fromM2 - 1e-9) idx = i; });
    return { tier: mat.tiers[idx], next: mat.tiers[idx + 1] || null, index: idx };
  }

  /** Bruttopreis je m² einer Stufe, wie im Shop angezeigt. */
  function grossPerM2(cat, netPerM2) {
    return round2(netPerM2 * (1 + cat.vatRate));
  }

  /** Rechnet eine Position. tierAreaM2 überschreibt die Staffelfläche (Auftragsstaffel). */
  function pricePosition(cat, pos, rules, tierAreaM2) {
    rules = Object.assign({}, DEFAULT_RULES, rules || {});
    const mat = findMaterial(cat, pos.material);
    const geo = G.shapeGeometry(pos);
    const area = areaM2(pos);                       // echte Fläche der Form
    const billed = billedAreaM2(cat, pos, rules);   // berechnete Fläche (bei Trapez/Dreieck evtl. mit Zuschlag)
    const tierArea = tierAreaM2 != null ? tierAreaM2 : billed;
    const t = tierFor(mat, tierArea);
    const materialNet = billed * t.tier.netPerM2;
    const shapeSurchargeNet = (billed - area) * t.tier.netPerM2;

    const edgeLines = geo.sides.map((s) => {
      const e = findEdge(cat, pos.edges[s.code]);
      const lengthM = s.lengthExactCm / 100;
      const rate = rules.edgePricing === 'proposed' ? e.proposedNetPerM : e.surchargeNetPerM;
      return { side: s.code, edge: e.code, lengthM, rateNetPerM: rate, net: lengthM * rate };
    });
    const edgeNet = edgeLines.reduce((a, l) => a + l.net, 0);

    const ey = eyelets(cat, pos);
    const accessoryLines = [];
    if (rules.accessories && ey.count > 0) {
      for (const acc of cat.accessories) {
        const qty = Math.ceil(ey.count * acc.perEyelet);
        accessoryLines.push({ code: acc.code, name: acc.name, quantity: qty, unitNet: acc.netPrice, net: qty * acc.netPrice });
      }
    }
    const accessoryNet = accessoryLines.reduce((a, l) => a + l.net, 0);

    const unitNet = materialNet + edgeNet + accessoryNet;
    const unitGross = round2(unitNet * (1 + cat.vatRate));
    const lineGross = round2(unitGross * pos.quantity);

    let toNextTierM2 = null;
    if (t.next) toNextTierM2 = Math.max(0, t.next.fromM2 - tierArea);

    return {
      areaM2: area,
      shapeAreaM2: area,
      billedAreaM2: billed,
      shapeSurchargeNet,
      geometry: geo,
      tierAreaM2: tierArea,
      tier: t.tier,
      tierIndex: t.index,
      nextTier: t.next,
      toNextTierM2,
      netPerM2: t.tier.netPerM2,
      grossPerM2: grossPerM2(cat, t.tier.netPerM2),
      materialNet,
      edgeLines,
      edgeNet,
      eyeletCount: ey.count,
      eyeletSpacingBySide: ey.spacingBySide,
      accessoryLines,
      accessoryNet,
      unitNet,
      unitGross,
      quantity: pos.quantity,
      lineGross,
      weightKg: (area * mat.weightGm2 * pos.quantity) / 1000,
    };
  }

  /** Rechnet alle Positionen eines Auftrags. */
  function priceOrder(cat, positions, rules) {
    rules = Object.assign({}, DEFAULT_RULES, rules || {});
    const valid = positions.filter((p) => validate(cat, p).length === 0);
    const areaByMaterial = {};
    for (const p of valid) areaByMaterial[p.material] = (areaByMaterial[p.material] || 0) + billedAreaM2(cat, p, rules) * p.quantity;
    const lines = valid.map((p) => ({
      position: p,
      price: pricePosition(cat, p, rules, rules.tierBasis === 'order' ? areaByMaterial[p.material] : null),
    }));
    const totalGross = round2(lines.reduce((a, l) => a + l.price.lineGross, 0));
    const totalNet = round2(totalGross / (1 + cat.vatRate));
    return {
      lines,
      totalGross,
      totalNet,
      vat: round2(totalGross - totalNet),
      weightKg: lines.reduce((a, l) => a + l.price.weightKg, 0),
      totalAreaM2: lines.reduce((a, l) => a + l.price.areaM2 * l.position.quantity, 0),
      areaByMaterial,
    };
  }

  /** Eingabemaße der Form plus Flächen und umschließendes Rechteck für den Export. */
  function dimensionsOf(p, r) {
    const shape = G.findShape(G.shapeCode(p));
    const d = {};
    for (const k of shape.inputs) d[k] = p[k] === undefined ? null : p[k];
    d.areaM2 = round2(r.shapeAreaM2);
    d.billedAreaM2 = round2(r.billedAreaM2);
    d.bboxWidthCm = Math.round(r.geometry.bboxWidthCm * 10) / 10;
    d.bboxHeightCm = Math.round(r.geometry.bboxHeightCm * 10) / 10;
    return d;
  }

  /** Export-Struktur für Phase 2 (Odoo). Nur Codes und Zahlen, keine Anzeigetexte als Schlüssel. */
  function exportOrder(cat, positions, rules) {
    const order = priceOrder(cat, positions, rules);
    return {
      schema: 'net-configurator/order@2',
      createdAt: new Date().toISOString(),
      currency: cat.currency,
      vatRate: cat.vatRate,
      rules: Object.assign({}, DEFAULT_RULES, rules || {}),
      positions: order.lines.map((l, i) => {
        const p = l.position, r = l.price, mat = findMaterial(cat, p.material);
        const color = mat.colors.find((c) => c.code === p.color);
        return {
          line: i + 1,
          name: p.name || null,
          product: { material: p.material, color: p.color, sku: color ? color.sku : null },
          shape: G.shapeCode(p),
          dimensions: dimensionsOf(p, r),
          geometry: {
            vertices: r.geometry.vertices.map((v) => [round2(v.x), round2(v.y)]),
            sides: r.geometry.sides.map((s) => ({ side: s.code, lengthCm: s.lengthCm, edge: p.edges[s.code] })),
          },
          edges: Object.fromEntries(r.geometry.sides.map((s) => [s.code, p.edges[s.code]])),
          eyelets: r.eyeletCount,
          accessories: r.accessoryLines.map((a) => ({ code: a.code, quantity: a.quantity })),
          quantity: p.quantity,
          price: {
            tierFromM2: r.tier.fromM2,
            netPerM2: r.netPerM2,
            unitNet: round2(r.unitNet),
            unitGross: r.unitGross,
            lineGross: r.lineGross,
          },
          weightKg: round2(r.weightKg),
        };
      }),
      totals: { net: order.totalNet, vat: order.vat, gross: order.totalGross, weightKg: round2(order.weightKg) },
    };
  }

  const api = { DEFAULT_RULES, round2, findMaterial, findEdge, areaM2, billedAreaM2, sideLengthCm, validate, eyelets, tierFor, grossPerM2, pricePosition, priceOrder, exportOrder };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NetPricing = api;
})(typeof window !== 'undefined' ? window : globalThis);
