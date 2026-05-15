"use client";

import { useMemo, useState } from "react";
import { ImagePlus, Loader, User as UserIcon, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  currentPath: string | null;
  onChange: (path: string | null) => void;
};

export default function AvatarUpload({ currentPath, onChange }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewUrl = currentPath
    ? supabase.storage.from("avatars").getPublicUrl(currentPath).data.publicUrl
    : null;

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be signed in.");

      const imageCompression = (
        await import("browser-image-compression")
      ).default;
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 512,
        useWebWorker: true,
      });

      const ext = (compressed.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, compressed, {
          contentType: compressed.type,
          upsert: false,
        });
      if (upErr) throw new Error(upErr.message);

      // Best-effort cleanup of the previous avatar so the bucket doesn't fill
      // up with orphans every time the user updates their picture.
      if (currentPath) {
        await supabase.storage
          .from("avatars")
          .remove([currentPath])
          .catch(() => {});
      }

      onChange(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!currentPath) return;
    await supabase.storage
      .from("avatars")
      .remove([currentPath])
      .catch(() => {});
    onChange(null);
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-20 w-20 flex-none overflow-hidden rounded-full bg-neutral-100 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:ring-neutral-700">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-400">
            <UserIcon className="h-8 w-8" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-xs text-neutral-600 hover:border-rose-400 hover:text-rose-500 dark:border-neutral-700 dark:text-neutral-300">
          {busy ? (
            <>
              <Loader className="h-3.5 w-3.5 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <ImagePlus className="h-3.5 w-3.5" />
              {currentPath ? "Change image" : "Add image"}
            </>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void handleFile(file);
            }}
          />
        </label>

        {currentPath && (
          <button
            type="button"
            onClick={handleRemove}
            className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-rose-600"
          >
            <X className="h-3 w-3" />
            Remove
          </button>
        )}

        {error && (
          <p className="rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-200">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
