/* Clynia — Contentsquare (tag UXA "bf49b71f9c7e2", proyecto 940740) con consentimiento
   estricto (RGPD/AEPD). Grabacion de sesion y mapas de calor. NO se carga NADA de
   Contentsquare hasta que el usuario acepta todas las cookies (banner en assets/js/cookies.js,
   clave localStorage "clynia_cookie_consent" === "all"), exactamente igual que GA4
   (assets/js/ga.js) y el pixel de Meta.

   Ademas, NUNCA arranca si la pagina declara window.CLYNIA_NO_REPLAY = true. Esas son las
   paginas con datos personales o de salud (peso, salud sexual, capilar, gracias/parte 2, altas
   de medico y colaborador, lista de espera y contacto): no grabamos datos de salud a un tercero.
   La propia cookies.js ni siquiera inyecta este fichero en esas paginas; este guard es la
   segunda capa.

   API publica:
     window.clyniaCSConsent(valor)  -> cookies.js avisa aqui con la eleccion del banner ("all"
                                       arranca la grabacion; cualquier otra cosa no hace nada). */
(function () {
  "use strict";
  if (window.CLYNIA_NO_REPLAY) return; // pagina excluida de la grabacion (datos personales/salud)
  var TAG = "bf49b71f9c7e2";
  var loaded = false;
  function consentOK() {
    // Mismo criterio que cookies.js y ga.js: "all" y no caducado (180 dias), para no arrancar
    // con un "all" viejo en la misma pagina en la que el banner va a volver a preguntar.
    try {
      if (localStorage.getItem("clynia_cookie_consent") !== "all") return false;
      var ts = parseInt(localStorage.getItem("clynia_cookie_consent_ts") || "0", 10);
      return ts > 0 && (Date.now() - ts) < 180 * 24 * 60 * 60 * 1000;
    } catch (e) { return false; }
  }
  function boot() {
    if (loaded) return;
    loaded = true;
    // Bootstrap oficial de Contentsquare (cola _uxa). Sitio multipagina de HTML estatico: cada
    // pagina carga el tag una vez con su path; el guard CS_CONF cubre el caso SPA (aqui no aplica).
    window._uxa = window._uxa || [];
    if (typeof window.CS_CONF === "undefined") {
      window._uxa.push(["setPath", location.pathname + location.hash.replace("#", "?__")]);
      var s = document.createElement("script");
      s.type = "text/javascript";
      s.async = true;
      s.src = "https://t.contentsquare.net/uxa/" + TAG + ".js";
      (document.head || document.getElementsByTagName("head")[0]).appendChild(s);
    } else {
      window._uxa.push(["trackPageview", location.pathname + location.hash.replace("#", "?__")]);
    }
  }
  window.clyniaCSConsent = function (v) {
    if (v === "all") boot();
    // Al revocar no arrancamos. Si ya estuviera cargado en esta pagina, Contentsquare no expone
    // una API de apagado en caliente; por eso el gate es de arranque (sin "all" no se carga nada).
  };
  if (consentOK()) boot();
})();
