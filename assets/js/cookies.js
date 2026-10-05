/* Clynia — aviso de cookies (LSSI / RGPD, criterio AEPD).
   Banner NO bloqueante: la web se ve y se usa desde el primer momento; el usuario
   elige cuando quiera. Aceptar y rechazar AL MISMO NIVEL y en un clic cada uno (la AEPD
   exige que rechazar sea tan facil como aceptar; nada de muros de cookies). La eleccion
   (aceptar o rechazar) caduca a los 180 dias y se vuelve a preguntar. Sin "all", Meta
   Pixel y GA4 no envian absolutamente nada (el pixel arranca con consent revocado). */
(function () {
  var KEY = "clynia_cookie_consent";
  var TSK = KEY + "_ts";
  var TTL = 180 * 24 * 60 * 60 * 1000; // 180 dias: renovacion del consentimiento y de la negativa

  // Contentsquare (grabacion de sesion / mapas de calor): se inyecta en TODAS las paginas EXCEPTO
  // las que declaren window.CLYNIA_NO_REPLAY (formularios con datos personales o de salud). El
  // propio cs.js no envia NADA a Contentsquare sin consentimiento "all" (mismo criterio que GA4 y
  // el pixel). Se inyecta aqui, antes del early-return de "consentimiento vigente", para que
  // tambien cargue en las visitas de retorno (donde el banner ya no aparece).
  try {
    if (!window.CLYNIA_NO_REPLAY && !window.__clyniaCSInjected) {
      window.__clyniaCSInjected = true;
      var csEl = document.createElement("script");
      csEl.src = "/assets/js/cs.js?v=20260724";
      csEl.defer = true;
      (document.head || document.documentElement).appendChild(csEl);
    }
  } catch (e) {}

  // Menu de navegacion movil: se inyecta en TODAS las paginas; en las que no tienen barra
  // (.topnav) no hace nada. Sin relacion con cookies/consentimiento (no traza nada).
  try {
    if (!window.__clyniaNavInjected) {
      window.__clyniaNavInjected = true;
      var navEl = document.createElement("script");
      navEl.src = "/assets/js/nav.js?v=20260724";
      navEl.defer = true;
      (document.head || document.documentElement).appendChild(navEl);
    }
  } catch (e) {}

  // Retirar o cambiar el consentimiento en cualquier momento (art. 7.3 RGPD, 5 oct 2026): enlace
  // "Configurar cookies" junto a cada enlace del pie a /cookies y boton en la politica de cookies.
  // Borra la decision guardada y las cookies de medicion, revoca lo que ya estaba cargado y RECARGA
  // la pagina: asi no queda vivo ningun script de medicion (GA4 y Contentsquare no se pueden apagar
  // en caliente) y el aviso vuelve a salir limpio para elegir de nuevo.
  window.clyniaConfigurarCookies = function () {
    try { localStorage.removeItem(KEY); localStorage.removeItem(TSK); } catch (e) {}
    try { if (window.fbq) fbq("consent", "revoke"); } catch (e) {}
    try { if (window.clyniaGAConsent) clyniaGAConsent("essential"); } catch (e) {}
    borrarCookiesMedicion();
    try { location.reload(); } catch (e) { if (!document.querySelector(".ck-bar")) init(); }
  };
  function enlacesConfigurar() {
    try {
      var links = document.querySelectorAll('a[href="/cookies"]');
      for (var i = 0; i < links.length; i++) {
        var a = links[i];
        if (!a.closest || !a.closest("footer") || a.getAttribute("data-ck-cfg")) continue;
        a.setAttribute("data-ck-cfg", "1");
        var cfg = document.createElement("a");
        cfg.href = "#";
        cfg.textContent = "Configurar cookies";
        cfg.onclick = function (ev) { ev.preventDefault(); window.clyniaConfigurarCookies(); };
        var li = a.parentNode && a.parentNode.tagName === "LI" ? a.parentNode : null;
        if (li) { var nli = document.createElement("li"); nli.appendChild(cfg); li.parentNode.insertBefore(nli, li.nextSibling); }
        else { a.parentNode.insertBefore(cfg, a.nextSibling); a.parentNode.insertBefore(document.createTextNode(" "), cfg); }
      }
      var btns = document.querySelectorAll("[data-configurar-cookies]");
      for (var j = 0; j < btns.length; j++) {
        btns[j].onclick = function (ev) { ev.preventDefault(); window.clyniaConfigurarCookies(); };
      }
    } catch (e) {}
  }
  if (document.body) enlacesConfigurar();
  else document.addEventListener("DOMContentLoaded", enlacesConfigurar);

  // Borra las cookies propias de medicion (Meta, Google y Contentsquare) al rechazar o retirar el consentimiento.
  function borrarCookiesMedicion() {
    try {
      var host = location.hostname, dominios = ["", host, "." + host];
      var partes = host.split(".");
      if (partes.length > 2) { var base = partes.slice(-2).join("."); dominios.push(base, "." + base); }
      document.cookie.split(";").forEach(function (c) {
        var n = c.split("=")[0].trim();
        if (!/^(_fbp|_fbc|_ga|_ga_.*|_gid|_gat.*|_cs_.*)$/.test(n)) return;
        dominios.forEach(function (d) {
          document.cookie = n + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + (d ? "; domain=" + d : "");
        });
      });
    } catch (e) {}
  }

  var vigente = false;
  try {
    var v = localStorage.getItem(KEY);
    var ts = parseInt(localStorage.getItem(TSK) || "0", 10);
    if (v && ts && (Date.now() - ts) < TTL) vigente = true; // eleccion vigente: no molestar
    else if (v) { localStorage.removeItem(KEY); localStorage.removeItem(TSK); } // caducada: se pregunta de nuevo
  } catch (e) {}

  var css = ''
    + '.ck-bar{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;display:flex;'
    + 'justify-content:center;padding:14px;pointer-events:none;animation:ckin .3s ease both}'
    + '@keyframes ckin{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}'
    + '.ck-card{pointer-events:auto;background:#fff;color:#2c2c2c;max-width:660px;width:100%;'
    + 'border:1px solid #e4e0d7;border-radius:16px;padding:15px 18px;box-shadow:0 18px 50px rgba(23,32,28,.22);'
    + "font-family:'Hanken Grotesk',system-ui,-apple-system,'Segoe UI',Arial,sans-serif;font-size:14px;line-height:1.55;"
    + 'display:flex;align-items:center;gap:16px;flex-wrap:wrap}'
    + '.ck-card p{margin:0;flex:1 1 300px;text-align:left}'
    + '.ck-card strong{color:#1f2a25}'
    + '.ck-card a{color:#437066;font-weight:600;text-decoration:underline}'
    + '.ck-actions{display:flex;gap:10px;flex:0 0 auto}'
    + '.ck-btn{border-radius:11px;font:inherit;font-weight:600;font-size:14px;cursor:pointer;padding:10px 18px;white-space:nowrap}'
    + '.ck-accept{background:#437066;color:#fff;border:0}'
    + '.ck-accept:hover{background:#365a52}'
    + '.ck-reject{background:#fff;color:#2c2c2c;border:1.5px solid #d9d5ca}'
    + '.ck-reject:hover{border-color:#437066}'
    + '.ck-bar.ck-hide{opacity:0;transform:translateY(16px);transition:.24s}'
    + '@media(max-width:560px){.ck-bar{padding:10px}.ck-card{gap:12px}.ck-actions{width:100%}.ck-btn{flex:1}}'
    + '@media(prefers-reduced-motion:reduce){.ck-bar,.ck-bar.ck-hide{animation:none;transition:none}}';

  function init() {
    if (!document.getElementById("ck-style")) {
      var st = document.createElement("style"); st.id = "ck-style"; st.textContent = css; document.head.appendChild(st);
    }
    var bar = document.createElement("div"); bar.className = "ck-bar";
    bar.setAttribute("role", "region"); bar.setAttribute("aria-label", "Aviso de cookies");
    var card = document.createElement("div"); card.className = "ck-card";
    card.innerHTML =
      '<p><strong>Cookies en Clynia.</strong> Usamos cookies propias y de terceros para que la web '
      + 'funcione y para medir qu&eacute; ayuda y qu&eacute; debemos mejorar. T&uacute; eliges, y puedes '
      + 'cambiar de opini&oacute;n cuando quieras desde la <a href="/cookies">pol&iacute;tica de cookies</a>.</p>'
      + '<div class="ck-actions">'
      + '<button class="ck-btn ck-reject" type="button">Rechazar todo</button>'
      + '<button class="ck-btn ck-accept" type="button">Aceptar todo</button>'
      + '</div>';
    bar.appendChild(card);
    document.body.appendChild(bar);
    function choose(v) {
      try { localStorage.setItem(KEY, v); localStorage.setItem(TSK, String(Date.now())); } catch (e) {}
      bar.classList.add("ck-hide");
      setTimeout(function () { if (bar.parentNode) bar.parentNode.removeChild(bar); }, 260);
      // Meta Pixel: solo enviamos eventos si el usuario acepta todo (RGPD/AEPD). El pixel arranca con consent revocado
      // y, desde el 5 oct 2026, el script de Meta (fbevents.js) ni siquiera se descarga hasta aceptar: lo carga
      // clyniaLoadFb(), que define el snippet del <head> de cada pagina.
      try { if (window.fbq) fbq("consent", v === "all" ? "grant" : "revoke"); } catch (e) {}
      try { if (v === "all" && window.clyniaLoadFb) window.clyniaLoadFb(); } catch (e) {}
      if (v !== "all") borrarCookiesMedicion();
      // GA4: solo arranca (y vacia su cola de eventos) si el usuario acepta todo. Ver assets/js/ga.js.
      try { if (window.clyniaGAConsent) clyniaGAConsent(v); } catch (e) {}
      // Contentsquare: solo graba la sesion si el usuario acepta todo. Ver assets/js/cs.js. Si cs.js
      // aun no ha cargado cuando se pulsa, se auto-arranca al cargar porque ya lee el consentimiento.
      try { if (window.clyniaCSConsent) clyniaCSConsent(v); } catch (e) {}
      // Contador anonimo de la decision (aceptar/rechazar): sin datos personales ni cookies, solo la
      // eleccion y la pagina, para medir la tasa de rechazo (webhook n8n -> Airtable "Consentimiento cookies").
      try {
        var ckUrl = "https://n8n-ixwg.srv1722506.hstgr.cloud/webhook/cookie-consent";
        var ckBody = JSON.stringify({ choice: v === "all" ? "accept" : "reject", path: location.pathname, ts: new Date().toISOString() });
        if (navigator.sendBeacon) navigator.sendBeacon(ckUrl, new Blob([ckBody], { type: "text/plain;charset=UTF-8" }));
        else fetch(ckUrl, { method: "POST", headers: { "Content-Type": "text/plain" }, body: ckBody, keepalive: true, mode: "no-cors" });
      } catch (e) {}
    }
    card.querySelector(".ck-accept").onclick = function () { choose("all"); };
    card.querySelector(".ck-reject").onclick = function () { choose("essential"); };
  }

  if (!vigente) {
    if (document.body) init();
    else document.addEventListener("DOMContentLoaded", init);
  }
})();
