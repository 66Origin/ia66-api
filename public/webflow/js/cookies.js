(() => {
  const lang = window.location.pathname.startsWith("/en") ? "en" : "fr";

  const i18n = {
    fr: {
      text: "Nous utilisons des cookies pour mesurer l'audience de ce site (Google Analytics).",
      accept: "Accepter",
      refuse: "Refuser",
      infoHref:
        "https://support.google.com/analytics/answer/6004245?sjid=5624211428556571422-EU&hl=fr#info_for_visitors",
    },
    en: {
      text: "We use cookies to measure audience on this site (Google Analytics).",
      accept: "Accept",
      refuse: "Reject",
      infoHref:
        "https://support.google.com/analytics/answer/6004245?sjid=5624211428556571422-EU#info_for_visitors",
    },
  };

  const t = i18n[lang];

  document.getElementById("consent-text").textContent = t.text;
  document.getElementById("btn-accept").textContent = t.accept;
  document.getElementById("btn-refuse").textContent = t.refuse;
  document.getElementById("analytics-info-link").href = t.infoHref;

  const getCookie = () => {
    const match = document.cookie
      .split("; ")
      .find((r) => r.startsWith("cookie_consent="));
    return match ? match.split("=")[1] : null;
  };

  const setCookie = (status) => {
    const exp = new Date();
    exp.setMonth(exp.getMonth() + 6);
    document.cookie = `cookie_consent=${status}; expires=${exp.toUTCString()}; path=/; SameSite=Lax`;
  };

  const pushGTM = (status) => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "consent_update",
      analytics_storage: status,
    });
  };

  const banner = document.getElementById("consent-banner");

  const showBanner = () => {
    banner.classList.remove("is-hidden", "is-visible");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        banner.classList.add("is-visible");
      });
    });
  };

  const hideBanner = () => {
    banner.classList.remove("is-visible");
    banner.classList.add("is-hidden");

    setTimeout(() => {
      banner.classList.remove("is-hidden");
    }, 420);
  };

  const applyConsent = (status) => {
    setCookie(status);
    pushGTM(status);
    hideBanner();
  };

  document
    .getElementById("btn-refuse")
    .addEventListener("click", () => applyConsent("denied"));

  document
    .getElementById("btn-accept")
    .addEventListener("click", () => applyConsent("granted"));

  document
    .getElementById("consent-banner-close")
    .addEventListener("click", () => hideBanner());

  window.showConsentBanner = showBanner;

  const saved = getCookie();

  if (!saved) {
    window.shouldShowConsentBanner = true;
  } else {
    pushGTM(saved);
  }
})();
