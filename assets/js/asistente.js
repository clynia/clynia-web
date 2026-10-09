/* Asistente virtual de Clynia (voz y chat) sobre ElevenLabs Agents, con interfaz propia.
   Agente: "Clynia · Asistente web" (agent_7001m4b2psx0e31bwkxzzc7reqa8). El guion y los ajustes
   viven en clynia-docs/asistente-voz/.

   Decisiones:
   - Interfaz propia sobre el SDK oficial @elevenlabs/client 1.27.0 (servido desde clynia.es):
     botón que dice claramente que es una IA, botón grande "Hablar con la asistente", sin el icono
     de teléfono del widget y un círculo animado que reacciona a la voz.
   - Nada de ElevenLabs se carga ni se conecta hasta que la persona pulsa Hablar o Escribir.
   - user-id aleatorio por visita, solo en memoria: no se guarda nada en el navegador.
   - Si no hay micrófono (o se deniega), se pasa a conversación escrita.
   - Herramienta de cliente abrir_pagina: solo los cuatro destinos de DESTINOS.
   - La voz va por WebSocket, NO por WebRTC. El agente tiene lista de webs permitidas y ElevenLabs
     exige la cabecera Origin; por WebRTC no llega y cierra la conversación al instante con
     "Client did not provide the origin header" (comprobado el 9 oct 2026 en su historial: todas
     las de voz fallaron desde que se puso WebRTC el 8 oct a las 20:15, y la de las 20:01 por
     WebSocket funcionó entera).
   - La esfera de puntos (Esfera, abajo) es la misma en el botón, en el panel y en la sección de
     la home (assets/js/esfera-asistente.js la usa a través de window.ClyniaEsfera). */
(function () {
  "use strict";

  var AGENT_ID = "agent_7001m4b2psx0e31bwkxzzc7reqa8";
  var SDK_SRC = "/assets/vendor/elevenlabs/elevenlabs-client-1.27.0.js";
  var LIBSAMPLERATE = "/assets/vendor/elevenlabs/libsamplerate-2.1.2.worklet.js";
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
  var USER_ID = idAleatorio();

  function evento(nombre) {
    try { if (typeof window.gtag === "function") window.gtag("event", nombre, { seccion: SECCION }); } catch (e) {}
  }

  /* ---------- Estilos ---------- */
  var VERDE = "var(--green,#437066)";
  var css = ""
    /* Esfera de puntos en pequeño, sobre el mismo verde oscuro que la sección de la home.
       Se hincha un poco con la voz (--nivel de 0 a 1); el movimiento lo pone la propia esfera. */
    + ".cla-orb{--s:120px;--nivel:0;position:relative;width:var(--s);height:var(--s);border-radius:50%;flex:0 0 auto;overflow:hidden;"
    + "background:radial-gradient(circle at 50% 45%,#1f4a41 0%,#132a25 62%,#0c1714 100%);"
    + "box-shadow:0 18px 40px -18px rgba(12,23,20,.75),inset 0 0 0 1px rgba(159,216,196,.12);"
    + "transform:scale(calc(1 + var(--nivel) * .08));transition:transform .09s linear}"
    + ".cla-orb canvas{position:absolute;inset:0;width:100%;height:100%;display:block}"
    + ".cla-orb[data-estado=conectando]{animation:claRespira 1.4s ease-in-out infinite}"
    + "@keyframes claRespira{0%,100%{transform:scale(1)}50%{transform:scale(.93)}}"

    /* Botón de entrada */
    + ".cla-lanzador{position:fixed;right:16px;bottom:16px;z-index:2147482000;display:flex;align-items:center;gap:12px;"
    + "padding:8px 18px 8px 8px;border:0;border-radius:999px;cursor:pointer;text-align:left;background:#fff;color:#1c2421;"
    + "font-family:'Hanken Grotesk',system-ui,sans-serif;box-shadow:0 14px 34px -14px rgba(28,36,33,.45),0 0 0 1px rgba(28,36,33,.07);"
    + "transition:transform .2s ease,bottom .25s ease,box-shadow .2s ease;-webkit-tap-highlight-color:transparent}"
    + ".cla-lanzador:hover{transform:translateY(-2px);box-shadow:0 18px 40px -14px rgba(28,36,33,.5),0 0 0 1px rgba(67,112,102,.25)}"
    + ".cla-lanzador:focus-visible{outline:3px solid rgba(67,112,102,.4);outline-offset:3px}"
    + ".cla-lanzador .cla-orb{--s:44px}"
    + ".cla-lanzador__t1{display:block;font-size:15px;font-weight:700;line-height:1.2}"
    + ".cla-lanzador__t2{display:block;font-size:12.5px;color:#586460;line-height:1.3;margin-top:2px}"
    + ".cla-lanzador--mini{padding:6px}.cla-lanzador--mini .cla-lanzador__txt{display:none}"
    + "@media (min-width:900px){.cla-lanzador{right:24px;bottom:24px}}"

    /* Panel */
    + ".cla-panel{position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483100;display:flex;flex-direction:column;"
    + "max-height:min(680px,calc(100dvh - 16px));background:#fff;color:#1c2421;border-radius:26px;overflow:hidden;"
    + "font:400 15px/1.5 'Hanken Grotesk',system-ui,sans-serif;"
    + "box-shadow:0 30px 80px -30px rgba(28,36,33,.5),0 0 0 1px rgba(28,36,33,.07);animation:claEntra .35s cubic-bezier(.22,1,.36,1)}"
    + "@media (min-width:600px){.cla-panel{left:auto;right:24px;bottom:24px;width:390px}}"
    + "@keyframes claEntra{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}"
    + ".cla-panel[hidden],.cla-lanzador[hidden],.cla-panel [hidden]{display:none!important}"
    + ".cla-cab{display:flex;align-items:center;gap:10px;padding:12px 12px 12px 16px;border-bottom:1px solid #efece4}"
    + ".cla-cab .cla-orb{--s:30px}"
    + ".cla-cab__t{flex:1;min-width:0}.cla-cab__t1{display:block;font-weight:700;font-size:15px;line-height:1.2}"
    + ".cla-cab__t2{display:block;font-size:12.5px;color:#586460}"
    + ".cla-x{width:40px;height:40px;border:0;border-radius:12px;background:transparent;color:#586460;cursor:pointer;display:grid;place-items:center}"
    + ".cla-x:hover{background:#f6f4ef;color:#1c2421}"
    + ".cla-cuerpo{flex:1;min-height:0;overflow-y:auto;padding:20px 20px 16px;display:flex;flex-direction:column}"
    + ".cla-inicio{display:flex;flex-direction:column;align-items:center}"
    + ".cla-inicio .cla-orb{--s:132px;margin:6px 0 18px}"
    + ".cla-h{font-family:'Fraunces',Georgia,serif;font-weight:500;font-size:23px;line-height:1.2;margin:0 0 10px;text-align:center}"
    + ".cla-p{margin:0 0 18px;color:#1c2421}"
    + ".cla-p,.cla-legal,.cla-msg p{text-align:justify;text-align-last:left;-webkit-hyphens:auto;hyphens:auto}"
    + ".cla-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;border-radius:16px;cursor:pointer;"
    + "font:600 16px/1 'Hanken Grotesk',system-ui,sans-serif;transition:background .2s ease,transform .15s ease}"
    + ".cla-btn:active{transform:scale(.985)}"
    + ".cla-btn--pri{height:54px;border:0;background:" + VERDE + ";color:#fff;box-shadow:0 12px 26px -14px rgba(54,91,82,.9)}"
    + ".cla-btn--pri:hover{background:var(--green-600,#3d655c)}"
    + ".cla-btn--sec{height:46px;margin-top:10px;border:1px solid #e6e1d7;background:#fff;color:#1c2421;font-size:15px}"
    + ".cla-btn--sec:hover{background:#f6f4ef}"
    + ".cla-btn:focus-visible,.cla-ctl:focus-visible,.cla-x:focus-visible,.cla-enviar:focus-visible{outline:3px solid rgba(67,112,102,.4);outline-offset:2px}"
    /* Puntitos que laten dentro del botón Hablar */
    + ".cla-puntos{display:inline-flex;gap:4px;align-items:center}"
    + ".cla-puntos i{width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.9;animation:claPunto 1.2s ease-in-out infinite}"
    + ".cla-puntos i:nth-child(2){animation-delay:.15s}.cla-puntos i:nth-child(3){animation-delay:.3s}"
    + "@keyframes claPunto{0%,80%,100%{transform:translateY(0);opacity:.45}40%{transform:translateY(-5px);opacity:1}}"
    + ".cla-legal{font-size:12px;line-height:1.5;color:#586460;margin:16px 0 0}"
    + ".cla-legal a{color:#365b52}"
    /* Sesión */
    + ".cla-sesion{display:flex;flex-direction:column;min-height:0;flex:1}"
    + ".cla-escena{display:flex;flex-direction:column;align-items:center;padding:4px 0 12px}"
    + ".cla-escena .cla-orb{--s:120px}"
    + ".cla-sesion--texto .cla-escena .cla-orb{--s:44px}"
    + ".cla-estado{margin:12px 0 0;font-size:14px;color:#586460;text-align:center;min-height:21px}"
    + ".cla-msgs{display:flex;flex-direction:column;gap:8px;overflow-y:auto;min-height:60px;max-height:34vh;padding:2px}"
    + ".cla-sesion--texto .cla-msgs{max-height:none;flex:1}"
    + ".cla-msg{max-width:86%;padding:10px 13px;border-radius:16px;font-size:15px;line-height:1.45}"
    + ".cla-msg p{margin:0}"
    + ".cla-msg--agente{align-self:flex-start;background:#f6f4ef;border-bottom-left-radius:5px}"
    + ".cla-msg--usuario{align-self:flex-end;background:" + VERDE + ";color:#fff;border-bottom-right-radius:5px}"
    + ".cla-msg--pensando{align-self:flex-start;background:#f6f4ef;color:#586460;border-bottom-left-radius:5px}"
    + ".cla-form{display:flex;gap:8px;margin-top:12px}"
    + ".cla-input{flex:1;min-width:0;height:46px;padding:0 14px;border:1px solid #e6e1d7;border-radius:16px;font:400 16px 'Hanken Grotesk',system-ui,sans-serif;color:#1c2421;background:#fff}"
    + ".cla-input:focus{outline:none;border-color:" + VERDE + ";box-shadow:0 0 0 3px rgba(67,112,102,.15)}"
    + ".cla-enviar{width:46px;height:46px;flex:0 0 auto;border:0;border-radius:50%;background:" + VERDE + ";color:#fff;cursor:pointer;display:grid;place-items:center}"
    + ".cla-ctls{display:flex;gap:8px;margin-top:12px}"
    + ".cla-ctl{flex:1;height:44px;border:0;border-radius:14px;background:#f6f4ef;color:#1c2421;cursor:pointer;"
    + "font:600 14px 'Hanken Grotesk',system-ui,sans-serif;display:flex;align-items:center;justify-content:center;gap:6px}"
    + ".cla-ctl:hover{background:#efece4}"
    + ".cla-ctl[aria-pressed=true]{background:#e7efeb;color:#365b52}"
    + ".cla-ctl--fin{background:#1c2421;color:#fff}.cla-ctl--fin:hover{background:#28433c}"
    + ".cla-fin{text-align:center;padding:10px 0}"
    + "html.cla-abierto .sticky-cta{display:none!important}"
    + "@media (prefers-reduced-motion:reduce){.cla-orb,.cla-puntos i,.cla-panel{animation:none!important;transition:none!important}}";

  function ponerEstilos() {
    var s = document.createElement("style");
    s.setAttribute("data-clynia", "asistente");
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  /* ---------- Esfera de puntos ----------
     Canvas 2D, sin WebGL, para que se vea en cualquier móvil. La usan el botón, el panel y la
     sección de la home (esfera-asistente.js). Solo se anima mientras está a la vista.
     Opciones: puntos (cuántos), radio (fracción del lado), interactiva (reacciona al ratón). */
  function Esfera(canvas, op) {
    op = op || {};
    var ctx = canvas.getContext && canvas.getContext("2d");
    if (!ctx) return null;
    var reducido = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var N = op.puntos || (window.innerWidth < 600 ? 1100 : 1700);
    var RADIO = op.radio || 0.37;
    var pts = [], i;
    var oro = Math.PI * (3 - Math.sqrt(5));
    for (i = 0; i < N; i++) {
      var y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = oro * i;
      pts.push([Math.cos(th) * r, y, Math.sin(th) * r, Math.random()]);
    }
    var W = 0, H = 0, dpr = 1, escala = 1, raf = 0, t0 = performance.now();
    var aLaVista = true;
    var tx = 0, ty = 0, cx = 0, cy = 0, energia = 0, energiaObj = 0;
    var ondas = [], proxOnda = 1.2;

    function medir() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = canvas.clientWidth, h = canvas.clientHeight;
      W = Math.max(1, Math.round(w * dpr));
      H = Math.max(1, Math.round(h * dpr));
      canvas.width = W; canvas.height = H;
      /* los puntos se encogen con la esfera: a 44 px no pueden medir lo mismo que a 480 */
      escala = Math.max(0.5, Math.min(1, Math.min(w, h) / 360));
    }

    function nuevaOnda(t) {
      var u = Math.random() * 2 - 1, f = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      ondas.push({ x: Math.cos(f) * s, y: u, z: Math.sin(f) * s, t: t });
      if (ondas.length > 4) ondas.shift();
    }

    function pintar(now) {
      raf = 0;
      if (Math.round(canvas.clientWidth * dpr) !== W || Math.round(canvas.clientHeight * dpr) !== H) medir();
      if (W < 4 || H < 4) return;
      var t = (now - t0) / 1000;
      if (!reducido && t > proxOnda) { nuevaOnda(t); proxOnda = t + 1.6 + Math.random() * 1.8; }
      cx += (tx - cx) * 0.05; cy += (ty - cy) * 0.05;
      energia += (energiaObj - energia) * 0.06;

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      var R = Math.min(W, H) * RADIO * (1 + 0.025 * Math.sin(t * 1.4) + energia * 0.06);
      var ox = W / 2, oy = H / 2;
      var ry = t * (0.32 + energia * 0.5) + cx * 0.8;
      var rx = Math.sin(t * 0.21) * 0.45 + cy * 0.6;
      var cY = Math.cos(ry), sY = Math.sin(ry), cX = Math.cos(rx), sX = Math.sin(rx);
      var amp = 0.075 + energia * 0.06;
      var minTam = 0.75 * dpr;

      for (var k = 0; k < pts.length; k++) {
        var p = pts[k], x = p[0], y = p[1], z = p[2];
        /* superficie viva: dos campos de ondas que se cruzan y una respiración por punto */
        var d = amp * Math.sin(3.1 * y + t * 2.2) * Math.cos(2.3 * x - t * 1.4)
          + 0.05 * Math.sin(5.2 * z + t * 3.1 + p[3] * 6.28)
          + 0.018 * Math.sin(t * 4 + p[3] * 40);
        for (var o = 0; o < ondas.length; o++) {
          var w = ondas[o], edad = t - w.t;
          if (edad > 2.6) continue;
          var ang = Math.acos(Math.max(-1, Math.min(1, x * w.x + y * w.y + z * w.z)));
          var frente = ang - edad * 1.9;
          d += 0.16 * Math.exp(-frente * frente * 26) * (1 - edad / 2.6);
        }
        var s = 1 + d;
        var X = x * s, Y = y * s, Z = z * s;
        var x1 = X * cY + Z * sY, z1 = -X * sY + Z * cY;
        var y2 = Y * cX - z1 * sX, z2 = Y * sX + z1 * cX;
        var f = 2.8 / (2.8 - z2);
        var px = ox + x1 * R * f, py = oy + y2 * R * f;
        var prof = (z2 + 1.25) / 2.5; /* 0 detrás, 1 delante */
        if (prof < 0) prof = 0; else if (prof > 1) prof = 1;
        var tam = (0.9 + prof * 2.3 + d * 6) * dpr * escala;
        if (tam < minTam) tam = minTam;
        var brillo = 0.22 + prof * 0.78 + Math.max(0, d) * 2.5;
        if (brillo > 1) brillo = 1;
        var cal = Math.max(0, d) * 6; if (cal > 1) cal = 1;
        var rr = Math.round(70 + prof * 100 + cal * 85), g = Math.round(150 + prof * 75 + cal * 30), b2 = Math.round(130 + prof * 70 + cal * 55);
        if (rr > 255) rr = 255;
        ctx.fillStyle = "rgba(" + rr + "," + g + "," + b2 + "," + brillo.toFixed(3) + ")";
        ctx.fillRect(px - tam / 2, py - tam / 2, tam, tam);
      }
      ctx.globalCompositeOperation = "source-over";
      if (!reducido && aLaVista && !document.hidden) raf = window.requestAnimationFrame(pintar);
    }

    function arrancar() { if (!raf) raf = window.requestAnimationFrame(pintar); }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        aLaVista = es[es.length - 1].isIntersecting;
        if (aLaVista) arrancar();
      }).observe(canvas);
    }
    document.addEventListener("visibilitychange", function () { if (!document.hidden && aLaVista) arrancar(); });
    window.addEventListener("resize", function () { arrancar(); });

    if (op.interactiva) {
      var zona = canvas.parentNode;
      zona.addEventListener("pointermove", function (e) {
        var b = zona.getBoundingClientRect();
        tx = ((e.clientX - b.left) / b.width - 0.5) * 2;
        ty = ((e.clientY - b.top) / b.height - 0.5) * 2;
      });
      zona.addEventListener("pointerenter", function () { energiaObj = 1; });
      zona.addEventListener("pointerleave", function () { energiaObj = 0; tx = 0; ty = 0; });
      zona.addEventListener("pointerdown", function () { energiaObj = 1.6; nuevaOnda((performance.now() - t0) / 1000); });
    }

    arrancar();
    return {
      /* 0 en reposo; sube con la voz para que la superficie se agite y gire más rápido */
      energia: function (v) { energiaObj = v; if (reducido) arrancar(); }
    };
  }
  window.ClyniaEsfera = Esfera;

  /* ---------- Piezas ---------- */
  function orbe(puntos) {
    var o = document.createElement("div");
    o.className = "cla-orb";
    o.setAttribute("aria-hidden", "true");
    var c = document.createElement("canvas");
    o.appendChild(c);
    try { o.esfera = Esfera(c, { puntos: puntos, radio: 0.32 }); } catch (e) { o.esfera = null; }
    return o;
  }
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (html != null) n.innerHTML = html;
    return n;
  }
  var ICO = {
    cerrar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    enviar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    silencio: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 9v3a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.9-.6"/><path d="M19 11a7 7 0 0 1-1.2 3.9M5 11a7 7 0 0 0 11.2 5.6M12 19v3M3 3l18 18"/></svg>',
    teclado: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/></svg>'
  };
  var PUNTOS = '<span class="cla-puntos" aria-hidden="true"><i></i><i></i><i></i></span>';

  /* Botón de entrada */
  var lanzador = el("button", { type: "button", "class": "cla-lanzador", "aria-haspopup": "dialog",
    "aria-label": "Hablar con la asistente virtual de Clynia, una inteligencia artificial" });
  lanzador.appendChild(orbe(240));
  lanzador.appendChild(el("span", { "class": "cla-lanzador__txt" },
    '<span class="cla-lanzador__t1">Habla con nuestra asistente</span>'
    + '<span class="cla-lanzador__t2">Es una IA, por voz o por escrito</span>'));

  /* Panel */
  var panel = el("div", { "class": "cla-panel", role: "dialog", "aria-modal": "false", "aria-label": "Asistente virtual de Clynia", lang: "es", hidden: "" });
  var cab = el("div", { "class": "cla-cab" });
  cab.appendChild(orbe(170));
  cab.appendChild(el("div", { "class": "cla-cab__t" },
    '<span class="cla-cab__t1">Asistente virtual de Clynia</span><span class="cla-cab__t2">Inteligencia artificial</span>'));
  var btnCerrar = el("button", { type: "button", "class": "cla-x", "aria-label": "Cerrar la asistente" }, ICO.cerrar);
  cab.appendChild(btnCerrar);
  panel.appendChild(cab);

  var cuerpo = el("div", { "class": "cla-cuerpo" });
  panel.appendChild(cuerpo);

  /* Pantalla de inicio */
  var inicio = el("div", { "class": "cla-inicio" });
  inicio.appendChild(orbe(560));
  inicio.appendChild(el("h2", { "class": "cla-h" }, "Hola, soy la asistente virtual de Clynia"));
  inicio.appendChild(el("p", { "class": "cla-p" },
    "Soy una inteligencia artificial, no una persona. Te cuento cómo funciona Clynia, qué incluye y cuánto cuesta. Tu caso lo valora siempre un médico, en el cuestionario."));
  var btnHablar = el("button", { type: "button", "class": "cla-btn cla-btn--pri" }, PUNTOS + "<span>Hablar con la asistente</span>");
  var btnEscribir = el("button", { type: "button", "class": "cla-btn cla-btn--sec" }, "Prefiero escribir");
  inicio.appendChild(btnHablar);
  inicio.appendChild(btnEscribir);
  inicio.appendChild(el("p", { "class": "cla-legal" },
    "Al pulsar aceptas que tratemos esta conversación para responderte. No grabamos el audio y guardamos la transcripción 30 días. "
    + "No hace falta que compartas datos de salud; si lo haces, consientes que los usemos solo para responderte. "
    + 'Más información en la <a href="/privacidad" target="_blank" rel="noopener">política de privacidad</a>.'));
  cuerpo.appendChild(inicio);

  /* Pantalla de conversación */
  var sesion = el("div", { "class": "cla-sesion", hidden: "" });
  var escena = el("div", { "class": "cla-escena" });
  var orbeVivo = orbe(560);
  escena.appendChild(orbeVivo);
  var estadoTxt = el("p", { "class": "cla-estado", "aria-live": "polite" }, "");
  escena.appendChild(estadoTxt);
  sesion.appendChild(escena);
  var msgs = el("div", { "class": "cla-msgs", role: "log", "aria-live": "polite", "aria-label": "Conversación" });
  sesion.appendChild(msgs);
  var form = el("form", { "class": "cla-form", hidden: "" });
  var input = el("input", { "class": "cla-input", type: "text", "aria-label": "Escribe tu pregunta", placeholder: "Escribe tu pregunta", autocomplete: "off", maxlength: "500" });
  var btnEnviar = el("button", { type: "submit", "class": "cla-enviar", "aria-label": "Enviar" }, ICO.enviar);
  form.appendChild(input);
  form.appendChild(btnEnviar);
  sesion.appendChild(form);
  var ctls = el("div", { "class": "cla-ctls" });
  var btnSilenciar = el("button", { type: "button", "class": "cla-ctl", "aria-pressed": "false" }, ICO.silencio + "<span>Silenciar</span>");
  var btnTeclado = el("button", { type: "button", "class": "cla-ctl", "aria-pressed": "false" }, ICO.teclado + "<span>Escribir</span>");
  var btnTerminar = el("button", { type: "button", "class": "cla-ctl cla-ctl--fin" }, "<span>Terminar</span>");
  ctls.appendChild(btnSilenciar);
  ctls.appendChild(btnTeclado);
  ctls.appendChild(btnTerminar);
  sesion.appendChild(ctls);
  cuerpo.appendChild(sesion);

  /* Pantalla final */
  var fin = el("div", { "class": "cla-fin", hidden: "" });
  var finTxt = el("p", { "class": "cla-p", style: "text-align:center" }, "Conversación terminada. Gracias por escribirnos.");
  var btnOtraVoz = el("button", { type: "button", "class": "cla-btn cla-btn--pri" }, PUNTOS + "<span>Volver a hablar</span>");
  var btnOtraTexto = el("button", { type: "button", "class": "cla-btn cla-btn--sec" }, "Escribir otra vez");
  fin.appendChild(finTxt);
  fin.appendChild(btnOtraVoz);
  fin.appendChild(btnOtraTexto);
  cuerpo.appendChild(fin);

  /* ---------- Estado ---------- */
  var conv = null;
  var modo = null;           /* "voz" | "texto" */
  var modoHabla = "listening";
  var silenciado = false;
  var raf = 0;
  var pensando = null;
  var arrancando = false;

  function verPantalla(cual) {
    inicio.hidden = cual !== "inicio";
    sesion.hidden = cual !== "sesion";
    fin.hidden = cual !== "fin";
  }
  function setEstado(txt, estadoOrbe) {
    estadoTxt.textContent = txt || "";
    orbeVivo.setAttribute("data-estado", estadoOrbe || "");
  }
  function limpiar(t) {
    return String(t || "").replace(/\[[^\]]{1,40}\]\s*/g, "").trim();
  }
  function anadir(rol, texto) {
    texto = limpiar(texto);
    if (!texto) return;
    quitarPensando();
    var m = el("div", { "class": "cla-msg cla-msg--" + rol });
    var p = document.createElement("p");
    p.textContent = texto;
    m.appendChild(p);
    msgs.appendChild(m);
    msgs.scrollTop = msgs.scrollHeight;
  }
  function ponerPensando() {
    quitarPensando();
    pensando = el("div", { "class": "cla-msg cla-msg--pensando", "aria-label": "La asistente está escribiendo" }, PUNTOS);
    msgs.appendChild(pensando);
    msgs.scrollTop = msgs.scrollHeight;
    if (modo === "texto") orbeVivo.setAttribute("data-estado", "pensando");
  }
  function quitarPensando() {
    if (pensando && pensando.parentNode) pensando.parentNode.removeChild(pensando);
    pensando = null;
    if (modo === "texto") orbeVivo.setAttribute("data-estado", "");
  }

  /* La esfera se agita y se hincha con el volumen de quien habla en cada momento */
  function nivelEsfera(n) {
    orbeVivo.style.setProperty("--nivel", n.toFixed(3));
    if (orbeVivo.esfera) orbeVivo.esfera.energia(n * 1.6);
  }
  function animar() {
    if (!conv || modo !== "voz") { raf = 0; nivelEsfera(0); return; }
    var v = 0;
    try { v = modoHabla === "speaking" ? conv.getOutputVolume() : (silenciado ? 0 : conv.getInputVolume()); } catch (e) {}
    nivelEsfera(Math.min(1, (v || 0) * 1.8));
    raf = window.requestAnimationFrame(animar);
  }

  function cargarSDK() {
    return new Promise(function (ok, ko) {
      if (window.ElevenLabsClient && window.ElevenLabsClient.Conversation) return ok();
      var s = document.createElement("script");
      s.src = SDK_SRC;
      s.async = true;
      s.onload = function () { window.ElevenLabsClient ? ok() : ko(new Error("SDK sin cargar")); };
      s.onerror = function () { ko(new Error("No se ha podido cargar el SDK")); };
      document.head.appendChild(s);
    });
  }

  function herramientas() {
    return {
      abrir_pagina: function (params) {
        var destino = params && params.destino;
        var url = Object.prototype.hasOwnProperty.call(DESTINOS, destino) ? DESTINOS[destino] : null;
        if (!url) return "destino no permitido";
        evento("asistente_abre_" + destino);
        window.setTimeout(function () {
          var c = conv;
          conv = null;
          try { if (c) c.endSession(); } catch (e) {}
          window.location.href = url;
        }, ESPERA_ANTES_DE_IR_MS);
        return "abriendo " + destino;
      }
    };
  }

  /* Voz y texto por WebSocket: por WebRTC ElevenLabs no recibe la cabecera Origin y, con la lista
     de webs permitidas del agente, corta la conversación nada más empezar (ver la cabecera). */
  function arrancar(tipo) {
    if (arrancando) return;
    arrancando = true;
    modo = tipo;
    msgs.innerHTML = "";
    verPantalla("sesion");
    sesion.classList.toggle("cla-sesion--texto", tipo === "texto");
    form.hidden = tipo !== "texto";
    btnSilenciar.hidden = tipo !== "voz";
    btnTeclado.hidden = tipo !== "voz";
    btnTeclado.setAttribute("aria-pressed", "false");
    silenciado = false;
    btnSilenciar.setAttribute("aria-pressed", "false");
    setEstado("Conectando", "conectando");
    evento(tipo === "voz" ? "asistente_hablar" : "asistente_escribir");

    cargarSDK().then(function () {
      var opts = {
        agentId: AGENT_ID,
        connectionType: "websocket",
        userId: USER_ID,
        dynamicVariables: { pagina: path, seccion: SECCION },
        clientTools: herramientas(),
        libsampleratePath: LIBSAMPLERATE,
        onConnect: function () {
          setEstado(tipo === "voz" ? "Te escucho" : "", tipo === "voz" ? "escuchando" : "");
        },
        onDisconnect: function () { terminado(); },
        onError: function (m) { if (window.console) console.warn("[Asistente Clynia]", m); },
        onMessage: function (p) {
          if (!p) return;
          var rol = p.source === "user" || p.role === "user" ? "usuario" : "agente";
          if (rol === "usuario" && modo === "texto") return; /* en texto ya se pinta al enviar */
          anadir(rol, p.message);
        },
        onModeChange: function (p) {
          modoHabla = p && p.mode;
          if (modo !== "voz") return;
          if (modoHabla === "speaking") setEstado("Hablando", "hablando");
          else setEstado(silenciado ? "Micrófono en silencio" : "Te escucho", "escuchando");
        }
      };
      if (tipo === "texto") {
        opts.textOnly = true;
        opts.overrides = { conversation: { textOnly: true } };
      }
      return window.ElevenLabsClient.Conversation.startSession(opts);
    }).then(function (c) {
      conv = c;
      arrancando = false;
      if (tipo === "voz") { if (!raf) raf = window.requestAnimationFrame(animar); }
      else { setEstado("", ""); try { input.focus(); } catch (e) {} }
    }).catch(function (err) {
      arrancando = false;
      conv = null;
      var msg = String((err && (err.name || err.message)) || "");
      if (tipo === "voz" && /NotAllowed|Permission|NotFound|denied|microphone|micr/i.test(msg)) {
        arrancar("texto");
        window.setTimeout(function () {
          anadir("agente", "No tengo acceso a tu micrófono, así que seguimos por escrito. ¿En qué te puedo ayudar?");
        }, 50);
        return;
      }
      setEstado("No he podido conectar. Inténtalo de nuevo en un momento.", "");
      verPantalla("inicio");
    });
  }

  function terminado() {
    var eraConv = !!conv;
    conv = null;
    if (raf) { window.cancelAnimationFrame(raf); raf = 0; }
    nivelEsfera(0);
    quitarPensando();
    if (!panel.hidden && eraConv) verPantalla("fin");
  }

  function terminar() {
    var c = conv;
    conv = null;
    try { if (c) c.endSession(); } catch (e) {}
    terminado();
    verPantalla("fin");
  }

  function abrirPanel() {
    panel.hidden = false;
    lanzador.hidden = true;
    document.documentElement.classList.add("cla-abierto");
    verPantalla(conv ? "sesion" : "inicio");
    evento("asistente_abrir");
    window.setTimeout(function () { try { (conv ? btnTerminar : btnHablar).focus(); } catch (e) {} }, 60);
  }
  function cerrarPanel() {
    if (conv) terminar();
    panel.hidden = true;
    lanzador.hidden = false;
    document.documentElement.classList.remove("cla-abierto");
    try { lanzador.focus(); } catch (e) {}
    recolocar();
  }

  /* ---------- Colocación del botón de entrada ---------- */
  function tapaDesdeAbajo(n) {
    if (!n) return 0;
    var cs = window.getComputedStyle(n);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return 0;
    var r = n.getBoundingClientRect();
    if (r.height === 0 || r.top >= window.innerHeight || r.bottom <= 0) return 0;
    var tapa = window.innerHeight - r.top;
    return tapa > window.innerHeight * 0.5 ? 0 : tapa;
  }
  function base() { return window.innerWidth >= 900 ? 24 : 16; }
  function recolocar() {
    var sticky = document.querySelector(".sticky-cta");
    var cookies = document.querySelector(".ck-bar .ck-card") || document.querySelector(".ck-bar");
    var tapaCookies = tapaDesdeAbajo(cookies);
    var tapa = Math.max(tapaDesdeAbajo(sticky), tapaCookies);
    lanzador.style.bottom = (tapa > 0 ? Math.round(tapa) + 12 : base()) + "px";
    lanzador.classList.toggle("cla-lanzador--mini", tapaCookies > 0 && window.innerWidth < 600);
  }
  var pendiente = false;
  function pedirRecolocar() {
    if (pendiente) return;
    pendiente = true;
    window.requestAnimationFrame(function () { pendiente = false; recolocar(); });
  }

  /* ---------- Eventos ---------- */
  lanzador.addEventListener("click", abrirPanel);
  /* La esfera de assets/js/esfera-asistente.js abre el mismo panel, con su aviso y consentimiento */
  window.ClyniaAsistente = { abrir: function (origen) { if (origen) evento("asistente_abrir_" + origen); abrirPanel(); } };
  btnCerrar.addEventListener("click", cerrarPanel);
  btnHablar.addEventListener("click", function () { arrancar("voz"); });
  btnEscribir.addEventListener("click", function () { arrancar("texto"); });
  btnOtraVoz.addEventListener("click", function () { arrancar("voz"); });
  btnOtraTexto.addEventListener("click", function () { arrancar("texto"); });
  btnTerminar.addEventListener("click", terminar);
  btnSilenciar.addEventListener("click", function () {
    silenciado = !silenciado;
    btnSilenciar.setAttribute("aria-pressed", silenciado ? "true" : "false");
    btnSilenciar.querySelector("span").textContent = silenciado ? "Activar micro" : "Silenciar";
    try { if (conv) conv.setMicMuted(silenciado); } catch (e) {}
    if (modoHabla !== "speaking") setEstado(silenciado ? "Micrófono en silencio" : "Te escucho", "escuchando");
  });
  btnTeclado.addEventListener("click", function () {
    var ver = form.hidden;
    form.hidden = !ver;
    btnTeclado.setAttribute("aria-pressed", ver ? "true" : "false");
    if (ver) try { input.focus(); } catch (e) {}
  });
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var t = input.value.trim();
    if (!t || !conv) return;
    input.value = "";
    anadir("usuario", t);
    if (modo === "texto") ponerPensando();
    try { conv.sendUserMessage(t); } catch (e) {}
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && !panel.hidden) cerrarPanel();
  });
  window.addEventListener("pagehide", function () { try { if (conv) conv.endSession(); } catch (e) {} });

  function iniciar() {
    ponerEstilos();
    document.body.appendChild(lanzador);
    document.body.appendChild(panel);
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
