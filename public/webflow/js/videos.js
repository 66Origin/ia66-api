document.addEventListener("DOMContentLoaded", () => {
  const video = document.querySelector(".home-background-video .bg-video");
  if (!video) return;

  const isMobile = window.matchMedia("(max-width: 767px)").matches;

  const src = isMobile ? video.dataset.mobileSrc : video.dataset.desktopSrc;
  const poster = isMobile
    ? video.dataset.mobilePoster
    : video.dataset.desktopPoster;

  video.poster = poster;

  const source = document.createElement("source");
  source.src = src;
  source.type = "video/mp4";

  video.appendChild(source);
  video.load();
  video.play().catch(() => {});
});
