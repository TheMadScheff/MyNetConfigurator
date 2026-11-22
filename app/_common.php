<?php
// Gemeinsame Hilfen für kontakt.php und angebot.php.
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
date_default_timezone_set('Europe/Vienna');

function respond(int $code, array $data): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
function fail(int $code, string $msg): never { respond($code, ['ok' => false, 'error' => $msg]); }

/** Text bereinigen: Steuerzeichen raus, Länge begrenzen. */
function clean(mixed $v, int $max, bool $multiline = false): string {
    if (!is_string($v) && !is_int($v) && !is_float($v)) return '';
    $s = str_replace("\r", '', (string) $v);
    $s = preg_replace($multiline ? '/[^\P{C}\n]+/u' : '/\p{C}+/u', ' ', $s) ?? '';
    return trim(mb_substr($s, 0, $max));
}
function eur(mixed $v): string { return number_format((float) $v, 2, ',', '.') . ' €'; }

/** kontakt.config.php laden (Empfänger, Absender, Angebotsliste). */
function load_config(): array {
    $file = __DIR__ . '/kontakt.config.php';
    $config = is_file($file) ? require $file : null;
    if (!is_array($config) || empty($config['to']) || empty($config['from'])) {
        error_log('kontakt.config.php fehlt oder ist unvollständig');
        fail(500, 'Das Formular ist noch nicht eingerichtet.');
    }
    return $config;
}

/** Eine Anfrage je IP und $seconds. Gibt den Stempel zurück, damit er bei Fehlern gelöscht werden kann. */
function rate_limit(string $name, int $seconds): string {
    $stamp = sys_get_temp_dir() . '/' . $name . '_' . sha1($_SERVER['REMOTE_ADDR'] ?? 'unbekannt');
    if (is_file($stamp) && time() - (int) filemtime($stamp) < $seconds) fail(429, 'Bitte einen Moment warten und dann erneut senden.');
    @touch($stamp);
    return $stamp;
}
