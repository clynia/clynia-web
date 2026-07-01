<?php
declare(strict_types=1);

/*
  Clynia · proxy del formulario de contacto.
  Recibe el POST de contacto.html, envia un email a clynia@clynia.es y,
  si hay webhook de n8n configurado en config.php, reenvia el lead como
  JSON (para registrarlo en Airtable "Contactos web"). Sin PHI.
*/

$cfg = is_file(__DIR__ . '/config.php') ? (array) require __DIR__ . '/config.php' : [];
$TO   = $cfg['TO'] ?? 'clynia@clynia.es';
$FROM = $cfg['FROM'] ?? 'clynia@clynia.es';
$N8N  = $cfg['N8N_WEBHOOK'] ?? '';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Location: contacto.html');
    exit;
}

// Honeypot anti-spam: si viene relleno, fingimos exito y descartamos.
if (trim((string) ($_POST['website'] ?? '')) !== '') {
    header('Location: contacto.html?ok=1');
    exit;
}

$val = static function (string $k): string {
    return trim((string) ($_POST[$k] ?? ''));
};

$nombre   = mb_substr($val('nombre'), 0, 120);
$email    = mb_substr($val('email'), 0, 160);
$telefono = mb_substr($val('telefono'), 0, 40);
$motivo   = mb_substr($val('motivo'), 0, 80);
$mensaje  = mb_substr($val('mensaje'), 0, 4000);
$consent  = $val('consent');

$errores = [];
if ($nombre === '') {
    $errores[] = 'nombre';
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errores[] = 'email';
}
if ($mensaje === '') {
    $errores[] = 'mensaje';
}
if ($consent === '') {
    $errores[] = 'consent';
}
if ($errores) {
    header('Location: contacto.html?error=1');
    exit;
}

// --- Email al equipo ---
$asunto = 'Nuevo contacto web: ' . $nombre;
$cuerpo = "Nuevo mensaje desde el formulario de contacto de clynia.es\n\n"
        . "Nombre:   {$nombre}\n"
        . "Email:    {$email}\n"
        . "Telefono: {$telefono}\n"
        . "Motivo:   {$motivo}\n\n"
        . "Mensaje:\n{$mensaje}\n";

// Defensa en profundidad frente a inyeccion de cabeceras: aunque FILTER_VALIDATE_EMAIL
// ya rechaza CR/LF, eliminamos cualquier salto de linea antes de interpolar el email.
$replyTo = str_replace(["\r", "\n", "\0"], '', $email);
$headers  = 'From: =?UTF-8?B?' . base64_encode('Clynia web') . '?= <' . $FROM . ">\r\n";
$headers .= 'Reply-To: ' . $replyTo . "\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
$headers .= "Content-Transfer-Encoding: 8bit\r\n";
$headers .= 'Message-ID: <' . bin2hex(random_bytes(12)) . '@clynia.es>' . "\r\n";
$asuntoEnc = '=?UTF-8?B?' . base64_encode($asunto) . '?=';

// El 5o parametro (-f) fija el Return-Path al buzon real del dominio para
// alinear SPF y reducir que el aviso caiga en spam.
$enviado = @mail($TO, $asuntoEnc, $cuerpo, $headers, '-f ' . $FROM);

// --- Reenvio opcional a n8n (Airtable "Contactos web") ---
if ($N8N !== '') {
    $payload = json_encode([
        'nombre'   => $nombre,
        'email'    => $email,
        'telefono' => $telefono,
        'motivo'   => $motivo,
        'mensaje'  => $mensaje,
        'source'   => 'clynia.es/contacto',
        'ts'       => gmdate('c'),
    ], JSON_UNESCAPED_UNICODE);

    if (function_exists('curl_init')) {
        $ch = curl_init($N8N);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 8,
        ]);
        @curl_exec($ch);
        curl_close($ch);
    }
}

header('Location: contacto.html?' . ($enviado ? 'ok=1' : 'error=1'));
exit;
