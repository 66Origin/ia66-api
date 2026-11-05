export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not found", { status: 404 });
  }

  const placement =
    new URL(request.url).searchParams.get("placement") === "global"
      ? "global"
      : "home";

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>O — Test local des analytics</title>
  <style>
    :root {
      --_colors---ink-900: #222;
    }

    body {
      margin: 0;
      padding: 24px;
      font-family: Arial, sans-serif;
      color: #222;
      background: #f5f5f5;
    }

    main {
      max-width: 800px;
      margin: auto;
    }

    nav {
      display: flex;
      gap: 20px;
      margin-bottom: 24px;
    }

    .ia-66o {
      padding: 24px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 12px;
    }

    .ia-state--chat:not(.is-active),
    .ia-state--intro.isnot-active {
      display: none;
    }

    .ia-form {
      display: flex;
      align-items: flex-end;
      gap: 12px;
      margin-top: 16px;
    }

    .ia-input-wrapper {
      flex: 1;
    }

    textarea {
      box-sizing: border-box;
      width: 100%;
      min-height: 90px;
      padding: 12px;
      font: inherit;
    }

    button {
      padding: 12px;
      cursor: pointer;
    }

    .is-disabled {
      opacity: 0.5;
    }

    .ia66o-chat-user-wrapper,
    .ia66o-chat-bot-wrapper {
      margin: 16px 0;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 8px;
      overflow-wrap: anywhere;
    }

    .ia66o-chat-user-wrapper {
      background: #eef3ff;
    }

    .ia66o-chat-avatar {
      width: 28px;
      height: 28px;
    }
  </style>
  <script src="/webflow/js/ia.js" defer></script>
</head>
<body>
  <main>
    <h1>O — Test local : ${placement}</h1>
    <p>Page de développement pour vérifier les requêtes du chat.</p>

    <nav>
      <a href="/dev/o-analytics?placement=home">Module accueil</a>
      <a href="/dev/o-analytics?placement=global">Module interne</a>
    </nav>

    <section
      class="ia-context-${placement}"
      data-o-analytics="true"
    >
      <div class="ia-66o">
        <div class="ia-chat-shell">
          <div class="ia-state ia-state--intro is-active">
            <form class="ia-form">
              <div class="ia-input-wrapper">
                <textarea
                  class="ia-input-textarea"
                  aria-label="Premier message"
                  placeholder="Pose une question à O"
                ></textarea>
              </div>
              <button class="ia-send-button" type="submit">
                Envoyer
              </button>
            </form>
          </div>

          <div class="ia-state ia-state--chat">
            <div class="ia-chat-top-bar">
              <button type="button" data-ia-newchat>
                Nouvelle conversation
              </button>
            </div>

            <div class="ia-messages" aria-live="polite"></div>

            <div class="ia-chat-bottom-bar">
              <form class="ia-form">
                <div class="ia-input-wrapper">
                  <textarea
                    class="ia-input-textarea"
                    aria-label="Message suivant"
                    placeholder="Continue la conversation"
                  ></textarea>
                </div>
                <button class="ia-send-button" type="submit">
                  Envoyer
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
