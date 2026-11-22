<?php
// Nimmt das im Browser erzeugte Angebots-PDF entgegen, speichert es mit Zeitstempel auf dem Server
// und schickt es per E-Mail an die Liste 'angebot_to' aus kontakt.config.php (Ersatz: 'to').
declare(strict_types=1);
require __DIR__ . '/_common.php';

const MAX_PDF = 4 * 1024 * 1024;     // 4 MB
const MAX_PER_DAY = 200;             // Schutz vor Missbrauch: so viele Angebote pro Tag

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { header('Allow: POST'); fail(405, 'Nur POST erlaubt.'); }
$config = load_config();
$stamp = rate_limit('angebot', 10);

$f = $_FILES['pdf'] ?? null;
if (!is_array($f) || ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) fail(400, 'Keine PDF-Datei erhalten.');
if ($f['size'] > MAX_PDF) fail(413, 'Die PDF-Datei ist zu groß.');
$pdf = file_get_contents($f['tmp_name']);
if ($pdf === false || !str_starts_with($pdf, '%PDF-')) fail(400, 'Das ist keine PDF-Datei.');

// Speichern: Dateiname mit Zeitstempel (Serverzeit), dazu eine kurze Zufallskennung gegen Erraten.
$dir = rtrim((string) ($config['angebote_dir'] ?? (__DIR__ . '/angebote')), '/');
if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) { error_log('angebot.php: Ordner nicht anlegbar'); fail(500, 'Speichern nicht möglich.'); }
if (!is_file($dir . '/.htaccess')) @file_put_contents($dir . '/.htaccess', "Require all denied\nOptions -Indexes\n");
if (!is_file($dir . '/index.html')) @file_put_contents($dir . '/index.html', '');
if (count(glob($dir . '/Angebotsanfrage-' . date('Y-m-d') . '_*.pdf') ?: []) >= MAX_PER_DAY) fail(429, 'Tageslimit erreicht.');

$name = 'Angebotsanfrage-' . date('Y-m-d_H-i-s') . '-' . bin2hex(random_bytes(3)) . '.pdf';
if (file_put_contents($dir . '/' . $name, $pdf, LOCK_EX) === false) { @unlink($stamp); error_log('angebot.php: Schreiben fehlgeschlagen'); fail(500, 'Speichern nicht möglich.'); }

// Mail mit PDF im Anhang
$list = $config['angebot_to'] ?? $config['to'];
$list = array_values(array_filter(array_map('trim', (array) $list), fn($a) => filter_var($a, FILTER_VALIDATE_EMAIL)));
if (!$list) $list = [$config['to']];

$count = (int) ($_POST['positions'] ?? 0);
$text = "Es wurde eine Angebotsanfrage im Konfigurator erstellt.\n\n"
    . 'Zeitpunkt: ' . date('d.m.Y H:i:s') . "\n"
    . ($count > 0 ? 'Positionen: ' . $count . "\n" : '')
    . (isset($_POST['gross']) ? 'Gesamt brutto (Beispielpreise): ' . eur($_POST['gross']) . "\n" : '')
    . "Datei auf dem Server: angebote/$name\n\nDas PDF hängt an dieser Mail.\n";

$b = 'b' . bin2hex(random_bytes(12));
$body = "--$b\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n" . $text . "\r\n"
    . "--$b\r\nContent-Type: application/pdf; name=\"$name\"\r\nContent-Transfer-Encoding: base64\r\nContent-Disposition: attachment; filename=\"$name\"\r\n\r\n"
    . chunk_split(base64_encode($pdf)) . "--$b--\r\n";
$subject = mb_encode_mimeheader('Neue Angebotsanfrage ' . date('d.m.Y H:i'), 'UTF-8', 'B');
$headers = [
    'From' => 'Konfigurator <' . $config['from'] . '>',
    'MIME-Version' => '1.0',
    'Content-Type' => "multipart/mixed; boundary=\"$b\"",
];

if (!empty($config['dry_run'])) {
    file_put_contents($dir . '/angebot.dry-run.txt', 'To: ' . implode(', ', $list) . "\nSubject: $subject\n\n$text");
    respond(200, ['ok' => true, 'file' => $name, 'mailed' => count($list), 'dryRun' => true]);
}
$sent = mail(implode(', ', $list), $subject, $body, $headers);
if (!$sent) error_log('angebot.php: mail() ist fehlgeschlagen');
// Gespeichert ist das PDF in jedem Fall; der Browser erfährt, ob auch die Mail rausging.
respond(200, ['ok' => true, 'file' => $name, 'mailed' => $sent ? count($list) : 0]);
