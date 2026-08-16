// Video-tutorial "Asi funciona Clynia": elige la fuente segun la pantalla (1080p en
// escritorio, 720p en el resto) antes de cargar, y arranca con el boton de play propio.
// Los controles nativos NO van en el HTML: se activan al reproducir, para que el poster se
// vea limpio. Una vez puestos ya no se quitan, asi que siguen ahi si el usuario pausa.
(function () {
  var video = document.querySelector('.video__frame video');
  if (!video) return;
  var play = document.querySelector('.video__play');
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
