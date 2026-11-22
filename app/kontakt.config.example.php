<?php
// Kopieren nach kontakt.config.php und ausfüllen. kontakt.config.php wird nicht eingecheckt,
// damit die Empfängeradresse nicht im öffentlichen Repository steht.
return [
    'to'   => 'empfaenger@example.com',      // hierhin gehen die Anfragen
    'from' => 'noreply@example.com',         // Absender, am besten eine Adresse der eigenen Domain
    'angebot_to' => ['empfaenger@example.com'],  // Liste: hierhin geht jedes erstellte Angebot (PDF im Anhang). Fehlt sie, gilt 'to'.
    // 'angebote_dir' => '/pfad/zu/angebote',     // optional, Standard: angebote/ neben kontakt.php
    // 'dry_run' => true,                    // nur lokal: schreibt kontakt.dry-run.txt statt zu senden
];
