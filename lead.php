<?php
declare(strict_types=1);

/*
  Clynia · proxy del formulario de contacto.

  Recibe el POST de contacto.html y lo manda al webhook de n8n "Clynia · Contacto web",
  que deja el registro en Airtable (tabla "Contactos web") y avisa por correo a
  clynia@clynia.es desde la cuenta de Google de Clynia. Sin PHI.

  POR QUE NO SE AVISA YA CON mail() (16 ago 2026): el SPF de clynia.es solo autoriza a
  Google (v=spf1 include:_spf.google.com ~all) y el DMARC del dominio esta en
  p=quarantine. Los avisos salian del servidor de Hostinger, que no esta autorizado y
  no firma con DKIM, asi que Gmail los metia TODOS en Spam: entre ellos el de un medico
  endocrino que escribio el 29 de julio y al que nadie contesto. Por n8n el correo sale
  autenticado por Google y entra en la bandeja.

  mail() se queda solo como red de seguridad: se usa unicamente si el webhook falla.
*/

$cfg = is_file(__DIR__ . '/config.php') ? (array) require __DIR__ . '/config.php' : [];
$TO   = $cfg['TO'] ?? 'clynia@clynia.es';
$FROM = $cfg['FROM'] ?? 'clynia@clynia.es';
$N8N  = $cfg['N8N_WEBHOOK'] ?? 'https://n8n-ixwg.srv1722506.hstgr.cloud/webhook/contacto-web';

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

// --- Camino principal: n8n (Airtable + aviso por correo autenticado) ---
$entregado = false;

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
            CURLOPT_TIMEOUT        => 10,
        ]);
        @curl_exec($ch);
        $codigo = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        $entregado = $codigo >= 200 && $codigo < 300;
    } else {
        // Hosting sin cURL: mismo POST por streams. Sin esto nos quedariamos sin aviso
        // y sin registro, que es justo el fallo que se arregla aqui.
        $ctx = stream_context_create(['http' => [
            'method'        => 'POST',
            'header'        => "Content-Type: application/json\r\n",
            'content'       => $payload,
            'timeout'       => 10,
            'ignore_errors' => true,
        ]]);
        @file_get_contents($N8N, false, $ctx);
        foreach ($http_response_header ?? [] as $h) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) {
                $entregado = (int) $m[1] >= 200 && (int) $m[1] < 300;
            }
        }
    }
}

// --- Red de seguridad: solo si n8n no ha respondido bien ---
if (!$entregado) {
    $asunto = 'Nuevo contacto web: ' . $nombre;
    $cuerpo = "Nuevo mensaje desde el formulario de contacto de clynia.es\n"
            . "(AVISO: este correo sale del servidor web porque n8n no respondio;\n"
            . "puede acabar en Spam y NO queda registrado en Airtable.)\n\n"
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
    $entregado = @mail($TO, $asuntoEnc, $cuerpo, $headers, '-f ' . $FROM);
}

header('Location: contacto.html?' . ($entregado ? 'ok=1' : 'error=1'));
exit;
