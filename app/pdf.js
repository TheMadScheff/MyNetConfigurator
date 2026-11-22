/* PDF-Export "Angebotsanfrage": je Konfiguration ein Abschnitt mit Vorschau-Bild und Daten. Nutzt jsPDF (vendor/). */
(function () {
  'use strict';

  const fmt = (n, d = 2) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n).replace(/[  ]/g, ' ');
  const eur = (n) => fmt(n) + ' €';

  /** SVG-Element → PNG (Data-URL). Farbvariablen und Klassenstile werden fest eingesetzt, weil das Bild außerhalb der Seite gerendert wird. */
  function svgToPng(svgEl, scale) {
    const cs = getComputedStyle(document.documentElement);
    const vars = (str) => str.replace(/var\((--[\w-]+)\)/g, (_, name) => (cs.getPropertyValue(name).trim() || '#777'));
    const vb = svgEl.getAttribute('viewBox').split(/\s+/).map(Number);
    const w = vb[2], h = vb[3];
    const clone = svgEl.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', w);
    clone.setAttribute('height', h);
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = '.dimtext{font:600 16px Arial,Helvetica,sans-serif;fill:#242424}.dimline{stroke:#6e6e6e;stroke-width:1.2}.edge-tag{font:500 12.5px Arial,Helvetica,sans-serif;fill:#555}';
    clone.insertBefore(style, clone.firstChild);
    const xml = vars(new XMLSerializer().serializeToString(clone));
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = w * scale; c.height = h * scale;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve({ url: c.toDataURL('image/jpeg', 0.88), w, h });
      };
      img.onerror = () => reject(new Error('Vorschau konnte nicht gezeichnet werden'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
    });
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        resolve({ url: c.toDataURL('image/jpeg', 0.92), w: img.naturalWidth, h: img.naturalHeight });
      };
      img.onerror = () => resolve(null); // Logo ist optional
      img.src = src;
    });
  }

  async function create(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const PW = 210, PH = 297, ML = 15, MR = 15, MT = 15, MB = 28;
    const INK = [36, 36, 36], MUTED = [110, 110, 110], GREEN = [38, 90, 15], LINE = [225, 227, 220];
    const setText = (rgb) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);

    const [logo, ...shots] = await Promise.all([loadImage('logo.jpg'), ...data.items.map((it) => svgToPng(it.svg, 2))]);

    // Kopf
    if (logo) { const lw = 52; doc.addImage(logo.url, 'JPEG', PW - MR - lw, MT, lw, lw * logo.h / logo.w); }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(22); setText(GREEN);
    doc.text(data.title, ML, MT + 9);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); setText(MUTED);
    doc.text('Erstellt am ' + new Date().toLocaleDateString('de-DE') + ' · Netze nach Maß, Konfigurator (Prototyp)', ML, MT + 16);
    doc.setDrawColor(...LINE); doc.line(ML, MT + 21, PW - MR, MT + 21);
    let y = MT + 28;

    // Konfigurationen
    const TOTALS_H = 44, IMG_W = 95, TX = ML + IMG_W + 6, TW = PW - MR - TX;
    data.items.forEach((it, i) => {
      const shot = shots[i];
      const imgH = IMG_W * shot.h / shot.w;
      const blockH = imgH + 8;
      // Die letzte Position wandert mit den Summen auf eine neue Seite, damit die Summen nie allein stehen.
      const needed = blockH + (i === data.items.length - 1 ? TOTALS_H : 0);
      if (y + needed > PH - MB) { doc.addPage(); y = MT; }

      doc.addImage(shot.url, 'JPEG', ML, y, IMG_W, imgH);
      doc.setDrawColor(...LINE); doc.rect(ML, y, IMG_W, imgH);

      let ty = y + 5;
      const line = (text, opts = {}) => {
        doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
        doc.setFontSize(opts.size || 10);
        setText(opts.color || INK);
        for (const l of doc.splitTextToSize(text, TW)) { doc.text(l, TX, ty); ty += (opts.size || 10) * 0.5; }
        ty += opts.gap || 0.8;
      };
      line(it.nr + '. ' + it.title, { bold: true, size: 12, gap: 1.5 });
      line(it.material + ', ' + it.color + (it.sku ? ' (Art.-Nr. ' + it.sku + ')' : ''));
      line(fmt(it.widthCm, 0) + ' × ' + fmt(it.heightCm, 0) + ' cm · ' + fmt(it.areaM2) + ' m²');
      line('Menge: ' + it.quantity + ' Stück', { gap: 1.5 });
      const same = new Set(it.edges.map((e) => e[1])).size === 1;
      if (same) line('Kanten: rundum ' + it.edges[0][1]);
      else { line('Kanten:', { gap: 0 }); for (const [side, e] of it.edges) line('   ' + side + ': ' + e, { color: MUTED, gap: 0 }); ty += 0.8; }
      if (it.eyelets) line('Ösen: ' + it.eyelets);
      ty += 1.5;
      line('Einzelpreis: ' + eur(it.unitNet) + ' netto · ' + eur(it.unitGross) + ' brutto', { color: MUTED });
      line('Summe: ' + eur(it.lineNet) + ' netto', { gap: 0.2 });
      line(eur(it.lineGross) + ' brutto', { bold: true, size: 11 });

      y += Math.max(imgH, ty - y) + 6;
      if (i < data.items.length - 1) { doc.setDrawColor(...LINE); doc.line(ML, y - 3, PW - MR, y - 3); }
    });

    // Summen
    const rows = [
      ['Fläche gesamt', fmt(data.totals.areaM2) + ' m² · ' + data.totals.pieces + ' Stück'],
      ['Versandgewicht', fmt(data.totals.weightKg, 1) + ' kg'],
      ['Netto', eur(data.totals.net)],
      ['MwSt. ' + data.vatPct + ' %', eur(data.totals.vat)],
    ];
    if (y + TOTALS_H - 10 > PH - MB) { doc.addPage(); y = MT; }
    y += 2;
    const X1 = 120, X2 = PW - MR;
    doc.setFontSize(10);
    for (const [k, v] of rows) {
      doc.setFont('helvetica', 'normal'); setText(MUTED); doc.text(k, X1, y);
      setText(INK); doc.text(v, X2, y, { align: 'right' }); y += 6;
    }
    doc.setDrawColor(...INK); doc.line(X1, y - 3.5, X2, y - 3.5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); setText(GREEN);
    doc.text('Gesamt brutto', X1, y + 2); doc.text(eur(data.totals.gross), X2, y + 2, { align: 'right' });

    // Fußzeile mit Seitenzahl
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setText(MUTED);
      doc.setDrawColor(...LINE); doc.line(ML, PH - 22, PW - MR, PH - 22);
      doc.setFont('helvetica', 'bold'); setText(INK);
      doc.text('Agroflor Kunststoff GmbH', ML, PH - 17);
      doc.setFont('helvetica', 'normal'); setText(MUTED);
      doc.text('Fattweg 6 · A-6922 Wolfurt · Tel. +43 5576 25313 · office@agroflor.at · www.agro-flor.com', ML, PH - 13);
      doc.text('Beispielsortiment und -preise, inkl. ' + data.vatPct + ' % MwSt., zzgl. Versand, unverbindlich.', ML, PH - 9);
      doc.text('Seite ' + p + ' von ' + pages, PW - MR, PH - 9, { align: 'right' });
    }

    doc.setProperties({ title: data.title });
    const filename = 'Angebotsanfrage-' + new Date().toISOString().slice(0, 10) + '.pdf';
    const blob = doc.output('blob');
    doc.save(filename);
    return { blob, filename };
  }

  window.NetPdf = { create };
})();
