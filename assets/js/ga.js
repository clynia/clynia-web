/* Clynia — Google Analytics 4 (G-X7VS1KBEMH) con consentimiento estricto (RGPD/AEPD).
   No se carga NADA de Google hasta que el usuario acepta todas las cookies
   (banner en assets/js/cookies.js, clave localStorage "clynia_cookie_consent" === "all").
   API pública:
     window.clyniaGA(nombre, params)   -> envía un evento (si aún no hay consentimiento, se
                                          encola y solo se envía si el usuario acepta en esta página)
     window.clyniaGAConsent(valor)     -> cookies.js avisa aquí con la elección del banner */
(function () {
  "use strict";
  var ID = "G-X7VS1KBEMH";
  var loaded = false;
  var q = [];
  function consentOK() {
    try { return localStorage.getItem("clynia_cookie_consent") === "all"; } catch (e) { return false; }
  }
  function boot() {
    if (loaded) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    // Solo llegamos aquí con consentimiento "all", por eso el estado por defecto es granted.
    window.gtag("consent", "default", { analytics_storage: "granted", ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" });
    window.gtag("js", new Date());
    window.gtag("config", ID);
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + ID;
    document.head.appendChild(s);
    while (q.length) { var ev = q.shift(); window.gtag("event", ev[0], ev[1]); }
  }
  window.clyniaGA = function (name, params) {
    try {
      if (loaded) window.gtag("event", name, params || {});
      else q.push([name, params || {}]);
    } catch (e) {}
  };
  window.clyniaGAConsent = function (v) { if (v === "all") boot(); };
  if (consentOK()) boot();
})();
