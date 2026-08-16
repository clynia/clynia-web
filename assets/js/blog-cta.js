/* Blog de Clynia: botón de compartir y barra fija de móvil.
   Sin dependencias y sin tocar analítica. Si algo falta en la página, no hace nada. */
(function () {
  "use strict";

  // --- Compartir ---
  // En móvil abre el menú nativo del sistema (WhatsApp, notas, lo que tenga la persona).
  // En escritorio casi nunca existe navigator.share, así que copia el enlace y lo dice.
  var boton = document.querySelector("[data-share]");
  var aviso = document.querySelector("[data-share-ok]");
  if (boton) {
    boton.addEventListener("click", function () {
      var url = window.location.href.split("#")[0];
      var titulo = document.title;
      function copiado() {
        if (!aviso) return;
        aviso.hidden = false;
        window.setTimeout(function () { aviso.hidden = true; }, 2600);
      }
      if (navigator.share) {
        navigator.share({ title: titulo, url: url }).catch(function () { /* cancelar no es un error */ });
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(copiado, function () { window.prompt("Copia el enlace:", url); });
        return;
      }
      window.prompt("Copia el enlace:", url);
    });
  }

  // --- Barra fija (solo móvil, la esconde el CSS a partir de 900px) ---
  // Se calcula con la posición del scroll y no con IntersectionObserver: si alguien salta de
  // golpe con un enlace del índice, el observador no cruza ningún umbral y la barra se queda
  // escondida. Con esto sale siempre que toca, se llegue como se llegue.
  var barra = document.getElementById("stickyBlog");
  var primera = document.querySelector(".artcta:not(.artcta--end)");
  var cierre = document.querySelector(".artcta--end");
  if (!barra) return;

  function arriba(el) {
    return el.getBoundingClientRect().top + (window.scrollY || document.documentElement.scrollTop || 0);
  }

  var pedido = false;
  function pintar() {
    pedido = false;
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    // Aparece cuando la primera invitación ya ha quedado atrás.
    var desde = primera ? arriba(primera) + primera.offsetHeight : 700;
    // Y se retira cuando asoma la del final, para no taparla ni repetirse encima.
    var hasta = cierre ? arriba(cierre) - window.innerHeight * 0.7 : Infinity;
    var ver = y > desde && y < hasta;
    barra.classList.toggle("is-on", ver);
    barra.setAttribute("aria-hidden", ver ? "false" : "true");
  }

  function alScroll() {
    if (pedido) return;
    pedido = true;
    window.requestAnimationFrame(pintar);
  }

  window.addEventListener("scroll", alScroll, { passive: true });
  window.addEventListener("resize", alScroll);
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(pintar); }
  pintar();
})();
