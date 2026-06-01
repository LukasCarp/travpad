"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  BellRing,
  ChevronLeft,
  ChevronRight,
  ImageUp,
  MapPin,
  Pencil,
  Share2,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Drawer } from "vaul";
import { createClient } from "@/lib/supabase/client";
import type { Pin } from "@/lib/supabase";
import {
  colorForCategory,
  iconForCategory,
  iconForService,
  iconForSubcategory,
  labelForService,
} from "@/lib/pinTaxonomy";
import { useAuth } from "./AuthProvider";
import AddToList from "./AddToList";
import OfflineImage from "./OfflineImage";
import PhotoCredit from "./PhotoCredit";
import PinAttribution from "./PinAttribution";
import PinContact from "./PinContact";
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
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onShowOnMap: () => void;
};

export default function PinDrawer({
  pin,
  onClose,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onShowOnMap,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const { user } = useAuth();
  const [activeIdx, setActiveIdx] = useState(0);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const isMobile = useMediaQuery("(max-width: 768px)");

  const images = useMemo(() => {
    if (!pin) return [];
    return (pin.images ?? []).map((img) => ({
      path: img.storage_path,
      url: supabase.storage
        .from("pin-images")
        .getPublicUrl(img.storage_path).data.publicUrl,
      credit: img.credit_json ?? null,
    }));
  }, [pin, supabase]);

  useEffect(() => {
    setActiveIdx(0);
    setConfirmingDelete(false);
    setActionError(null);
  }, [pin?.id]);

  useEffect(() => {
    if (!pin || !user) {
      setIsFollowing(false);
      return;
    }
    let alive = true;
    supabase
      .from("pin_follows")
      .select("pin_id")
      .eq("user_id", user.id)
      .eq("pin_id", pin.id)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setIsFollowing(!!data);
      });
    return () => {
      alive = false;
    };
  }, [pin, user, supabase]);

  async function handleFollow() {
    if (!pin || !user) return;
    setFollowBusy(true);
    if (isFollowing) {
      await supabase
        .from("pin_follows")
        .delete()
        .eq("user_id", user.id)
        .eq("pin_id", pin.id);
      setIsFollowing(false);
    } else {
      await supabase
        .from("pin_follows")
        .insert({ user_id: user.id, pin_id: pin.id });
      setIsFollowing(true);
    }
    setFollowBusy(false);
  }

  async function handleShare() {
    if (!pin) return;
    const url = `${window.location.origin}/pin/${pin.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: pin.title, url });
      } catch {
        // share dialog dismissed — ignore
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — ignore
    }
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    setActionError(null);
    try {
      await onDelete();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Couldn't delete the pin"
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
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          {pin && (() => {
            const CategoryIcon = pin.subcategory
              ? iconForSubcategory(pin.subcategory)
              : iconForCategory(pin.category);
            const categoryColor = colorForCategory(pin.category);
            const categoryBadge = (
              <div
                aria-label={pin.subcategory ?? pin.category}
                className="absolute left-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white shadow-lg"
                style={{ backgroundColor: categoryColor }}
              >
                <CategoryIcon
                  className="h-5 w-5 text-white"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
              </div>
            );
            return (
            <div className="flex-1 overflow-y-auto">
              {images.length === 0 && (
                <div className="relative mx-3 mt-3 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-800">
                  <ImageUp
                    className="h-24 w-24 text-neutral-400 dark:text-neutral-500"
                    aria-hidden="true"
                  />
                  {categoryBadge}
                </div>
              )}
              {images.length > 0 && (
                <div className="relative mx-3 mt-3 overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-800">
                  <div className="aspect-[4/3] w-full">
                    <OfflineImage
                      path={images[activeIdx].path}
                      src={images[activeIdx].url}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  {categoryBadge}
                  {images.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveIdx(
                            (i) => (i - 1 + images.length) % images.length
                          )
                        }
                        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2 text-neutral-700 shadow hover:bg-white"
                        aria-label="Previous image"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveIdx((i) => (i + 1) % images.length)
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2 text-neutral-700 shadow hover:bg-white"
                        aria-label="Next image"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-2 py-0.5 text-xs text-white">
                        {activeIdx + 1} / {images.length}
                      </div>
                    </>
                  )}
                </div>
              )}

              {images[activeIdx]?.credit && (
                <PhotoCredit
                  credit={images[activeIdx].credit}
                  className="px-5 pt-1"
                />
              )}

              {images.length > 1 && (
                <div className="flex gap-1 overflow-x-auto px-3 py-2">
                  {images.map((img, i) => (
                    <button
                      key={img.path}
                      type="button"
                      onClick={() => setActiveIdx(i)}
                      className={
                        "h-12 w-16 flex-none overflow-hidden rounded transition " +
                        (i === activeIdx
                          ? "ring-2 ring-rose-500"
                          : "ring-2 ring-transparent hover:ring-neutral-300")
                      }
                      aria-label={`Image ${i + 1}`}
                    >
                      <OfflineImage
                        path={img.path}
                        src={img.url}
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
                    <span
                      className="rounded-full px-2.5 py-1 font-medium uppercase tracking-wide text-white"
                      style={{
                        backgroundColor: colorForCategory(pin.category),
                      }}
                    >
                      {pin.category}
                    </span>
                    {pin.subcategory && (
                      <span className="rounded-full bg-rose-100 px-2.5 py-1 font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-200">
                        {pin.subcategory}
                      </span>
                    )}
                    {pin.secret && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-200">
                        <Star
                          className="h-3.5 w-3.5 flex-none fill-amber-400 text-amber-400"
                          aria-hidden="true"
                        />
                        Secret Spot
                      </span>
                    )}
                  </div>
                  {pin.created_by && pin.created_by_name && (
                    <p className="text-xs text-neutral-500">
                      Created by{" "}
                      <Link
                        href={`/?profile=${pin.created_by}`}
                        className="font-medium text-rose-600 hover:underline"
                      >
                        {pin.created_by_name}
                      </Link>
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {user ? (
                    <button
                      type="button"
                      onClick={handleFollow}
                      disabled={followBusy}
                      className={
                        "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium shadow transition disabled:opacity-50 " +
                        (isFollowing
                          ? "bg-violet-600 text-white hover:bg-violet-700"
                          : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700")
                      }
                    >
                      {isFollowing ? (
                        <BellRing className="h-4 w-4" />
                      ) : (
                        <Bell className="h-4 w-4" />
                      )}
                      {isFollowing ? "Following" : "Follow"}
                    </button>
                  ) : (
                    <Link
                      href="/login"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Link>
                  )}
                  <AddToList pinId={pin.id} />
                  <button
                    type="button"
                    onClick={onShowOnMap}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                  >
                    <MapPin className="h-4 w-4" />
                    Show on map
                  </button>
                  <button
                    type="button"
                    onClick={handleShare}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                  >
                    <Share2 className="h-4 w-4" />
                    {copied ? "Copied!" : "Share"}
                  </button>
                </div>

                {pin.short_description && (
                  <p className="border-l-2 border-rose-300 pl-3 text-base font-medium italic text-neutral-700 dark:border-rose-800 dark:text-neutral-200">
                    {pin.short_description}
                  </p>
                )}

                {pin.description && (() => {
                  const det = (pin.details ?? {}) as {
                    wikipedia_lang?: string;
                    wikipedia_title?: string;
                  };
                  const lang = det.wikipedia_lang;
                  const translated = !!lang && lang !== "en" && !!det.wikipedia_title;
                  return (
                    <div>
                      {translated && (
                        <p className="mb-2 inline-block rounded-md bg-neutral-100 px-2 py-1 text-[10px] uppercase tracking-wide text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                          Auto-translated from {lang} Wikipedia
                        </p>
                      )}
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                        {pin.description}
                      </p>
                    </div>
                  );
                })()}

                <PinContact details={pin.details} />

                {pin.services && pin.services.length > 0 && (
                  <div className="border-t border-neutral-200 pt-4 dark:border-neutral-800">
                    <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                      Service buttons
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {pin.services.map((s) => {
                        const Icon = iconForService();
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

                <PinAttribution
                  details={pin.details as Parameters<typeof PinAttribution>[0]["details"]}
                  createdByName={pin.created_by_name}
                />

                {(canEdit || canDelete) && (
                  <div className="border-t border-neutral-200 pt-4 dark:border-neutral-800">
                    {confirmingDelete ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
                          Delete &ldquo;{pin.title}&rdquo;? The images will be
                          removed too.
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleConfirmDelete}
                            disabled={deleting}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500 px-3 py-2 text-sm font-medium text-white shadow hover:bg-rose-600 disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            {deleting ? "Deleting…" : "Confirm delete"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingDelete(false)}
                            disabled={deleting}
                            className="rounded-lg px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                          >
                            Cancel
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
                        {canEdit && (
                          <button
                            type="button"
                            onClick={onEdit}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setConfirmingDelete(true)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/30"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            );
          })()}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
