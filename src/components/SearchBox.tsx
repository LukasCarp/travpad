"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Search, User as UserIcon, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { avatarUrl } from "@/lib/avatar";

type MapHit = {
  type: "map";
  lat: number;
  lng: number;
  label: string;
  placeId: string;
};

type PinHit = {
  type: "pin";
  id: string;
  title: string;
  category: string;
  subcategory: string | null;
};

type UserHit = {
  type: "user";
  id: string;
  name: string;
  avatarUrl: string | null;
};

type Props = {
  onMapPick: (lat: number, lng: number, zoom?: number) => void;
  onPinPick: (id: string) => void;
  onUserPick: (id: string) => void;
};

export default function SearchBox({
  onMapPick,
  onPinPick,
  onUserPick,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [mapHits, setMapHits] = useState<MapHit[]>([]);
  const [pinHits, setPinHits] = useState<PinHit[]>([]);
  const [userHits, setUserHits] = useState<UserHit[]>([]);
  const [busy, setBusy] = useState(false);

  const hasQuery = query.trim().length >= 2;

  // Close dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Debounced search.
  useEffect(() => {
    if (!hasQuery) {
      setMapHits([]);
      setPinHits([]);
      setUserHits([]);
      setBusy(false);
      abortRef.current?.abort();
      return;
    }
    setBusy(true);
    const timeout = window.setTimeout(() => {
      void runSearch(query.trim());
    }, 500);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function runSearch(q: string) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const nominatimUrl =
      "https://nominatim.openstreetmap.org/search?format=json&limit=5&q=" +
      encodeURIComponent(q);

    const [mapRes, pinRes, userRes] = await Promise.all([
      fetch(nominatimUrl, {
        signal: ctrl.signal,
        headers: { "Accept-Language": "en" },
      })
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
      supabase
        .from("pins_view")
        .select("id, title, category, subcategory")
        .or(
          [
            `title.ilike.%${q}%`,
            `short_description.ilike.%${q}%`,
            `description.ilike.%${q}%`,
            `subcategory.ilike.%${q}%`,
            `category.ilike.%${q}%`,
          ].join(",")
        )
        .limit(5),
      supabase
        .from("profiles")
        .select("id, display_name, avatar_path")
        .ilike("display_name", `%${q}%`)
        .limit(5),
    ]);

    if (ctrl.signal.aborted) return;

    const mapList: MapHit[] = Array.isArray(mapRes)
      ? mapRes
          .slice(0, 5)
          .map(
            (r: {
              lat: string;
              lon: string;
              display_name: string;
              place_id: number;
            }) => ({
              type: "map" as const,
              lat: parseFloat(r.lat),
              lng: parseFloat(r.lon),
              label: r.display_name,
              placeId: String(r.place_id),
            })
          )
          .filter((r) => !Number.isNaN(r.lat) && !Number.isNaN(r.lng))
      : [];

    const pinList: PinHit[] = (
      (pinRes?.data ?? []) as Array<{
        id: string;
        title: string;
        category: string;
        subcategory: string | null;
      }>
    ).map((p) => ({
      type: "pin",
      id: p.id,
      title: p.title,
      category: p.category,
      subcategory: p.subcategory,
    }));

    const userList: UserHit[] = (
      (userRes?.data ?? []) as Array<{
        id: string;
        display_name: string | null;
        avatar_path: string | null;
      }>
    ).map((u) => ({
      type: "user",
      id: u.id,
      name: u.display_name ?? "User",
      avatarUrl: avatarUrl(supabase, u.avatar_path),
    }));

    setMapHits(mapList);
    setPinHits(pinList);
    setUserHits(userList);
    setBusy(false);
  }

  function handleMapPickInner(hit: MapHit) {
    onMapPick(hit.lat, hit.lng, 14);
    setOpen(false);
    setQuery("");
  }

  function handlePinPickInner(hit: PinHit) {
    onPinPick(hit.id);
    setOpen(false);
    setQuery("");
  }

  function handleUserPickInner(hit: UserHit) {
    onUserPick(hit.id);
    setOpen(false);
    setQuery("");
  }

  const showDropdown = open && hasQuery;
  const noResults =
    showDropdown &&
    !busy &&
    mapHits.length === 0 &&
    pinHits.length === 0 &&
    userHits.length === 0;

  return (
    <div className="relative w-full min-w-0 max-w-md flex-1" ref={containerRef}>
      <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm shadow-sm focus-within:border-rose-400 dark:border-neutral-700 dark:bg-neutral-900">
        <Search className="h-4 w-4 flex-none text-neutral-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search places, pins or people…"
          className="w-0 flex-1 bg-transparent outline-none"
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setMapHits([]);
              setPinHits([]);
              setUserHits([]);
            }}
            aria-label="Clear"
            className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-[600] mt-1 max-h-96 overflow-y-auto rounded-xl bg-white shadow-xl ring-1 ring-black/10 dark:bg-neutral-900 dark:ring-white/10">
          {userHits.length > 0 && (
            <div className="py-1">
              <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                People
              </div>
              {userHits.map((hit) => (
                <button
                  key={`user-${hit.id}`}
                  type="button"
                  onClick={() => handleUserPickInner(hit)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <span className="flex h-7 w-7 flex-none items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-neutral-500 dark:bg-neutral-800">
                    {hit.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={hit.avatarUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserIcon className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <span className="block min-w-0 flex-1 truncate font-medium">
                    {hit.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {pinHits.length > 0 && (
            <div
              className={
                "py-1" +
                (userHits.length > 0
                  ? " border-t border-neutral-100 dark:border-neutral-800"
                  : "")
              }
            >
              <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                Pins
              </div>
              {pinHits.map((hit) => (
                <button
                  key={`pin-${hit.id}`}
                  type="button"
                  onClick={() => handlePinPickInner(hit)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-rose-50 text-rose-500 dark:bg-rose-950">
                    <MapPin className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {hit.title}
                    </span>
                    <span className="block truncate text-xs text-neutral-500">
                      {hit.category}
                      {hit.subcategory ? ` · ${hit.subcategory}` : ""}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {mapHits.length > 0 && (
            <div className="border-t border-neutral-100 py-1 dark:border-neutral-800">
              <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                Map
              </div>
              {mapHits.map((hit) => (
                <button
                  key={`map-${hit.placeId}`}
                  type="button"
                  onClick={() => handleMapPickInner(hit)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-neutral-100 text-neutral-500 dark:bg-neutral-800">
                    <Search className="h-3.5 w-3.5" />
                  </span>
                  <span className="block min-w-0 flex-1 truncate">
                    {hit.label}
                  </span>
                </button>
              ))}
            </div>
          )}

          {busy && (
            <div className="px-3 py-3 text-sm text-neutral-500">Searching…</div>
          )}

          {noResults && (
            <div className="px-3 py-3 text-sm text-neutral-500">
              No results.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
