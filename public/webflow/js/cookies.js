(() => {
  const lang = window.location.pathname.startsWith("/en") ? "en" : "fr";

  const i18n = {
    fr: {
      text: "Nous utilisons des cookies pour mesurer l'audience de ce site (Google Analytics).",
      accept: "Accepter",
      refuse: "Refuser",
      infoHref: "/politique-de-confidentialite#cookies",
      infoLabel: "En savoir plus sur les cookies",
    },
    en: {
      text: "We use cookies to measure audience on this site (Google Analytics).",
      accept: "Accept",
      refuse: "Reject",
      // No English privacy policy yet: the French one is used.
      infoHref: "/politique-de-confidentialite#cookies",
      infoLabel: "Learn more about cookies",
    },
  };

  const t = i18n[lang];

  document.getElementById("consent-text").textContent = t.text;
  document.getElementById("btn-accept").textContent = t.accept;
  document.getElementById("btn-refuse").textContent = t.refuse;

  // With href="#" in Webflow, the link goes to the privacy policy in the
  // page's language. Any other href set in Webflow is kept.
  const infoLink = document.getElementById("analytics-info-link");
  const webflowHref = (infoLink.getAttribute("href") || "").trim();

  if (!webflowHref || webflowHref === "#") {
    infoLink.href = t.infoHref;
    infoLink.removeAttribute("target");
    infoLink.setAttribute("aria-label", t.infoLabel);
  }

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

  // Google Analytics sets its cookies on the parent domain (.66origin.com),
  // so each possible domain is cleared.
  const deleteAnalyticsCookies = () => {
    const names = document.cookie
      .split("; ")
      .map((r) => r.split("=")[0])
      .filter((name) => name === "_ga" || name.startsWith("_ga_"));

    const parts = window.location.hostname.split(".");
    const domains = [""];

    for (let i = 0; i < parts.length - 1; i += 1) {
      domains.push(`; domain=.${parts.slice(i).join(".")}`);
    }

    for (const name of names) {
      for (const domain of domains) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`;
      }
    }
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

    if (status === "denied") {
      deleteAnalyticsCookies();
    }

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

  // "Manage cookies" links: any element with the data-cookie-settings
  // attribute in Webflow reopens the banner, wherever it is on the page.
  document.addEventListener("click", (event) => {
    const trigger =
      event.target && event.target.closest
        ? event.target.closest("[data-cookie-settings]")
        : null;

    if (!trigger) {
      return;
    }

    event.preventDefault();
    showBanner();
  });

  const saved = getCookie();

  if (!saved) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", showBanner, {
        once: true,
      });
    } else {
      showBanner();
    }
  } else {
    pushGTM(saved);
  }
})();
