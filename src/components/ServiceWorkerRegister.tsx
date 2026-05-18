"use client";

import { useEffect } from "react";

// Registers the offline Service Worker (public/sw.js). When a *new* worker
// takes over an already-controlled page, reload once so the page runs under
// the up-to-date worker instead of a stale one.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;

    function onControllerChange() {
      // Only auto-reload when replacing an existing worker, not on the very
      // first install (which has no previous controller).
      if (reloaded || !hadController) return;
      reloaded = true;
      window.location.reload();
    }

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange
    );
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .catch(() => {
        // Registration failures shouldn't break the app.
      });

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange
      );
    };
  }, []);

  return null;
}
