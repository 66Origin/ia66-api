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
  }

  showConsentBannerIfNeeded();
});
