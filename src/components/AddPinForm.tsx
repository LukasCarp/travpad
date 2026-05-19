"use client";

import { useEffect, useState } from "react";
import { MapPin, Move, X } from "lucide-react";
import type { NewPin, Pin } from "@/lib/supabase";
import {
  CATEGORIES,
  colorForCategory,
  iconForCategory,
  iconForSubcategory,
  subcategoriesFor,
  type Category,
} from "@/lib/pinTaxonomy";
import IconSelect from "./IconSelect";
import ServiceTags from "./ServiceTags";
import PinImageUpload from "./PinImageUpload";

const SHORT_DESC_MAX = 200;

type Mode = "create" | "edit";

type Props = {
  mode: Mode;
  position: { lat: number; lng: number };
  relocating: boolean;
  initialValues?: Pin | null;
  initialImagePaths?: string[];
  onSubmit: (pin: NewPin) => Promise<void> | void;
  onCancel: () => void;
  onStartRelocate?: () => void;
  onCancelRelocate?: () => void;
  onSuggestRelocate?: (lat: number, lng: number) => void;
};

export default function AddPinForm({
  mode,
  position,
  relocating,
  initialValues,
  initialImagePaths,
  onSubmit,
  onCancel,
  onStartRelocate,
  onCancelRelocate,
  onSuggestRelocate,
}: Props) {
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [category, setCategory] = useState<Category>(
    ((initialValues?.category as Category) ?? CATEGORIES[0])
  );
  const [subcategory, setSubcategory] = useState(
    initialValues?.subcategory ?? ""
  );
  const [shortDesc, setShortDesc] = useState(
    initialValues?.short_description ?? ""
  );
  const [description, setDescription] = useState(
    initialValues?.description ?? ""
  );

  // Contact info, stored in the pin's `details` jsonb.
  const initialDetails = (initialValues?.details ?? {}) as Record<
    string,
    unknown
  >;
  const [website, setWebsite] = useState(
    typeof initialDetails.website === "string" ? initialDetails.website : ""
  );
  const [phone, setPhone] = useState(
    typeof initialDetails.phone === "string" ? initialDetails.phone : ""
  );
  const [email, setEmail] = useState(
    typeof initialDetails.email === "string" ? initialDetails.email : ""
  );

  const [services, setServices] = useState<string[]>(
    initialValues?.services ?? []
  );
  const [secret, setSecret] = useState(initialValues?.secret ?? false);
  const [imagePaths, setImagePaths] = useState<string[]>(
    initialValues?.images?.map((i) => i.storage_path) ??
      initialImagePaths ??
      []
  );
  const [gpsSuggest, setGpsSuggest] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Only reset subcategory/services when the *user* changes category, not
  // when initialValues hydrate the form.
  const [userTouchedCategory, setUserTouchedCategory] = useState(false);

  const subOptions = subcategoriesFor(category);

  const categoryOptions = CATEGORIES.map((c) => ({
    value: c,
    label: c,
    icon: iconForCategory(c),
    color: colorForCategory(c),
  }));
  const subcategoryOptions = subOptions.map((s) => ({
    value: s,
    label: s,
    icon: iconForSubcategory(s),
    color: colorForCategory(category),
  }));

  useEffect(() => {
    if (userTouchedCategory) {
      setSubcategory("");
      setServices([]);
    }
  }, [category, userTouchedCategory]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (shortDesc.length > SHORT_DESC_MAX) {
      setError(
        `Short description can be at most ${SHORT_DESC_MAX} characters`
      );
      return;
    }

    const details: Record<string, string> = {};
    if (website.trim()) details.website = website.trim();
    if (phone.trim()) details.phone = phone.trim();
    if (email.trim()) details.email = email.trim();

    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        category,
        subcategory: subcategory.trim() || null,
        short_description: shortDesc.trim() || null,
        description: description.trim() || null,
        services,
        secret,
        lat: position.lat,
        lng: position.lng,
        details,
        imageStoragePaths: imagePaths,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save pin");
      setSaving(false);
    }
  }

  function applyGpsSuggestion() {
    if (gpsSuggest && onSuggestRelocate) {
      onSuggestRelocate(gpsSuggest.lat, gpsSuggest.lng);
    }
    setGpsSuggest(null);
  }

  // While relocating: collapse to a compact bottom bar so the user can see
  // and click the map. Form state stays mounted — no data loss.
  if (relocating) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-[1000] flex justify-center p-4">
        <div className="flex items-center gap-3 rounded-full bg-white px-5 py-3 shadow-2xl ring-1 ring-black/10 dark:bg-neutral-900 dark:ring-white/10">
          <MapPin className="h-4 w-4 text-rose-500" />
          <span className="text-sm">Click the map for the new position</span>
          <button
            type="button"
            onClick={onCancelRelocate}
            className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-xl bg-white shadow-2xl dark:bg-neutral-900">
        <div className="flex items-start justify-between border-b border-neutral-200 p-6 pb-4 dark:border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-rose-500" />
              <h2 className="text-lg font-semibold">
                {mode === "edit" ? "Edit pin" : "New pin"}
              </h2>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <p className="text-xs text-neutral-500">
                {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
              </p>
              {mode === "edit" && onStartRelocate && (
                <button
                  type="button"
                  onClick={onStartRelocate}
                  className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200"
                >
                  <Move className="h-3 w-3" />
                  Move
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            <div>
              <label className="mb-1 block text-sm font-medium">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-rose-500 dark:border-neutral-700"
                placeholder="e.g. Café Tortoni"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Category
                </label>
                <IconSelect
                  value={category}
                  options={categoryOptions}
                  onChange={(v) => {
                    setCategory(v as Category);
                    setUserTouchedCategory(true);
                  }}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Subcategory
                </label>
                <IconSelect
                  value={subcategory}
                  options={subcategoryOptions}
                  onChange={(v) => {
                    setSubcategory(v);
                    setServices([]);
                  }}
                  placeholder="— select —"
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-baseline justify-between">
                <label className="block text-sm font-medium">
                  Short description
                </label>
                <span className="text-[10px] text-neutral-400">
                  {shortDesc.length}/{SHORT_DESC_MAX}
                </span>
              </div>
              <input
                type="text"
                value={shortDesc}
                onChange={(e) =>
                  setShortDesc(e.target.value.slice(0, SHORT_DESC_MAX))
                }
                maxLength={SHORT_DESC_MAX}
                className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-rose-500 dark:border-neutral-700"
                placeholder="A sentence shown first in the detail view"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Long description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-rose-500 dark:border-neutral-700"
                placeholder="More details — shown behind the Read more button."
              />
            </div>

            <div className="space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
              <p className="text-sm font-medium">Contact</p>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-500">
                  Website
                </label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-rose-500 dark:border-neutral-700"
                  placeholder="example.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-500">
                  Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-rose-500 dark:border-neutral-700"
                  placeholder="+34 600 000 000"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-500">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-rose-500 dark:border-neutral-700"
                  placeholder="hello@example.com"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Service buttons
              </label>
              <ServiceTags
                category={category}
                subcategory={subcategory}
                value={services}
                onChange={setServices}
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-800/40">
              <div>
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <span aria-hidden="true">🤫</span> Secret Spot
                </div>
                <p className="text-xs text-neutral-500">
                  Mark this as a hidden gem — it gets a special marker on the
                  map.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={secret}
                aria-label="Secret Spot"
                onClick={() => setSecret((v) => !v)}
                className={
                  "relative h-6 w-11 flex-none rounded-full transition " +
                  (secret
                    ? "bg-violet-600"
                    : "bg-neutral-300 dark:bg-neutral-700")
                }
              >
                <span
                  className={
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all " +
                    (secret ? "left-[22px]" : "left-0.5")
                  }
                />
              </button>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Images</label>
              <PinImageUpload
                paths={imagePaths}
                onChange={setImagePaths}
                onGpsDetected={
                  mode === "create" ? (gps) => setGpsSuggest(gps) : undefined
                }
              />
            </div>

            {gpsSuggest && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm dark:border-rose-900 dark:bg-rose-950/40">
                <p className="text-neutral-700 dark:text-neutral-200">
                  The image contains GPS data:
                  <br />
                  <span className="font-mono text-xs">
                    {gpsSuggest.lat.toFixed(5)}, {gpsSuggest.lng.toFixed(5)}
                  </span>
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={applyGpsSuggestion}
                    disabled={!onSuggestRelocate}
                    className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-medium text-white shadow hover:bg-rose-600 disabled:opacity-50"
                  >
                    Move pin here
                  </button>
                  <button
                    type="button"
                    onClick={() => setGpsSuggest(null)}
                    className="rounded-lg px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  >
                    Keep current
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-200">
                {error}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-neutral-200 p-4 dark:border-neutral-800">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-rose-600 disabled:opacity-50"
            >
              {saving
                ? "Saving…"
                : mode === "edit"
                  ? "Save changes"
                  : "Save pin"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
