// Video-tutorial "Asi funciona Clynia": elige la fuente segun la pantalla antes de cargar y
// arranca con el boton de play propio.
// En movil (menos de 720 px) va una version VERTICAL, montada aparte para la web: en un movil
// el 16:9 se queda en una tira estrecha y el texto que sale en pantalla no hay quien lo lea.
// De 720 px para arriba, el horizontal de siempre: 1080p desde 1024 px y 720p entre medias.
// La forma del marco NO la decide este script, la decide el CSS (9/16 debajo de 720 px y 16/9
// encima): el fichero lleva defer, asi que el hueco se pinta antes de que esto corra.
(function () {
  var video = document.querySelector('.video__frame video');
  if (!video) return;
  var play = document.querySelector('.video__play');
  var vertical = window.innerWidth < 720;
  // El poster del HTML es el horizontal: es el que ve Google y el que queda si esto no corre.
  if (vertical) {
    video.poster = 'assets/video/clynia-como-funciona-poster-vertical.jpg';
  }
  var src = document.createElement('source');
  src.src = 'assets/video/clynia-como-funciona-' +
    (vertical ? 'vertical' : (window.innerWidth >= 1024 ? '1080' : '720')) + '.mp4';
  src.type = 'video/mp4';
  video.appendChild(src);
  video.load();
  // Los controles nativos NO van en el HTML: se activan al reproducir, para que el poster se
  // vea limpio. Una vez puestos ya no se quitan, asi que siguen ahi si el usuario pausa.
  if (play) {
    play.addEventListener('click', function () { video.controls = true; video.play(); });
    video.addEventListener('play', function () { video.controls = true; play.classList.add('is-hidden'); });
  }
})();
