/* Clynia — menú de navegación móvil.
   En pantallas < 880px la barra superior solo mostraba el logo: los enlaces (.topnav__links)
   estaban en display:none y no había ningún botón para abrirlos, así que no se podía navegar.
   Este script añade un botón hamburguesa y un panel desplegable con los enlaces del menú y las
   acciones (Colabora / Acceso al portal), todo alcanzable en móvil. Es accesible: aria-expanded,
   cierre con Escape, al pulsar un enlace y al tocar fuera. En >=880px no hace nada (el nav de
   escritorio se ve como siempre). Se inyecta desde cookies.js en todas las páginas; en las que no
   tienen barra (formularios) no hace nada.
   Se estiliza a sí mismo (inyecta su <style>) para funcionar igual con styles.css y con home.css. */
(function () {
  "use strict";
  function init() {
    var navs = document.querySelectorAll(".topnav");
    if (!navs.length) return;

    if (!document.getElementById("clynia-navmenu-css")) {
      var st = document.createElement("style");
      st.id = "clynia-navmenu-css";
      st.textContent = [
        ".topnav__toggle{display:none;flex:none;width:44px;height:44px;align-items:center;justify-content:center;",
        "background:transparent;border:0;border-radius:11px;color:var(--green,#437066);cursor:pointer;margin-left:2px;-webkit-tap-highlight-color:transparent}",
        ".topnav__toggle:hover{background:var(--green-tint,rgba(67,112,102,.1))}",
        ".topnav__toggle svg{width:26px;height:26px;display:block}",
        ".topnav__toggle .nav-x{display:none}",
        ".topnav.nav-open .topnav__toggle .nav-bars{display:none}",
        ".topnav.nav-open .topnav__toggle .nav-x{display:block}",
        ".topnav__panel{display:none}",
        "@media (max-width:879.98px){",
        ".topnav__toggle{display:inline-flex}",
        ".topnav__inner>.topnav__links,.topnav__inner>.topnav__actions{display:none!important}",
        ".topnav__panel{position:absolute;top:100%;left:0;right:0;flex-direction:column;",
        "max-height:78vh;overflow-y:auto;padding:6px 20px 14px;",
        "background:rgba(246,244,239,.99);border-top:1px solid var(--line,#e4e0d7);",
        "box-shadow:0 20px 44px -22px rgba(28,36,33,.55)}",
        ".topnav.nav-open .topnav__panel{display:flex}",
        ".topnav__panel a{display:flex;align-items:center;gap:10px;min-height:48px;padding:9px 4px;",
        "font-family:'Hanken Grotesk',system-ui,-apple-system,'Segoe UI',Arial,sans-serif;",
        "font-size:16.5px;font-weight:500;color:var(--ink,#2c2c2c);",
        "border-bottom:1px solid rgba(67,112,102,.09);text-decoration:none}",
        ".topnav__panel a:last-child{border-bottom:0}",
        ".topnav__panel a.topnav__panel-cta{color:var(--green,#437066);font-weight:600}",
        ".topnav__panel svg{width:19px;height:19px;flex:none}",
        "}",
        "@media (prefers-reduced-motion:no-preference){",
        ".topnav.nav-open .topnav__panel{animation:clyniaNavDrop .22s ease both}",
        "@keyframes clyniaNavDrop{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}",
        "}"
      ].join("");
      document.head.appendChild(st);
    }

    navs.forEach(function (nav, i) {
      var inner = nav.querySelector(".topnav__inner");
      var links = nav.querySelector(".topnav__links");
      if (!inner || !links || nav.querySelector(".topnav__toggle")) return;

      var panel = document.createElement("div");
      panel.className = "topnav__panel";
      panel.id = "clynia-nav-panel-" + i;

      links.querySelectorAll("a").forEach(function (a) {
        panel.appendChild(a.cloneNode(true));
      });
      var actions = nav.querySelector(".topnav__actions");
      if (actions) {
        actions.querySelectorAll("a").forEach(function (a) {
          var c = a.cloneNode(true);
          c.classList.add("topnav__panel-cta");
          // En el panel mostramos siempre la etiqueta larga (sin las variantes compactas de móvil).
          c.querySelectorAll(".topnav__login-short,.topnav__join-short,.topnav__docs-short").forEach(function (e) { e.remove(); });
          c.querySelectorAll(".topnav__login-full,.topnav__join-full,.topnav__docs-full").forEach(function (e) { e.style.display = "inline"; });
          panel.appendChild(c);
        });
      }
      nav.appendChild(panel);

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "topnav__toggle";
      btn.setAttribute("aria-label", "Abrir menú");
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-controls", panel.id);
      btn.innerHTML =
        '<svg class="nav-bars" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>' +
        '<svg class="nav-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';
      inner.appendChild(btn);

      function setOpen(open) {
        nav.classList.toggle("nav-open", open);
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        btn.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
      }
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        setOpen(!nav.classList.contains("nav-open"));
      });
      panel.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });
      document.addEventListener("click", function (e) {
        if (nav.classList.contains("nav-open") && !nav.contains(e.target)) setOpen(false);
      });
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
