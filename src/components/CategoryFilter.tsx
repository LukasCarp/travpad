"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Layers } from "lucide-react";
import { CATEGORIES, colorForCategory, iconForCategory } from "@/lib/pinTaxonomy";

export const SECRET_FILTER = "Secret Spot";

type Props = {
  active: string[];
  onChange: (next: string[]) => void;
};

function ItemIcon({ value }: { value: string }) {
  if (value === SECRET_FILTER) {
    return (
      <span aria-hidden="true" className="flex-none text-base leading-none">
        🤫
      </span>
    );
  }
  const Icon = iconForCategory(value);
  return (
    <Icon
      className="h-4 w-4 flex-none"
      color={colorForCategory(value)}
      aria-hidden="true"
    />
  );
}

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

  function toggle(value: string) {
    onChange(
      active.includes(value)
        ? active.filter((v) => v !== value)
        : [...active, value]
    );
  }

  const items = [
    ...CATEGORIES.map((c) => ({ value: c, label: c })),
    { value: SECRET_FILTER, label: SECRET_FILTER },
  ];

  const count = active.length;
  const label =
    count === 0
      ? "Categories"
      : count === 1
        ? active[0]
        : `${count} categories`;

  return (
    <div ref={ref} className="absolute left-4 top-20 z-[500]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Filter pins by category"
        className={
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium shadow-lg ring-1 ring-black/10 transition " +
          (count > 0
            ? "bg-rose-500 text-white hover:bg-rose-600"
            : "bg-white/95 text-neutral-700 hover:bg-white dark:bg-neutral-900/95 dark:text-neutral-200")
        }
      >
        {count === 1 ? (
          <ItemIcon value={active[0]} />
        ) : (
          <Layers className="h-4 w-4" />
        )}
        {label}
      </button>

      {open && (
        <div className="mt-2 w-56 overflow-hidden rounded-xl bg-white py-1 shadow-xl ring-1 ring-black/10 dark:bg-neutral-900 dark:ring-white/10">
          {items.map((item) => {
            const isSecret = item.value === SECRET_FILTER;
            const isActive = active.includes(item.value);
            return (
              <div key={item.value}>
                {isSecret && (
                  <div className="my-1 h-px bg-neutral-100 dark:bg-neutral-800" />
                )}
                <button
                  type="button"
                  onClick={() => toggle(item.value)}
                  className={
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 " +
                    (isActive
                      ? "font-medium text-violet-700 dark:text-violet-300"
                      : "")
                  }
                >
                  <ItemIcon value={item.value} />
                  <span className="flex-1">{item.label}</span>
                  {isActive && <Check className="h-4 w-4 flex-none" />}
                </button>
              </div>
            );
          })}

          {count > 0 && (
            <>
              <div className="my-1 h-px bg-neutral-100 dark:bg-neutral-800" />
              <button
                type="button"
                onClick={() => onChange([])}
                className="flex w-full items-center px-3 py-2 text-left text-sm text-neutral-500 hover:bg-neutral-100 hover:text-rose-600 dark:hover:bg-neutral-800"
              >
                Clear all
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
