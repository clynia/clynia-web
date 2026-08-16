// Video-tutorial "Asi funciona Clynia": elige la fuente segun la pantalla antes de cargar.
// En movil (menos de 720 px) va una version VERTICAL, montada aparte para la web: en un movil
// el 16:9 se queda en una tira estrecha y el texto que sale en pantalla no hay quien lo lea.
// De 720 px para arriba, el horizontal de siempre: 1080p desde 1024 px y 720p entre medias.
// La forma del marco NO la decide este script, la decide el CSS (9/16 debajo de 720 px y 16/9
// encima): el fichero lleva defer, asi que el hueco se pinta antes de que esto corra.
//
// Lo que carga primero NO es el video entero, es un CLIP DE VISTA PREVIA de 7 s, mudo, en
// bucle y sin pista de audio siquiera (~85 KB el horizontal, ~93 KB el vertical). Va asi para
// que se vea de un golpe que eso es un VIDEO y no una foto: el movimiento es la senal, sin
// tener que explicarlo con texto. Cada clip empieza EXACTAMENTE en el fotograma del poster de
// su formato (segundo 12,5 del master horizontal y 24,5 del vertical), asi que al entrar el
// bucle no hay salto: la imagen que ya estaba es la que arranca.
// Al pulsar el play se cambia la fuente al video completo, vuelve al principio, recupera el
// sonido y salen los controles nativos.
(function () {
  var video = document.querySelector('.video__frame video');
  if (!video) return;
  var frame = video.parentNode;
  var play = document.querySelector('.video__play');

  var base = 'assets/video/clynia-como-funciona-';
  var vertical = window.innerWidth < 720;
  // El poster del HTML es el horizontal: es el que ve Google y el que queda si esto no corre.
  if (vertical) video.poster = base + 'poster-vertical.jpg';

  var completo = base + (vertical ? 'vertical' : (window.innerWidth >= 1024 ? '1080' : '720')) + '.mp4';
  var previa = base + 'preview' + (vertical ? '-vertical' : '') + '.mp4';

  // Hay dos motivos para NO mover nada y dejar el poster quieto: que el usuario haya pedido
  // menos animacion en su sistema, o que este pagando los megas (ahorro de datos o una red
  // lenta de verdad). En esos casos no se descarga ni el clip: el video se queda sin fuente
  // hasta que pulsen, y lo unico que se ve es el poster con su boton.
  function sinBucle() {
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
    } catch (e) { /* navegador sin matchMedia: seguimos */ }
    var red = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (red) {
      if (red.saveData === true) return true;
      if (red.effectiveType === '2g' || red.effectiveType === 'slow-2g') return true;
    }
    return false;
  }

  if (!sinBucle()) {
    // muted ANTES que el src: es la condicion que miran los navegadores para dejar que un
    // video arranque solo. Ademas los clips no llevan pista de audio, asi que aunque algo
    // fallara aqui no hay sonido que pueda sonar.
    video.muted = true;
    video.setAttribute('muted', '');
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = previa;
    video.load();
    // Si el navegador se niega a reproducir solo, no pasa nada: queda el poster y el boton.
    var bucle = video.play();
    if (bucle && bucle.catch) bucle.catch(function () {});
  }

  // Del clip al video completo. Se llama una sola vez: despues mandan los controles nativos.
  var arrancado = false;
  function arrancar() {
    if (arrancado) return;
    arrancado = true;
    video.loop = false;
    video.removeAttribute('loop');
    video.autoplay = false;
    video.removeAttribute('autoplay');
    video.muted = false;
    video.removeAttribute('muted');
    // Los controles nativos NO van en el HTML: se activan aqui, para que el poster se vea
    // limpio hasta que el usuario decide. Una vez puestos ya no se quitan, asi que siguen
    // ahi si pausa.
    video.controls = true;
    video.preload = 'auto';
    // El poster se queda puesto: mientras el video completo carga se ve el fotograma de
    // siempre, no un hueco negro.
    video.src = completo;
    video.load();
    video.addEventListener('loadedmetadata', function alPrincipio() {
      video.removeEventListener('loadedmetadata', alPrincipio);
      video.currentTime = 0;
    });
    if (play) play.classList.add('is-hidden');
    var entero = video.play();
    if (entero && entero.catch) entero.catch(function () {});
  }

  if (play) play.addEventListener('click', arrancar);
  // El marco entero vale de boton mientras corre el bucle. Despues no estorba: arrancar() ya
  // no hace nada y los clics se los queda el reproductor nativo.
  if (frame) frame.addEventListener('click', arrancar);
})();
