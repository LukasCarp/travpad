"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { Drawer } from "vaul";
import { createClient } from "@/lib/supabase/client";
import type { Pin } from "@/lib/supabase";
import { iconForService, labelForService } from "@/lib/pinTaxonomy";
import PinReviews from "./PinReviews";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    setMatches(m.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    m.addEventListener("change", handler);
    return () => m.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

type Props = {
  pin: Pin | null;
  onClose: () => void;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => Promise<void>;
};

export default function PinDrawer({
  pin,
  onClose,
  canEdit,
  onEdit,
  onDelete,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [activeIdx, setActiveIdx] = useState(0);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isMobile = useMediaQuery("(max-width: 768px)");

  const imageUrls = useMemo(() => {
    if (!pin) return [];
    return (pin.images ?? []).map(
      (img) =>
        supabase.storage.from("pin-images").getPublicUrl(img.storage_path).data
          .publicUrl
    );
  }, [pin, supabase]);

  useEffect(() => {
    setActiveIdx(0);
    setConfirmingDelete(false);
    setActionError(null);
  }, [pin?.id]);

  async function handleConfirmDelete() {
    setDeleting(true);
    setActionError(null);
    try {
      await onDelete();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Kunde inte radera pinnen"
      );
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  const open = pin !== null;
  const direction = isMobile ? "bottom" : "right";

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      direction={direction}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[800] bg-black/30 backdrop-blur-[1px]" />
        <Drawer.Content
          className={
            "fixed z-[900] flex flex-col bg-white shadow-2xl outline-none ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10 " +
            (isMobile
              ? "inset-x-0 bottom-0 max-h-[90vh] rounded-t-2xl"
              : "inset-y-0 right-0 w-full max-w-md")
          }
        >
          <Drawer.Title className="sr-only">{pin?.title ?? ""}</Drawer.Title>

          {isMobile && (
            <div
              aria-hidden="true"
              className="mx-auto mt-2 h-1.5 w-12 flex-none rounded-full bg-neutral-300 dark:bg-neutral-700"
            />
          )}

          <button
            type="button"
            onClick={onClose}
            className={
              "absolute z-10 rounded-full bg-white/90 p-1.5 text-neutral-700 shadow ring-1 ring-black/5 hover:bg-white dark:bg-neutral-800/90 dark:text-neutral-100 dark:ring-white/10 " +
              (isMobile ? "right-3 top-4" : "right-3 top-3")
            }
            aria-label="Stäng"
          >
            <X className="h-4 w-4" />
          </button>

          {pin && (
            <div className="flex-1 overflow-y-auto">
              {imageUrls.length > 0 && (
                <div className="relative bg-neutral-100 dark:bg-neutral-800">
                  <div className="aspect-[4/3] w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrls[activeIdx]}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                  {imageUrls.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveIdx(
                            (i) =>
                              (i - 1 + imageUrls.length) % imageUrls.length
                          )
                        }
                        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2 text-neutral-700 shadow hover:bg-white"
                        aria-label="Föregående bild"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveIdx((i) => (i + 1) % imageUrls.length)
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2 text-neutral-700 shadow hover:bg-white"
                        aria-label="Nästa bild"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-2 py-0.5 text-xs text-white">
                        {activeIdx + 1} / {imageUrls.length}
                      </div>
                    </>
                  )}
                </div>
              )}

              {imageUrls.length > 1 && (
                <div className="flex gap-1 overflow-x-auto px-3 py-2">
                  {imageUrls.map((url, i) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => setActiveIdx(i)}
                      className={
                        "h-12 w-16 flex-none overflow-hidden rounded transition " +
                        (i === activeIdx
                          ? "ring-2 ring-rose-500"
                          : "ring-2 ring-transparent hover:ring-neutral-300")
                      }
                      aria-label={`Bild ${i + 1}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-4 p-6">
                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold leading-tight">
                    {pin.title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-medium uppercase tracking-wide text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                      {pin.category}
                    </span>
                    {pin.subcategory && (
                      <span className="rounded-full bg-rose-100 px-2.5 py-1 font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-200">
                        {pin.subcategory}
                      </span>
                    )}
                  </div>
                  {pin.created_by && pin.created_by_name && (
                    <p className="text-xs text-neutral-500">
                      Skapad av{" "}
                      <Link
                        href={`/?profile=${pin.created_by}`}
                        className="font-medium text-rose-600 hover:underline"
                      >
                        {pin.created_by_name}
                      </Link>
                    </p>
                  )}
                </div>

                {pin.short_description && (
                  <p className="border-l-2 border-rose-300 pl-3 text-base font-medium italic text-neutral-700 dark:border-rose-800 dark:text-neutral-200">
                    {pin.short_description}
                  </p>
                )}

                {pin.description && (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                    {pin.description}
                  </p>
                )}

                {pin.services && pin.services.length > 0 && (
                  <div className="border-t border-neutral-200 pt-4 dark:border-neutral-800">
                    <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                      Services
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {pin.services.map((s) => {
                        const Icon = iconForService(s);
                        return (
                          <span
                            key={s}
                            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {labelForService(s)}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                <PinReviews pinId={pin.id} />

                {canEdit && (
                  <div className="border-t border-neutral-200 pt-4 dark:border-neutral-800">
                    {confirmingDelete ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
                          Radera &ldquo;{pin.title}&rdquo;? Bilderna tas också
                          bort.
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleConfirmDelete}
                            disabled={deleting}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500 px-3 py-2 text-sm font-medium text-white shadow hover:bg-rose-600 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            {deleting ? "Raderar…" : "Bekräfta radering"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingDelete(false)}
                            disabled={deleting}
                            className="rounded-lg px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                          >
                            Ångra
                          </button>
                        </div>
                        {actionError && (
                          <p className="text-xs text-rose-700 dark:text-rose-300">
                            {actionError}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={onEdit}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                        >
                          <Pencil className="h-4 w-4" />
                          Redigera
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingDelete(true)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/30"
                        >
                          <Trash2 className="h-4 w-4" />
                          Radera
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
