// Video-tutorial "Asi funciona Clynia": elige la fuente segun la pantalla (1080p en
// escritorio, 720p en el resto) antes de cargar, y arranca con el boton de play propio.
// Los controles nativos NO van en el HTML: se activan al reproducir, para que el poster se
// vea limpio. Una vez puestos ya no se quitan, asi que siguen ahi si el usuario pausa.
(function () {
  var video = document.querySelector('.video__frame video');
  if (!video) return;
  var play = document.querySelector('.video__play');
  // Poster propio para movil: en un marco de 358 px el boton se comia el hueco central del de
  // escritorio. El del HTML (12,5 s) se queda como esta: es el que ve Google y el que sale si
  // esto no corre. El de movil (9,7 s) deja el centro despejado bajo el boton.
  if (window.innerWidth < 720) {
    video.poster = 'assets/video/clynia-como-funciona-poster-movil.jpg';
  }
  var src = document.createElement('source');
  src.src = 'assets/video/clynia-como-funciona-' + (window.innerWidth >= 1024 ? '1080' : '720') + '.mp4';
  src.type = 'video/mp4';
  video.appendChild(src);
  video.load();
  if (play) {
    play.addEventListener('click', function () { video.controls = true; video.play(); });
    video.addEventListener('play', function () { video.controls = true; play.classList.add('is-hidden'); });
  }
})();
