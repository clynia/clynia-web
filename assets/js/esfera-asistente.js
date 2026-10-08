/* Clynia · Esfera de la asistente virtual
   Bloque protagonista que invita a usar la asistente (assets/js/asistente.js).
   Rellena cualquier <section data-cla-esfera> con una esfera de puntos animada en canvas 2D
   (sin WebGL, para que se vea en cualquier móvil) y abre el panel de la asistente al pulsar.
   El panel conserva el aviso de que es una IA y el consentimiento antes de empezar. */
(function () {
  "use strict";
  if (window.__clyniaEsfera) return;
  window.__clyniaEsfera = true;

  var css = ""
    + ".cla-banda{padding:clamp(28px,5vw,56px) 0}"
    + ".cla-banda__card{position:relative;overflow:hidden;border-radius:32px;background:radial-gradient(120% 140% at 78% 40%,#1f4a41 0%,#132a25 45%,#0c1714 100%);color:#eef3f0;"
    + "display:grid;grid-template-columns:1.05fr .95fr;align-items:center;gap:clamp(8px,3vw,40px);padding:clamp(28px,5vw,64px);box-shadow:0 40px 80px -40px rgba(12,23,20,.7)}"
    + ".cla-banda__card:before{content:'';position:absolute;inset:0;background-image:radial-gradient(rgba(159,216,196,.09) 1px,transparent 1px);background-size:22px 22px;pointer-events:none;"
    + "-webkit-mask-image:linear-gradient(90deg,#000 0%,transparent 60%);mask-image:linear-gradient(90deg,#000 0%,transparent 60%)}"
    + ".cla-banda__txt{position:relative;z-index:1}"
    + ".cla-banda__h{font-family:Fraunces,Georgia,serif;font-weight:500;font-size:clamp(30px,4.2vw,50px);line-height:1.06;letter-spacing:-.02em;margin:0 0 18px;color:#fff}"
    + ".cla-banda__h em{font-style:italic;color:#9fd8c4}"
    + ".cla-banda__p{font-size:clamp(16px,1.4vw,18px);line-height:1.6;color:rgba(238,243,240,.82);margin:0 0 26px;max-width:34em;text-align:justify;-webkit-hyphens:auto;hyphens:auto}"
    + ".cla-banda__btn{display:inline-flex;align-items:center;gap:12px;border:0;cursor:pointer;font:600 17px/1 'Hanken Grotesk',system-ui,sans-serif;color:#0c1714;background:#9fd8c4;"
    + "padding:17px 26px;border-radius:16px;box-shadow:0 0 0 0 rgba(159,216,196,.5);animation:clabPulso 2.8s ease-out infinite;transition:transform .2s,background .2s}"
    + ".cla-banda__btn:hover{background:#b8e6d5;transform:translateY(-2px)}"
    + ".cla-banda__btn:focus-visible{outline:3px solid #fff;outline-offset:3px}"
    + ".cla-banda__btn svg{flex:none}"
    + ".cla-banda__nota{margin:16px 0 0;font-size:14px;line-height:1.5;color:rgba(238,243,240,.6);max-width:34em;text-align:justify;-webkit-hyphens:auto;hyphens:auto}"
    + ".cla-banda__esfera{position:relative;z-index:1;aspect-ratio:1/1;width:100%;max-width:480px;justify-self:center;border:0;padding:0;background:none;cursor:pointer;border-radius:50%}"
    + ".cla-banda__esfera:focus-visible{outline:3px solid #9fd8c4;outline-offset:6px}"
    + ".cla-banda__esfera:after{content:'';position:absolute;inset:14%;border-radius:50%;background:radial-gradient(circle,rgba(110,200,170,.35) 0%,rgba(67,112,102,.12) 45%,transparent 70%);filter:blur(10px);z-index:-1;animation:clabHalo 5s ease-in-out infinite}"
    + ".cla-banda__esfera canvas{width:100%;height:100%;display:block}"
    + "@keyframes clabPulso{0%{box-shadow:0 0 0 0 rgba(159,216,196,.55)}70%{box-shadow:0 0 0 16px rgba(159,216,196,0)}100%{box-shadow:0 0 0 0 rgba(159,216,196,0)}}"
    + "@keyframes clabHalo{0%,100%{transform:scale(.92);opacity:.8}50%{transform:scale(1.08);opacity:1}}"
    + "@media (max-width:820px){.cla-banda{padding:20px 0}.cla-banda__card{grid-template-columns:1fr;text-align:left;border-radius:26px;padding:22px 20px 26px;gap:4px}.cla-banda__h{font-size:31px;margin-bottom:12px}.cla-banda__p{font-size:16px;margin-bottom:20px}.cla-banda__esfera{order:-1;max-width:300px;margin:-6px auto 0}"
    + ".cla-banda__card:before{-webkit-mask-image:linear-gradient(180deg,#000 0%,transparent 55%);mask-image:linear-gradient(180deg,#000 0%,transparent 55%)}.cla-banda__btn{width:100%;justify-content:center}}"
    + ".cla-lanzador{transition:opacity .25s,transform .25s}html.cla-banda-vista .cla-lanzador{opacity:0;transform:translateY(12px);pointer-events:none}"
    + "@media (prefers-reduced-motion:reduce){.cla-banda__btn,.cla-banda__esfera:after{animation:none}}";

  var MIC = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';

  function abrirAsistente() {
    if (window.ClyniaAsistente && typeof window.ClyniaAsistente.abrir === "function") {
      window.ClyniaAsistente.abrir("esfera");
    } else {
      var l = document.querySelector(".cla-lanzador");
      if (l) l.click();
    }
  }

  /* ---------- Esfera de puntos ---------- */
  function Esfera(canvas) {
    var ctx = canvas.getContext("2d");
    var reducido = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var N = window.innerWidth < 600 ? 1100 : 1700;
    var pts = [], anillo = [], i;
    var oro = Math.PI * (3 - Math.sqrt(5));
    for (i = 0; i < N; i++) {
      var y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = oro * i;
      pts.push([Math.cos(th) * r, y, Math.sin(th) * r, Math.random()]);
    }
    for (i = 0; i < 150; i++) {
      var a = (i / 150) * Math.PI * 2;
      anillo.push([Math.cos(a), Math.sin(a), Math.random()]);
    }
    var W = 0, H = 0, dpr = 1, visible = true, raf = 0, t0 = performance.now();
    var tx = 0, ty = 0, cx = 0, cy = 0, energia = 0, energiaObj = 0;
    var ondas = [], proxOnda = 1.2;

    function medir() {
      var b = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(b.width * dpr));
      H = Math.max(1, Math.round(b.height * dpr));
      canvas.width = W; canvas.height = H;
    }

    function nuevaOnda(t) {
      var u = Math.random() * 2 - 1, f = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      ondas.push({ x: Math.cos(f) * s, y: u, z: Math.sin(f) * s, t: t });
      if (ondas.length > 4) ondas.shift();
    }

    function pintar(now) {
      var t = (now - t0) / 1000;
      if (!reducido && t > proxOnda) { nuevaOnda(t); proxOnda = t + 1.6 + Math.random() * 1.8; }
      cx += (tx - cx) * 0.05; cy += (ty - cy) * 0.05;
      energia += (energiaObj - energia) * 0.06;

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      var R = Math.min(W, H) * 0.37 * (1 + 0.025 * Math.sin(t * 1.4) + energia * 0.06);
      var ox = W / 2, oy = H / 2;
      var ry = t * (0.32 + energia * 0.5) + cx * 0.8;
      var rx = Math.sin(t * 0.21) * 0.45 + cy * 0.6;
      var cY = Math.cos(ry), sY = Math.sin(ry), cX = Math.cos(rx), sX = Math.sin(rx);
      var amp = 0.075 + energia * 0.06;

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
        var tam = (0.9 + prof * 2.3 + d * 6) * dpr;
        if (tam < 0.6) tam = 0.6;
        var brillo = 0.22 + prof * 0.78 + Math.max(0, d) * 2.5;
        if (brillo > 1) brillo = 1;
        var cal = Math.max(0, d) * 6; if (cal > 1) cal = 1;
        var rr = Math.round(70 + prof * 100 + cal * 85), g = Math.round(150 + prof * 75 + cal * 30), b2 = Math.round(130 + prof * 70 + cal * 55);
        if (rr > 255) rr = 255;
        ctx.fillStyle = "rgba(" + rr + "," + g + "," + b2 + "," + brillo.toFixed(3) + ")";
        ctx.fillRect(px - tam / 2, py - tam / 2, tam, tam);
      }

      /* anillo orbital inclinado, gira al revés */
      var ra = -t * 0.55, inc = 1.15 + Math.sin(t * 0.3) * 0.1;
      var cA = Math.cos(ra), sA = Math.sin(ra), cI = Math.cos(inc), sI = Math.sin(inc);
      for (var j = 0; j < anillo.length; j++) {
        var q = anillo[j];
        var ax = (q[0] * cA - q[1] * sA) * 1.42, az = (q[0] * sA + q[1] * cA) * 1.42;
        var ay = -az * sI, az2 = az * cI;
        var fa = 2.8 / (2.8 - az2);
        var pa = (az2 + 1.5) / 3;
        var parp = 0.5 + 0.5 * Math.sin(t * 3 + q[2] * 20);
        var ta = (0.9 + pa * 1.8) * dpr;
        ctx.fillStyle = "rgba(159,216,196," + (0.12 + pa * 0.65 * parp).toFixed(3) + ")";
        ctx.fillRect(ox + ax * R * fa - ta / 2, oy + ay * R * fa - ta / 2, ta, ta);
      }
      ctx.globalCompositeOperation = "source-over";
      if (!reducido && visible) raf = window.requestAnimationFrame(pintar);
      else raf = 0;
    }

    function arrancar() { if (!raf) raf = window.requestAnimationFrame(pintar); }

    medir();
    window.addEventListener("resize", function () { medir(); if (reducido) pintar(performance.now()); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible) arrancar();
      }).observe(canvas);
    }
    document.addEventListener("visibilitychange", function () {
      visible = !document.hidden; if (visible) arrancar();
    });

    var zona = canvas.parentNode;
    zona.addEventListener("pointermove", function (e) {
      var b = zona.getBoundingClientRect();
      tx = ((e.clientX - b.left) / b.width - 0.5) * 2;
      ty = ((e.clientY - b.top) / b.height - 0.5) * 2;
    });
    zona.addEventListener("pointerenter", function () { energiaObj = 1; });
    zona.addEventListener("pointerleave", function () { energiaObj = 0; tx = 0; ty = 0; });
    zona.addEventListener("pointerdown", function () { energiaObj = 1.6; nuevaOnda((performance.now() - t0) / 1000); });

    arrancar();
  }

  function montar(sec) {
    if (sec.getAttribute("data-montada")) return;
    sec.setAttribute("data-montada", "1");
    sec.classList.add("cla-banda");
    if (!sec.getAttribute("aria-label")) sec.setAttribute("aria-label", "Asistente virtual de Clynia");
    sec.innerHTML = ''
      + '<div class="wrap"><div class="cla-banda__card">'
      + '<div class="cla-banda__txt">'
      + '<h2 class="cla-banda__h">¿Dudas? <em>Pregúntaselo</em> a nuestra asistente.</h2>'
      + '<p class="cla-banda__p">Es una inteligencia artificial que te explica cómo funciona Clynia, qué incluye y cuánto cuesta. Háblale como hablarías por teléfono o escríbele, cuando quieras y sin compromiso.</p>'
      + '<button type="button" class="cla-banda__btn">' + MIC + '<span>Hablar con la asistente</span></button>'
      + '<p class="cla-banda__nota">Es una IA, no una persona. No da consejo médico: tu caso lo valora siempre un médico.</p>'
      + '</div>'
      + '<button type="button" class="cla-banda__esfera" aria-label="Abrir la asistente virtual de Clynia, una inteligencia artificial"><canvas aria-hidden="true"></canvas></button>'
      + '</div></div>';
    sec.querySelector(".cla-banda__btn").addEventListener("click", abrirAsistente);
    var zona = sec.querySelector(".cla-banda__esfera");
    zona.addEventListener("click", abrirAsistente);
    try { Esfera(zona.querySelector("canvas")); } catch (e) { if (window.console) console.warn("[Esfera Clynia]", e); }
  }

  function iniciar() {
    var secs = document.querySelectorAll("[data-cla-esfera]");
    if (!secs.length) return;
    var s = document.createElement("style");
    s.setAttribute("data-clynia", "esfera");
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
    for (var i = 0; i < secs.length; i++) montar(secs[i]);
    /* mientras la tarjeta se ve, el botón flotante sobra y en móvil la tapa */
    if ("IntersectionObserver" in window) {
      var vistas = 0;
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { vistas += e.isIntersecting ? 1 : (e.target.__vista ? -1 : 0); e.target.__vista = e.isIntersecting; });
        document.documentElement.classList.toggle("cla-banda-vista", vistas > 0);
      }, { threshold: 0.25 });
      for (var j = 0; j < secs.length; j++) io.observe(secs[j]);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
