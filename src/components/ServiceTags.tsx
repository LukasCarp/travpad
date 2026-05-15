"use client";

import { chipsFor, iconForService, labelForService } from "@/lib/pinTaxonomy";

type Props = {
  category: string;
  subcategory: string;
  value: string[];
  onChange: (next: string[]) => void;
};

export default function ServiceTags({
  category,
  subcategory,
  value,
  onChange,
}: Props) {
  if (!subcategory) {
    return (
      <p className="text-xs text-neutral-500">Select a subcategory first.</p>
    );
  }

  const available = chipsFor(category, subcategory);

  if (available.length === 0) {
    return (
      <p className="text-xs text-neutral-500">
        No service buttons for this subcategory.
      </p>
    );
  }

  function toggle(service: string) {
    const next = value.includes(service)
      ? value.filter((s) => s !== service)
      : [...value, service];
    onChange(next);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {available.map((service) => {
        const Icon = iconForService();
        const active = value.includes(service);
        return (
          <button
            key={service}
            type="button"
            onClick={() => toggle(service)}
            aria-pressed={active}
            className={
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition " +
              (active
                ? "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-200"
                : "border-neutral-300 bg-transparent text-neutral-700 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-200")
            }
          >
            <Icon className="h-3.5 w-3.5" />
            {labelForService(service)}
          </button>
        );
      })}
    </div>
  );
}
