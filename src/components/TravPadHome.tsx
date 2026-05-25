"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Info, Layers, LogIn, MapPin, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { NewPin, Pin } from "@/lib/supabase";
import { getOfflinePins } from "@/lib/offline/db";
import AddPinFab from "./AddPinFab";
import AboutDrawer from "./AboutDrawer";
import AddPinForm from "./AddPinForm";
import CategoryFilter, {
  SECRET_FILTER,
  TOP_TEN_FILTER,
} from "./CategoryFilter";
import ListDrawer from "./ListDrawer";
import LoginModal from "./LoginModal";
import MessageDrawer from "./MessageDrawer";
import OsmImportDrawer from "./OsmImportDrawer";
import type { OsmBounds } from "@/lib/osmImport";
import { NotificationsProvider } from "./NotificationsProvider";
import PinDrawer from "./PinDrawer";
import ProfileMenu from "./ProfileMenu";
import ProfilePageContent from "./ProfilePageContent";
import SearchBox from "./SearchBox";
import { useAuth } from "./AuthProvider";
import type { Basemap, MapFocus, ViewportBounds } from "./MapCanvas";

const MapCanvas = dynamic(() => import("./MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-neutral-500">
      Loading map…
    </div>
  ),
});

export default function TravPadHome() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Create flow
  const [pending, setPending] = useState<{
    lat: number;
    lng: number;
    imagePath?: string;
  } | null>(null);

  // Drawer / share-link selection
  const [selectedId, setSelectedId] = useState<string | null>(
    searchParams.get("pin")
  );

  // Edit flow
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPosition, setEditPosition] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [relocating, setRelocating] = useState(false);

  // FAB: "Pick on the map" mode — next map click sets the new pin's position.
  const [pickingFromMap, setPickingFromMap] = useState(false);

  // Map filter: selected category names and/or SECRET_FILTER. Empty = show all.
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const categoryFilterLoaded = useRef(false);

  // Login modal over the map.
  const [loginOpen, setLoginOpen] = useState(false);

  // Selected base map style.
  const [basemap, setBasemap] = useState<Basemap>("osm");
  const [aboutOpen, setAboutOpen] = useState(false);

  // Imperative map move (used by SearchBox map results).
  const [mapFocus, setMapFocus] = useState<MapFocus>(null);

  // OSM import (test feature — see src/lib/osmImport.ts).
  const [osmImportBounds, setOsmImportBounds] = useState<OsmBounds | null>(
    null
  );

  const selectedPin = useMemo(
    () => (selectedId ? pins.find((p) => p.id === selectedId) ?? null : null),
    [pins, selectedId]
  );

  const editingPin = useMemo(
    () => (editingId ? pins.find((p) => p.id === editingId) ?? null : null),
    [pins, editingId]
  );

  // Average rating per pin (lazy-loaded the first time Top Ten is toggled).
  const [ratings, setRatings] = useState<
    Map<string, { avg: number; count: number }>
  >(new Map());
  const ratingsLoaded = useRef(false);
  const topTenActive = categoryFilter.includes(TOP_TEN_FILTER);

  // Current map viewport, captured on moveend/zoomend. Top Ten ranks against
  // whatever is visible right now so panning re-ranks instantly.
  const [mapBounds, setMapBounds] = useState<ViewportBounds | null>(null);

  useEffect(() => {
    if (!topTenActive || ratingsLoaded.current) return;
    ratingsLoaded.current = true;
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("pin_reviews")
        .select("pin_id, rating");
      if (!alive) return;
      const sums = new Map<string, { sum: number; count: number }>();
      for (const r of (data ?? []) as { pin_id: string; rating: number }[]) {
        const cur = sums.get(r.pin_id) ?? { sum: 0, count: 0 };
        cur.sum += r.rating;
        cur.count++;
        sums.set(r.pin_id, cur);
      }
      const next = new Map<string, { avg: number; count: number }>();
      for (const [id, v] of sums) {
        next.set(id, { avg: v.sum / v.count, count: v.count });
      }
      setRatings(next);
    })();
    return () => {
      alive = false;
    };
  }, [topTenActive, supabase]);

  const visiblePins = useMemo(() => {
    if (categoryFilter.length === 0) return [];
    const selected = new Set(categoryFilter);
    const wantSecret = selected.has(SECRET_FILTER);
    const wantTopTen = selected.has(TOP_TEN_FILTER);

    // Anything left in the filter once "modes" (Secret/TopTen) are stripped
    // counts as a category/subcategory restriction.
    const real = categoryFilter.filter(
      (v) => v !== SECRET_FILTER && v !== TOP_TEN_FILTER
    );

    let base: Pin[];
    if (real.length === 0 && !wantSecret) {
      // Only Top Ten is toggled — rank across every pin.
      base = pins;
    } else {
      const cats = new Set(real);
      base = pins.filter(
        (p) =>
          cats.has(p.category) ||
          (p.subcategory != null && cats.has(p.subcategory)) ||
          (wantSecret && p.secret)
      );
    }

    if (wantTopTen) {
      const inView = mapBounds
        ? base.filter(
            (p) =>
              p.lat >= mapBounds.minLat &&
              p.lat <= mapBounds.maxLat &&
              p.lng >= mapBounds.minLng &&
              p.lng <= mapBounds.maxLng
          )
        : base;
      // Rated pins come first (sorted by average, then count). Unrated pins
      // keep their original order and fill the remaining slots up to 10 —
      // this matters most for Secret Spots, which often have no reviews yet
      // but should still rank when the user wants a "top" list.
      const decorated = inView.map((p, i) => ({
        p,
        r: ratings.get(p.id),
        i,
      }));
      decorated.sort((a, b) => {
        const aHas = !!(a.r && a.r.count > 0);
        const bHas = !!(b.r && b.r.count > 0);
        if (aHas !== bHas) return aHas ? -1 : 1;
        if (aHas && bHas) {
          return (
            (b.r as { avg: number; count: number }).avg -
              (a.r as { avg: number; count: number }).avg ||
            (b.r as { avg: number; count: number }).count -
              (a.r as { avg: number; count: number }).count
          );
        }
        return a.i - b.i;
      });
      return decorated.slice(0, 10).map((x) => x.p);
    }

    return base;
  }, [pins, categoryFilter, ratings, mapBounds]);

  const editFormPosition = useMemo(() => {
    if (!editingPin) return null;
    return editPosition ?? { lat: editingPin.lat, lng: editingPin.lng };
  }, [editingPin, editPosition]);

  // Keep the ?pin= query param in sync with the selected pin. selectedId is
  // pure client state (the drawer is state-driven), so this is only for
  // shareable URLs — use history.replaceState instead of router.replace to
  // avoid an RSC navigation that a stale Service Worker could break.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("pin") === (selectedId ?? null)) return;
    if (selectedId) sp.set("pin", selectedId);
    else sp.delete("pin");
    const qs = sp.toString();
    const url = qs
      ? `${window.location.pathname}?${qs}`
      : window.location.pathname;
    window.history.replaceState(window.history.state, "", url);
  }, [selectedId]);

  const loadPins = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from("pins_view")
        .select(
          "id, title, category, subcategory, short_description, description, services, secret, details, lat, lng, created_by, created_by_name, created_at, images"
        );
      if (error) throw new Error(error.message);
      setPins((data ?? []) as Pin[]);
    } catch (err) {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        // Offline — fall back to the pins from downloaded offline packs.
        const offline = await getOfflinePins();
        setPins(offline);
        setLoadError(
          offline.length === 0
            ? "You're offline and have no downloaded pins."
            : null
        );
      } else {
        setLoadError(
          err instanceof Error ? err.message : "Couldn't load pins"
        );
        setPins([]);
      }
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadPins();
  }, [loadPins]);

  // Re-evaluate the pin source (network vs offline cache) on connectivity
  // changes, so going offline/online switches over seamlessly.
  useEffect(() => {
    window.addEventListener("online", loadPins);
    window.addEventListener("offline", loadPins);
    return () => {
      window.removeEventListener("online", loadPins);
      window.removeEventListener("offline", loadPins);
    };
  }, [loadPins]);

  // Restore the category filter from localStorage on mount (done in an effect
  // — not the initial state — so it can't cause an SSR hydration mismatch).
  useEffect(() => {
    try {
      const raw = localStorage.getItem("travpad:categoryFilter");
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) {
        setCategoryFilter(parsed.filter((v) => typeof v === "string"));
      }
    } catch {
      // ignore unreadable storage
    }
  }, []);

  // Persist the category filter so a reload remembers it. The first run is
  // skipped so it can't overwrite stored state before the restore above.
  useEffect(() => {
    if (!categoryFilterLoaded.current) {
      categoryFilterLoaded.current = true;
      return;
    }
    try {
      localStorage.setItem(
        "travpad:categoryFilter",
        JSON.stringify(categoryFilter)
      );
    } catch {
      // ignore storage write failures
    }
  }, [categoryFilter]);

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (relocating && editingId) {
        setEditPosition({ lat, lng });
        setRelocating(false);
        return;
      }
      if (pickingFromMap && user) {
        setPending({ lat, lng });
        setPickingFromMap(false);
        return;
      }
    },
    [editingId, relocating, pickingFromMap, user]
  );

  const handleCreate = useCallback(
    async (pin: NewPin) => {
      const { data, error } = await supabase.rpc("create_pin", {
        p_title: pin.title,
        p_category: pin.category,
        p_lat: pin.lat,
        p_lng: pin.lng,
        p_subcategory: pin.subcategory,
        p_short_description: pin.short_description,
        p_description: pin.description,
        p_services: pin.services,
        p_details: pin.details,
        p_image_paths: pin.imageStoragePaths,
        p_secret: pin.secret,
      });
      if (error) throw new Error(error.message);
      setPending(null);
      await loadPins();
      // Pop the saved pin open so the user sees it.
      if (typeof data === "string") setSelectedId(data);
    },
    [loadPins, supabase]
  );

  const handleUpdate = useCallback(
    async (pin: NewPin) => {
      if (!editingId || !editingPin) return;

      const oldPaths = editingPin.images.map((i) => i.storage_path);
      const removed = oldPaths.filter(
        (p) => !pin.imageStoragePaths.includes(p)
      );

      const { error } = await supabase.rpc("update_pin", {
        p_pin_id: editingId,
        p_title: pin.title,
        p_category: pin.category,
        p_lat: pin.lat,
        p_lng: pin.lng,
        p_subcategory: pin.subcategory,
        p_short_description: pin.short_description,
        p_description: pin.description,
        p_services: pin.services,
        p_image_paths: pin.imageStoragePaths,
        p_secret: pin.secret,
        p_details: pin.details,
      });
      if (error) throw new Error(error.message);

      if (removed.length > 0) {
        await supabase.storage
          .from("pin-images")
          .remove(removed)
          .catch(() => {});
      }

      setEditingId(null);
      setEditPosition(null);
      setRelocating(false);
      await loadPins();
      // Re-open the saved pin so the user sees the updated detail view.
      setSelectedId(editingId);
    },
    [editingId, editingPin, loadPins, supabase]
  );

  const handleDelete = useCallback(async () => {
    if (!selectedId) return;
    const { data: paths, error } = await supabase.rpc("delete_pin", {
      p_pin_id: selectedId,
    });
    if (error) throw new Error(error.message);
    if (Array.isArray(paths) && paths.length > 0) {
      await supabase.storage
        .from("pin-images")
        .remove(paths)
        .catch(() => {});
    }
    setSelectedId(null);
    await loadPins();
  }, [selectedId, loadPins, supabase]);

  const startEdit = useCallback(() => {
    if (!selectedId) return;
    setEditingId(selectedId);
    setSelectedId(null);
  }, [selectedId]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditPosition(null);
    setRelocating(false);
  }, []);

  const handleSuggestRelocate = useCallback((lat: number, lng: number) => {
    setPending({ lat, lng });
  }, []);

  const handleMapPick = useCallback(
    (lat: number, lng: number, zoom?: number) => {
      setMapFocus({ lat, lng, zoom });
    },
    []
  );

  const handlePinPick = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleUserPick = useCallback(
    (userId: string) => {
      const sp = new URLSearchParams(searchParams.toString());
      sp.set("profile", userId);
      sp.delete("tab");
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const clearMapFocus = useCallback(() => setMapFocus(null), []);

  // When the user lands on /?pin=<id> (typically from a shared link),
  // zoom the map all the way in to that pin once pins are loaded. Runs
  // exactly once per mount; later clicks on pins don't re-trigger this.
  const initialPinFocusedRef = useRef(false);
  useEffect(() => {
    if (initialPinFocusedRef.current) return;
    if (loading || pins.length === 0) return;
    const initialPin = searchParams.get("pin");
    if (!initialPin) {
      initialPinFocusedRef.current = true;
      return;
    }
    const p = pins.find((pin) => pin.id === initialPin);
    if (!p) return;
    initialPinFocusedRef.current = true;
    // Ensure the marker is actually visible — the saved category filter
    // may have hidden this pin's category.
    setCategoryFilter((curr) =>
      curr.length === 0 || curr.includes(p.category)
        ? curr
        : [...curr, p.category]
    );
    setMapFocus({ lat: p.lat, lng: p.lng, zoom: 18 });
  }, [loading, pins, searchParams]);

  const handleShowOnMap = useCallback(() => {
    if (!selectedPin) return;
    // The map only renders pins whose category is in the filter, so make sure
    // this pin's category is selected — otherwise its marker stays hidden.
    setCategoryFilter((curr) =>
      curr.includes(selectedPin.category)
        ? curr
        : [...curr, selectedPin.category]
    );
    setMapFocus({ lat: selectedPin.lat, lng: selectedPin.lng, zoom: 16 });
    setSelectedId(null);
  }, [selectedPin]);

  const status = useMemo(() => {
    if (loading) return "Loading pins…";
    if (loadError) return `Error: ${loadError}`;
    return `${pins.length} pin${pins.length === 1 ? "" : "s"}`;
  }, [loading, loadError, pins.length]);

  // Any signed-in user can edit a pin (wiki); only the creator can delete it.
  const canEditSelected = !!user;
  const canDeleteSelected =
    !!user && selectedPin?.created_by === user.id;

  const profileViewId = searchParams.get("profile");
  const listViewId = searchParams.get("list");
  const dmViewId = searchParams.get("dm");

  const closeDm = useCallback(() => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("dm");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const closeProfile = useCallback(() => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("profile");
    sp.delete("tab");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const openPinFromProfile = useCallback(
    (pinId: string) => {
      closeProfile();
      setSelectedId(pinId);
    },
    [closeProfile]
  );

  const closeList = useCallback(() => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("list");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  // Profile → list is a single URL change so the profile param can't linger.
  const openListFromProfile = useCallback(
    (listId: string) => {
      const sp = new URLSearchParams(searchParams.toString());
      sp.delete("profile");
      sp.delete("tab");
      sp.set("list", listId);
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const openPinFromList = useCallback(
    (pinId: string) => {
      closeList();
      setSelectedId(pinId);
    },
    [closeList]
  );

  const showCreateForm = pending && !!user && !editingId;

  return (
    <NotificationsProvider>
      <div className="relative h-screen w-full">
      <main className="relative h-full w-full">
        <MapCanvas
          pins={visiblePins}
          basemap={basemap}
          onMapClick={handleMapClick}
          onPinClick={setSelectedId}
          focus={mapFocus}
          onFocusConsumed={clearMapFocus}
          onRequestOsmImport={setOsmImportBounds}
          topTenMode={topTenActive}
          onBoundsChange={setMapBounds}
        />

        <div className="absolute left-4 top-4 z-[500] flex items-center gap-3">
          <Link
            href="/"
            className="flex flex-none items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-sm shadow-lg ring-1 ring-black/10 hover:bg-white dark:bg-neutral-900/95 dark:ring-white/10"
          >
            <MapPin className="h-5 w-5 text-rose-500" />
            <span className="font-semibold tracking-tight">TravPad</span>
          </Link>
          <SearchBox
            onMapPick={handleMapPick}
            onPinPick={handlePinPick}
            onUserPick={handleUserPick}
          />
        </div>

        {!selectedId && !profileViewId && (
          <CategoryFilter
            active={categoryFilter}
            onChange={setCategoryFilter}
          />
        )}

        {/* Profile / sign-in — level with the category filter */}
        <div className="absolute right-4 top-20 z-[500] flex items-center gap-2">
          {authLoading ? (
            <div className="h-9 w-20 animate-pulse rounded-full bg-white/80 dark:bg-neutral-900/80" />
          ) : user ? (
            <ProfileMenu />
          ) : (
            <>
              <Link
                href="/about"
                className="inline-flex items-center rounded-full bg-white/95 px-3 py-1.5 text-sm font-medium text-neutral-700 shadow-lg ring-1 ring-black/10 hover:bg-white dark:bg-neutral-900/95 dark:text-neutral-200 dark:ring-white/10"
              >
                About
              </Link>
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-4 py-1.5 text-sm font-medium text-white shadow-lg hover:bg-rose-600"
              >
                <LogIn className="h-4 w-4" />
                Sign in
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setAboutOpen(true)}
          aria-label="About TravPad"
          title="About TravPad"
          className="fixed bottom-32 left-4 z-[500] flex h-11 w-11 items-center justify-center rounded-full bg-white text-neutral-700 shadow-2xl ring-1 ring-black/10 transition hover:bg-neutral-50 hover:text-rose-500 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          <Info className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() =>
            setBasemap((b) =>
              b === "osm" ? "voyager" : b === "voyager" ? "toner" : "osm"
            )
          }
          aria-label="Switch map style"
          title="Switch map style"
          className="fixed bottom-20 left-4 z-[500] flex h-11 w-11 items-center justify-center rounded-full bg-white text-neutral-700 shadow-2xl ring-1 ring-black/10 transition hover:bg-neutral-50 hover:text-rose-500 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          <Layers className="h-5 w-5" />
        </button>

        <div className="pointer-events-none fixed bottom-6 left-4 z-[400]">
          <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm shadow-lg ring-1 ring-black/5 dark:bg-neutral-900/95 dark:ring-white/10">
            {pickingFromMap ? (
              <>
                <Plus className="h-4 w-4 text-rose-500" />
                <span>Click where the pin should go</span>
                <button
                  type="button"
                  onClick={() => setPickingFromMap(false)}
                  className="ml-2 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 text-rose-500" />
                <span>
                  {authLoading
                    ? "Loading…"
                    : user
                      ? status
                      : "Sign in to add pins"}
                </span>
              </>
            )}
          </div>
        </div>
      </main>

      {user && (
        <AddPinFab
          onPickFromMap={() => setPickingFromMap(true)}
          onGpsFromImage={(lat, lng, imagePath) =>
            setPending({ lat, lng, imagePath })
          }
        />
      )}

      {!authLoading && !user && (
        <button
          type="button"
          onClick={() => setLoginOpen(true)}
          aria-label="Sign in to add pins"
          title="Sign in to add pins"
          className="fixed bottom-6 right-6 z-[500] flex h-14 w-14 items-center justify-center rounded-full bg-neutral-400 text-white shadow-2xl ring-1 ring-black/10 transition hover:bg-neutral-500 dark:bg-neutral-600 dark:hover:bg-neutral-500"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}

      <PinDrawer
        pin={selectedPin}
        onClose={() => setSelectedId(null)}
        canEdit={canEditSelected}
        canDelete={canDeleteSelected}
        onEdit={startEdit}
        onDelete={handleDelete}
        onShowOnMap={handleShowOnMap}
      />

      {profileViewId && (
        <ProfilePageContent
          key={profileViewId}
          profileId={profileViewId}
          onClose={closeProfile}
          onOpenPin={openPinFromProfile}
          onOpenList={openListFromProfile}
        />
      )}

      {listViewId && (
        <ListDrawer
          key={listViewId}
          listId={listViewId}
          onClose={closeList}
          onOpenPin={openPinFromList}
        />
      )}

      {dmViewId && user && (
        <MessageDrawer
          key={dmViewId}
          otherUserId={dmViewId}
          onClose={closeDm}
        />
      )}

      {osmImportBounds && (
        <OsmImportDrawer
          bounds={osmImportBounds}
          onClose={() => setOsmImportBounds(null)}
          onImported={loadPins}
        />
      )}

      <AboutDrawer open={aboutOpen} onClose={() => setAboutOpen(false)} />

      {showCreateForm && pending && (
        <AddPinForm
          mode="create"
          position={pending}
          relocating={false}
          initialImagePaths={
            pending.imagePath ? [pending.imagePath] : undefined
          }
          onSubmit={handleCreate}
          onCancel={() => setPending(null)}
          onSuggestRelocate={handleSuggestRelocate}
        />
      )}

      {editingPin && editFormPosition && (
        <AddPinForm
          mode="edit"
          position={editFormPosition}
          relocating={relocating}
          initialValues={editingPin}
          onSubmit={handleUpdate}
          onCancel={cancelEdit}
          onStartRelocate={() => setRelocating(true)}
          onCancelRelocate={() => setRelocating(false)}
        />
      )}
      </div>
    </NotificationsProvider>
  );
}
