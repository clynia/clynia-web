/* Rastro verde Clynia que sigue al cursor con retardo. Compartido por todas las paginas.
   Solo en punteros finos (no tactiles) y si no se ha pedido reducir el movimiento. */
(function () {
  var mm = window.matchMedia;
  if (!mm) return;
  if (mm('(prefers-reduced-motion: reduce)').matches) return;
  if (!mm('(pointer: fine)').matches) return;

  function init() {
    if (!document.body || document.querySelector('.cursor-glow')) return;
    var glow = document.createElement('div');
    glow.className = 'cursor-glow';
    glow.setAttribute('aria-hidden', 'true');
    document.body.appendChild(glow);

    var gx = window.innerWidth / 2, gy = window.innerHeight / 2, tx = gx, ty = gy;
    document.addEventListener('mousemove', function (e) {
      tx = e.clientX; ty = e.clientY; glow.style.opacity = '1';
    }, { passive: true });
    document.addEventListener('mouseleave', function () { glow.style.opacity = '0'; });

    (function follow() {
      gx += (tx - gx) * 0.1;
      gy += (ty - gy) * 0.1;
      glow.style.transform = 'translate3d(' + gx.toFixed(1) + 'px,' + gy.toFixed(1) + 'px,0)';
      requestAnimationFrame(follow);
    })();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
