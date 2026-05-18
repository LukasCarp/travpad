"use client";

import { useMemo, useRef, useState } from "react";
import { ImagePlus, MapPin, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  onPickFromMap: () => void;
  onGpsFromImage: (lat: number, lng: number, imagePath: string) => void;
};

export default function AddPinFab({ onPickFromMap, onGpsFromImage }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handlePickMap() {
    setOpen(false);
    onPickFromMap();
  }

  function triggerImageUpload() {
    setError(null);
    fileInputRef.current?.click();
  }

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const exifr = (await import("exifr")).default;
      const gps = await exifr.gps(file);
      if (
        !gps ||
        !Number.isFinite(gps.latitude) ||
        !Number.isFinite(gps.longitude)
      ) {
        setError("The image has no GPS data.");
        return;
      }

      // Upload the image too, so it's attached to the new pin.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be signed in.");

      const imageCompression = (await import("browser-image-compression"))
        .default;
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      });

      const ext = (compressed.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("pin-images")
        .upload(path, compressed, {
          contentType: compressed.type,
          upsert: false,
        });
      if (upErr) throw new Error(upErr.message);

      onGpsFromImage(gps.latitude, gps.longitude, path);
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't add the image."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[490]"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {open && (
        <div className="fixed bottom-24 right-6 z-[500] w-72 rounded-xl bg-white p-2 shadow-2xl ring-1 ring-black/10 dark:bg-neutral-900 dark:ring-white/10">
          <button
            type="button"
            onClick={handlePickMap}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <MapPin className="h-4 w-4 flex-none text-rose-500" />
            <div>
              <div className="font-medium">Pick on the map</div>
              <div className="text-xs text-neutral-500">
                Click where the pin should go
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={triggerImageUpload}
            disabled={busy}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-800"
          >
            <ImagePlus className="h-4 w-4 flex-none text-rose-500" />
            <div>
              <div className="font-medium">
                {busy ? "Reading image…" : "Upload image with GPS"}
              </div>
              <div className="text-xs text-neutral-500">
                Position is read from EXIF data
              </div>
            </div>
          </button>

          {error && (
            <p className="mt-1 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-200">
              {error}
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setError(null);
        }}
        aria-label={open ? "Close menu" : "Add pin"}
        className="fixed bottom-6 right-6 z-[500] flex h-14 w-14 items-center justify-center rounded-full bg-rose-500 text-white shadow-2xl ring-1 ring-black/10 transition hover:bg-rose-600"
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />
    </>
  );
}
