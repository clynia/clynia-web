// Video-tutorial "Asi funciona Clynia": elige la fuente segun la pantalla (1080p en
// escritorio, 720p en el resto) antes de cargar, y arranca con el boton de play propio.
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
    play.addEventListener('click', function () { video.play(); });
    video.addEventListener('play', function () { play.classList.add('is-hidden'); });
  }
})();
