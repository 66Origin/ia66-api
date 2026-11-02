// Runs now if the page is already parsed (script loaded late or
// dynamically), otherwise once the DOM is ready.
function onVideosReady(callback) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback, { once: true });
  } else {
    callback();
  }
}

onVideosReady(() => {
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

  video.setAttribute("webkit-playsinline", "");

  const tryPlay = async () => {
    if (!video.paused) return;

    try {
      await video.play();
    } catch (error) {
      console.warn("Video autoplay failed:", error);
    }
  };

  let source = video.querySelector("source");

  if (!source) {
    source = document.createElement("source");
    source.type = "video/mp4";
    video.appendChild(source);
  }

  if (source.getAttribute("src") !== src) {
    source.src = src;
    video.load();
  }

  video.addEventListener("canplay", tryPlay, { once: true });

  if (video.readyState >= 3) {
    tryPlay();
  }

  window.addEventListener("pageshow", tryPlay);

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
