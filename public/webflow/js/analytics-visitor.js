(function () {
  let pendingPreparation = null;

  async function prepare() {
    if (!["localhost", "127.0.0.1"].includes(window.location.hostname)) {
      return null;
    }

    if (pendingPreparation) {
      return pendingPreparation;
    }

    pendingPreparation = prepareWithLock();

    try {
      return await pendingPreparation;
    } finally {
      pendingPreparation = null;
    }
  }

  async function prepareWithLock() {
    const storage = window.OAnalyticsVisitorStorage;
    const locks = window.navigator?.locks;

    if (!storage || !locks) {
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    try {
      return await locks.request(
        "o.analytics.visitor.dev.v1",
        { signal: controller.signal },
        async () => {
          if (controller.signal.aborted) {
            return null;
          }

          // Read inside the lock so another tab's saved token is reused.
          const saved = storage.read();

          const response = await fetch(
            `${window.location.origin}/api/v1/analytics/visitor`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              cache: "no-store",
              signal: controller.signal,
              body: JSON.stringify(
                saved ? { visitorToken: saved.visitorToken } : {},
              ),
            },
          );

          if (!response.ok) {
            return null;
          }

          const visitor = await response.json();

          if (controller.signal.aborted || !storage.save(visitor)) {
            return null;
          }

          return storage.read();
        },
      );
    } catch {
      // Recognition failure must not prevent a chat message.
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  window.OAnalyticsVisitor = {
    prepare,
  };
})();
