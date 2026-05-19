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

    // In development the worker caches Turbopack chunks that change under the
    // same URL, which serves stale JS and breaks hydration. Unregister it and
    // drop its caches so dev always runs the fresh build.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
      if (typeof caches !== "undefined") {
        caches
          .keys()
          .then((keys) => keys.forEach((k) => caches.delete(k)))
          .catch(() => {});
      }
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
