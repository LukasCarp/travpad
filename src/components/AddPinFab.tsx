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
    console.log(
      `[AddPinFab] file: name=${file.name} type=${file.type} size=${(file.size / 1024 / 1024).toFixed(2)}MB`
    );
    try {
      // EXIF GPS — wrap in its own try so a parser crash on a quirky
      // file (Samsung Motion Photo, broken EXIF, etc.) doesn't kill the
      // whole flow.
      let gps: { latitude: number; longitude: number } | null = null;
      try {
        const exifr = (await import("exifr")).default;
        const raw = await exifr.gps(file);
        if (
          raw &&
          Number.isFinite(raw.latitude) &&
          Number.isFinite(raw.longitude)
        ) {
          gps = { latitude: raw.latitude, longitude: raw.longitude };
        }
      } catch (e) {
        console.warn("[AddPinFab] exifr failed:", e);
      }
      if (!gps) {
        setError("The image has no GPS data.");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be signed in.");

      // Compression — many things can break it on mobile (HEIC, RAW, huge
      // files, Motion Photo bundles). Fall back to uploading the original
      // file when the limit allows.
      let blob: Blob = file;
      let ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      let contentType = file.type || "image/jpeg";
      try {
        const imageCompression = (await import("browser-image-compression"))
          .default;
        const compressed = await imageCompression(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        });
        blob = compressed;
        ext = (compressed.name.split(".").pop() || "jpg").toLowerCase();
        contentType = compressed.type || "image/jpeg";
      } catch (e) {
        console.warn("[AddPinFab] compression failed, uploading original:", e);
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(
            "Couldn't compress this image and it's too large to upload as-is (>10 MB)."
          );
        }
      }

      const path = `${user.id}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("pin-images")
        .upload(path, blob, { contentType, upsert: false });
      if (upErr) throw new Error(`Storage: ${upErr.message}`);

      onGpsFromImage(gps.latitude, gps.longitude, path);
      setOpen(false);
    } catch (err) {
      console.error("[AddPinFab] handleFile failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't add the image."
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
