"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Trash2 } from "lucide-react";
import {
  deletePack,
  getActivePackId,
  listPacks,
  setActivePackId,
  type OfflinePack,
} from "@/lib/offline/db";

export default function OfflinePacks({
  onCountChange,
}: {
  onCountChange?: (count: number) => void;
}) {
  const [packs, setPacks] = useState<OfflinePack[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, active] = await Promise.all([
        listPacks(),
        getActivePackId(),
      ]);
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setPacks(list);
      setActiveId(active);
      onCountChange?.(list.length);
    } catch {
      setPacks([]);
      onCountChange?.(0);
    }
    setLoaded(true);
  }, [onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(id: string) {
    const next = activeId === id ? null : id;
    await setActivePackId(next);
    setActiveId(next);
  }

  async function remove(id: string) {
    await deletePack(id);
    setActiveId((curr) => (curr === id ? null : curr));
    await load();
  }

  if (!loaded) return null;

  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-neutral-100 px-3 py-2 text-xs leading-relaxed text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
        <strong className="font-semibold">Download</strong> an area with the
        ⬇ button on the map →{" "}
        <strong className="font-semibold">Activate</strong> the pack here →{" "}
        <strong className="font-semibold">open the map offline</strong> to use
        it.
      </p>

      {packs.length === 0 ? (
        <p className="text-sm text-neutral-500">No offline maps yet.</p>
      ) : (
        <ul className="space-y-2">
          {packs.map((pack) => {
            const isActive = pack.id === activeId;
            return (
              <li
                key={pack.id}
                className="flex items-center gap-2 rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{pack.name}</div>
                  <div className="text-xs text-neutral-500">
                    {pack.tileCount} tiles · {pack.poiCount} pins ·{" "}
                    {pack.imageCount ?? 0} photos ·{" "}
                    {new Date(pack.createdAt).toLocaleDateString("en-US")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleActive(pack.id)}
                  className={
                    "inline-flex flex-none items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition " +
                    (isActive
                      ? "bg-rose-500 text-white hover:bg-rose-600"
                      : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600")
                  }
                >
                  {isActive && <Check className="h-3.5 w-3.5" />}
                  {isActive ? "Active" : "Activate"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(pack.id)}
                  aria-label={`Delete ${pack.name}`}
                  className="flex-none rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-200 hover:text-rose-600 dark:hover:bg-neutral-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
