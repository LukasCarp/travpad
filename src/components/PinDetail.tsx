"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Pin } from "@/lib/supabase";
import { iconForService, labelForService } from "@/lib/pinTaxonomy";
import OfflineImage from "./OfflineImage";

export default function PinDetail({ pin }: { pin: Pin }) {
  const supabase = useMemo(() => createClient(), []);
  const [showLong, setShowLong] = useState(false);

  const images = useMemo(
    () =>
      (pin.images ?? []).map((img) => ({
        path: img.storage_path,
        url: supabase.storage
          .from("pin-images")
          .getPublicUrl(img.storage_path).data.publicUrl,
      })),
    [pin.images, supabase]
  );

  return (
    <div className="max-w-xs space-y-2">
      {images.length > 0 && (
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
          {images.map((img) => (
            <OfflineImage
              key={img.path}
              path={img.path}
              src={img.url}
              className="h-24 w-24 flex-none rounded object-cover"
            />
          ))}
        </div>
      )}

      <div>
        <div className="text-base font-semibold leading-tight">{pin.title}</div>
        <div className="text-[10px] uppercase tracking-wide text-neutral-500">
          {pin.category}
          {pin.subcategory ? ` · ${pin.subcategory}` : ""}
        </div>
      </div>

      {pin.short_description && (
        <p className="text-sm text-neutral-700 dark:text-neutral-200">
          {pin.short_description}
        </p>
      )}

      {pin.description && (
        <div>
          <button
            type="button"
            onClick={() => setShowLong((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:underline"
          >
            {showLong ? (
              <>
                Hide <ChevronUp className="h-3 w-3" />
              </>
            ) : (
              <>
                Read more <ChevronDown className="h-3 w-3" />
              </>
            )}
          </button>
          {showLong && (
            <p className="mt-1 whitespace-pre-wrap text-xs text-neutral-700 dark:text-neutral-300">
              {pin.description}
            </p>
          )}
        </div>
      )}

      {pin.services && pin.services.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {pin.services.map((s) => {
            const Icon = iconForService();
            return (
              <span
                key={s}
                title={labelForService(s)}
                className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
              >
                <Icon className="h-3 w-3" />
                {labelForService(s)}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
