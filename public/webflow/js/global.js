function getNamespace() {
  return document.querySelector('[data-barba="container"]')?.dataset
    .barbaNamespace;
}

function updateHeaderByNamespace(namespace) {
  const isHome = namespace === "home";
  document.body.classList.toggle("is-home", isHome);
  document.body.classList.toggle("is-page", !isHome);
}

function showConsentBannerIfNeeded() {
  if (
    window.shouldShowConsentBanner &&
    typeof window.showConsentBanner === "function"
  ) {
    window.showConsentBanner();
    window.shouldShowConsentBanner = false;
  }
}

function forcePlayHomeHeroVideo() {
  const video = document.querySelector(
    ".home-hero video, video[autoplay], video",
  );
  if (!video) return;

  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");

  const play = () => video.play()?.catch(() => {});

  play();
  setTimeout(play, 200);
  setTimeout(play, 600);
  setTimeout(play, 1200);
}

document.addEventListener("DOMContentLoaded", () => {
  const namespace = getNamespace();

  updateHeaderByNamespace(namespace);

  document.body.classList.add("is-loaded");

  if (namespace === "home") {
    if (typeof initHomeVideoCursor === "function") {
      initHomeVideoCursor();
    }

    if (typeof window.animateHomeHeader === "function") {
      window.animateHomeHeader();
    }

    if (typeof window.startHeroVideo === "function") {
      window.startHeroVideo();
    }

    forcePlayHomeHeroVideo();
  }

  showConsentBannerIfNeeded();
});
