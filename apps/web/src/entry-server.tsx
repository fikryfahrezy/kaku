// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";
import { getRequestEvent } from "solid-js/web";

const ANALYTICS_PATHS = new Set(["/", "/app", "/app/"]);

function showsAnalytics() {
  const event = getRequestEvent();
  return !!event && ANALYTICS_PATHS.has(new URL(event.request.url).pathname);
}

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="color-scheme" content="light" />
          <link rel="icon" href="/icon.svg" type="image/svg+xml" />
          <link rel="icon" href="/favicon.ico" sizes="64x64" />
          <link rel="icon" href="/icon.png" type="image/png" sizes="512x512" />
          <link rel="apple-touch-icon" href="/icon.png" />
          {showsAnalytics() && (
            <script
              defer
              src="https://analytics.fahrezy.work/script.js"
              data-website-id="3443101f-e301-48fd-935a-ec8b5c6c50eb"
            />
          )}
          {assets}
        </head>
        <body>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
