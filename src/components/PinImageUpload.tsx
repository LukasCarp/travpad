"use client";

import { useMemo, useState } from "react";
import { Camera, ImagePlus, Loader, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  paths: string[];
  onChange: (paths: string[]) => void;
  onGpsDetected?: (gps: { lat: number; lng: number }) => void;
};

export default function PinImageUpload({
  paths,
  onChange,
  onGpsDetected,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gpsAnnounced, setGpsAnnounced] = useState(false);

  function previewUrl(path: string): string {
    return supabase.storage.from("pin-images").getPublicUrl(path).data
      .publicUrl;
  }

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("You must be signed in to upload images.");
      }

      const [imageCompression, exifr] = await Promise.all([
        import("browser-image-compression").then((m) => m.default),
        import("exifr").then((m) => m.default),
      ]);

      const newPaths: string[] = [];
      let announcedThisBatch = gpsAnnounced;

      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;

        if (!announcedThisBatch && onGpsDetected) {
          try {
            const gps = await exifr.gps(file);
            if (
              gps &&
              typeof gps.latitude === "number" &&
              typeof gps.longitude === "number"
            ) {
              onGpsDetected({ lat: gps.latitude, lng: gps.longitude });
              announcedThisBatch = true;
              setGpsAnnounced(true);
            }
          } catch {
            // ignore
          }
        }

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

        newPaths.push(path);
      }

      onChange([...paths, ...newPaths]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function removePath(path: string) {
    // Best-effort delete; if Storage cleanup fails the orphan stays in the
    // bucket but is no longer referenced by any pin.
    await supabase.storage
      .from("pin-images")
      .remove([path])
      .catch(() => {});
    onChange(paths.filter((p) => p !== path));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-600 hover:border-rose-400 hover:text-rose-500 dark:border-neutral-700 dark:text-neutral-300">
          {busy ? (
            <>
              <Loader className="h-4 w-4 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <ImagePlus className="h-4 w-4" />
              Add images
            </>
          )}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const arr = e.target.files ? Array.from(e.target.files) : [];
              e.target.value = "";
              void handleFiles(arr);
            }}
          />
        </label>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-600 hover:border-rose-400 hover:text-rose-500 dark:border-neutral-700 dark:text-neutral-300">
          <Camera className="h-4 w-4" />
          Take photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const arr = e.target.files ? Array.from(e.target.files) : [];
              e.target.value = "";
              void handleFiles(arr);
            }}
          />
        </label>
      </div>

      {paths.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {paths.map((path) => (
            <div
              key={path}
              className="relative h-20 w-20 overflow-hidden rounded-lg ring-1 ring-neutral-200 dark:ring-neutral-800"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl(path)}
                alt=""
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removePath(path)}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                aria-label="Remove image"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-200">
          {error}
        </p>
      )}
    </div>
  );
}
