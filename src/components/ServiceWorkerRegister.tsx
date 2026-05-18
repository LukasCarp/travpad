"use client";

import { useEffect } from "react";

// Registers the offline Service Worker (public/sw.js) once on load.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .catch(() => {
        // Registration failures shouldn't break the app.
      });
  }, []);

  return null;
}
