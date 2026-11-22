<?php
// Nimmt die Anfrage aus dem Kontaktformular entgegen und schickt sie per E-Mail.
// Empfänger und Absender stehen in kontakt.config.php (nicht im Git, siehe kontakt.config.example.php).
declare(strict_types=1);

require __DIR__ . '/_common.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { header('Allow: POST'); fail(405, 'Nur POST erlaubt.'); }

$config = load_config();

$raw = file_get_contents('php://input', false, null, 0, 262145);
if ($raw === false || strlen($raw) > 262144) fail(413, 'Die Anfrage ist zu groß.');
$in = json_decode($raw, true);
if (!is_array($in)) fail(400, 'Ungültige Anfrage.');

// Honeypot: Bots füllen das versteckte Feld aus. Sie bekommen "ok", damit sie nichts lernen.
if (clean($in['website'] ?? '', 200) !== '') respond(200, ['ok' => true]);

$name    = clean($in['name'] ?? '', 100);
$email   = clean($in['email'] ?? '', 200);
$phone   = clean($in['phone'] ?? '', 50);
$message = clean($in['message'] ?? '', 5000, true);

$errors = [];
if (mb_strlen($name) < 2) $errors['name'] = 'Bitte Ihren Namen angeben.';
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors['email'] = 'Bitte eine gültige E-Mail-Adresse angeben.';
if (mb_strlen($message) < 10) $errors['message'] = 'Bitte eine kurze Nachricht schreiben (mindestens 10 Zeichen).';
if (($in['consent'] ?? false) !== true) $errors['consent'] = 'Bitte der Verarbeitung Ihrer Angaben zustimmen.';
if ($errors) respond(422, ['ok' => false, 'error' => 'Bitte die markierten Felder prüfen.', 'fields' => $errors]);

// Einfache Bremse: eine Anfrage je IP und 30 Sekunden.
$stamp = rate_limit('kontakt', 30);

// Positionen aus dem Konfigurator (optional), nur als Text und mit begrenzter Länge.
$lines = [];
$shapeNames = ['RECT' => 'Rechteck', 'TRAPEZ_SYM' => 'Trapez, gleichschenklig', 'TRAPEZ_RECHT' => 'Trapez, eine Seite senkrecht', 'DREIECK_RECHT' => 'Dreieck, rechtwinklig', 'DREIECK_FREI' => 'Dreieck, drei Seiten'];
$sideNames = ['top' => 'Oben', 'right' => 'Rechts', 'bottom' => 'Unten', 'left' => 'Links'];
$order = $in['order'] ?? null;
if (is_array($order) && is_array($order['positions'] ?? null)) {
    foreach (array_slice($order['positions'], 0, 50) as $i => $p) {
        if (!is_array($p)) continue;
        $prod = is_array($p['product'] ?? null) ? $p['product'] : [];
        $dim  = is_array($p['dimensions'] ?? null) ? $p['dimensions'] : [];
        $pr   = is_array($p['price'] ?? null) ? $p['price'] : [];
        $title = clean($p['name'] ?? '', 60);
        $sku = clean($prod['sku'] ?? '', 40);
        $lines[] = sprintf('%d. %s', $i + 1, $title !== '' ? $title : 'Position');
        $lines[] = sprintf('   %s, %s%s', clean($prod['material'] ?? '', 40), clean($prod['color'] ?? '', 40), $sku !== '' ? ' (Art.-Nr. ' . $sku . ')' : '');
        $shape = clean($p['shape'] ?? 'RECT', 20);
        $lines[] = '   Form: ' . ($shapeNames[$shape] ?? $shape) . sprintf(', %d Stück', (int) ($p['quantity'] ?? 0));
        $area = clean($dim['areaM2'] ?? '', 10);
        $billed = clean($dim['billedAreaM2'] ?? '', 10);
        $lines[] = sprintf('   Fläche: %s m²%s', str_replace('.', ',', $area), ($billed !== '' && $billed !== $area) ? ', berechnet ' . str_replace('.', ',', $billed) . ' m²' : '');
        $geoSides = is_array($p['geometry']['sides'] ?? null) ? $p['geometry']['sides'] : [];
        if ($geoSides) {
            foreach (array_slice($geoSides, 0, 4) as $gs) {
                if (!is_array($gs)) continue;
                $code = clean($gs['side'] ?? '', 10);
                $lines[] = sprintf('   %s: %s cm, %s', $sideNames[$code] ?? $code, str_replace('.', ',', clean($gs['lengthCm'] ?? '', 10)), clean($gs['edge'] ?? '', 30));
            }
        } else {
            $lines[] = sprintf('   %s × %s cm', clean($dim['widthCm'] ?? '', 10), clean($dim['heightCm'] ?? '', 10));
        }
        $eo = is_array($p['eyeletOptions'] ?? null) ? $p['eyeletOptions'] : [];
        $eoParts = [];
        if (clean($eo['material'] ?? '', 20) === 'EDELSTAHL') $eoParts[] = 'Edelstahl-Ösen';
        if (!empty($eo['aligned'])) $eoParts[] = 'Ösen deckungsgleich';
        if (is_numeric($eo['spacingCm'] ?? null)) $eoParts[] = 'Ösenabstand ' . (int) $eo['spacingCm'] . ' cm';
        if ($eoParts) $lines[] = '   ' . implode(', ', $eoParts);
        $lines[] = sprintf('   Summe brutto: %s', eur($pr['lineGross'] ?? 0));
        $lines[] = '';
    }
    $acc = is_array($order['accessories'] ?? null) ? array_slice($order['accessories'], 0, 20) : [];
    if ($lines && $acc) {
        $lines[] = 'Befestigung:';
        foreach ($acc as $x) {
            if (!is_array($x)) continue;
            $lines[] = sprintf('   %d × %s (%s), %s', (int) ($x['quantity'] ?? 0), clean($x['code'] ?? '', 30), clean($x['sku'] ?? '', 30), eur($x['lineGross'] ?? 0));
        }
        $lines[] = '';
    }
    if ($lines && is_array($order['totals'] ?? null)) {
        $lines[] = 'Gesamt brutto (Beispielpreise, unverbindlich): ' . eur($order['totals']['gross'] ?? 0);
    }
}

$body = "Neue Anfrage über den Konfigurator\n\n"
    . "Name:    $name\n"
    . "E-Mail:  $email\n"
    . "Telefon: " . ($phone !== '' ? $phone : '–') . "\n\n"
    . "Nachricht:\n$message\n"
    . ($lines ? "\n--- Positionen aus dem Konfigurator ---\n" . implode("\n", $lines) . "\n" : '');

$subject = mb_encode_mimeheader('Anfrage Konfigurator: ' . $name, 'UTF-8', 'B');
$headers = [
    'From' => 'Konfigurator <' . $config['from'] . '>',
    'Reply-To' => $email,            // durch FILTER_VALIDATE_EMAIL geprüft, enthält keine Zeilenumbrüche
    'MIME-Version' => '1.0',
    'Content-Type' => 'text/plain; charset=UTF-8',
    'Content-Transfer-Encoding' => '8bit',
];

if (!empty($config['dry_run'])) {   // nur zum lokalen Testen: Mail in Datei statt versenden
    file_put_contents(__DIR__ . '/kontakt.dry-run.txt', "To: {$config['to']}\nSubject: $subject\n" . json_encode($headers) . "\n\n$body");
    respond(200, ['ok' => true, 'dryRun' => true]);
}

if (!mail($config['to'], $subject, $body, $headers)) {
    @unlink($stamp);
    error_log('kontakt.php: mail() ist fehlgeschlagen');
    fail(500, 'Die Nachricht konnte nicht gesendet werden. Bitte später erneut versuchen.');
}
respond(200, ['ok' => true]);
