"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Layers } from "lucide-react";
import { CATEGORIES, emojiFor } from "@/lib/pinTaxonomy";

export const SECRET_FILTER = "Secret Spot";

type Props = {
  active: string | null;
  onChange: (next: string | null) => void;
};

export default function CategoryFilter({ active, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function pick(value: string) {
    // Re-selecting the active filter clears it (back to showing all pins).
    onChange(active === value ? null : value);
    setOpen(false);
  }

  const items = [
    ...CATEGORIES.map((c) => ({ value: c, label: c, emoji: emojiFor(c) })),
    { value: SECRET_FILTER, label: SECRET_FILTER, emoji: "🤫" },
  ];

  return (
    <div ref={ref} className="absolute left-4 top-20 z-[500]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Filter pins by category"
        className={
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium shadow-lg ring-1 ring-black/10 transition " +
          (active
            ? "bg-violet-600 text-white hover:bg-violet-700"
            : "bg-white/95 text-neutral-700 hover:bg-white dark:bg-neutral-900/95 dark:text-neutral-200")
        }
      >
        {active ? (
          <span aria-hidden="true">
            {active === SECRET_FILTER ? "🤫" : emojiFor(active)}
          </span>
        ) : (
          <Layers className="h-4 w-4" />
        )}
        {active ?? "Categories"}
      </button>

      {open && (
        <div className="mt-2 w-56 overflow-hidden rounded-xl bg-white py-1 shadow-xl ring-1 ring-black/10 dark:bg-neutral-900 dark:ring-white/10">
          {items.map((item) => {
            const isSecret = item.value === SECRET_FILTER;
            const isActive = active === item.value;
            return (
              <div key={item.value}>
                {isSecret && (
                  <div className="my-1 h-px bg-neutral-100 dark:bg-neutral-800" />
                )}
                <button
                  type="button"
                  onClick={() => pick(item.value)}
                  className={
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 " +
                    (isActive
                      ? "font-medium text-violet-700 dark:text-violet-300"
                      : "")
                  }
                >
                  <span aria-hidden="true">{item.emoji}</span>
                  <span className="flex-1">{item.label}</span>
                  {isActive && <Check className="h-4 w-4 flex-none" />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
