"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { CircleMarker, useMap } from "react-leaflet";
import { Loader, LocateFixed } from "lucide-react";

export default function UserLocation() {
  const map = useMap();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const flownRef = useRef(false);

  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [tracking, setTracking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    L.DomEvent.disableClickPropagation(containerRef.current);
    L.DomEvent.disableScrollPropagation(containerRef.current);
  }, []);

  // Always clean up the watch when the component unmounts.
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  function showError(msg: string) {
    setError(msg);
    window.setTimeout(
      () => setError((curr) => (curr === msg ? null : curr)),
      4500
    );
  }

  function stopTracking() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTracking(false);
    setBusy(false);
    setPosition(null);
    flownRef.current = false;
  }

  function startTracking() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      showError("Din webbläsare stöder inte platstjänster.");
      return;
    }
    setBusy(true);
    setError(null);
    flownRef.current = false;

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setPosition({ lat, lng });
        setBusy(false);
        // Only fly on first fix — subsequent updates just move the marker so
        // the map doesn't keep yanking around while the user pans.
        if (!flownRef.current) {
          map.flyTo([lat, lng], 16, { duration: 1.2 });
          flownRef.current = true;
        }
      },
      (err) => {
        let msg = "Kunde inte hämta din plats.";
        if (err.code === err.PERMISSION_DENIED) {
          msg = "Du har nekat platsåtkomst i webbläsaren.";
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = "Din position kunde inte fastställas.";
        } else if (err.code === err.TIMEOUT) {
          msg = "Det tog för lång tid att hämta din plats.";
        }
        showError(msg);
        stopTracking();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    watchIdRef.current = id;
    setTracking(true);
  }

  function handleToggle() {
    if (tracking || watchIdRef.current !== null) {
      stopTracking();
    } else {
      startTracking();
    }
  }

  return (
    <>
      <div
        ref={containerRef}
        className="absolute bottom-40 right-6 z-[500] flex flex-col items-end gap-2"
      >
        {error && (
          <div className="max-w-xs rounded-lg bg-white px-3 py-2 text-xs text-rose-700 shadow-lg ring-1 ring-rose-200 dark:bg-neutral-900 dark:text-rose-300 dark:ring-rose-900">
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={handleToggle}
          aria-label={tracking ? "Sluta följa min plats" : "Hitta min plats"}
          title={tracking ? "Sluta följa min plats" : "Hitta min plats"}
          aria-pressed={tracking}
          className={
            "flex h-11 w-11 items-center justify-center rounded-full shadow-2xl ring-1 ring-black/10 transition " +
            (tracking
              ? "bg-rose-500 text-white hover:bg-rose-600"
              : "bg-white text-neutral-700 hover:bg-neutral-50 hover:text-rose-500 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800")
          }
        >
          {busy ? (
            <Loader className="h-5 w-5 animate-spin" />
          ) : (
            <LocateFixed className="h-5 w-5" />
          )}
        </button>
      </div>

      {position && (
        <CircleMarker
          center={[position.lat, position.lng]}
          radius={8}
          pathOptions={{
            fillColor: "#3b82f6",
            fillOpacity: 0.75,
            color: "#ffffff",
            weight: 2,
          }}
        />
      )}
    </>
  );
}
