/* Clynia · UTM: guarda de dónde viene la visita y lo pasa al cuestionario.
   Sin esto el test de ángulos no se puede leer: los anuncios llegan a la landing con
   ?utm_content=angulo1|2|3, pero el botón manda a /peso sin parámetros y la consulta se
   guardaba en Airtable sin saber qué anuncio la trajo. Ahora:
   1) si la URL trae utm_*, se guarda en sessionStorage (misma pestaña, muere al cerrarla);
   2) se añade a todos los enlaces que llevan al cuestionario, para que sobreviva a
      "abrir en pestaña nueva";
   3) form-engine.js lo lee (URL primero, sessionStorage después) y lo mete en answers._utm,
      que viaja dentro del payload de la consulta y del lead parcial. */
(function () {
  var KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  var STORE = "clynia_utm";
  var qs;
  try { qs = new URLSearchParams(window.location.search); } catch (e) { return; }
  var found = {};
  var any = false;
  KEYS.forEach(function (k) {
    var v = (qs.get(k) || "").trim().slice(0, 80);
    if (v) { found[k] = v; any = true; }
  });
  if (any) {
    try { sessionStorage.setItem(STORE, JSON.stringify(found)); } catch (e) {}
  } else {
    try { found = JSON.parse(sessionStorage.getItem(STORE) || "{}") || {}; any = Object.keys(found).length > 0; } catch (e) { found = {}; }
  }
  if (!any) return;
  var extra = new URLSearchParams(found).toString();
  function tag() {
    var links = document.querySelectorAll('a[href="peso"], a[href="/peso"], a[href^="peso?"], a[href^="/peso?"], a[href="saludsexual"], a[href="/saludsexual"]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.getAttribute("data-utm-tagged")) continue;
      var href = a.getAttribute("href");
      a.setAttribute("href", href + (href.indexOf("?") > -1 ? "&" : "?") + extra);
      a.setAttribute("data-utm-tagged", "1");
    }
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", tag); } else { tag(); }
})();
