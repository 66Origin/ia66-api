document.addEventListener("DOMContentLoaded", () => {
  const modal =
    document.getElementById("modal") || document.querySelector(".menu");
  if (!modal) return;

  const panel = modal.querySelector(".menu-panel");
  const headerItems = modal.querySelectorAll(".menu-header-grid > *");
  const links = modal.querySelectorAll(".menu-link");
  const footer = modal.querySelector(".menu-footer");

  let isOpen = false;
  let tl = null;

  const OPEN_RADIUS = "0% 0%";
  const CLOSED_RADIUS = "50% 42%";

  function resetMenu() {
    gsap.set(modal, {
      autoAlpha: 0,
      pointerEvents: "none",
    });

    gsap.set(panel, {
      xPercent: -50,
      yPercent: 100,
      borderTopLeftRadius: CLOSED_RADIUS,
      borderTopRightRadius: CLOSED_RADIUS,
    });

    gsap.set(headerItems, { y: -16, opacity: 0 });
    gsap.set(links, { y: 80, opacity: 0 });
    gsap.set(footer, { y: 24, opacity: 0 });
  }

  resetMenu();

  function openMenu() {
    if (isOpen) return;
    isOpen = true;

    tl?.kill();
    document.body.classList.add("menu-open");

    gsap.set(modal, {
      autoAlpha: 1,
      pointerEvents: "auto",
    });

    tl = gsap.timeline();

    tl.to(panel, {
      yPercent: 0,
      duration: 1.05,
      ease: "expo.inOut",
    });

    tl.to(
      panel,
      {
        borderTopLeftRadius: OPEN_RADIUS,
        borderTopRightRadius: OPEN_RADIUS,
        duration: 0.85,
        ease: "expo.inOut",
      },
      0.32,
    );

    tl.to(
      headerItems,
      {
        y: 0,
        opacity: 1,
        stagger: 0.04,
        duration: 0.55,
        ease: "expo.out",
      },
      0.65,
    );

    tl.to(
      links,
      {
        y: 0,
        opacity: 1,
        stagger: 0.065,
        duration: 0.9,
        ease: "expo.out",
      },
      0.72,
    );

    tl.to(
      footer,
      {
        y: 0,
        opacity: 1,
        duration: 0.55,
        ease: "expo.out",
      },
      0.95,
    );
  }

  function closeMenu() {
    return new Promise((resolve) => {
      tl?.kill();

      document.body.classList.add("menu-is-closing");

      gsap.set(modal, {
        autoAlpha: 1,
        pointerEvents: "auto",
      });

      tl = gsap.timeline({
        onComplete: () => {
          isOpen = false;

          document.body.classList.remove("menu-open");
          document.body.classList.remove("menu-is-closing");

          resetMenu();
          resolve();
        },
      });

      tl.to(
        links,
        {
          y: -24,
          opacity: 0,
          stagger: 0.05,
          duration: 0.6,
          ease: "power2.out",
        },
        0,
      );

      tl.to(
        [headerItems, footer],
        {
          opacity: 0,
          duration: 0.2,
        },
        0,
      );

      tl.to(
        panel,
        {
          borderTopLeftRadius: CLOSED_RADIUS,
          borderTopRightRadius: CLOSED_RADIUS,
          duration: 0.55,
          ease: "expo.inOut",
        },
        0.05,
      );

      tl.to(
        panel,
        {
          yPercent: 100,
          duration: 0.9,
          ease: "expo.inOut",
        },
        0.12,
      );
    });
  }

  document.addEventListener("click", (event) => {
    const openBtn = event.target.closest(
      "#disable-scroll-btn, #disable-scroll-btn-ia, [data-menu-open]",
    );
    const closeBtn = event.target.closest(
      "#modal-close-btn, #modal-close-btn-mobile, [data-menu-close], .menu-close-button",
    );

    if (openBtn) {
      event.preventDefault();
      openMenu();
      return;
    }

    if (closeBtn) {
      event.preventDefault();
      closeMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  window.resetSiteMenu = resetMenu;
  window.closeSiteMenu = closeMenu;
});
