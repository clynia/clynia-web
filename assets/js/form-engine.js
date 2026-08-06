/* Clynia — motor de formulario multipaso, dirigido por esquema.
   Lee window.CLYNIA_FORM = { storeKey, webhook, plans, steps[], computeVars(answers) }.
   Tipos de paso: statement | text | longtext | email | tel | number | date |
                  single | multi | yesno | file | consent | plans | gate | ending */
(function () {
  "use strict";
  var F = window.CLYNIA_FORM;
  var root = document.getElementById("cq");
  if (!F || !root) return;

  var answers = load();
  var vars = {};
  var history = [];
  var current = null;
  // Ficheros elegidos en pasos type:"file", SOLO en memoria: un File no puede persistirse en
  // localStorage, así que una recarga lo pierde (y el paso limpia answers[key] al repintarse
  // para no prometer un adjunto que ya no tenemos). En answers viaja solo {name, size}; el
  // contenido real se lee como base64 en el envío (collectFiles) y va en payload.files.
  var pendingFiles = {};
  // Mismo límite de 3,5 MB que los adjuntos del portal, y por debajo del tope de 5 MB de la
  // API de adjuntos de Airtable, que es donde acaba el fichero vía n8n.
  var MAX_FILE_BYTES = 3670016;
  // ── Modo PARTE 2 (flujo en 2 partes): tras el pago, el cuestionario continúa aquí. ──
  // Se entra desde gracias.html o desde el enlace del email (?p2=<intakeId>). Si el intakeId
  // del enlace no coincide con el guardado (otro dispositivo), la parte 2 arranca en blanco y
  // n8n funde las respuestas con las de la parte 1 (merge server-side por intakeId). Solo
  // aplica si el esquema define p2StartId (hoy: solo peso); en el resto es un no-op.
  var P2 = false;
  (function () {
    if (!F.p2StartId) return;
    var qp = null;
    try { qp = new URLSearchParams(window.location.search).get("p2"); } catch (e) {}
    var paid = false;
    try { paid = localStorage.getItem(F.storeKey + "_paid") === "1"; } catch (e) {}
    // ?pay=<casoId> es intento EXPLICITO de pagar ESE caso. Si viene y es de un caso DISTINTO al
    // guardado, es un pago NUEVO: no debe secuestrarlo el modo parte 2 por un _paid viejo de una
    // compra anterior (bug: el apto nuevo caia en el formulario en vez del pago).
    var payp = null;
    try { payp = new URLSearchParams(window.location.search).get("pay"); } catch (e) {}
    var pagoNuevo = !!(payp && /^rec[a-zA-Z0-9]{6,20}$/.test(payp) && payp !== answers._caso);
    if (qp && /^[a-zA-Z0-9-]{8,80}$/.test(qp)) {
      if (answers._intakeId && answers._intakeId !== qp) { answers = {}; }
      answers._intakeId = qp;
      P2 = true;
    } else if (paid && answers._intakeId && !pagoNuevo) {
      // Pagó en este dispositivo y vuelve a peso.html (sin ?pay= de otro caso): continúa en la
      // parte 2, nunca en el paso de planes (que relanzaría un pago ya hecho).
      P2 = true;
    }
    if (P2) {
      try { localStorage.setItem(F.storeKey + "_paid", "1"); } catch (e) {}
      try { sessionStorage.removeItem(F.storeKey + "_return"); } catch (e) {}
      save();
    }
  })();
  // ── Modo PAGO (?pay=<casoId>): el apto llega desde el email tras el OK del médico. Entra directo
  // al paso de planes (payStartId) con su casoId sembrado, sin repetir la parte 1; al elegir plan,
  // finish() ve answers._caso y lanza el checkout (crear-checkout) sin recrear el caso. P2 gana sobre
  // PAY: si ya pagó (?p2= o marker _paid), va a la parte 2, nunca de vuelta a planes. ──
  var PAY = false;
  (function () {
    if (P2 || !F.payStartId) return;
    var pc = null;
    try { pc = new URLSearchParams(window.location.search).get("pay"); } catch (e) {}
    if (!pc || !/^rec[a-zA-Z0-9]{6,20}$/.test(pc)) return; // casoId de Airtable (recXXXX…)
    if (answers._caso && answers._caso !== pc) { answers = {}; } // otro caso en este dispositivo: empieza limpio
    answers._caso = pc;
    PAY = true;
    try { localStorage.removeItem(F.storeKey + "_paid"); } catch (e) {} // pago NUEVO: limpia el marker de un pago anterior
    // ?plan=<id>: en el email del apto cada tarjeta de precio enlaza aqui con SU plan, asi que si
    // ha pulsado una en concreto llega ya marcada y solo tiene que confirmar. Se valida contra los
    // planes del propio esquema: un id que no exista se ignora y elige como hasta ahora.
    try {
      var qs = new URLSearchParams(window.location.search);
      var pl = qs.get("plan");
      if (pl && (F.plans || []).some(function (p) { return p.id === pl; })) { answers.plan = pl; }
      // ?code=<CODIGO>: el correo del descuento lo trae en el enlace para que la sesion de Stripe
      // se abra YA con el precio rebajado. Sin esto el correo titula 71,20 y la pantalla de pago
      // enseña 89 hasta que ella escriba el codigo a mano, que es lo que hace cerrar la pestaña.
      // Aqui NO se valida: quien decide si un codigo existe es Stripe, via la lista blanca del
      // nodo 'Mapear plan a price' de n8n. Se guarda en answers para que sobreviva a una recarga.
      var cd = (qs.get("code") || "").trim().toUpperCase();
      if (/^[A-Z0-9-]{3,32}$/.test(cd)) { answers._code = cd; }
    } catch (e) {}
    save();
  })();
  // --- Meta Pixel: evento de INICIO del cuestionario (se dispara una sola vez, al primer
  // avance). Sirve para etiquetar a quien empieza y no termina (retargeting) y medir el embudo. ---
  var started = false;
  function px(ev, params) { try { if (window.fbq) fbq("trackCustom", ev, params || {}); } catch (e) {} }
  // --- Meta Pixel: un evento por paso ALCANZADO (solo avance, una vez por paso y sesión).
  // Permite ver en qué pregunta abandona la gente. Envía el id del paso, nunca respuestas. ---
  var seenSteps = {};
  // GA4: espejo de los eventos del embudo (assets/js/ga.js gestiona consentimiento y cola).
  function ga(ev, params) { try { if (window.clyniaGA) window.clyniaGA(ev, params || {}); } catch (e) {} }
  function pxStep(step) {
    if (!step || !step.id || seenSteps[step.id]) return;
    seenSteps[step.id] = true;
    // PRIVACIDAD: los pasos condicionales (showIf) y los finales solo aparecen segun respuestas
    // previas de salud; enviar su id identificaria la respuesta (RGPD art. 9 / terminos de Meta).
    // A Meta/GA solo se manda la identidad de los pasos que ve todo el mundo; el resto, etiqueta generica.
    var safe = !step.showIf && step.type !== "ending";
    var sid = safe ? step.id : (step.type === "ending" ? "final" : "detalle_condicional");
    var sidx = safe ? idx(step.id) + 1 : 0;
    // Privacidad: a Meta enviamos SOLO la posición en el embudo (step_index), nunca el id del paso
    // (que revelaría el tema de salud, p. ej. "embarazo"/"contraindicaciones"). El id se conserva
    // solo en analítica de primera parte (GA), útil para el embudo y sobre propiedad propia.
    px("QStep", { step_index: sidx, content_name: F.product, content_category: F.category || F.product });
    ga("question_step", { step: sid, step_index: sidx, product: F.product });
  }

  // Los datos de salud del intake NO deben quedar indefinidamente en localStorage
  // (equipos compartidos/públicos). Se purgan pasadas 24h desde la última edición.
  var TTL_MS = 24 * 60 * 60 * 1000;
  function clearStore() {
    try {
      localStorage.removeItem(F.storeKey);
      localStorage.removeItem(F.storeKey + "_ts");
      localStorage.removeItem(F.storeKey + "_pending");
      localStorage.removeItem(F.storeKey + "_paid");
    } catch (e) {}
  }
  function load() {
    try {
      var ts = parseInt(localStorage.getItem(F.storeKey + "_ts") || "0", 10);
      if (ts && (Date.now() - ts) > TTL_MS) { clearStore(); return {}; }
      return JSON.parse(localStorage.getItem(F.storeKey)) || {};
    } catch (e) { return {}; }
  }
  function save() {
    try {
      localStorage.setItem(F.storeKey, JSON.stringify(answers));
      localStorage.setItem(F.storeKey + "_ts", String(Date.now()));
    } catch (e) {}
  }
  // Guarda un "lead parcial" en cuanto tenemos email + los consentimientos obligatorios, aunque la
  // persona no termine el cuestionario. Es un envío de la propia persona (con su consentimiento
  // explícito), independiente de las cookies. Una sola vez por intake. Solo actúa si el esquema
  // define F.leadWebhook (hoy: solo el de peso); en los demás formularios es un no-op.
  var partialSent = false;
  function sendPartial() {
    try {
      if (partialSent || answers._partialSent || !F.leadWebhook) return;
      var email = answers.email;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
      if (answers.acepta_privacidad !== true || answers.acepta_datos_salud !== true) return;
      var body = JSON.stringify({
        email: email,
        nombre: [answers.nombre, answers.primer_apellido].filter(Boolean).join(" "),
        telefono: answers.telefono || "",
        consent: true,
        // Consentimiento de comunicaciones comerciales (casilla OPCIONAL del paso de consentimiento).
        // Va aparte de `consent` (privacidad + datos de salud, obligatorias) porque la base legal es
        // distinta: sin este flag no hay forma de acreditar el opt-in del art. 21 LSSI y cualquier
        // campaña futura a estos leads se queda sin sustento. Antes se perdía aquí mismo.
        comercial: answers.acepta_comercial === true,
        intakeId: answers._intakeId || "",
        origen: "web-peso-form",
        ts: new Date().toISOString()
      });
      var sent = false;
      if (navigator.sendBeacon) { try { sent = navigator.sendBeacon(F.leadWebhook, new Blob([body], { type: "text/plain;charset=UTF-8" })); } catch (e) {} }
      if (!sent) { try { fetch(F.leadWebhook, { method: "POST", headers: { "Content-Type": "text/plain" }, body: body, keepalive: true, mode: "no-cors" }); } catch (e) {} }
      partialSent = true; answers._partialSent = true; save();
      // Señal a Meta (solo si hay consentimiento de cookies): captación de contacto, distinta del Lead final.
      px("LeadPartial", { content_name: F.product, content_category: F.category || F.product });
    } catch (e) {}
  }

  // Al llegar a un final de "no apto" (cribado rojo o menor de edad), marca el lead parcial como
  // "Descartado" en Airtable: lo saca del drip de recuperación y del embudo. Solo si la persona
  // ya dejó email + consentimiento (si no, no hay lead que marcar). Una sola vez. No-op si el
  // esquema no define F.discardWebhook. Además blinda _partialSent para que un pagehide tardío
  // NO reescriba el lead de vuelta a "Parcial".
  var discardSent = false;
  function sendDiscard(motivo) {
    try {
      if (P2) return; // en la parte 2 ya ha pagado: no se toca su lead
      if (discardSent || answers._discardSent || !F.discardWebhook) return;
      var email = answers.email;
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
      if (answers.acepta_privacidad !== true || answers.acepta_datos_salud !== true) return;
      var body = JSON.stringify({
        email: email,
        intakeId: answers._intakeId || "",
        motivo: motivo || "No apto (web)",
        origen: "web-peso-form",
        ts: new Date().toISOString()
      });
      var sent = false;
      if (navigator.sendBeacon) { try { sent = navigator.sendBeacon(F.discardWebhook, new Blob([body], { type: "text/plain;charset=UTF-8" })); } catch (e) {} }
      if (!sent) { try { fetch(F.discardWebhook, { method: "POST", headers: { "Content-Type": "text/plain" }, body: body, keepalive: true, mode: "no-cors" }); } catch (e) {} }
      discardSent = true; answers._discardSent = true; answers._partialSent = true; save();
    } catch (e) {}
  }

  function byId(id) { for (var i = 0; i < F.steps.length; i++) if (F.steps[i].id === id) return F.steps[i]; return null; }
  function idx(id) { for (var i = 0; i < F.steps.length; i++) if (F.steps[i].id === id) return i; return -1; }
  function visible(s) { return !s.showIf || s.showIf(answers, vars) !== false; }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }
  function interp(t) {
    return String(t || "").replace(/\{\{(\w+)\}\}/g, function (_, k) {
      return (vars[k] != null ? vars[k] : (answers[k] != null ? answers[k] : ""));
    });
  }

  // Resuelve a partir de un id el siguiente paso renderizable (saltando ocultos y gates)
  function resolveFrom(startIdx) {
    for (var i = startIdx; i < F.steps.length; i++) {
      var s = F.steps[i];
      if (!visible(s)) continue;
      if (s.type === "gate") { var t = s.route(answers, vars); if (t) return byId(t); else continue; }
      return s;
    }
    return null;
  }
  function nextOf(step) {
    if (step.next) { var nid = step.next(answers, vars); if (nid) { var t = byId(nid); if (t && t.type === "gate") return resolveFrom(idx(nid)); return t; } }
    return resolveFrom(idx(step.id) + 1);
  }

  function go(step, push) {
    if (!step) return;
    if (push && current) history.push(current.id);
    if (push && !started) { started = true; px("StartQuestionnaire", { content_name: F.product, content_category: F.category || F.product }); ga("start_questionnaire", { product: F.product, category: F.category || F.product }); }
    if (push) pxStep(step);
    current = step;
    vars = F.computeVars ? F.computeVars(answers) : {};
    render();
    window.scrollTo(0, 0);
  }
  function back() {
    if (!history.length) return;
    var id = history.pop();
    current = byId(id);
    vars = F.computeVars ? F.computeVars(answers) : {};
    render();
    window.scrollTo(0, 0);
  }

  // Marca que salimos al pago, para reanudar en ese paso al volver (botón atrás / bfcache).
  function markReturn() {
    try { sessionStorage.setItem(F.storeKey + "_return", current && current.id ? current.id : "plans"); } catch (e) {}
  }

  // Reanuda el formulario. Si volvemos del pago, aterriza en el paso guardado y reconstruye
  // el historial para que "Atrás" recorra las respuestas; si no, arranca por el principio.
  // Parte 2: antes de pintar nada preguntamos QUÉ DATOS DE IDENTIDAD YA TENEMOS de este paciente
  // (solo si el esquema define queTenemosWebhook), para saltarnos las preguntas que ya sabemos
  // contestar. Es el caso de quien ya compró otro producto: sus apellidos, su documento y su
  // dirección ya están en su ficha, y volver a pedírselos justo después de pagar es donde más gente
  // se cae. La respuesta son solo booleanos, nunca el dato.
  // Si el endpoint falla o tarda más de 2,5 s se arranca igual y se pregunta todo: nunca se deja al
  // paciente mirando una pantalla en blanco por esto.
  function arrancarP2() {
    var lanzado = false;
    var arranca = function () { if (lanzado) return; lanzado = true; go(byId(F.p2StartId), false); };
    if (!F.queTenemosWebhook || !answers._intakeId) { arranca(); return; }
    setTimeout(arranca, 2500);
    fetch(F.queTenemosWebhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intakeId: answers._intakeId }) })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && j.ok && j.tenemos) { answers._yaTenemos = j.tenemos; save(); } })
      .then(arranca, arranca);
  }

  function resume() {
    // Parte 2: siempre arranca en su primer paso (nunca en los de la parte 1 ni en planes).
    if (P2) { history = []; arrancarP2(); return; }
    // Modo pago (apto desde el email): arranca directo en el paso de planes, sin repetir la parte 1.
    if (PAY) { history = []; go(byId(F.payStartId), false); return; }
    var target = null;
    try { target = sessionStorage.getItem(F.storeKey + "_return"); } catch (e) {}
    if (!target || !byId(target)) { history = []; go(resolveFrom(0), false); return; }
    vars = F.computeVars ? F.computeVars(answers) : {};
    history = [];
    var step = resolveFrom(0), guard = 0;
    while (step && step.id !== target && guard++ < F.steps.length + 5) {
      history.push(step.id);
      var nx = nextOf(step);
      if (!nx) break;
      step = nx;
    }
    current = (step && step.id === target) ? step : byId(target);
    vars = F.computeVars ? F.computeVars(answers) : {};
    render();
    window.scrollTo(0, 0);
  }

  function progress() {
    // Barra en 2 fases cuando el flujo tiene parte 2 (post-pago): la parte 1 mide
    // solo sus propios pasos y llega llena en el paso del pago; la parte 2 reinicia.
    var done = idx(current.id), total = F.steps.length, start = 0, end = total;
    if (F.p2StartId) { if (P2) { start = idx(F.p2StartId); } else { end = idx(F.p2StartId); } }
    if (!P2 && F.p2StartId && done >= end - 1) return 100;
    return Math.max(6, Math.min(96, Math.round(((done - start) / (end - start)) * 100)));
  }

  function render() {
    vars = F.computeVars ? F.computeVars(answers) : {};
    var s = current;
    if (s.type === "ending") return renderEnding(s);
    if (s.type === "statement") return renderStatement(s);

    var h = '<header class="cq__bar">';
    h += '<button class="cq__back" type="button" aria-label="Atrás"' + (history.length ? "" : " disabled") + ">&#8592;</button>";
    h += '<div class="cq__progress"><i style="width:' + progress() + '%"></i></div>';
    h += '<img class="cq__brand" src="assets/logos/clynia-wordmark.png" alt="Clynia"></header>';
    h += '<main class="cq__stage"><div class="cq__step">';
    // section:false quita el pretitulo en mayusculas SOLO en ese paso. Lo usa el paso de planes, que
    // ya tiene titular, tarjetas y boton: un "COMO QUIERES PAGAR" encima no aporta y es justo el tipo
    // de etiqueta que no queremos. Un paso que no lo pida sigue pintandolo igual que siempre.
    if (s.section !== false) h += '<p class="cq__eyebrow">' + esc(s.section || "Tu valoración") + "</p>";
    h += '<h1 class="cq__q">' + interp(s.q) + "</h1>";
    if (s.help) h += '<p class="cq__help">' + interp(s.help) + "</p>";
    if (s.visual) h += s.visual(answers, vars);
    h += '<div class="cq__field" id="cqField">' + fieldHTML(s) + "</div>";
    // `note` = letra pequena DESPUES del campo. Existe para que lo legal no tenga que viajar en el
    // `help`, que se pinta ENCIMA y empujaba las tarjetas de plan fuera de la primera pantalla.
    if (s.note) h += '<p class="cq__note">' + interp(s.note) + "</p>";
    h += '<div class="cq__err" id="cqErr" style="display:none"></div>';
    h += "</div></main>";
    h += '<footer class="cq__foot"><div class="in"><button class="cq__next" type="button" id="cqNext">' + esc(s.cta || "Continuar") + "</button>" + (history.length ? '<button class="cq__backlow" type="button" id="cqBackLow">&#8592; Atrás</button>' : "") + "</div></footer>";
    root.innerHTML = h;

    var backBtn = root.querySelector(".cq__back");
    if (backBtn) backBtn.onclick = back;
    bind(s);
    document.getElementById("cqNext").onclick = function () { submitStep(s); };
    var bl = document.getElementById("cqBackLow"); if (bl) bl.onclick = back;
  }

  function fieldHTML(s) {
    var v = answers[s.key];
    switch (s.type) {
      case "text": return '<input class="cq__input" id="cqIn" type="text" autocomplete="' + (s.autocomplete || "on") + '" value="' + esc(v || "") + '" placeholder="' + esc(s.placeholder || "") + '">';
      case "select": return '<select class="cq__input" id="cqIn"><option value="" disabled' + (v ? "" : " selected") + ">" + esc(s.placeholder || "Selecciona una opción") + "</option>" + (s.options || []).map(function (o) { var val = ("value" in o) ? o.value : o.label; return '<option value="' + esc(val) + '"' + (v === val ? " selected" : "") + ">" + esc(o.label) + "</option>"; }).join("") + "</select>";
      case "longtext": return '<textarea class="cq__input" id="cqIn" placeholder="' + esc(s.placeholder || "") + '">' + esc(v || "") + "</textarea>";
      case "email": return '<input class="cq__input" id="cqIn" type="email" inputmode="email" autocomplete="email" value="' + esc(v || "") + '" placeholder="tucorreo@email.com">';
      case "tel": return '<input class="cq__input" id="cqIn" type="tel" inputmode="tel" autocomplete="tel" value="' + esc(v || "") + '" placeholder="600 000 000">';
      case "number": return '<div class="cq__suffix"><input class="cq__input" id="cqIn" type="number" inputmode="decimal" value="' + esc(v == null ? "" : v) + '" placeholder="' + esc(s.placeholder || "") + '"' + (s.min != null ? ' min="' + s.min + '"' : "") + (s.max != null ? ' max="' + s.max + '"' : "") + ">" + (s.unit ? "<span>" + esc(s.unit) + "</span>" : "") + "</div>";
      case "date": return '<input class="cq__input" id="cqIn" type="date" value="' + esc(v || "") + '">';
      case "file":
        // Respuesta guardada sin File en memoria = el fichero se perdió en una recarga: se
        // limpia para que el paso vuelva a "Opcional" en vez de pintar un adjunto que no existe.
        if (v && !pendingFiles[s.key]) { v = null; delete answers[s.key]; save(); }
        return '<div class="cq__file"><label for="cqIn">&#128206; ' + esc(s.cta2 || "Subir archivo") + '</label><input id="cqIn" type="file" accept="' + esc(s.accept || "image/*,.pdf") + '"><span class="name" id="cqFileName">' + esc(v ? v.name || "Archivo adjunto" : "Opcional") + "</span></div>";
      case "yesno": return optBtns(s, [{ label: "Sí", value: true }, { label: "No", value: false }], false);
      case "single": return optBtns(s, s.options, false);
      case "multi": return optBtns(s, s.options, true);
      case "consent": return s.items.map(function (it) {
        var ck = (answers[it.key] === true) ? " checked" : "";
        return '<label class="cq__consent"><input type="checkbox" data-ck="' + esc(it.key) + '"' + ck + ">" + '<span>' + it.label + (it.required ? "" : ' <em style="color:var(--muted)">(opcional)</em>') + "</span></label>";
      }).join("");
      // OJO con precioUI: `precio` es SIEMPRE el importe que se cobra de verdad y el que viaja a
      // las analiticas y al ticket de compra. `precioUI` es solo lo que se pinta grande, para poder
      // enseñar un anual como su equivalente mensual (32,50 en vez de 390) sin falsear el cobro.
      // El envoltorio .cq__plans es OBLIGATORIO: sin el, las tarjetas cuelgan de .cq__field, que
      // solo deja 7 px de hueco, y como la etiqueta va en position:absolute con top:-10px acababa
      // metiendose dentro de la tarjeta de arriba. Su regla existia en el CSS desde siempre, pero
      // el motor nunca pintaba el contenedor, asi que no la aplicaba nadie.
      case "plans": return '<div class="cq__plans">' + F.plans.map(function (p, i) {
        var sel = (v === p.id) ? " is-sel" : "";
        return (p.sep ? '<span class="cq__plansep"><span>' + esc(p.sep) + "</span></span>" : "") +
          '<button type="button" class="cq__plan' + (p.featured ? " feat" : "") + sel + '" data-plan="' + esc(p.id) + '">' +
          (p.tag ? '<span class="tag">' + esc(p.tag) + "</span>" : "") +
          // Marca de elegido. Se pinta SIEMPRE y el CSS solo la enseña en .is-sel: elegir plan no
          // avanza de paso (hay que pulsar el boton de abajo), asi que sin una marca clara el
          // paciente no sabe si su clic ha contado. Antes solo cambiaba el color del borde.
          '<span class="pick" aria-hidden="true"></span>' +
          // `icono` es SVG que viene del propio esquema (fichero nuestro, no entrada de usuario),
          // por eso va sin escapar. Es OPCIONAL: si un plan no lo trae no se pinta nada, así que
          // los esquemas que no lo usan (salud sexual) siguen exactamente igual.
          (p.icono ? '<span class="ico" aria-hidden="true">' + p.icono + "</span>" : "") +
          '<div class="name">' + esc(p.nombre) + "</div>" +
          // Espacio duro antes del simbolo: en español el importe va "89 €", nunca "89€", y el duro
          // impide que el € se quede solo al final de una linea.
          '<div class="price">' + esc(p.precioUI != null ? p.precioUI : p.precio) + " €" +
            // El espacio va FUERA del span a proposito: sin el, el nombre accesible del boton
            // concatena los textos y un lector de pantalla dice "89 euroal mes".
            (p.unidad ? ' <span class="unit">' + esc(p.unidad) + "</span>" : "") +
            (p.antes ? ' <span class="was">' + esc(p.antes) +" €</span>" : "") +
            (p.meta ? "<small>" + esc(p.meta) + "</small>" : "") + "</div>" +
          (p.desc ? '<div class="desc">' + esc(p.desc) + "</div>" : "") + "</button>";
      }).join("") + "</div>" +
        // Metodos de pago aceptados, bajo las tarjetas. Solo aparece en pasos type:"plans" (peso y
        // salud sexual), que es "donde hay que pagar". Cada logo es un SVG autocontenido servido de
        // /assets; `alt=""` porque el aria-label del contenedor ya los enumera y si no un lector de
        // pantalla leeria las cinco marcas de corrido. Es el MISMO set del pie de pagina.
        '<div class="cq__pay" role="img" aria-label="Métodos de pago aceptados: Visa, Mastercard, American Express, Apple Pay y Google Pay">' +
        ["visa", "mastercard", "amex", "apple-pay", "google-pay"].map(function (n) {
          return '<img src="/assets/img/pay/' + n + '.svg" alt="" width="40" height="25" loading="lazy">';
        }).join("") + "</div>";
    }
    return "";
  }
  function optBtns(s, opts, multi) {
    var v = answers[s.key];
    return opts.map(function (o, i) {
      var val = ("value" in o) ? o.value : o.label;
      var sel = multi ? (Array.isArray(v) && v.indexOf(val) > -1) : (v === val);
      return '<button type="button" class="cq__opt' + (multi ? " multi" : "") + (sel ? " is-sel" : "") + '" data-i="' + i + '">' +
        "<span>" + esc(o.label) + '</span><span class="tick"></span></button>';
    }).join("");
  }

  function bind(s) {
    var field = document.getElementById("cqField");
    if (!field) return;
    if (s.type === "single" || s.type === "yesno" || s.type === "multi") {
      var opts = (s.type === "yesno") ? [{ label: "Sí", value: true }, { label: "No", value: false }] : s.options;
      var multi = s.type === "multi";
      field.querySelectorAll(".cq__opt").forEach(function (btn) {
        btn.onclick = function () {
          var o = opts[+btn.getAttribute("data-i")];
          var val = ("value" in o) ? o.value : o.label;
          if (multi) {
            var arr = Array.isArray(answers[s.key]) ? answers[s.key].slice() : [];
            // "ninguna/exclusiva" deselecciona el resto y viceversa
            if (o.exclusive) { arr = (arr.indexOf(val) > -1) ? [] : [val]; }
            else {
              var p = arr.indexOf(val); if (p > -1) arr.splice(p, 1); else arr.push(val);
              arr = arr.filter(function (x) { var oo = opts.filter(function (z) { return (("value" in z) ? z.value : z.label) === x; })[0]; return !(oo && oo.exclusive); });
            }
            answers[s.key] = arr; save(); render();
          } else {
            answers[s.key] = val; save();
            if (s.autoNext !== false) submitStep(s); else render();
          }
        };
      });
    } else if (s.type === "plans") {
      field.querySelectorAll(".cq__plan").forEach(function (btn) {
        btn.onclick = function () { answers[s.key] = btn.getAttribute("data-plan"); save(); render(); };
      });
    } else if (s.type === "file") {
      var inp = document.getElementById("cqIn");
      inp.onchange = function () {
        var f = inp.files[0];
        if (!f) return;
        if (f.size > MAX_FILE_BYTES) {
          delete pendingFiles[s.key]; delete answers[s.key]; save();
          inp.value = "";
          document.getElementById("cqFileName").textContent = "Opcional";
          err("El archivo supera 3,5 MB. Elige uno más pequeño (por ejemplo, una foto con menos calidad).");
          return;
        }
        pendingFiles[s.key] = f;
        answers[s.key] = { name: f.name, size: f.size };
        save();
        document.getElementById("cqFileName").textContent = f.name;
        var e = document.getElementById("cqErr"); if (e) e.style.display = "none";
      };
    } else if (s.type === "consent") {
      field.querySelectorAll("input[data-ck]").forEach(function (c) {
        c.onchange = function () { answers[c.getAttribute("data-ck")] = c.checked; save(); sendPartial(); };
      });
    } else {
      var el = document.getElementById("cqIn");
      if (el) {
        var setv = function () { answers[s.key] = (s.type === "number") ? (el.value === "" ? null : +el.value) : el.value; save(); };
        el.oninput = setv;
        el.onchange = setv;
        if (s.type !== "longtext") {
          el.onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); setv(); submitStep(s); } };
          setTimeout(function () { try { el.focus(); } catch (e) {} }, 40);
        }
      }
    }
  }

  function err(msg) { var e = document.getElementById("cqErr"); if (e) { e.textContent = msg; e.style.display = "block"; } }

  function validate(s) {
    var v = answers[s.key];
    if (s.required === false) return true;
    switch (s.type) {
      case "multi": return Array.isArray(v) && v.length > 0;
      case "yesno": return v === true || v === false;
      case "file": return true;
      case "plans": return !!v;
      case "consent": return s.items.every(function (it) { return !it.required || answers[it.key] === true; });
      case "email": return v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      // Telefono: minimo 9 digitos, que es lo que tiene un numero español. Cuenta SOLO digitos, asi
      // que admite espacios, guiones y prefijo (+34 600 11 22 33). Sin esto, un campo obligatorio
      // invita a escribir "no" o "-" para pasar de pantalla, y la ficha se llena de basura, que es
      // justo lo que no queremos si el plan es llamar.
      case "tel": return v != null && (String(v).match(/\d/g) || []).length >= 9;
      case "number": return v != null && v !== "" && !isNaN(v);
      default: return v != null && String(v).trim() !== "";
    }
  }

  function submitStep(s) {
    if (!validate(s)) { err(s.errMsg || "Responde para continuar."); return; }
    // Rango de los números (min/max del schema). Los atributos min y max del input SOLO los aplica
    // el navegador al enviar un formulario nativo, y aquí se avanza por JS, así que no se estaban
    // comprobando: se colaba la altura en metros (1,63 en vez de 163) y el IMC salía por las nubes
    // en la ficha del médico (pasó de verdad el 25 jul 2026). Se rechaza en vez de convertir: 1,63
    // podría ser un error de tecleo y no toca adivinar un dato clínico.
    if (s.type === "number" && answers[s.key] != null && answers[s.key] !== "") {
      var nv = +answers[s.key];
      if ((s.min != null && nv < s.min) || (s.max != null && nv > s.max)) {
        err("Escríbelo" + (s.unit ? " en " + s.unit : "") + (s.min != null && s.max != null ? ", entre " + s.min + " y " + s.max : "") + ".");
        return;
      }
    }
    // Validación suave del número de documento contra el tipo elegido (DNI/NIE/Pasaporte).
    if (s.key === "num_documento" && F.validarDocumento && !F.validarDocumento(answers.tipo_documento, answers.num_documento).ok) {
      err("Revisa el número: no parece un " + (answers.tipo_documento || "documento") + " válido.");
      return;
    }
    sendPartial();
    if (s.id === "plans" || s.submit) return finish();
    go(nextOf(s), true);
  }

  function renderStatement(s) {
    var h = '<header class="cq__bar"><button class="cq__back" type="button"' + (history.length ? "" : " disabled") + ">&#8592;</button>";
    h += '<div class="cq__progress"><i style="width:' + progress() + '%"></i></div><img class="cq__brand" src="assets/logos/clynia-wordmark.png" alt="Clynia"></header>';
    h += '<main class="cq__stage"><div class="cq__step"><h1 class="cq__q">' + interp(s.q) + "</h1>";
    if (s.badge) h += badgeHTML(s.badge);
    if (s.body) h += '<p class="cq__help">' + interp(s.body) + "</p>";
    if (s.steps && s.steps.length) h += flowHTML(s.steps);
    // Cierre fuera del if: antes, un statement sin body dejaba div y main sin cerrar.
    h += "</div></main>";
    h += '<footer class="cq__foot"><div class="in"><button class="cq__next" type="button" id="cqNext">' + esc(s.cta || "Continuar") + "</button>" + (history.length ? '<button class="cq__backlow" type="button" id="cqBackLow">&#8592; Atrás</button>' : "") + "</div></footer>";
    root.innerHTML = h;
    var b = root.querySelector(".cq__back"); if (b) b.onclick = back;
    // El paso final de la parte 2 (submitP2) envía el cuestionario en vez de avanzar.
    document.getElementById("cqNext").onclick = function () { if (s.submitP2) { finishP2(); } else { go(nextOf(s), true); } };
    var bl = document.getElementById("cqBackLow"); if (bl) bl.onclick = back;
  }

  // Iconos de la línea temporal del ending (trazo 24x24, mismo lenguaje visual que el resto del
  // sitio). Si un paso no trae icono conocido, cae al número: nunca queda un hueco vacío.
  var ENDICONS = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    medico: '<path d="M11 2v2"/><path d="M5 2v2"/><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/><path d="M8 15a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/>',
    email: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    ficha: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 12h6"/><path d="M9 16h4"/>'
  };
  function endIcon(name) {
    var p = ENDICONS[name];
    return p ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + "</svg>" : "";
  }
  // Bloques compartidos por la pantalla final y las de tipo statement: mismo componente, mismo
  // aspecto. Si cambias uno, cambian las dos: no dupliques el markup.
  function badgeHTML(txt) {
    return '<span class="cq__badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>' + esc(txt) + "</span>";
  }
  function flowHTML(steps) {
    var h = '<ol class="cq__flow">';
    for (var i = 0; i < steps.length; i++) {
      var st = steps[i];
      var dot = st.done ? endIcon("check") : (ENDICONS[st.icon] ? endIcon(st.icon) : String(i + 1));
      h += '<li class="' + (st.done ? "is-done" : "") + '"><span class="cq__flow-dot" aria-hidden="true">' + dot + '</span><span class="cq__flow-txt"><strong>' + esc(st.t) + "</strong><span>" + esc(st.d) + "</span></span></li>";
    }
    return h + "</ol>";
  }

  function renderEnding(s) {
    var stop = s.variant === "stop";
    // No apto: saca el lead del drip y del embudo (marca Descartado). No-op si no hay lead.
    if (stop) sendDiscard(s.id === "ending_menor" ? "Menor de edad (web)" : "Cribado rojo · no apto (web)");
    var ico = stop
      ? '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>'
      : '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    // Ending "enriquecido" (el que trae distintivo o pasos): titular protagonista y, si el schema
    // lo pide con icono:false, sin la marca redonda de encima.
    var rico = !!(s.badge || (s.steps && s.steps.length));
    var h = '<div class="cq__center ' + (stop ? "stop" : "") + (rico ? " cq__center--flow" : "") + '">';
    // Marca oficial (wordmark con el punto verde). Nunca "Clynia" como texto ni recoloreado.
    if (s.marca) h += '<div class="cq__logo"><img src="/assets/logos/clynia-wordmark.png" alt="Clynia"></div>';
    if (s.icono !== false) h += '<div class="ico' + (stop ? "" : " ico--ok") + '">' + ico + "</div>";
    h += "<h1>" + interp(s.q) + "</h1>";
    // Distintivo tranquilizador ("no tienes que hacer nada"): opcional, solo si el schema lo trae.
    if (s.badge) {
      h += '<span class="cq__badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>' + esc(s.badge) + "</span>";
    }
    if (s.body) h += "<p>" + interp(s.body) + "</p>";
    // "Qué pasa ahora": línea temporal opcional. Hace visible que la pelota no está en su tejado.
    if (s.steps && s.steps.length) {
      h += '<ol class="cq__flow">';
      for (var i = 0; i < s.steps.length; i++) {
        var st = s.steps[i];
        var dot = st.done ? endIcon("check") : (ENDICONS[st.icon] ? endIcon(st.icon) : String(i + 1));
        h += '<li class="' + (st.done ? "is-done" : "") + '"><span class="cq__flow-dot" aria-hidden="true">' + dot + '</span><span class="cq__flow-txt"><strong>' + esc(st.t) + "</strong><span>" + esc(st.d) + "</span></span></li>";
      }
      h += "</ol>";
    }
    if (stop && history.length) {
      h += '<button class="btn" type="button" id="cqEndBack">&#8592; Volver y corregir</button>';
      if (s.href) h += '<a class="cq__endlink" href="' + esc(s.href) + '">Salir a Clynia</a>';
    } else if (s.cta && s.href) {
      if (s.ctaNote) {
        h += '<div class="cq__invite"><p class="cq__invite-note">' + esc(s.ctaNote) + '</p><a class="btn" href="' + esc(s.href) + '">' + esc(s.cta) + "</a></div>";
      } else {
        h += '<a class="btn" href="' + esc(s.href) + '">' + esc(s.cta) + "</a>";
      }
    }
    h += "</div>";
    root.innerHTML = h;
    var eb = document.getElementById("cqEndBack"); if (eb) eb.onclick = back;
  }

  // ── Cloudflare Turnstile: token anti-bot que luego verifica n8n ──
  // La Site Key es pública (va en el HTML). El secreto vive en n8n, nunca aquí.
  var TS_SITEKEY = "0x4AAAAAADujDjAOr7tezclm";
  (function loadTurnstile() {
    try {
      if (!TS_SITEKEY || document.querySelector('script[data-cf-turnstile]')) return;
      var s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      s.async = true; s.defer = true; s.setAttribute("data-cf-turnstile", "1");
      document.head.appendChild(s);
    } catch (e) {}
  })();
  // Renderiza el widget en #cq-ts y devuelve el token por callback. Fail-open en el
  // cliente: si Turnstile no carga, envía token vacío y la decisión la toma n8n.
  function turnstileToken(cb) {
    var done = false;
    function fin(tok) { if (done) return; done = true; cb(tok || ""); }
    try {
      if (!TS_SITEKEY || !window.turnstile) { fin(""); return; }
      var c = document.getElementById("cq-ts");
      if (!c) { fin(""); return; }
      window.turnstile.render(c, {
        sitekey: TS_SITEKEY,
        callback: function (tok) { fin(tok); },
        "error-callback": function () { fin(""); },
        "timeout-callback": function () { fin(""); }
      });
      setTimeout(function () { fin(""); }, 12000);
    } catch (e) { fin(""); }
  }

  // Lee los ficheros elegidos (pendingFiles) como base64 y llama a cb con un mapa
  // { key: { name, type, base64 } }, o con null si no hay ninguno. Va FUERA de `answers` a
  // propósito: el nodo "Validar P2" de n8n recorta toda cadena de answers a 1000 caracteres
  // y destrozaría el base64. cb se llama SIEMPRE (también si la lectura falla): un problema
  // con el adjunto nunca bloquea el envío del cuestionario, que es lo prioritario.
  function collectFiles(cb) {
    var keys = Object.keys(pendingFiles).filter(function (k) { return pendingFiles[k] && answers[k]; });
    if (!keys.length) { cb(null); return; }
    var out = {}, left = keys.length, any = false;
    function one() { left--; if (left === 0) cb(any ? out : null); }
    keys.forEach(function (k) {
      try {
        var f = pendingFiles[k];
        var r = new FileReader();
        r.onload = function () {
          var s = String(r.result || "");
          var i = s.indexOf(",");
          if (i > -1 && s.length > i + 1) { out[k] = { name: f.name, type: f.type || "application/octet-stream", base64: s.slice(i + 1) }; any = true; }
          one();
        };
        r.onerror = function () { one(); };
        r.readAsDataURL(f);
      } catch (e) { one(); }
    });
  }

  function finish() {
    vars = F.computeVars ? F.computeVars(answers) : {};
    root.innerHTML = '<div class="cq__center"><div class="cq__loading"><span class="cq__spin"></span> Enviando tu información de forma segura...</div><div id="cq-ts" style="margin-top:18px;min-height:1px;display:flex;justify-content:center"></div></div>';
    var payload = { product: F.product, intakeId: answers._intakeId, answers: answers, triage: vars, submittedAt: new Date().toISOString(), fase: F.p2StartId ? "parte1" : undefined };
    var plan = (F.plans || []).filter(function (p) { return p.id === answers.plan; })[0];
    var redirected = false;
    // --- Meta Pixel: eventos de conversión. eventID = clave compartida con la CAPI (n8n) para deduplicar. ---
    var leadFired = false;
    function mTrack(ev, params, eid) { try { if (window.fbq) fbq("track", ev, params || {}, eid ? { eventID: eid } : undefined); } catch (e) {} }
    function fireLead(casoId) {
      if (leadFired) return; leadFired = true;
      mTrack("Lead", { content_name: F.product, content_category: F.category || F.product, value: plan ? plan.precio : undefined, currency: "EUR" }, "lead_" + (casoId || ("anon_" + new Date().getTime())));
      ga("generate_lead", { currency: "EUR", value: plan ? plan.precio : 0, product: F.product });
    }
    function fireCheckout(casoId) {
      if (!plan) return;
      mTrack("InitiateCheckout", { content_name: plan.nombre, content_ids: [plan.id], value: plan.precio, currency: "EUR", num_items: 1 }, "ic_" + (casoId || ("anon_" + new Date().getTime())));
      ga("begin_checkout", { currency: "EUR", value: plan.precio, items: [{ item_id: plan.id, item_name: plan.nombre }] });
      // Guardamos el ticket para que gracias.html dispare Purchase con valor y el mismo eventID (dedup con la CAPI).
      try { localStorage.setItem("clynia_pending_purchase", JSON.stringify({ value: plan.precio, currency: "EUR", content_name: plan.nombre, content_ids: [plan.id], store: F.storeKey, eid: "purchase_" + (casoId || ("anon_" + new Date().getTime())) })); } catch (e) {}
    }
    // Ruta por defecto y fallback: Payment Link estático. casoId -> client_reference_id (emparejamiento del pago).
    function payViaLink(casoId) {
      if (redirected) return; redirected = true;
      if (plan && plan.pago) {
        fireCheckout(casoId);
        var url = plan.pago + (plan.pago.indexOf("?") > -1 ? "&" : "?") + "prefilled_email=" + encodeURIComponent(answers.email || "");
        if (casoId) url += "&client_reference_id=" + encodeURIComponent(casoId);
        markReturn();
        window.location.href = url;
      } else { go(byId("ending_ok"), false); }
    }
    // Ruta preferida si está configurada: Stripe Checkout Session creada en servidor (n8n) con el email BLOQUEADO.
    function proceedToPayment(casoId) {
      fireLead(casoId);
      if (!F.checkoutEndpoint || !casoId || !plan) { payViaLink(casoId); return; }
      var settled = false;
      var t = setTimeout(function () { if (settled) return; settled = true; payViaLink(casoId); }, 6000);
      fetch(F.checkoutEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ casoId: casoId, email: answers.email || "", tipo_caso: answers.plan, codigo: answers._code || "" }) })
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (d) {
          if (settled) return; settled = true; clearTimeout(t);
          if (d && d.url) { if (redirected) return; redirected = true; fireCheckout(casoId); markReturn(); window.location.href = d.url; }
          else { payViaLink(casoId); }
        })
        .catch(function () { if (settled) return; settled = true; clearTimeout(t); payViaLink(casoId); });
    }
    // ── Fallo del intake SIN caso creado ──
    // Con plan (flujo de pago): NO bloqueamos, seguimos al pago igualmente (el caso se
    // reconcilia después por email/intakeId). Sin plan (CONSULTA GRATIS y formularios de
    // alta): la pantalla de gracias promete "lo hemos recibido y lo revisaremos"; mostrarla
    // sin caso creado es mentir y perder el envío en silencio (nadie reintenta porque cree
    // que ya está hecho). En ese caso se enseña reintento, igual que la parte 2 (finishP2).
    function finishFail() {
      if (redirected) return;
      root.innerHTML = '<div class="cq__center stop"><h1>No se ha podido enviar</h1><p>Comprueba tu conexión y vuelve a intentarlo en un momento. Tus respuestas siguen guardadas en este dispositivo.</p><button class="btn" type="button" id="cqRetry1">Reintentar</button></div>';
      var b = document.getElementById("cqRetry1"); if (b) b.onclick = function () { finish(); };
    }
    function afterIntake(cid) {
      if (cid || plan) { proceedToPayment(cid); } else { finishFail(); }
    }
    if (!F.webhook) { proceedToPayment(null); return; }
    // Si ya creamos el caso en este intake, no lo recreamos: evita duplicados al volver atrás y reintentar.
    if (answers._caso) { proceedToPayment(answers._caso); return; }
    // Failsafe: si el intake tarda demasiado, decide afterIntake (el pago sigue; la consulta reintenta).
    var failsafe = setTimeout(function () { afterIntake(null); }, 14000);
    turnstileToken(function (cfToken) {
      payload.cf_token = cfToken;
      collectFiles(function (files) {
        if (files) payload.files = files;
        fetch(F.webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
          .then(function (r) { return r.json().catch(function () { return {}; }); })
          .then(function (data) { clearTimeout(failsafe); var cid = data && data.casoId ? data.casoId : null; if (cid) { answers._caso = cid; save(); } afterIntake(cid); })
          .catch(function () {
            clearTimeout(failsafe);
            // El respaldo _pending va SIN los ficheros: un base64 de varios MB no cabe en la
            // cuota de localStorage y tiraría también las respuestas.
            try { var pcopy = {}; Object.keys(payload).forEach(function (k) { if (k !== "files") pcopy[k] = payload[k]; }); localStorage.setItem(F.storeKey + "_pending", JSON.stringify(pcopy)); } catch (e) {}
            afterIntake(null);
          });
      });
    });
  }

  // ── Envío de la PARTE 2 (post-pago): POST al webhook de n8n, que funde las respuestas
  // con el caso de la parte 1 (por intakeId), recalcula el cribado, asigna médico y genera
  // el informe PreMed. Si falla, las respuestas siguen en este dispositivo y se puede
  // reintentar (también desde el enlace del email). ──
  function finishP2() {
    vars = F.computeVars ? F.computeVars(answers) : {};
    root.innerHTML = '<div class="cq__center"><div class="cq__loading"><span class="cq__spin"></span> Enviando tu cuestionario de forma segura...</div></div>';
    var payload = { intakeId: answers._intakeId, answers: {}, triage: vars, submittedAt: new Date().toISOString() };
    Object.keys(answers).forEach(function (k) { if (k.charAt(0) !== "_") payload.answers[k] = answers[k]; });
    var done = false;
    function fail() {
      if (done) return; done = true;
      root.innerHTML = '<div class="cq__center stop"><h1>No se ha podido enviar</h1><p>Comprueba tu conexión y vuelve a intentarlo en un momento. Tus respuestas siguen guardadas en este dispositivo y tienes el enlace en tu correo.</p><button class="btn" type="button" id="cqRetryP2">Reintentar</button></div>';
      var b = document.getElementById("cqRetryP2"); if (b) b.onclick = function () { finishP2(); };
    }
    collectFiles(function (files) {
      if (files) payload.files = files;
      // Con adjunto (la analítica puede rondar los 3,5 MB) se da más margen antes de enseñar
      // el reintento: en una conexión móvil lenta la subida legítima puede pasar de 15 s.
      var t = setTimeout(fail, files ? 30000 : 15000);
      fetch(F.part2Webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (d) {
          clearTimeout(t);
          if (done) return;
          if (d && d.ok) {
            done = true;
            px("P2Complete", { content_name: F.product, content_category: F.category || F.product });
            ga("p2_complete", { product: F.product });
            clearStore();
            go(byId("ending_p2_ok"), false);
          } else { fail(); }
        })
        .catch(function () { clearTimeout(t); fail(); });
    });
  }

  document.body.classList.add("cq-body");
  // Identificador estable de este intake: permite volver atrás y reintentar sin duplicar el caso.
  if (!answers._intakeId) {
    try { answers._intakeId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10)); }
    catch (e) { answers._intakeId = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10); }
    save();
  }
  // Reanudar: si volvemos del pago, al paso de planes; si no, al primer paso (respuestas ya guardadas).
  resume();
  // Volver atrás desde el pago restaura la página desde la bfcache con el spinner congelado:
  // repintamos la vista (paso de planes) para que el usuario pueda cambiar de plan o revisar.
  window.addEventListener("pageshow", function (e) {
    if (!e.persisted) return;
    var fromPay = false;
    try { fromPay = !!sessionStorage.getItem(F.storeKey + "_return"); } catch (ex) {}
    if (fromPay) resume();
  });
  // Red de seguridad: si la persona abandona la pestaña tras dejar email + consentimiento,
  // intentamos guardar el lead parcial antes de que se vaya (una sola vez, gated por leadWebhook).
  window.addEventListener("pagehide", function () { try { sendPartial(); } catch (e) {} });
})();
