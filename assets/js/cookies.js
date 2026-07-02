/* Clynia — aviso de cookies (LSSI / RGPD, criterio AEPD).
   Discreto (abajo a la izquierda), aceptar y rechazar igual de accesibles, enlace a la política.
   Guarda la elección y no vuelve a mostrarse. Las cookies no esenciales deben cargarse solo si consent === "all". */
(function () {
  var KEY = "clynia_cookie_consent";
  try { if (localStorage.getItem(KEY)) return; } catch (e) {}

  var css = ''
    + '.ck-banner{position:fixed;left:16px;bottom:16px;z-index:2147483000;max-width:360px;'
    + 'background:#fff;color:#2c2c2c;border:1px solid #e4e1d8;border-radius:14px;'
    + 'box-shadow:0 10px 34px rgba(0,0,0,.14);padding:16px 16px 14px;'
    + "font-family:'Raleway',system-ui,-apple-system,'Segoe UI',Arial,sans-serif;font-size:13.5px;line-height:1.55;animation:ckin .3s ease both}"
    + '@keyframes ckin{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}'
    + '.ck-banner p{margin:0 0 12px}'
    + '.ck-banner a{color:#437066;font-weight:600;text-decoration:underline}'
    + '.ck-actions{display:flex;gap:8px}'
    + '.ck-btn{flex:1;min-height:42px;border-radius:10px;font:inherit;font-weight:600;font-size:14px;cursor:pointer;padding:0 12px}'
    + '.ck-accept{background:#437066;color:#fff;border:0}'
    + '.ck-accept:hover{background:#365a52}'
    + '.ck-reject{background:#fff;color:#2c2c2c;border:1.5px solid #d9d5ca}'
    + '.ck-reject:hover{border-color:#437066}'
    + '.ck-banner.ck-hide{opacity:0;transform:translateY(14px);transition:.25s}'
    + '@media(max-width:520px){.ck-banner{left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom));max-width:none;padding:16px}.ck-btn{min-height:48px;font-size:15px}}'
    + '@media(prefers-reduced-motion:reduce){.ck-banner,.ck-banner.ck-hide{animation:none;transition:none}}';

  function init() {
    var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    var box = document.createElement("div");
    box.className = "ck-banner"; box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "Aviso de cookies"); box.setAttribute("aria-live", "polite");
    box.innerHTML =
      '<p>Usamos cookies propias y de terceros para mejorar tu experiencia y por motivos analíticos. '
      + 'Puedes aceptarlas todas, rechazarlas o leer nuestra <a href="cookies">política de cookies</a>.</p>'
      + '<div class="ck-actions">'
      + '<button class="ck-btn ck-reject" type="button">Rechazar todo</button>'
      + '<button class="ck-btn ck-accept" type="button">Aceptar todo</button>'
      + '</div>';
    document.body.appendChild(box);
    function choose(v) {
      try { localStorage.setItem(KEY, v); } catch (e) {}
      box.classList.add("ck-hide");
      setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 260);
      // Meta Pixel: solo enviamos eventos si el usuario acepta todo (RGPD/AEPD). El píxel arranca con consent revocado.
      try { if (window.fbq) fbq("consent", v === "all" ? "grant" : "revoke"); } catch (e) {}
      // GA4: solo arranca (y vacía su cola de eventos) si el usuario acepta todo. Ver assets/js/ga.js.
      try { if (window.clyniaGAConsent) clyniaGAConsent(v); } catch (e) {}
    }
    box.querySelector(".ck-accept").onclick = function () { choose("all"); };
    box.querySelector(".ck-reject").onclick = function () { choose("essential"); };
  }

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded", init);
})();
