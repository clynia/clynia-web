/* Clynia — aviso de cookies (LSSI / RGPD, criterio AEPD).
   Modal centrado de eleccion obligatoria: la pagina queda bloqueada hasta elegir, con
   aceptar y rechazar AL MISMO NIVEL y en un clic cada uno (la AEPD exige que rechazar
   sea tan facil como aceptar; nada de patrones de 2 pasos ni enlaces escondidos).
   La eleccion (aceptar o rechazar) caduca a los 180 dias y se vuelve a preguntar.
   Sin "all", Meta Pixel y GA4 no envian absolutamente nada. */
(function () {
  var KEY = "clynia_cookie_consent";
  var TSK = KEY + "_ts";
  var TTL = 180 * 24 * 60 * 60 * 1000; // 180 dias: renovacion del consentimiento y de la negativa
  try {
    var v = localStorage.getItem(KEY);
    var ts = parseInt(localStorage.getItem(TSK) || "0", 10);
    if (v && ts && (Date.now() - ts) < TTL) return; // eleccion vigente: no molestar
    if (v) { localStorage.removeItem(KEY); localStorage.removeItem(TSK); } // caducada: se pregunta de nuevo
  } catch (e) {}

  var css = ''
    + '.ck-overlay{position:fixed;inset:0;z-index:2147483000;background:rgba(23,32,28,.48);'
    + 'display:flex;align-items:center;justify-content:center;padding:20px;animation:ckin .28s ease both}'
    + '@keyframes ckin{from{opacity:0}to{opacity:1}}'
    + '.ck-modal{background:#fff;color:#2c2c2c;max-width:470px;width:100%;border-radius:20px;'
    + 'padding:26px 26px 20px;box-shadow:0 26px 80px rgba(0,0,0,.3);'
    + "font-family:'Raleway',system-ui,-apple-system,'Segoe UI',Arial,sans-serif;font-size:14.5px;line-height:1.6;"
    + 'animation:ckup .32s ease both;outline:none}'
    + '@keyframes ckup{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}'
    + '.ck-modal h2{margin:0 0 10px;font-size:19px;color:#1f2a25}'
    + '.ck-modal p{margin:0 0 18px;text-align:justify;hyphens:auto}'
    + '.ck-modal a{color:#437066;font-weight:600;text-decoration:underline}'
    + '.ck-actions{display:flex;gap:10px}'
    + '.ck-btn{flex:1;min-height:50px;border-radius:12px;font:inherit;font-weight:600;font-size:15px;cursor:pointer;padding:0 12px}'
    + '.ck-accept{background:#437066;color:#fff;border:0}'
    + '.ck-accept:hover{background:#365a52}'
    + '.ck-reject{background:#fff;color:#2c2c2c;border:1.5px solid #d9d5ca}'
    + '.ck-reject:hover{border-color:#437066}'
    + '.ck-overlay.ck-hide{opacity:0;transition:.22s}'
    + '@media(max-width:520px){.ck-overlay{align-items:flex-end;padding:0}'
    + '.ck-modal{max-width:none;border-radius:20px 20px 0 0;padding:24px 20px calc(18px + env(safe-area-inset-bottom))}}'
    + '@media(prefers-reduced-motion:reduce){.ck-overlay,.ck-modal,.ck-overlay.ck-hide{animation:none;transition:none}}';

  function init() {
    var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    var ov = document.createElement("div"); ov.className = "ck-overlay";
    var box = document.createElement("div");
    box.className = "ck-modal"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-labelledby", "ckTitle"); box.setAttribute("tabindex", "-1");
    box.innerHTML =
      '<h2 id="ckTitle">Cookies en Clynia</h2>'
      + '<p>Usamos cookies propias y de terceros para que la web funcione bien y para medir qu&eacute; ayuda '
      + 'y qu&eacute; debemos mejorar. T&uacute; eliges, y puedes cambiar de opini&oacute;n cuando quieras desde la '
      + '<a href="/cookies">pol&iacute;tica de cookies</a>.</p>'
      + '<div class="ck-actions">'
      + '<button class="ck-btn ck-reject" type="button">Rechazar todo</button>'
      + '<button class="ck-btn ck-accept" type="button">Aceptar todo</button>'
      + '</div>';
    ov.appendChild(box);
    document.body.appendChild(ov);
    var prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    function choose(v) {
      try { localStorage.setItem(KEY, v); localStorage.setItem(TSK, String(Date.now())); } catch (e) {}
      document.documentElement.style.overflow = prevOverflow;
      ov.classList.add("ck-hide");
      setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 240);
      // Meta Pixel: solo enviamos eventos si el usuario acepta todo (RGPD/AEPD). El pixel arranca con consent revocado.
      try { if (window.fbq) fbq("consent", v === "all" ? "grant" : "revoke"); } catch (e) {}
      // GA4: solo arranca (y vacia su cola de eventos) si el usuario acepta todo. Ver assets/js/ga.js.
      try { if (window.clyniaGAConsent) clyniaGAConsent(v); } catch (e) {}
    }
    box.querySelector(".ck-accept").onclick = function () { choose("all"); };
    box.querySelector(".ck-reject").onclick = function () { choose("essential"); };
    try { box.focus(); } catch (e) {}
  }

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded", init);
})();
