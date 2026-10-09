/* Clynia · Esfera de la asistente virtual
   Bloque protagonista que invita a usar la asistente (assets/js/asistente.js).
   Rellena cualquier <section data-cla-esfera> con la esfera de puntos animada y abre el panel de
   la asistente al pulsar. El panel conserva el aviso de que es una IA y el consentimiento.
   La esfera la dibuja asistente.js (window.ClyniaEsfera), que es la misma que se ve en pequeño en
   el botón y en el chat: una sola animación en toda la web.
   9 oct 2026 (Alfonso): la sección va en verde de lado a lado de la web, no como tarjeta en
   medio, y sin el anillo de partículas alrededor de la esfera, que la hacía parecer plana. */
(function () {
  "use strict";
  if (window.__clyniaEsfera) return;
  window.__clyniaEsfera = true;

  var css = ""
    + ".cla-banda{position:relative;overflow:hidden;color:#eef3f0;padding:clamp(48px,7vw,96px) 0;"
    + "background:radial-gradient(90% 130% at 74% 45%,#1f4a41 0%,#132a25 48%,#0c1714 100%)}"
    + ".cla-banda:before{content:'';position:absolute;inset:0;background-image:radial-gradient(rgba(159,216,196,.09) 1px,transparent 1px);background-size:22px 22px;pointer-events:none;"
    + "-webkit-mask-image:linear-gradient(90deg,#000 0%,transparent 55%);mask-image:linear-gradient(90deg,#000 0%,transparent 55%)}"
    + ".cla-banda__grid{position:relative;z-index:1;display:grid;grid-template-columns:1.05fr .95fr;align-items:center;gap:clamp(8px,3vw,48px)}"
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
    + ".cla-banda__esfera{position:relative;z-index:1;aspect-ratio:1/1;width:100%;max-width:520px;justify-self:center;border:0;padding:0;background:none;cursor:pointer;border-radius:50%}"
    + ".cla-banda__esfera:focus-visible{outline:3px solid #9fd8c4;outline-offset:6px}"
    + ".cla-banda__esfera:after{content:'';position:absolute;inset:14%;border-radius:50%;background:radial-gradient(circle,rgba(110,200,170,.35) 0%,rgba(67,112,102,.12) 45%,transparent 70%);filter:blur(10px);z-index:-1;animation:clabHalo 5s ease-in-out infinite}"
    + ".cla-banda__esfera canvas{width:100%;height:100%;display:block}"
    + "@keyframes clabPulso{0%{box-shadow:0 0 0 0 rgba(159,216,196,.55)}70%{box-shadow:0 0 0 16px rgba(159,216,196,0)}100%{box-shadow:0 0 0 0 rgba(159,216,196,0)}}"
    + "@keyframes clabHalo{0%,100%{transform:scale(.92);opacity:.8}50%{transform:scale(1.08);opacity:1}}"
    + "@media (max-width:820px){.cla-banda{padding:28px 0 40px;background:radial-gradient(140% 70% at 50% 22%,#1f4a41 0%,#132a25 50%,#0c1714 100%)}"
    + ".cla-banda__grid{grid-template-columns:1fr;text-align:left;gap:4px}.cla-banda__h{font-size:31px;margin-bottom:12px}.cla-banda__p{font-size:16px;margin-bottom:20px}"
    + ".cla-banda__esfera{order:-1;max-width:320px;margin:-6px auto 0}"
    + ".cla-banda:before{-webkit-mask-image:linear-gradient(180deg,#000 0%,transparent 45%);mask-image:linear-gradient(180deg,#000 0%,transparent 45%)}.cla-banda__btn{width:100%;justify-content:center}}"
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

  function montar(sec) {
    if (sec.getAttribute("data-montada")) return;
    sec.setAttribute("data-montada", "1");
    sec.classList.add("cla-banda");
    if (!sec.getAttribute("aria-label")) sec.setAttribute("aria-label", "Asistente virtual de Clynia");
    sec.innerHTML = ''
      + '<div class="wrap"><div class="cla-banda__grid">'
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
    if (typeof window.ClyniaEsfera === "function") {
      try { window.ClyniaEsfera(zona.querySelector("canvas"), { interactiva: true }); } catch (e) { if (window.console) console.warn("[Esfera Clynia]", e); }
    } else if (window.console) {
      console.warn("[Esfera Clynia] falta assets/js/asistente.js, que dibuja la esfera");
    }
  }

  var iniciado = false;
  function iniciar() {
    if (iniciado) return;
    var secs = document.querySelectorAll("[data-cla-esfera]");
    if (!secs.length) return;
    iniciado = true;
    var s = document.createElement("style");
    s.setAttribute("data-clynia", "esfera");
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
    for (var i = 0; i < secs.length; i++) montar(secs[i]);
    /* mientras la sección se ve, el botón flotante sobra y en móvil la tapa */
    if ("IntersectionObserver" in window) {
      var vistas = 0;
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { vistas += e.isIntersecting ? 1 : (e.target.__vista ? -1 : 0); e.target.__vista = e.isIntersecting; });
        document.documentElement.classList.toggle("cla-banda-vista", vistas > 0);
      }, { threshold: 0.25 });
      for (var j = 0; j < secs.length; j++) io.observe(secs[j]);
    }
  }

  /* asistente.js va antes en el HTML (los dos con defer), así que ClyniaEsfera ya existe al llegar
     aquí; si algún día cambia el orden, se espera a que todo el HTML y sus scripts estén listos. */
  if (document.readyState === "loading" || typeof window.ClyniaEsfera !== "function") {
    document.addEventListener("DOMContentLoaded", iniciar);
    window.addEventListener("load", iniciar);
  } else iniciar();
})();
