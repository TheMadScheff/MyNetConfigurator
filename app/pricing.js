/*
 * Preis- und Geometrielogik für Gaze nach Maß.
 * Reine Funktionen ohne DOM, damit sie im Browser, in Tests (Node) und später serverseitig
 * (z. B. als Python-Port in einem Odoo-Modul) identisch rechnen.
 *
 * Preisformel je Stück (netto):
 *   fläche_m2      = breite_cm × höhe_cm / 10 000
 *   m2_preis       = Staffelpreis(material, staffelfläche)   // staffelfläche = Stückfläche oder Auftragsfläche
 *   kanten         = Σ kantenlänge_m × aufpreis_lfm(kantenart)
 *   zubehör        = Ösen × Kabelbinder (optional)
 *   stück_netto    = fläche_m2 × m2_preis + kanten + zubehör
 *   stück_brutto   = rund2(stück_netto × 1,19)
 *   position       = stück_brutto × menge
 */
(function (root) {
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  const DEFAULT_RULES = {
    tierBasis: 'piece',        // 'piece' = wie heute (Staffel je Stückfläche), 'order' = Summe gleicher Gaze im Auftrag
    edgePricing: 'included',   // 'included' = wie heute (Kante im m²-Preis), 'proposed' = Aufpreis je lfm
    accessories: false,        // Kabelbinder je Öse vorschlagen
  };

  function findMaterial(cat, code) {
    return cat.materials.find((m) => m.code === code) || null;
  }

  function findEdge(cat, code) {
    return cat.edges.find((e) => e.code === code) || null;
  }

  function sideLengthCm(pos, side) {
    return side === 'top' || side === 'bottom' ? pos.widthCm : pos.heightCm;
  }

  function areaM2(pos) {
    return (pos.widthCm * pos.heightCm) / 10000;
  }

  /** Prüft eine Position. Liefert eine Liste {field, message}. */
  function validate(cat, pos) {
    const errors = [];
    const L = cat.limits;
    const mat = findMaterial(cat, pos.material);
    if (!mat) errors.push({ field: 'material', message: 'Bitte eine Gaze wählen.' });
    if (mat && !mat.colors.some((c) => c.code === pos.color)) {
      errors.push({ field: 'color', message: 'Diese Farbe gibt es für ' + mat.name + ' nicht.' });
    }
    const intOk = (v) => Number.isFinite(v) && Math.round(v) === v;
    if (!intOk(pos.widthCm)) errors.push({ field: 'widthCm', message: 'Breite bitte in ganzen Zentimetern angeben.' });
    else if (pos.widthCm < L.minWidthCm) errors.push({ field: 'widthCm', message: 'Mindestens ' + L.minWidthCm + ' cm breit.' });
    else if (pos.widthCm > L.maxWidthCm) errors.push({ field: 'widthCm', message: 'Höchstens ' + L.maxWidthCm + ' cm breit.' });
    if (!intOk(pos.heightCm)) errors.push({ field: 'heightCm', message: 'Höhe bitte in ganzen Zentimetern angeben.' });
    else if (pos.heightCm < L.minHeightCm) errors.push({ field: 'heightCm', message: 'Mindestens ' + L.minHeightCm + ' cm hoch.' });
    else if (pos.heightCm > L.maxHeightCm) errors.push({ field: 'heightCm', message: 'Höchstens ' + L.maxHeightCm + ' cm hoch.' });
    if (!intOk(pos.quantity) || pos.quantity < 1) errors.push({ field: 'quantity', message: 'Mindestens 1 Stück.' });
    else if (pos.quantity > 999) errors.push({ field: 'quantity', message: 'Höchstens 999 Stück je Position.' });
    for (const s of cat.sides) {
      if (!findEdge(cat, pos.edges && pos.edges[s.code])) {
        errors.push({ field: 'edge_' + s.code, message: 'Bitte Kante ' + s.label + ' wählen.' });
      }
    }
    return errors;
  }

  /**
   * Ösenpositionen in cm (Ursprung oben links). Ecken werden geöst, wenn eine der beiden
   * angrenzenden Kanten Ösen hat. „ca. alle 50 cm“ = gleichmäßig verteilt, Abstand ≤ 50 cm.
   */
  function eyelets(cat, pos) {
    const W = pos.widthCm, H = pos.heightCm;
    const has = (side) => {
      const e = findEdge(cat, pos.edges[side]);
      return e && e.eyelets !== 'none';
    };
    const points = [];
    const spacingBySide = {};
    const corners = [
      { x: 0, y: 0, sides: ['top', 'left'] },
      { x: W, y: 0, sides: ['top', 'right'] },
      { x: W, y: H, sides: ['bottom', 'right'] },
      { x: 0, y: H, sides: ['bottom', 'left'] },
    ];
    for (const c of corners) if (c.sides.some(has)) points.push({ x: c.x, y: c.y, corner: true });

    const lines = {
      top: (t) => ({ x: t * W, y: 0 }),
      bottom: (t) => ({ x: t * W, y: H }),
      left: (t) => ({ x: 0, y: t * H }),
      right: (t) => ({ x: W, y: t * H }),
    };
    for (const side of Object.keys(lines)) {
      const e = findEdge(cat, pos.edges[side]);
      if (!e || e.eyelets !== 'spaced') continue;
      const L = sideLengthCm(pos, side);
      const segments = Math.max(1, Math.ceil(L / e.eyeletSpacingCm));
      spacingBySide[side] = L / segments;
      for (let i = 1; i < segments; i++) points.push(Object.assign(lines[side](i / segments), { corner: false }));
    }
    return { points, count: points.length, spacingBySide };
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
    const area = areaM2(pos);
    const tierArea = tierAreaM2 != null ? tierAreaM2 : area;
    const t = tierFor(mat, tierArea);
    const materialNet = area * t.tier.netPerM2;

    const edgeLines = cat.sides.map((s) => {
      const e = findEdge(cat, pos.edges[s.code]);
      const lengthM = sideLengthCm(pos, s.code) / 100;
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
    for (const p of valid) areaByMaterial[p.material] = (areaByMaterial[p.material] || 0) + areaM2(p) * p.quantity;
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

  /** Export-Struktur für Phase 2 (Odoo). Nur Codes und Zahlen, keine Anzeigetexte als Schlüssel. */
  function exportOrder(cat, positions, rules) {
    const order = priceOrder(cat, positions, rules);
    return {
      schema: 'net-configurator/order@1',
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
          dimensions: { widthCm: p.widthCm, heightCm: p.heightCm, areaM2: round2(r.areaM2) },
          edges: Object.assign({}, p.edges),
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

  const api = { DEFAULT_RULES, round2, findMaterial, findEdge, areaM2, sideLengthCm, validate, eyelets, tierFor, grossPerM2, pricePosition, priceOrder, exportOrder };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NetPricing = api;
})(typeof window !== 'undefined' ? window : globalThis);
