import { clientOnly } from "@solidjs/start";
import { onCleanup, onMount } from "solid-js";
import { PageHead } from "../../PageHead";
import "../../styles.css";

// The writing pad needs workers, storage, and sockets, so it never prerenders.
const WritingPad = clientOnly(() =>
  import("../../WritingPad").then(({ WritingPad }) => WritingPad),
);

const preventZoom = (event: Event) => event.preventDefault();
const preventPinch = (event: TouchEvent) => {
  if (event.touches.length > 1) preventZoom(event);
};
const gestureEvents = ["gesturestart", "gesturechange", "gestureend"];

export default function WritingPadPage() {
  onMount(() => {
    // iPadOS Safari ignores the viewport's zoom limits for accessibility. Keep
    // one-finger scrolling intact while blocking page-level pinch gestures.
    document.addEventListener("touchmove", preventPinch, { passive: false });
    for (const eventName of gestureEvents)
      document.addEventListener(eventName, preventZoom, { passive: false });

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register("/model-cache-worker.js")
        .catch(() => undefined);
    }
  });

  onCleanup(() => {
    if (typeof document === "undefined") return;
    document.removeEventListener("touchmove", preventPinch);
    for (const eventName of gestureEvents)
      document.removeEventListener(eventName, preventZoom);
  });

  return (
    <>
      <PageHead
        title="Writing Pad · Kaku"
        meta={[
          {
            name: "viewport",
            content:
              "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
          },
          { name: "theme-color", content: "#f4f0e8" },
          { name: "robots", content: "noindex" },
        ]}
      />
      <WritingPad />
    </>
  );
}
