"use client";

import { useMemo, useRef, useState } from "react";
import { Camera, ImagePlus, MapPin, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  onPickFromMap: () => void;
  // GPS came back from EXIF — drop a pin directly with the image attached.
  onGpsFromImage: (lat: number, lng: number, imagePath: string) => void;
  // EXIF was missing (e.g. Android 13+ Photo Picker stripped it). Upload
  // the image anyway and let the user tap on the map to set the position.
  onUploadAndPickOnMap: (imagePath: string) => void;
};

// EXIF GPSLatitude / GPSLongitude come as [degrees, minutes, seconds] arrays
// plus an N/S/E/W reference. Convert to a signed decimal degree.
function dmsToDecimal(dms: unknown, ref: unknown): number {
  if (!Array.isArray(dms) || dms.length < 3) return NaN;
  const [d, m, s] = dms.map((v) => Number(v));
  if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(s)) {
    return NaN;
  }
  const sign = ref === "S" || ref === "W" ? -1 : 1;
  return sign * (d + m / 60 + s / 3600);
}

export default function AddPinFab({
  onPickFromMap,
  onGpsFromImage,
  onUploadAndPickOnMap,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  function handlePickMap() {
    setOpen(false);
    onPickFromMap();
  }

  async function readExifGps(
    file: File
  ): Promise<{ latitude: number; longitude: number } | null> {
    try {
      const exifr = (await import("exifr")).default;

      // Strategy 1: the convenience method.
      const raw = await exifr.gps(file);
      if (
        raw &&
        Number.isFinite(raw.latitude) &&
        Number.isFinite(raw.longitude)
      ) {
        return { latitude: raw.latitude, longitude: raw.longitude };
      }

      // Strategy 2: full parse with the GPS block forced on.
      const parsed = await exifr.parse(file, { gps: true });
      if (
        parsed &&
        Number.isFinite(parsed.latitude) &&
        Number.isFinite(parsed.longitude)
      ) {
        return { latitude: parsed.latitude, longitude: parsed.longitude };
      }

      // Strategy 3: manual DMS → decimal from GPSLatitude/Ref tags
      // (some encoders only write the raw arrays, not the parsed pair).
      const raw3 = await exifr.parse(file, {
        pick: [
          "GPSLatitude",
          "GPSLatitudeRef",
          "GPSLongitude",
          "GPSLongitudeRef",
        ],
      });
      const lat = dmsToDecimal(raw3?.GPSLatitude, raw3?.GPSLatitudeRef);
      const lng = dmsToDecimal(raw3?.GPSLongitude, raw3?.GPSLongitudeRef);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { latitude: lat, longitude: lng };
      }
    } catch (e) {
      console.warn("[AddPinFab] exifr failed:", e);
    }
    return null;
  }

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    console.log(
      `[AddPinFab] file: name=${file.name} type=${file.type} size=${(
        file.size /
        1024 /
        1024
      ).toFixed(2)}MB`
    );
    try {
      // Try to read GPS first — if it's there, we can drop the pin at the
      // exact spot. If not (Android 13+ Photo Picker strips it on share),
      // we still upload the image and ask the user to tap on the map.
      const gps = await readExifGps(file);

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

      if (gps) {
        onGpsFromImage(gps.latitude, gps.longitude, path);
      } else {
        onUploadAndPickOnMap(path);
      }
      setOpen(false);
    } catch (err) {
      console.error("[AddPinFab] handleFile failed:", err);
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
            onClick={() => {
              setError(null);
              cameraInputRef.current?.click();
            }}
            disabled={busy}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-800"
          >
            <Camera className="h-4 w-4 flex-none text-rose-500" />
            <div>
              <div className="font-medium">
                {busy ? "Reading image…" : "Take a photo"}
              </div>
              <div className="text-xs text-neutral-500">
                Captures GPS straight from the camera
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setError(null);
              galleryInputRef.current?.click();
            }}
            disabled={busy}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-800"
          >
            <ImagePlus className="h-4 w-4 flex-none text-rose-500" />
            <div>
              <div className="font-medium">
                {busy ? "Reading image…" : "Upload from gallery"}
              </div>
              <div className="text-xs text-neutral-500">
                Uses EXIF GPS if present, otherwise pick on the map
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
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
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
