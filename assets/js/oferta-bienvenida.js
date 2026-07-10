/* Clynia — Oferta de bienvenida (-10% primera consulta).
   Barra fina arriba con cuenta atras + ventana para dejar el email a cambio del codigo.
   Autonomo: inyecta su propio CSS. Se incluye SOLO en paginas publicas de captacion
   (nunca en el cuestionario, legales ni gracias). Patron calcado de cookies.js.

   Para relanzar o cambiar fechas: toca DEADLINE aqui y el expires_at del promotion code
   en Stripe. Son los dos unicos puntos con fecha. */
(function () {
  "use strict";

  // ── Configuracion (un solo sitio con fechas) ─────────────────────────────
  var DEADLINE = "2026-07-19T23:59:59+02:00"; // domingo 19 jul 23:59 hora espanola
  var CODE = "BIENVENIDA10";
  var WEBHOOK = "https://n8n-ixwg.srv1722506.hstgr.cloud/webhook/oferta-bienvenida";
  var PRIVACIDAD = "/privacidad";
  var VALORACION_URL = "/peso.html"; // a donde empujamos tras conseguir el codigo

  var KEY_DISMISS = "clynia_oferta_bar_dismissed";
  var KEY_DONE = "clynia_oferta_done";

  var deadlineMs = new Date(DEADLINE).getTime();
  if (!deadlineMs || isNaN(deadlineMs)) return;          // fecha mal escrita: no arrancar
  if (Date.now() > deadlineMs) return;                   // oferta terminada: nada que mostrar
  try { if (localStorage.getItem(KEY_DISMISS) === "1") return; } catch (e) {}
  try { if (localStorage.getItem(KEY_DONE) === "1") return; } catch (e) {} // ya tiene su codigo

  // ── Analitica (se auto-gatea por consentimiento: el pixel arranca con consent revocado
  //    y ga.js encola hasta que el usuario acepta cookies). ─────────────────
  function px(ev, params) { try { if (window.fbq) fbq("trackCustom", ev, params || {}); } catch (e) {} }
  function ga(ev, params) { try { if (window.clyniaGA) window.clyniaGA(ev, params || {}); } catch (e) {} }

  // ── Estilos ──────────────────────────────────────────────────────────────
  var css = ''
    // Barra superior (flujo normal: se ve al cargar; la nav sticky del sitio queda encima al scrollear)
    + '.ob-bar{position:relative;z-index:60;background:linear-gradient(100deg,#437066,#365a52);'
    + "color:#fff;font-family:'Hanken Grotesk',system-ui,-apple-system,'Segoe UI',Arial,sans-serif;"
    + 'font-size:15px;line-height:1.35;box-shadow:0 2px 16px rgba(23,32,28,.18);'
    + 'animation:obdown .45s cubic-bezier(.2,.7,.2,1) both}'
    + '@keyframes obdown{from{transform:translateY(-100%)}to{transform:none}}'
    + '.ob-bar__in{max-width:1120px;margin:0 auto;display:flex;align-items:center;gap:14px 18px;'
    + 'flex-wrap:wrap;justify-content:center;padding:9px 46px 9px 16px;text-align:center}'
    + '.ob-bar__msg{font-weight:500}'
    + '.ob-bar__msg b{font-weight:700}'
    + '.ob-cd{display:inline-flex;align-items:center;gap:5px;font-variant-numeric:tabular-nums}'
    + '.ob-cd__u{background:rgba(255,255,255,.16);border-radius:8px;padding:3px 7px;font-weight:700;'
    + 'font-size:14px;min-width:26px;text-align:center}'
    + '.ob-cd__s{opacity:.7;font-size:11px;font-weight:600;margin-left:1px}'
    + '.ob-bar__cta{background:#fff;color:#2c5249;border:0;border-radius:999px;font:inherit;'
    + 'font-weight:700;font-size:14px;cursor:pointer;padding:8px 18px;white-space:nowrap;'
    + 'box-shadow:0 4px 14px rgba(0,0,0,.12);transition:transform .15s ease,box-shadow .15s ease}'
    + '.ob-bar__cta:hover{transform:translateY(-1px);box-shadow:0 7px 18px rgba(0,0,0,.18)}'
    + '.ob-bar__x{position:absolute;top:50%;right:12px;transform:translateY(-50%);background:transparent;'
    + 'border:0;color:rgba(255,255,255,.85);font-size:22px;line-height:1;cursor:pointer;padding:4px 6px;'
    + 'border-radius:8px}'
    + '.ob-bar__x:hover{background:rgba(255,255,255,.15);color:#fff}'
    + '@media(max-width:600px){.ob-bar__in{padding:9px 40px 9px 12px;font-size:14px;gap:8px 12px}'
    + '.ob-cd__u{font-size:13px;padding:2px 6px;min-width:22px}.ob-bar__cta{padding:7px 15px;font-size:13px}}'
    // Ventana (overlay + tarjeta)
    + '.ob-ov{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;'
    + 'padding:18px;background:rgba(24,34,30,.55);backdrop-filter:blur(3px);animation:obfade .2s ease both}'
    + '@keyframes obfade{from{opacity:0}to{opacity:1}}'
    + '.ob-card{position:relative;width:100%;max-width:440px;background:#fff;color:#2c2c2c;border-radius:22px;'
    + "padding:30px 28px 26px;box-shadow:0 30px 80px rgba(23,32,28,.4);font-family:'Hanken Grotesk',system-ui,-apple-system,'Segoe UI',Arial,sans-serif;"
    + 'animation:obpop .28s cubic-bezier(.2,.8,.2,1) both}'
    + '@keyframes obpop{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}'
    + '.ob-card__x{position:absolute;top:14px;right:14px;background:#f2efe8;border:0;width:34px;height:34px;'
    + 'border-radius:50%;font-size:19px;line-height:1;color:#5b6660;cursor:pointer;transition:background .15s}'
    + '.ob-card__x:hover{background:#e6e2d8;color:#2c2c2c}'
    + '.ob-badge{display:inline-block;background:#eaf1ee;color:#2c5249;font-weight:700;font-size:12px;'
    + 'letter-spacing:.02em;padding:5px 11px;border-radius:999px;margin-bottom:12px}'
    + ".ob-card h2{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:25px;line-height:1.15;"
    + 'margin:0 0 8px;color:#1f2a25}'
    + '.ob-card h2 .n{color:#437066}'
    + '.ob-card__p{margin:0 0 16px;font-size:15px;line-height:1.55;color:#4a544e;text-align:justify;'
    + 'text-justify:inter-word;hyphens:auto}'
    + '.ob-field{margin:0 0 12px}'
    + '.ob-field input[type=email]{width:100%;box-sizing:border-box;border:1.5px solid #d9d5ca;border-radius:12px;'
    + 'padding:13px 15px;font:inherit;font-size:16px;color:#2c2c2c;background:#fbfaf7;transition:border-color .15s,box-shadow .15s}'
    + '.ob-field input[type=email]:focus{outline:0;border-color:#437066;box-shadow:0 0 0 3px rgba(67,112,102,.15);background:#fff}'
    + '.ob-consent{display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.5;color:#5b6660;'
    + 'text-align:left;margin:0 0 16px;cursor:pointer}'
    + '.ob-consent input{margin-top:2px;width:17px;height:17px;accent-color:#437066;flex:0 0 auto;cursor:pointer}'
    + '.ob-consent a{color:#437066;font-weight:600}'
    + '.ob-submit{width:100%;background:#437066;color:#fff;border:0;border-radius:12px;font:inherit;'
    + 'font-weight:700;font-size:16px;cursor:pointer;padding:14px;transition:background .15s}'
    + '.ob-submit:hover{background:#365a52}'
    + '.ob-submit[disabled]{opacity:.6;cursor:default}'
    + '.ob-fine{margin:12px 0 0;font-size:11.5px;line-height:1.5;color:#9a9a92;text-align:center}'
    + '.ob-err{display:none;background:#fdecec;color:#b3261e;border-radius:10px;padding:9px 12px;font-size:13px;margin:0 0 12px}'
    // Estado exito
    + '.ob-ok{text-align:center}'
    + '.ob-ok__ico{width:56px;height:56px;border-radius:50%;background:#eaf1ee;color:#437066;'
    + 'display:flex;align-items:center;justify-content:center;margin:0 auto 14px}'
    + '.ob-code{display:flex;align-items:center;justify-content:center;gap:10px;margin:6px 0 4px}'
    + '.ob-code b{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:24px;font-weight:700;'
    + 'letter-spacing:.06em;color:#1f2a25;background:#f2efe8;border:1.5px dashed #c9c3b5;border-radius:12px;padding:9px 16px}'
    + '.ob-copy{background:#437066;color:#fff;border:0;border-radius:10px;font:inherit;font-weight:600;'
    + 'font-size:13px;cursor:pointer;padding:9px 13px}'
    + '.ob-copy:hover{background:#365a52}'
    + '.ob-go{display:inline-block;margin-top:16px;background:#437066;color:#fff;text-decoration:none;'
    + 'border-radius:12px;font-weight:700;font-size:16px;padding:14px 26px;transition:background .15s}'
    + '.ob-go:hover{background:#365a52}'
    + '@media(prefers-reduced-motion:reduce){.ob-bar,.ob-ov,.ob-card{animation:none}}';

  // ── Utilidades ───────────────────────────────────────────────────────────
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  var bar, ov, cdTimer, lastFocus;

  // ── Cuenta atras ─────────────────────────────────────────────────────────
  function cdHTML() {
    var d = Math.max(0, deadlineMs - Date.now());
    var days = Math.floor(d / 864e5);
    var h = Math.floor((d % 864e5) / 36e5);
    var m = Math.floor((d % 36e5) / 6e4);
    var s = Math.floor((d % 6e4) / 1e3);
    var u = function (v, lbl) { return '<span class="ob-cd__u">' + pad(v) + '<span class="ob-cd__s">' + lbl + '</span></span>'; };
    return (days > 0 ? u(days, "d") : "") + u(h, "h") + u(m, "m") + u(s, "s");
  }
  function tick() {
    if (Date.now() > deadlineMs) { closeBar(true); return; }
    var c = bar && bar.querySelector(".ob-cd");
    if (c) c.innerHTML = cdHTML();
  }

  // ── Barra ────────────────────────────────────────────────────────────────
  function buildBar() {
    bar = el("div", "ob-bar");
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Oferta de bienvenida de Clynia");
    var inner = el("div", "ob-bar__in");
    inner.innerHTML =
      '<span class="ob-bar__msg"><b>10% de bienvenida</b> en tu primera consulta médica. Termina el domingo.</span>'
      + '<span class="ob-cd" aria-hidden="true">' + cdHTML() + '</span>'
      + '<button class="ob-bar__cta" type="button">Quiero mi código</button>';
    var x = el("button", "ob-bar__x", "&times;");
    x.setAttribute("aria-label", "Cerrar aviso");
    bar.appendChild(inner);
    bar.appendChild(x);
    document.body.insertBefore(bar, document.body.firstChild);
    inner.querySelector(".ob-bar__cta").onclick = openModal;
    x.onclick = function () { closeBar(false); };
    cdTimer = setInterval(tick, 1000);
    px("OfertaView", {}); ga("oferta_view", {});
  }
  function closeBar(expired) {
    if (cdTimer) { clearInterval(cdTimer); cdTimer = null; }
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    bar = null;
    if (!expired) { try { localStorage.setItem(KEY_DISMISS, "1"); } catch (e) {} }
  }

  // ── Ventana ──────────────────────────────────────────────────────────────
  function openModal() {
    if (ov) return;
    lastFocus = document.activeElement;
    ov = el("div", "ob-ov");
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    ov.setAttribute("aria-labelledby", "ob-title");
    var card = el("div", "ob-card");
    card.innerHTML = formHTML();
    ov.appendChild(card);
    document.body.appendChild(ov);
    document.body.style.overflow = "hidden";
    bindForm(card);
    var x = el("button", "ob-card__x", "&times;");
    x.setAttribute("aria-label", "Cerrar");
    x.onclick = closeModal;
    card.appendChild(x);
    ov.addEventListener("mousedown", function (e) { if (e.target === ov) closeModal(); });
    document.addEventListener("keydown", onKey);
    var inp = card.querySelector("#ob-email");
    if (inp) setTimeout(function () { try { inp.focus(); } catch (e) {} }, 60);
    px("OfertaOpen", {}); ga("oferta_open", {});
  }
  function closeModal() {
    if (!ov) return;
    document.removeEventListener("keydown", onKey);
    if (ov.parentNode) ov.parentNode.removeChild(ov);
    ov = null;
    document.body.style.overflow = "";
    try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (e) {}
  }
  function onKey(e) { if (e.key === "Escape") closeModal(); }

  function formHTML() {
    return ''
      + '<span class="ob-badge">REGALO DE BIENVENIDA</span>'
      + '<h2 id="ob-title">Tu <span class="n">10%</span> en la primera consulta</h2>'
      + '<p class="ob-card__p">Déjanos tu correo y te enviamos tu código para usarlo en tu primera '
      + 'consulta con un médico colegiado. Un solo email, sin spam, y lo puedes usar cuando quieras '
      + 'antes de que acabe.</p>'
      + '<div class="ob-err" id="ob-err"></div>'
      + '<form id="ob-form" novalidate>'
      + '<div class="ob-field"><input id="ob-email" type="email" inputmode="email" autocomplete="email" '
      + 'placeholder="tucorreo@email.com" aria-label="Tu correo electrónico"></div>'
      + '<label class="ob-consent"><input type="checkbox" id="ob-consent">'
      + '<span>Acepto recibir mi código y comunicaciones de Clynia por email, y he leído la '
      + '<a href="' + PRIVACIDAD + '" target="_blank" rel="noopener">Política de Privacidad</a>. '
      + 'Puedo darme de baja cuando quiera.</span></label>'
      + '<button class="ob-submit" type="submit">Enviar mi código</button>'
      + '</form>'
      + '<p class="ob-fine">Válido hasta el domingo 19 de julio a las 23:59. Solo en tu primera compra en Clynia.</p>';
  }

  function bindForm(card) {
    var form = card.querySelector("#ob-form");
    if (!form) return;
    form.onsubmit = function (e) {
      e.preventDefault();
      var email = (card.querySelector("#ob-email").value || "").trim();
      var consent = card.querySelector("#ob-consent").checked;
      var err = card.querySelector("#ob-err");
      function fail(msg) { err.textContent = msg; err.style.display = "block"; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { fail("Escribe un correo válido para enviarte el código."); return; }
      if (!consent) { fail("Marca la casilla para poder enviarte el código."); return; }
      err.style.display = "none";
      var btn = card.querySelector(".ob-submit");
      btn.disabled = true; btn.textContent = "Enviando...";
      send(email, consent);
      try { localStorage.setItem(KEY_DONE, "1"); } catch (ex) {}
      px("OfertaLead", {}); ga("oferta_lead", { currency: "EUR", value: 0 });
      renderSuccess(card);
    };
  }

  // Envio best-effort del lead a n8n (fire and forget, como el lead parcial del cuestionario).
  function send(email, consent) {
    var body = JSON.stringify({
      email: email,
      consent: !!consent,
      origen: "banner-bienvenida",
      code: CODE,
      path: location.pathname,
      ts: new Date().toISOString()
    });
    var sent = false;
    try { if (navigator.sendBeacon) sent = navigator.sendBeacon(WEBHOOK, new Blob([body], { type: "text/plain;charset=UTF-8" })); } catch (e) {}
    if (!sent) { try { fetch(WEBHOOK, { method: "POST", headers: { "Content-Type": "text/plain" }, body: body, keepalive: true, mode: "no-cors" }); } catch (e) {} }
  }

  function renderSuccess(card) {
    var check = '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    card.innerHTML = ''
      + '<div class="ob-ok">'
      + '<div class="ob-ok__ico">' + check + '</div>'
      + '<span class="ob-badge">CÓDIGO LISTO</span>'
      + '<h2 id="ob-title">Ya es tuyo</h2>'
      + '<p class="ob-card__p" style="text-align:center">Este es tu código. Te lo hemos enviado también '
      + 'a tu correo. Tecléalo en el pago de tu primera consulta.</p>'
      + '<div class="ob-code"><b id="ob-codeval">' + CODE + '</b>'
      + '<button class="ob-copy" type="button" id="ob-copy">Copiar</button></div>'
      + '<a class="ob-go" href="' + VALORACION_URL + '">Empezar mi valoración</a>'
      + '<p class="ob-fine">Válido hasta el domingo 19 de julio a las 23:59.</p>'
      + '</div>';
    var x = el("button", "ob-card__x", "&times;");
    x.setAttribute("aria-label", "Cerrar");
    x.onclick = closeModal;
    card.appendChild(x);
    var copy = card.querySelector("#ob-copy");
    if (copy) copy.onclick = function () {
      try {
        if (navigator.clipboard) navigator.clipboard.writeText(CODE);
        copy.textContent = "Copiado";
        setTimeout(function () { copy.textContent = "Copiar"; }, 1800);
      } catch (e) {}
    };
    // La barra ya no hace falta: la persona tiene su codigo.
    if (bar) closeBar(true);
  }

  // ── Arranque ─────────────────────────────────────────────────────────────
  function init() {
    var st = el("style"); st.textContent = css; document.head.appendChild(st);
    buildBar();
  }
  if (document.body) init();
  else document.addEventListener("DOMContentLoaded", init);
})();
