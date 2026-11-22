/* Kontaktformular: schickt die Anfrage (optional mit Positionen) an kontakt.php. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const form = $('contact-form');
  if (!form) return;

  const status = $('c-status');
  const setStatus = (text, isError) => { status.textContent = text; status.classList.toggle('is-error', !!isError); };
  const fieldIds = { name: 'c-name', email: 'c-email', message: 'c-message', consent: 'c-consent' };
  const showErrors = (errs) => {
    for (const [key, id] of Object.entries(fieldIds)) {
      const box = $(id + '-error');
      if (box) box.textContent = errs[key] || '';
      $(id).closest('.field') && $(id).closest('.field').classList.toggle('is-invalid', !!errs[key]);
    }
  };

  function syncOrderOption() {
    const order = window.NetConfigurator && window.NetConfigurator.getOrder();
    const n = order ? order.positions.length : 0;
    $('c-order').disabled = n === 0;
    if (n === 0) $('c-order').checked = false;
    $('c-order-label').textContent = n === 0
      ? 'Positionen mitsenden (zuerst im Konfigurator eigene Positionen anlegen)'
      : 'Meine ' + n + (n === 1 ? ' Position' : ' Positionen') + ' mitsenden';
  }
  document.addEventListener('netcfg:update', syncOrderOption);
  syncOrderOption();

  function validate(d) {
    const e = {};
    if (d.name.trim().length < 2) e.name = 'Bitte Ihren Namen angeben.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) e.email = 'Bitte eine gültige E-Mail-Adresse angeben.';
    if (d.message.trim().length < 10) e.message = 'Bitte eine kurze Nachricht schreiben (mindestens 10 Zeichen).';
    if (!d.consent) e.consent = 'Bitte der Verarbeitung Ihrer Angaben zustimmen.';
    return e;
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = {
      name: $('c-name').value, email: $('c-email').value, phone: $('c-phone').value,
      message: $('c-message').value, consent: $('c-consent').checked, website: $('c-website').value,
    };
    const errs = validate(d);
    showErrors(errs);
    if (Object.keys(errs).length) { setStatus('Bitte die markierten Felder prüfen.', true); return; }
    if ($('c-order').checked && window.NetConfigurator) d.order = window.NetConfigurator.getOrder();

    const btn = $('c-send');
    btn.disabled = true;
    setStatus('Wird gesendet …', false);
    try {
      const res = await fetch('kontakt.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        form.reset();
        showErrors({});
        syncOrderOption();
        setStatus('Danke, Ihre Anfrage ist angekommen.', false);
      } else {
        showErrors(data.fields || {});
        setStatus(data.error || 'Das Senden hat nicht geklappt. Bitte später erneut versuchen.', true);
      }
    } catch (e) {
      setStatus('Keine Verbindung. Bitte später erneut versuchen.', true);
    } finally {
      btn.disabled = false;
    }
  });
})();
