"use client";

import { useState } from "react";
import { Compass, RefreshCw } from "lucide-react";

type Props = {
  userId: string;
  compassText: string | null;
  generatedAt: string | null;
  canRefresh: boolean;
  onRefreshed: (text: string, generatedAt: string) => void;
};

function formatRelative(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function CompassSection({
  userId,
  compassText,
  generatedAt,
  canRefresh,
  onRefreshed,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRefresh() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/compass/${userId}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const data: { text: string; generated_at: string } = await res.json();
      onRefreshed(data.text, data.generated_at);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't update TravPad Compass"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-900/60 dark:bg-rose-950/20">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-rose-500" />
          <h2 className="text-sm font-semibold tracking-tight">
            TravPad Compass
          </h2>
        </div>
        {canRefresh && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-medium text-neutral-700 shadow-sm ring-1 ring-black/5 hover:bg-neutral-50 disabled:opacity-50 dark:bg-neutral-900 dark:text-neutral-200 dark:ring-white/10"
          >
            <RefreshCw className={"h-3 w-3 " + (busy ? "animate-spin" : "")} />
            {busy
              ? "Generating…"
              : compassText
                ? "Update"
                : "Generate"}
          </button>
        )}
      </div>

      {compassText ? (
        <>
          <p className="text-sm italic leading-relaxed text-neutral-700 dark:text-neutral-200">
            {compassText}
          </p>
          {generatedAt && (
            <p className="mt-2 text-[10px] text-neutral-500">
              Updated {formatRelative(generatedAt)}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-neutral-500">
          {canRefresh
            ? "Click Generate and the AI will build a summary of your travel character based on your pins."
            : "This user hasn't generated their TravPad Compass yet."}
        </p>
      )}

      {error && (
        <p className="mt-2 rounded-lg bg-rose-100 px-3 py-1.5 text-xs text-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
          {error}
        </p>
      )}
    </div>
  );
}
