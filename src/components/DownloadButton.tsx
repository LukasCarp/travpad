"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMap } from "react-leaflet";
import { Download, X } from "lucide-react";
import { downloadPack } from "@/lib/offline/download";
import { useAuth } from "./AuthProvider";

type Props = {
  tileTemplate: string;
};

export default function DownloadButton({ tileTemplate }: Props) {
  const map = useMap();
  const router = useRouter();
  const { user } = useAuth();
  // The downloaded packs are listed on your profile and the "Done" button
  // navigates there, so the button is only useful to signed-in users.
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function openDialog() {
    setName("");
    setProgress(null);
    setResult(null);
    setError(null);
    setOpen(true);
  }

  async function handleDownload(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const b = map.getBounds();
      const pack = await downloadPack({
        name: trimmed,
        bounds: {
          south: b.getSouth(),
          west: b.getWest(),
          north: b.getNorth(),
          east: b.getEast(),
        },
        zoom: map.getZoom(),
        tileTemplate,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setResult(
        `Saved “${pack.name}” — ${pack.tileCount} tiles, ${pack.poiCount} pins.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setBusy(false);
    }
  }

  // "Done" after a successful download takes signed-in users to their
  // Offline maps tab, where the freshly saved pack is listed.
  function handleDone() {
    setOpen(false);
    if (result && user) {
      router.push(`/?profile=${user.id}&tab=offline`);
    }
  }

  const percent =
    progress && progress.total
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        disabled={!user}
        aria-label="Download this area for offline use"
        title={user ? "Download offline" : "Sign in to download offline maps"}
        className={
          "fixed bottom-44 left-4 z-[500] flex h-11 w-11 items-center justify-center rounded-full bg-white text-neutral-700 shadow-2xl ring-1 ring-black/10 transition dark:bg-neutral-900 dark:text-neutral-200 " +
          (user
            ? "hover:bg-neutral-50 hover:text-rose-500 dark:hover:bg-neutral-800"
            : "cursor-not-allowed opacity-50")
        }
      >
        <Download className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[1100] flex items-start justify-center overflow-y-auto bg-black/40 px-4 pb-4 pt-16">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl dark:bg-neutral-900">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">
                Download offline map
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-400">
              Saves the map and pins for the area currently on screen so you
              can view it offline.
            </p>

            <form onSubmit={handleDownload} className="space-y-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Pack name — e.g. Day 1 — Hike"
                autoFocus
                disabled={busy}
                className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-rose-500 dark:border-neutral-700"
              />

              {busy && progress && (
                <div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                    <div
                      className="h-full bg-rose-500 transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    Downloading tiles… {progress.done}/{progress.total}
                  </p>
                </div>
              )}

              {result && (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
                  {result}
                </p>
              )}
              {error && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-200">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleDone}
                  className="rounded-lg px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  {result ? "Done" : "Cancel"}
                </button>
                {!result && (
                  <button
                    type="submit"
                    disabled={busy || !name.trim()}
                    className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-rose-600 disabled:opacity-50"
                  >
                    {busy ? "Downloading…" : "Download"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
