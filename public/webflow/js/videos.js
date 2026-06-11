document.addEventListener("DOMContentLoaded", () => {
  const video = document.querySelector(".home-background-video .bg-video");
  if (!video) return;

  const isMobile = window.matchMedia("(max-width: 767px)").matches;

  const src = isMobile ? video.dataset.mobileSrc : video.dataset.desktopSrc;
  const poster = isMobile
    ? video.dataset.mobilePoster
    : video.dataset.desktopPoster;

  if (!src) return;

  video.poster = poster || "";

  video.muted = true;
  video.defaultMuted = true;
  video.autoplay = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "auto";

  video.setAttribute("muted", "");
  video.setAttribute("autoplay", "");
  video.setAttribute("loop", "");
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.setAttribute("preload", "auto");

  let source = video.querySelector("source");

  if (!source) {
    source = document.createElement("source");
    source.type = "video/mp4";
    video.appendChild(source);
  }

  if (source.src !== src) {
    source.src = src;
    video.load();
  }

  const tryPlay = () => {
    video.muted = true;
    video.defaultMuted = true;

    const playPromise = video.play();

    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        console.warn("Video autoplay failed:", error);
      });
    }
  };

  const startVideo = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        tryPlay();
        setTimeout(tryPlay, 250);
        setTimeout(tryPlay, 750);
        setTimeout(tryPlay, 1500);
      });
    });
  };

  video.addEventListener("loadedmetadata", startVideo, { once: true });
  video.addEventListener("loadeddata", startVideo, { once: true });
  video.addEventListener("canplay", startVideo, { once: true });

  if (video.readyState >= 2) {
    startVideo();
  }

  window.addEventListener("load", startVideo, { once: true });

  window.addEventListener("pageshow", startVideo);

  const unlockVideo = () => {
    tryPlay();
    window.removeEventListener("touchstart", unlockVideo);
    window.removeEventListener("click", unlockVideo);
  };

  window.addEventListener("touchstart", unlockVideo, {
    once: true,
    passive: true,
  });
  window.addEventListener("click", unlockVideo, { once: true });
});
