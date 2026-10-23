(function () {
  const STORAGE_KEY = "o.analytics.visitor.dev.v1";

  function isLocalEnvironment() {
    const hostname = window.location.hostname;

    return (
      ["localhost", "127.0.0.1"].includes(hostname) ||
      hostname.endsWith(".webflow.io") ||
      hostname === "ia66-api-analytics-test.vercel.app" ||
      hostname ===
        "ia66-api-analytics-test-git-feat-254a10-christellebqns-projects.vercel.app"
    );
  }

  function isUsable(value) {
    if (
      !value ||
      typeof value !== "object" ||
      typeof value.visitorToken !== "string" ||
      value.visitorToken.length > 200 ||
      !Number.isSafeInteger(value.expiresAt) ||
      value.expiresAt <= Date.now()
    ) {
      return false;
    }

    const parts = value.visitorToken.split(".");

    return (
      parts.length === 4 &&
      parts[0] === "v1" &&
      /^[0-9a-f-]{36}$/i.test(parts[1]) &&
      /^[1-9]\d{0,15}$/.test(parts[2]) &&
      Number(parts[2]) === value.expiresAt &&
      /^[A-Za-z0-9_-]{43}$/.test(parts[3])
    );
  }

  function clear() {
    if (!isLocalEnvironment()) return;

    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage may be unavailable.
    }
  }

  function read() {
    if (!isLocalEnvironment()) return null;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);

      if (raw === null) return null;

      const saved = JSON.parse(raw);

      if (!isUsable(saved)) {
        clear();
        return null;
      }

      return {
        visitorToken: saved.visitorToken,
        expiresAt: saved.expiresAt,
      };
    } catch {
      clear();
      return null;
    }
  }

  function save(value) {
    if (!isLocalEnvironment() || !isUsable(value)) {
      return false;
    }

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          visitorToken: value.visitorToken,
          expiresAt: value.expiresAt,
        }),
      );

      return true;
    } catch {
      return false;
    }
  }

  window.OAnalyticsVisitorStorage = {
    read,
    save,
    clear,
  };
})();
