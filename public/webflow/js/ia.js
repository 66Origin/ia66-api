function initIAChat(rootSelector) {
  const ia = document.querySelector(rootSelector);
  if (!ia) return;
  const module = ia.querySelector(".ia-66o");
  if (!module) return;
  const isGlobalIA = ia.classList.contains("ia-context-global");
  const introState = module.querySelector(".ia-state--intro");
  const chatState = module.querySelector(".ia-state--chat");
  const introForm = module.querySelector(".ia-state--intro .ia-form");
  const introTextarea = module.querySelector(
    ".ia-state--intro .ia-input-textarea",
  );
  const introButton = module.querySelector(".ia-state--intro .ia-send-button");
  const chatForm = module.querySelector(".ia-state--chat .ia-form");
  const chatTextarea = module.querySelector(
    ".ia-state--chat .ia-input-textarea",
  );
  const chatButton = module.querySelector(".ia-state--chat .ia-send-button");
  const topBar = module.querySelector(".ia-chat-top-bar");
  const bottomBar = module.querySelector(".ia-chat-bottom-bar");
  const newChatBtn = ia.querySelector("#ia-newchat, [data-ia-newchat]");
  const messagesContainer = module.querySelector(".ia-messages");
  const chatShell = module.querySelector(".ia-chat-shell");
  const typewriter = module.querySelector(".ia-typewriter");
  const introWrapper = module.querySelector(
    ".ia-state--intro .ia-input-wrapper",
  );
  const chatWrapper = module.querySelector(".ia-state--chat .ia-input-wrapper");
  const isCollapsible = ia?.classList.contains("is-collapsible") || false;
  let iaStarted = false;
  let isWaiting = false;
  let isKeyboardOpen = false;
  let isAutoScrolling = false;
  let isUserNearBottom = true;
  let lastScrollY = window.scrollY;
  let ticking = false;
  let history = [];
  const MAX_HISTORY = 20;
  const SCROLL_THRESHOLD = 10;
  function isMobile() {
    return window.innerWidth <= 767;
  }
  function getViewportHeight() {
    return window.visualViewport
      ? window.visualViewport.height
      : window.innerHeight;
  }
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
  function showBars() {
    topBar?.classList.remove("is-hidden");
    bottomBar?.classList.remove("is-hidden");
  }
  function hideBars() {
    topBar?.classList.add("is-hidden");
    bottomBar?.classList.add("is-hidden");
  }
  function openKeyboardMode() {
    if (!isMobile() || !iaStarted || !bottomBar) return;
    if (isKeyboardOpen) return;
    const vv = window.visualViewport;
    if (!vv) return;
    isKeyboardOpen = true;
    document.body.classList.add("keyboard-open");
    topBar?.classList.add("is-hidden");
    bottomBar.classList.remove("is-hidden");
    bottomBar.style.position = "fixed";
    bottomBar.style.width = "100%";
    bottomBar.style.left = "0";
    bottomBar.style.right = "0";
    bottomBar.style.bottom = "0";
    bottomBar.style.top = "auto";
  }
  function closeKeyboardMode() {
    if (!bottomBar) return;
    isKeyboardOpen = false;
    document.body.classList.remove("keyboard-open");
    bottomBar.style.position = "";
    bottomBar.style.left = "";
    bottomBar.style.right = "";
    bottomBar.style.top = "";
    bottomBar.style.bottom = "";
    showBars();
  }
  function fillRemainingSpaceAfterScroll() {
    if (!isMobile() || !chatShell) return;
    const scrollBottom = window.scrollY + getViewportHeight();
    const pageBottom = document.documentElement.scrollHeight;
    const spaceBelow = pageBottom - scrollBottom;
    if (spaceBelow > 0) {
      chatShell.style.minHeight = `${chatShell.offsetHeight + spaceBelow}px`;
    }
  }
  function fitFinalMessageHeight() {
    if (!isMobile() || !chatShell) return;
    const lastMsg = messagesContainer?.lastElementChild;
    if (!lastMsg) return;
    const shellRect = chatShell.getBoundingClientRect();
    const lastRect = lastMsg.getBoundingClientRect();
    const viewportHeight = getViewportHeight();
    const bottomBarHeight = bottomBar?.offsetHeight || 0;
    const visibleHeight = viewportHeight - shellRect.top;
    const lastBottomInsideShell = lastRect.bottom - shellRect.top;
    const SAFE_BUFFER = 40;
    const finalHeight = Math.max(
      visibleHeight,
      lastBottomInsideShell + bottomBarHeight + SAFE_BUFFER,
    );
    chatShell.style.minHeight = `${Math.ceil(finalHeight)}px`;
  }
  function updateTypewriterState() {
    if (!typewriter || !introTextarea) return;
    const hasText = introTextarea.value.trim().length > 0;
    const focused = document.activeElement === introTextarea;
    typewriter.style.display = hasText || focused ? "none" : "block";
  }
  function trimHistory() {
    history = history.slice(-MAX_HISTORY);
  }
  function storeMessage(role, text) {
    history.push({ role, text: (text || "").trim().slice(0, 1200) });
    trimHistory();
  }
  function formatMessage(text, emailData = null) {
    let safeText = escapeHtml(text);
    if (emailData?.to) {
      const mailto =
        `mailto:${emailData.to}` +
        `?subject=${encodeURIComponent(emailData.subject || "")}` +
        `&body=${encodeURIComponent(emailData.body || "")}`;
      const escapedEmail = emailData.to.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      safeText = safeText.replace(
        new RegExp(`(?<!\\w)${escapedEmail}(?!\\w)`, "g"),
        `<a href="${mailto}" class="ia66o-mail-link">${emailData.to}</a>`,
      );
    }
    const emailRegex =
      /(?<!mailto:)(?<!">)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

    safeText = safeText.replace(emailRegex, (email) => {
      return `<a href="mailto:${email}" class="ia66o-mail-link">${email}</a>`;
    });

    /* =========================================
  FORMAT FINAL
  ========================================= */
    return safeText
      .replace(/\*\*(.*?)\*\*   /g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>")
      .replace(/---/g, '<div class="ia-email-separator"></div>');
  }

  function updateCaretState() {
    if (introWrapper && introTextarea) {
      introWrapper.classList.toggle(
        "has-text",
        introTextarea.value.trim().length > 0,
      );
    }

    if (chatWrapper && chatTextarea) {
      chatWrapper.classList.toggle(
        "has-text",
        chatTextarea.value.trim().length > 0,
      );
    }
  }

  function enableInputCaret() {
    [introTextarea, chatTextarea].forEach((el) => {
      if (el) el.style.caretColor = "var(--_colors---ink-900)";
    });
  }

  function autoResizeTextarea(textarea) {
    if (!textarea) return;

    if (textarea === chatTextarea) {
      textarea.style.fontSize = "1rem";
      return;
    }

    const length = textarea.value.length;
    const width = window.innerWidth;

    let size = "2rem";

    if (width > 1200) {
      size = length < 70 ? "2.5rem" : length < 110 ? "2rem" : "1.65rem";
    } else if (width > 767) {
      size = length < 50 ? "2.5rem" : length < 85 ? "1.75rem" : "1rem";
    } else {
      size = length < 35 ? "2rem" : length < 55 ? "1.8rem" : "0.8rem";
    }

    textarea.style.fontSize = size;
  }

  function resetTextarea(textarea) {
    textarea.value = "";
    autoResizeTextarea(textarea);
  }

  /* ==================================================
    PROJECT LINKIFY
    ================================================== */

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function waitForProjects() {
    return new Promise((resolve) => {
      if (window.PROJECTS && window.PROJECTS.length) return resolve();

      const i = setInterval(() => {
        if (window.PROJECTS && window.PROJECTS.length) {
          clearInterval(i);
          resolve();
        }
      }, 50);
    });
  }

  function linkifyProjectsInElement(element) {
    if (!window.PROJECTS || !window.PROJECTS.length) return;

    const projects = [...window.PROJECTS].sort(
      (a, b) => b.name.length - a.name.length,
    );

    function processNode(node) {
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "A") return;

      if (node.nodeType === Node.TEXT_NODE) {
        let content = node.nodeValue;

        projects.forEach((project) => {
          const regex = new RegExp(`\\b${escapeRegExp(project.name)}\\b`, "gi");

          content = content.replace(regex, (match) => {
            return `<a href="/works/${project.slug}" target="_blank" rel="noopener noreferrer" class="ia66o-work-link">${match}</a>`;
          });
        });

        if (content !== node.nodeValue) {
          const span = document.createElement("span");
          span.innerHTML = content;
          node.replaceWith(...span.childNodes);
        }
      }

      node.childNodes.forEach(processNode);
    }

    processNode(element);
  }

  /* ==================================================
    CHAT HEIGHT (CONSERVÉ)
    ================================================== */

  function resetChatHeightWithBars() {
    if (!chatShell) return;

    const lastMessage = messagesContainer?.lastElementChild;

    if (!isMobile()) {
      chatShell.style.minHeight = "auto";

      const shellRect = chatShell.getBoundingClientRect();
      const lastRect = lastMessage?.getBoundingClientRect();

      const bottomBarHeight = bottomBar?.offsetHeight || 0;
      const visibleHeight = window.innerHeight - shellRect.top;

      let finalHeight;

      if (!lastMessage) {
        finalHeight = visibleHeight;
      } else {
        const lastBottomInsideShell = lastRect.bottom - shellRect.top;

        finalHeight =
          lastBottomInsideShell < visibleHeight
            ? visibleHeight
            : lastBottomInsideShell + bottomBarHeight;
      }

      chatShell.style.minHeight = `${Math.ceil(finalHeight)}px`;

      return;
    }

    if (isMobile()) {
      chatShell.style.minHeight = "auto";

      const viewportHeight = getViewportHeight();
      const bottomBarHeight = bottomBar?.offsetHeight || 0;
      const topBarHeight = topBar?.offsetHeight || 0;

      const contentHeight = messagesContainer?.scrollHeight || 0;

      const chromeReserve = topBarHeight + bottomBarHeight;
      const safeReserve = 32;

      const finalHeight = Math.max(
        viewportHeight + chromeReserve,
        contentHeight + chromeReserve + safeReserve,
      );

      chatShell.style.minHeight = `${Math.ceil(finalHeight)}px`;

      return;
    }
  }

  /* ==================================================
    SCROLL
    ================================================== */

  function checkIfUserIsNearBottom() {
    const threshold = 120;

    const scrollBottom = window.scrollY + getViewportHeight();

    const pageHeight = document.documentElement.scrollHeight;

    isUserNearBottom = pageHeight - scrollBottom < threshold;
  }

  function lockUserScroll() {
    document.documentElement.classList.add("ia-scroll-locked");
    document.body.classList.add("ia-scroll-locked");
  }

  function unlockUserScroll() {
    document.documentElement.classList.remove("ia-scroll-locked");
    document.body.classList.remove("ia-scroll-locked");
  }

  function scrollToMessage(element, smooth = true) {
    return new Promise((resolve) => {
      if (!element) {
        resolve();
        return;
      }

      const rect = element.getBoundingClientRect();

      const anchor = Math.round(getViewportHeight() * 0.12);

      const targetTop = window.scrollY + rect.top - anchor;

      isAutoScrolling = true;

      window.scrollTo({
        top: Math.max(0, Math.round(targetTop)),
        behavior: smooth ? "smooth" : "auto",
      });

      let frames = 0;
      let lastY = window.scrollY;
      let stable = 0;

      function checkEnd() {
        const y = window.scrollY;
        frames++;

        if (Math.abs(y - lastY) < 1) stable++;
        else stable = 0;

        lastY = y;

        if (stable > 5 || frames > 120) {
          isAutoScrolling = false;
          resolve();
          return;
        }

        requestAnimationFrame(checkEnd);
      }

      requestAnimationFrame(checkEnd);
    });
  }

  function handleBarsOnScroll() {
    if (!topBar || !bottomBar) {
      ticking = false;
      return;
    }

    const rawScrollY = window.scrollY;
    const currentScrollY = Math.max(0, rawScrollY);
    const delta = currentScrollY - lastScrollY;

    const TOP_HIDE_ZONE = 10;

    /* ignore rebond Safari au-dessus de 0 */
    if (rawScrollY < 0) {
      ticking = false;
      return;
    }

    /* ignore rebond Safari en bas */
    const maxScrollY =
      document.documentElement.scrollHeight - getViewportHeight();

    if (currentScrollY > maxScrollY) {
      ticking = false;
      return;
    }

    /* position réelle du module */
    const moduleTop = module.getBoundingClientRect().top + currentScrollY;

    /* si contenu au-dessus du chat */
    const hasContentAboveIA = moduleTop > 80;

    /* IA repliée via header */
    const iaHiddenByHeader =
      ia && ia.classList.contains("is-open") && ia.offsetHeight === 0;

    /* ==================================================
      IA masquée
      ================================================== */
    if (iaHiddenByHeader) {
      if (currentScrollY <= TOP_HIDE_ZONE) {
        hideBars();
        lastScrollY = currentScrollY;
        ticking = false;
        return;
      }

      if (Math.abs(delta) >= SCROLL_THRESHOLD) {
        if (delta > 0) {
          hideBars();
        } else {
          showBars();
        }
      }

      lastScrollY = currentScrollY;
      ticking = false;
      return;
    }

    /* ==================================================
      INTRO STATE
      ================================================== */
    if (!iaStarted) {
      hideBars();
      lastScrollY = currentScrollY;
      ticking = false;
      return;
    }

    /* ==================================================
      MOBILE + clavier ouvert
      ================================================== */
    if (isMobile() && isKeyboardOpen) {
      topBar.classList.add("is-hidden");
      bottomBar.classList.remove("is-hidden");

      lastScrollY = currentScrollY;
      ticking = false;
      return;
    }

    /* ==================================================
      Tout en haut (uniquement si contenu avant IA)
      ================================================== */
    if (hasContentAboveIA && currentScrollY <= TOP_HIDE_ZONE) {
      hideBars();
      lastScrollY = currentScrollY;
      ticking = false;
      return;
    }

    /* ==================================================
      Ignore auto scroll
      ================================================== */
    if (isAutoScrolling) {
      lastScrollY = currentScrollY;
      ticking = false;
      return;
    }

    /* ==================================================
      Micro scroll
      ================================================== */
    if (Math.abs(delta) < SCROLL_THRESHOLD) {
      ticking = false;
      return;
    }

    /* ==================================================
      Scroll normal
      ================================================== */
    if (delta > 0) {
      hideBars();
    } else {
      showBars();
    }

    lastScrollY = currentScrollY;
    ticking = false;
  }

  /* ==================================================
    UI
    ================================================== */

  function startChatMode() {
    introState?.classList.remove("is-active");
    introState?.classList.add("isnot-active");
    chatState?.classList.add("is-active");

    showBars();

    requestAnimationFrame(() => {
      resetChatHeightWithBars();
    });
  }

  function addUserMessage(text) {
    const wrapper = document.createElement("div");
    wrapper.className = "ia66o-chat-user-wrapper";

    wrapper.innerHTML = `
  <div class="ia66o-chat-message user-message">
  <div class="ia66o-chat-message_text">${escapeHtml(text)}</div>
  </div>
  `;

    messagesContainer.appendChild(wrapper);
    return wrapper;
  }

  function addBotLoader() {
    const wrapper = document.createElement("div");
    wrapper.className = "ia66o-chat-bot-wrapper";

    wrapper.innerHTML = `
  <div class="ia66o-chat-row">
  <img src="https://cdn.prod.website-files.com/6952888719949fbd2cc1b3d8/69c67fadcc59c91813c5c164_ia-o.png"
  class="ia66o-chat-avatar"
  alt="IA">
  <div class="ia66o-chat-message bot-message ia66o-loader"><div class="ia66o-chat-message_text"><span>.</span><span>.</span><span>.</span></div></div></div>`;

    messagesContainer.appendChild(wrapper);

    if (!isMobile()) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resetChatHeightWithBars();
        });
      });
    }

    return wrapper;
  }

  async function addBotMessage(text, emailData = null) {
    const wrapper = document.createElement("div");
    wrapper.className = "ia66o-chat-bot-wrapper";

    wrapper.innerHTML = `<div class="ia66o-chat-row"><img src="https://cdn.prod.website-files.com/6952888719949fbd2cc1b3d8/69c67fadcc59c91813c5c164_ia-o.png" class="ia66o-chat-avatar" alt="IA"><div class="ia66o-chat-message bot-message"><div class="ia66o-chat-message_text js-bot-text">${formatMessage(text, emailData)}</div></div></div>`;

    messagesContainer.appendChild(wrapper);

    const messageEl = wrapper.querySelector(".js-bot-text");

    await waitForProjects();
    linkifyProjectsInElement(messageEl);

    storeMessage("assistant", text);

    requestAnimationFrame(() => {
      if (isUserNearBottom) {
        scrollToMessage(wrapper, true);
      }
    });
  }

  async function transformLoader(loader, text, emailData = null) {
    loader
      .querySelector(".ia66o-chat-message")
      ?.classList.remove("ia66o-loader");

    const messageEl = loader.querySelector(".ia66o-chat-message_text");

    messageEl.innerHTML = formatMessage(text, emailData);

    await waitForProjects();
    linkifyProjectsInElement(messageEl);

    storeMessage("assistant", text);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (isMobile()) {
          fitFinalMessageHeight();
        } else {
          resetChatHeightWithBars();
        }
      });

      if (isUserNearBottom) {
        scrollToMessage(loader, true);
      }
    });

    setWaiting(false);

    setTimeout(() => {
      enableInputCaret();
      updateCaretState();
    }, 150);
  }

  function setWaiting(state) {
    isWaiting = state;

    if (state) {
      lockUserScroll();
    } else {
      unlockUserScroll();
    }

    [introTextarea, chatTextarea].forEach((el) => {
      if (!el) return;

      el.disabled = state;
      el.classList.toggle("is-waiting", state);
    });

    if (!state && !isMobile()) {
      chatTextarea?.focus();
    }

    if (!state && isMobile() && iaStarted && !isKeyboardOpen) {
      showBars();
    }
  }

  /* ==================================================
    API
    ================================================== */

  const IS_STAGING = window.location.hostname.includes("webflow.io");

  const API_BASE = IS_STAGING
    ? "https://ia66-api-git-develop-christellebqns-projects.vercel.app"
    : "https://ia66-api.vercel.app";

  async function sendMessage(message) {
    const loader = addBotLoader();
    try {
      const response = await fetch(`${API_BASE}/api/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          entrypoint: "home",
          conversation: {
            history: history.slice(-MAX_HISTORY),
          },
        }),
      });

      const data = await response.json();

      /* erreur API */
      if (!response.ok) {
        throw new Error("API_ERROR");
      }

      /* réponse vide ou inutilisable */
      if (!data?.text || data.text.trim() === "") {
        throw new Error("NO_ANSWER");
      }

      transformLoader(loader, data.text, data.email);
    } catch (err) {
      loader.remove();

      console.log(err.message);

      if (err.message === "NO_ANSWER") {
        addBotMessage(
          "Je manque un peu de contexte pour bien te répondre. Tu peux préciser ?",
        );
      } else {
        addBotMessage(
          "Un souci technique empêche ma réponse. Tu peux réessayer ?",
        );
      }

      setWaiting(false);
    }
  }

  /* ==================================================
    SEND
    ================================================== */
  async function handleSend(activeTextarea) {
    if (isWaiting) return;

    const text = activeTextarea.value.trim();
    if (!text) return;

    if (!iaStarted) {
      iaStarted = true;
      startChatMode();
    }

    const iaHidden =
      ia && ia.classList.contains("is-open") && ia.offsetHeight === 0;

    if (iaHidden) {
      showIA();

      await new Promise((resolve) => {
        setTimeout(resolve, 450);
      });
    }

    const userMessage = addUserMessage(text);

    if (isMobile()) {
      activeTextarea.blur();
    }

    storeMessage("user", text);

    setWaiting(true);

    resetTextarea(activeTextarea);
    updateTypewriterState();
    updateCaretState();

    if (isMobile()) {
      fillRemainingSpaceAfterScroll();
    } else {
      const EXTRA_SPACE = window.innerHeight * 0.75;
      chatShell.style.minHeight = `${chatShell.scrollHeight + EXTRA_SPACE}px`;
    }

    await scrollToMessage(userMessage, true);

    await sendMessage(text);
  }

  /* ==================================================
    INPUTS
    ================================================== */

  function bindInput(textarea, button, form) {
    if (!textarea || !button || !form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await handleSend(textarea);
    });

    button.addEventListener("click", async (e) => {
      e.preventDefault();
      await handleSend(textarea);
    });

    textarea.addEventListener("keydown", async (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        await handleSend(textarea);
      }
    });

    textarea.addEventListener("input", () => {
      autoResizeTextarea(textarea);
      updateCaretState();

      if (textarea === introTextarea) {
        updateTypewriterState();
      }
    });
  }

  bindInput(introTextarea, introButton, introForm);
  bindInput(chatTextarea, chatButton, chatForm);

  /* ==================================================
    FOCUS
    ================================================== */

  introTextarea?.addEventListener("focus", () => {
    introWrapper?.classList.add("is-focused");
    updateTypewriterState();
  });

  introTextarea?.addEventListener("blur", () => {
    setTimeout(() => {
      introWrapper?.classList.remove("is-focused");
      updateTypewriterState();
    }, 120);
  });

  chatTextarea?.addEventListener("focus", () => {
    chatWrapper?.classList.add("is-focused");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        openKeyboardMode();
      });
    });
  });

  chatTextarea?.addEventListener("blur", () => {
    setTimeout(() => {
      chatWrapper?.classList.remove("is-focused");
      closeKeyboardMode();
    }, 150);
  });

  /* ==================================================
    RESET
    ================================================== */

  function resetChat() {
    messagesContainer.innerHTML = "";
    history = [];

    iaStarted = false;
    isWaiting = false;
    isKeyboardOpen = false;
    isAutoScrolling = false;
    unlockUserScroll();

    document.body.classList.remove("keyboard-open");

    if (chatShell) chatShell.style.minHeight = "";
    if (chatState) chatState.style.minHeight = "";

    if (ia) {
      ia.classList.remove("is-hidden-ia");
      ia.style.minHeight = "";
      ia.style.height = "auto";
      ia.style.overflow = "";
    }

    chatState?.classList.remove("is-active");

    introState?.classList.add("is-active");
    introState?.classList.remove("isnot-active");

    hideBars();

    if (introTextarea) introTextarea.value = "";
    if (chatTextarea) chatTextarea.value = "";

    updateTypewriterState();
    updateCaretState();

    lastElementHeight = 0;

    ia.style.height = "";
    ia.style.minHeight = "";
    ia.style.overflow = "";

    chatShell.style.minHeight = "";
    chatState.style.minHeight = "";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        syncHeaderIAState();
        window.dispatchEvent(new Event("resize"));
      });
    });

    setTimeout(() => {
      ia?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  /* ==================================================
    EVENTS
    ================================================== */

  window.addEventListener("scroll", checkIfUserIsNearBottom, {
    passive: true,
  });

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        requestAnimationFrame(handleBarsOnScroll);
        ticking = true;
      }
    },
    {
      passive: true,
    },
  );

  window.addEventListener("resize", () => {
    autoResizeTextarea(introTextarea);
    autoResizeTextarea(chatTextarea);

    if (!isMobile()) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resetChatHeightWithBars();
        });
      });
    }

    handleBarsOnScroll();
  });

  if (window.visualViewport) {
    let keyboardWasOpen = false;

    const handleViewportResize = () => {
      if (!isMobile()) return;

      const vv = window.visualViewport;
      const keyboardOpen = vv.height < window.innerHeight - 100;

      if (keyboardOpen && !keyboardWasOpen) {
        keyboardWasOpen = true;

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            openKeyboardMode();
          });
        });
      }

      if (!keyboardOpen && keyboardWasOpen) {
        keyboardWasOpen = false;

        closeKeyboardMode();
      }
    };

    window.visualViewport.addEventListener("resize", handleViewportResize);
  }

  newChatBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    resetChat();
  });

  /* ==================================================
    IA - SHOW/HIDE
    ================================================== */
  const iaHeaderButton = isGlobalIA
    ? document.querySelector("[data-ia-toggle]")
    : null;
  const iaHeaderText = isGlobalIA
    ? document.querySelector("[data-ia-text]")
    : null;
  const iaHeaderClose = isGlobalIA
    ? document.querySelector("[data-ia-close]")
    : null;

  let lastElementHeight = 0;

  function getIaContextHeight() {
    const context = ia?.querySelector(".ia-context");
    return context ? context.scrollHeight : ia.scrollHeight;
  }

  function getActiveState() {
    return ia?.querySelector(".ia-state.is-active");
  }

  function isChatState() {
    return getActiveState()?.classList.contains("ia-state--chat");
  }

  function setHeaderIAOpenState(isOpen) {
    if (!isGlobalIA || !iaHeaderText || !iaHeaderClose) return;

    iaHeaderText.style.display = isOpen ? "none" : "flex";
    iaHeaderClose.style.display = isOpen ? "flex" : "none";
  }

  function syncHeaderIAState() {
    if (!isGlobalIA || !iaHeaderText || !iaHeaderClose) return;

    const isOpen =
      ia.classList.contains("is-open") &&
      !ia.classList.contains("is-hidden-ia");

    setHeaderIAOpenState(isOpen);
  }

  function openIA() {
    if (!ia || !isCollapsible) return;

    ia.classList.remove("is-hidden-ia");

    if (ia.classList.contains("is-open")) {
      if (ia.classList.contains("is-hidden-ia") || ia.offsetHeight === 0) {
        showIA();
        return;
      }

      ia.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }

    resetChat();

    ia.classList.add("is-open");

    setHeaderIAOpenState(true);

    ia.style.height = "0px";
    ia.style.overflow = "hidden";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const targetHeight = getIaContextHeight();

        ia.style.height = targetHeight + "px";

        setTimeout(() => {
          ia.style.height = "auto";
          ia.style.overflow = "";

          setHeaderIAOpenState(true);
        }, 400);
      });
    });
  }

  function showIA() {
    if (!ia) return;

    ia.classList.remove("is-hidden-ia");
    ia.classList.add("is-open");

    setHeaderIAOpenState(true);

    ia.style.height = "0px";
    ia.style.overflow = "hidden";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const targetHeight = lastElementHeight || getIaContextHeight();

        ia.style.height = targetHeight + "px";
      });
    });

    setTimeout(() => {
      ia.style.height = "auto";
      ia.style.overflow = "";

      if (isChatState()) {
        topBar?.classList.remove("is-hidden");
        bottomBar?.classList.remove("is-hidden");
      }

      setHeaderIAOpenState(true);
    }, 400);
  }

  function openIAAfterScroll() {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

    setTimeout(() => {
      const isOpen = ia.classList.contains("is-open");
      const isHidden =
        ia.classList.contains("is-hidden-ia") || ia.offsetHeight === 0;

      if (isOpen && isHidden) {
        showIA();
        return;
      }

      openIA();
    }, 600);
  }

  function hideIA() {
    if (!ia) return;

    setHeaderIAOpenState(false);

    lastElementHeight = getIaContextHeight();

    const currentHeight = ia.offsetHeight;

    ia.style.height = currentHeight + "px";
    ia.style.overflow = "hidden";

    if (isChatState()) {
      topBar?.classList.add("is-hidden");
      bottomBar?.classList.add("is-hidden");
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        ia.style.height = "0px";
      });
    });

    setTimeout(() => {
      ia.classList.add("is-hidden-ia");
      ia.style.overflow = "hidden";
    }, 400);
  }

  function handleHeaderIaButton() {
    if (!isGlobalIA || !ia || !isCollapsible) return;

    const isOpen = ia.classList.contains("is-open");
    const isHidden =
      ia.classList.contains("is-hidden-ia") || ia.offsetHeight === 0;

    if (!isOpen) {
      openIA();
      return;
    }

    if (isHidden) {
      showIA();
    } else {
      hideIA();
    }
  }

  ia.querySelector("[data-ia-open]")?.addEventListener("click", () => {
    openIA();
  });

  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-ia-trigger]");

    if (!trigger) return;

    e.preventDefault();

    openIAAfterScroll();
  });

  iaHeaderButton?.addEventListener("click", () => {
    handleHeaderIaButton();
  });

  /* ==================================================
    INIT
    ================================================== */

  autoResizeTextarea(introTextarea);
  autoResizeTextarea(chatTextarea);

  updateTypewriterState();
  updateCaretState();

  hideBars();
  checkIfUserIsNearBottom();
}

document.addEventListener("DOMContentLoaded", () => {
  initIAChat(".ia-context-global");
  initIAChat(".ia-context-home");
});
