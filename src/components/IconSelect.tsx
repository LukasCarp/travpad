"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";

export type IconSelectOption = {
  value: string;
  label: string;
  icon: LucideIcon;
  color: string;
};

type Props = {
  value: string;
  options: IconSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
};

export default function IconSelect({
  value,
  options,
  onChange,
  placeholder,
}: Props) {
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

  const selected = options.find((o) => o.value === value) ?? null;
  const SelectedIcon = selected?.icon ?? null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-rose-500 dark:border-neutral-700"
      >
        {selected && SelectedIcon ? (
          <>
            <SelectedIcon
              className="h-4 w-4 flex-none"
              color={selected.color}
              aria-hidden="true"
            />
            <span className="flex-1 truncate text-left">{selected.label}</span>
          </>
        ) : (
          <span className="flex-1 truncate text-left text-neutral-400">
            {placeholder ?? "Select"}
          </span>
        )}
        <ChevronDown className="h-4 w-4 flex-none text-neutral-400" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg bg-white py-1 shadow-xl ring-1 ring-black/10 dark:bg-neutral-900 dark:ring-white/10">
          {options.map((o) => {
            const Icon = o.icon;
            const isActive = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 " +
                  (isActive ? "font-medium" : "")
                }
              >
                <Icon
                  className="h-4 w-4 flex-none"
                  color={o.color}
                  aria-hidden="true"
                />
                <span className="flex-1 truncate">{o.label}</span>
                {isActive && <Check className="h-4 w-4 flex-none" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
