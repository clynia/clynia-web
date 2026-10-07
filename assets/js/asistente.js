/* Asistente virtual de Clynia (voz y chat) sobre ElevenLabs Agents.
   Agente: "Clynia · Asistente web" (agent_7001m4b2psx0e31bwkxzzc7reqa8), configurado en el panel de
   ElevenLabs; el guion y los ajustes viven en clynia-docs/asistente-voz/.

   Por qué un botón propio y no el widget tal cual:
   - Nada de ElevenLabs se carga hasta que la persona pulsa: ni el script (1,5 MB), ni Google Fonts,
     ni ninguna conexión a sus servidores. Quien no lo usa no paga ni rendimiento ni privacidad.
   - El widget y su procesador de audio se sirven desde clynia.es (versión fijada 0.19.0), sin unpkg
     ni jsDelivr.
   - Se le pasa un user-id aleatorio por visita: así el widget no usa FingerprintJS ni guarda un
     identificador del navegador (sin user-id lo hace al iniciar la conversación).
   - El botón sube por encima de la barra fija de las landings y del aviso de cookies, y con el
     asistente abierto se oculta la barra fija en móvil.

   Herramienta de cliente abrir_pagina: solo admite los cuatro destinos de DESTINOS. */
(function () {
  "use strict";

  var AGENT_ID = "agent_7001m4b2psx0e31bwkxzzc7reqa8";
  var WIDGET_SRC = "/assets/vendor/elevenlabs/convai-widget-embed-0.19.0.js";
  var WORKLET_LIBSAMPLERATE = "/assets/vendor/elevenlabs/libsamplerate-2.1.2.worklet.js";
  var TERMS_KEY = "clynia-asistente-terminos-v1";
  var AVATAR = "/assets/img/asistente-orb.svg";
  var DESTINOS = {
    cuestionario_peso: "/peso",
    cuestionario_salud_sexual: "/saludsexual",
    contacto: "/contacto",
    lista_espera: "/lista"
  };
  var ESPERA_ANTES_DE_IR_MS = 1800;

  if (window.__clyniaAsistente) return;
  window.__clyniaAsistente = true;

  var script = document.currentScript;
  var path = window.location.pathname || "/";

  function seccionDe(p) {
    var forzada = script && script.getAttribute("data-seccion");
    if (forzada) return forzada;
    if (/salud-sexual|saludsexual/.test(p)) return "salud_sexual";
    if (/peso/.test(p)) return "peso";
    return "general";
  }
  var SECCION = seccionDe(path);

  function idAleatorio() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  /* ---------- Estilos del botón ---------- */
  var css = ""
    + ".cl-asis{position:fixed;right:16px;bottom:16px;z-index:2147482000;display:inline-flex;align-items:center;gap:10px;"
    + "padding:10px 18px 10px 10px;border:1px solid rgba(255,255,255,.18);border-radius:999px;cursor:pointer;"
    + "background:var(--green,#437066);color:#fff;font:600 15px/1.2 var(--font-text,'Hanken Grotesk',system-ui,sans-serif);"
    + "letter-spacing:.005em;box-shadow:0 10px 26px -12px rgba(54,91,82,.8),0 2px 6px rgba(28,36,33,.12);"
    + "transition:background .2s ease,transform .2s ease,bottom .25s ease,opacity .2s ease;-webkit-tap-highlight-color:transparent}"
    + ".cl-asis:hover{background:var(--green-600,#3d655c);transform:translateY(-1px)}"
    + ".cl-asis:active{transform:translateY(0)}"
    + ".cl-asis:focus-visible{outline:3px solid rgba(67,112,102,.35);outline-offset:3px}"
    + ".cl-asis__orb{position:relative;flex:0 0 auto;width:28px;height:28px;border-radius:50%;"
    + "background:radial-gradient(circle at 36% 32%,#ffffff 0,#e7efeb 13%,#d6e4dd 28%,#437066 55%,#28433c 74%);"
    + "box-shadow:inset 0 0 0 1px rgba(255,255,255,.35);animation:clAsisRespira 3.2s ease-in-out infinite}"
    + ".cl-asis[aria-busy=true] .cl-asis__orb{animation:clAsisGira 1s linear infinite;"
    + "background:conic-gradient(from 0deg,#d6e4dd,#437066,#28433c,#d6e4dd)}"
    + ".cl-asis__txt{white-space:nowrap}"
    + ".cl-asis--mini{padding:9px;gap:0}.cl-asis--mini .cl-asis__txt{display:none}"
    + "@keyframes clAsisRespira{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(.9);opacity:.86}}"
    + "@keyframes clAsisGira{to{transform:rotate(360deg)}}"
    + "@media (min-width:900px){.cl-asis{right:24px;bottom:24px}}"
    + "@media (prefers-reduced-motion:reduce){.cl-asis,.cl-asis__orb{animation:none!important;transition:none!important}}"
    + ".cl-asis-on .sticky-cta{display:none!important}"
    + ".cl-asis[hidden]{display:none!important}";

  function ponerEstilos() {
    var s = document.createElement("style");
    s.setAttribute("data-clynia", "asistente");
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  /* ---------- Botón ---------- */
  var TEXTO = "¿Dudas? Pregúntame";
  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cl-asis";
  btn.setAttribute("aria-label", "Abrir la asistente virtual de Clynia, por voz o por escrito");
  btn.innerHTML = '<span class="cl-asis__orb" aria-hidden="true"></span><span class="cl-asis__txt"></span>';
  var txt = btn.querySelector(".cl-asis__txt");
  txt.textContent = TEXTO;

  /* Coloca el botón por encima de la barra fija (si se ve) y de la tarjeta del aviso de cookies (si está).
     Se mide cuánto tapa cada una desde abajo; una medida de más de media pantalla es una animación a medias
     y se descarta. */
  function tapaDesdeAbajo(el) {
    if (!el) return 0;
    var cs = window.getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return 0;
    var r = el.getBoundingClientRect();
    if (r.height === 0 || r.top >= window.innerHeight || r.bottom <= 0) return 0;
    var tapa = window.innerHeight - r.top;
    return tapa > window.innerHeight * 0.5 ? 0 : tapa;
  }
  var base = function () { return window.innerWidth >= 900 ? 24 : 16; };
  function recolocar() {
    var sticky = document.querySelector(".sticky-cta");
    var cookies = document.querySelector(".ck-bar .ck-card") || document.querySelector(".ck-bar");
    var tapaCookies = tapaDesdeAbajo(cookies);
    var tapa = Math.max(tapaDesdeAbajo(sticky), tapaCookies);
    btn.style.bottom = (tapa > 0 ? Math.round(tapa) + 12 : base()) + "px";
    /* En móvil, mientras el aviso de cookies está a la vista, el botón se queda en el círculo para no tapar el titular. */
    btn.classList.toggle("cl-asis--mini", tapaCookies > 0 && window.innerWidth < 600);
  }
  var pendiente = false;
  function pedirRecolocar() {
    if (pendiente) return;
    pendiente = true;
    window.requestAnimationFrame(function () { pendiente = false; recolocar(); });
  }

  /* ---------- Carga del widget ---------- */
  var cargando = false;
  var abierto = false;

  function cargarScript() {
    return new Promise(function (ok, ko) {
      if (window.customElements && customElements.get("elevenlabs-convai")) return ok();
      var s = document.createElement("script");
      s.src = WIDGET_SRC;
      s.async = true;
      s.onload = function () { ok(); };
      s.onerror = function () { ko(new Error("No se ha podido cargar el widget")); };
      document.head.appendChild(s);
    });
  }

  function herramientas() {
    return {
      abrir_pagina: function (params) {
        var destino = params && params.destino;
        var url = Object.prototype.hasOwnProperty.call(DESTINOS, destino) ? DESTINOS[destino] : null;
        if (!url) return "destino no permitido";
        window.setTimeout(function () { window.location.href = url; }, ESPERA_ANTES_DE_IR_MS);
        return "abriendo " + destino;
      }
    };
  }

  function montar() {
    var el = document.createElement("elevenlabs-convai");
    el.setAttribute("agent-id", AGENT_ID);
    el.setAttribute("language", "es");
    el.setAttribute("default-expanded", "true");
    el.setAttribute("terms-key", TERMS_KEY);
    el.setAttribute("user-id", idAleatorio());
    el.setAttribute("worklet-path-libsamplerate", WORKLET_LIBSAMPLERATE);
    /* Avatar como imagen y no el orbe animado: el orbe usa WebGL y, sin WebGL (algunos móviles y
       navegadores internos de apps), el widget se rompe y no se ve. */
    el.setAttribute("avatar-image-url", AVATAR);
    el.setAttribute("dynamic-variables", JSON.stringify({ pagina: path, seccion: SECCION }));
    el.setAttribute("lang", "es");
    el.addEventListener("elevenlabs-convai:call", function (ev) {
      if (ev && ev.detail && ev.detail.config) {
        ev.detail.config.clientTools = herramientas();
      }
    });
    document.body.appendChild(el);
    estiloInterior(el);
  }

  /* Texto de lectura justificado y con guiones también dentro del widget (regla de la casa). */
  function estiloInterior(el) {
    var intentos = 0;
    (function poner() {
      var sr = el.shadowRoot;
      if (!sr) { if (intentos++ < 50) window.setTimeout(poner, 100); return; }
      var st = document.createElement("style");
      st.textContent = "p{text-align:justify;text-align-last:left;-webkit-hyphens:auto;hyphens:auto}";
      sr.appendChild(st);
    })();
  }

  function abrir() {
    if (cargando || abierto) return;
    cargando = true;
    btn.setAttribute("aria-busy", "true");
    txt.textContent = "Un momento";
    try { if (typeof window.gtag === "function") window.gtag("event", "asistente_abrir", { seccion: SECCION }); } catch (e) {}
    cargarScript()
      .then(function () { return customElements.whenDefined("elevenlabs-convai"); })
      .then(function () {
        montar();
        abierto = true;
        document.documentElement.classList.add("cl-asis-on");
        btn.hidden = true;
      })
      .catch(function () {
        txt.textContent = "No se ha podido abrir";
        window.setTimeout(function () { txt.textContent = TEXTO; }, 4000);
      })
      .then(function () {
        cargando = false;
        btn.removeAttribute("aria-busy");
      });
  }

  function iniciar() {
    ponerEstilos();
    document.body.appendChild(btn);
    btn.addEventListener("click", abrir);
    recolocar();
    window.addEventListener("scroll", pedirRecolocar, { passive: true });
    window.addEventListener("resize", pedirRecolocar);
    document.addEventListener("transitionend", pedirRecolocar, true);
    document.addEventListener("animationend", pedirRecolocar, true);
    document.addEventListener("click", function () { window.setTimeout(pedirRecolocar, 450); }, true);
    try {
      new MutationObserver(pedirRecolocar).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });
    } catch (e) {}
    [300, 900, 2000, 4000].forEach(function (ms) { window.setTimeout(recolocar, ms); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
