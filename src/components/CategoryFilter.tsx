"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Layers, Minus } from "lucide-react";
import {
  CATEGORIES,
  colorForCategory,
  iconForCategory,
  iconForSubcategory,
  subcategoriesFor,
} from "@/lib/pinTaxonomy";

export const SECRET_FILTER = "Secret Spot";

type Props = {
  active: string[];
  onChange: (next: string[]) => void;
};

function CategoryItemIcon({ value }: { value: string }) {
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function toggleExpanded(cat: string) {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(cat)) n.delete(cat);
      else n.add(cat);
      return n;
    });
  }

  // Adding the category itself is enough — the map filter treats a checked
  // category as "all of its pins". Removing the category also clears any
  // individually picked subcategories so the deselect is visually clean.
  function toggleCategory(cat: string) {
    if (active.includes(cat)) {
      const subs = new Set(subcategoriesFor(cat));
      onChange(active.filter((v) => v !== cat && !subs.has(v)));
    } else {
      onChange([...active, cat]);
    }
  }

  function toggleSubcategory(sub: string) {
    onChange(
      active.includes(sub)
        ? active.filter((v) => v !== sub)
        : [...active, sub]
    );
  }

  function toggleSecret() {
    onChange(
      active.includes(SECRET_FILTER)
        ? active.filter((v) => v !== SECRET_FILTER)
        : [...active, SECRET_FILTER]
    );
  }

  // "full"   — category itself is selected (all pins in this category).
  // "partial" — only some subcategories of this category are selected.
  // "empty"  — nothing in this category is selected.
  function categoryState(cat: string): "empty" | "partial" | "full" {
    if (active.includes(cat)) return "full";
    if (subcategoriesFor(cat).some((s) => active.includes(s))) return "partial";
    return "empty";
  }

  const count = active.length;
  const label =
    count === 0
      ? "Categories"
      : count === 1
        ? active[0]
        : `${count} selected`;

  return (
    <div ref={ref} className="absolute left-4 top-20 z-[500]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Filter pins by category"
        className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-3 py-1.5 text-sm font-medium text-white shadow-lg ring-1 ring-black/10 transition hover:bg-violet-700"
      >
        {count === 1 ? (
          <CategoryItemIcon value={active[0]} />
        ) : (
          <Layers className="h-4 w-4" />
        )}
        {label}
      </button>

      {open && (
        <div className="mt-2 max-h-[70vh] w-64 overflow-y-auto rounded-xl bg-white py-1 shadow-xl ring-1 ring-black/10 dark:bg-neutral-900 dark:ring-white/10">
          {CATEGORIES.map((cat) => {
            const state = categoryState(cat);
            const isExpanded = expanded.has(cat);
            const subs = subcategoriesFor(cat);

            return (
              <div key={cat}>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={
                      "flex flex-1 items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 " +
                      (state === "full"
                        ? "font-medium text-violet-700 dark:text-violet-300"
                        : "")
                    }
                  >
                    <CategoryItemIcon value={cat} />
                    <span className="flex-1">{cat}</span>
                    {state === "full" && (
                      <Check className="h-4 w-4 flex-none" />
                    )}
                    {state === "partial" && (
                      <Minus className="h-4 w-4 flex-none opacity-60" />
                    )}
                  </button>
                  {subs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleExpanded(cat)}
                      aria-label={
                        isExpanded ? `Hide ${cat} subcategories` : `Show ${cat} subcategories`
                      }
                      className="flex-none px-2 py-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                    >
                      <ChevronDown
                        className={
                          "h-4 w-4 transition-transform " +
                          (isExpanded ? "rotate-180" : "")
                        }
                      />
                    </button>
                  )}
                </div>

                {isExpanded && subs.length > 0 && (
                  <div className="ml-4 border-l border-neutral-200 dark:border-neutral-800">
                    {subs.map((sub) => {
                      const subActive = active.includes(sub);
                      const SubIcon = iconForSubcategory(sub);
                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => toggleSubcategory(sub)}
                          className={
                            "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 " +
                            (subActive
                              ? "font-medium text-violet-700 dark:text-violet-300"
                              : "")
                          }
                        >
                          <SubIcon
                            className="h-3.5 w-3.5 flex-none"
                            color={colorForCategory(cat)}
                          />
                          <span className="flex-1">{sub}</span>
                          {subActive && (
                            <Check className="h-3.5 w-3.5 flex-none" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div className="my-1 h-px bg-neutral-100 dark:bg-neutral-800" />
          <button
            type="button"
            onClick={toggleSecret}
            className={
              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 " +
              (active.includes(SECRET_FILTER)
                ? "font-medium text-violet-700 dark:text-violet-300"
                : "")
            }
          >
            <CategoryItemIcon value={SECRET_FILTER} />
            <span className="flex-1">{SECRET_FILTER}</span>
            {active.includes(SECRET_FILTER) && (
              <Check className="h-4 w-4 flex-none" />
            )}
          </button>

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
