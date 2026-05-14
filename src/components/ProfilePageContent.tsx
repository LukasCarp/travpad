"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  LogOut,
  Pencil,
  Star,
  UserCheck,
  UserPlus,
  User as UserIcon,
  X,
} from "lucide-react";
import { Drawer } from "vaul";
import { createClient } from "@/lib/supabase/client";
import type { Pin, Profile, Review } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";
import ProfileEditModal from "./ProfileEditModal";

type Tab = "pins" | "reviews" | "follows";

const VALID_TABS: Tab[] = ["pins", "reviews", "follows"];

function parseTab(raw: string | null): Tab {
  return VALID_TABS.includes(raw as Tab) ? (raw as Tab) : "pins";
}

type FollowProfile = Pick<Profile, "id" | "display_name" | "avatar_path">;
type ReviewWithPin = Review & { pin_title: string | null };

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

function avatarUrl(
  supabase: ReturnType<typeof createClient>,
  path: string | null
): string | null {
  if (!path) return null;
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}

function StarRow({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={
            "h-3.5 w-3.5 " +
            (n <= value
              ? "fill-amber-400 text-amber-400"
              : "text-neutral-300 dark:text-neutral-600")
          }
        />
      ))}
    </div>
  );
}

function Avatar({ url, size = 96 }: { url: string | null; size?: number }) {
  return (
    <div
      className="relative flex-none overflow-hidden rounded-full bg-neutral-100 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:ring-neutral-700"
      style={{ width: size, height: size }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-neutral-400">
          <UserIcon style={{ width: size * 0.5, height: size * 0.5 }} />
        </div>
      )}
    </div>
  );
}

export default function ProfilePageContent({
  profileId,
  onClose,
}: {
  profileId: string;
  onClose: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, signOut } = useAuth();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [reviews, setReviews] = useState<ReviewWithPin[]>([]);
  const [followers, setFollowers] = useState<FollowProfile[]>([]);
  const [following, setFollowing] = useState<FollowProfile[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>(() =>
    parseTab(searchParams.get("tab"))
  );
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followBusy, setFollowBusy] = useState(false);

  const isOwn = !!user && user.id === profileId;

  // Push tab changes back to the URL so /?profile=<id>&tab=reviews can be
  // shared and bookmarked directly. Skip if we're already in sync.
  useEffect(() => {
    const urlTab = parseTab(searchParams.get("tab"));
    if (urlTab === activeTab) return;
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("tab", activeTab);
    router.replace(`?${sp.toString()}`, { scroll: false });
  }, [activeTab, router, searchParams]);

  async function handleSignOut() {
    await signOut();
    onClose();
    router.refresh();
  }

  async function handleFollow() {
    if (!user || isOwn) return;
    setFollowBusy(true);
    if (isFollowing) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", profileId);
      setIsFollowing(false);
      setFollowers((curr) => curr.filter((p) => p.id !== user.id));
    } else {
      await supabase
        .from("follows")
        .insert({ follower_id: user.id, following_id: profileId });
      setIsFollowing(true);
      const { data: me } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_path")
        .eq("id", user.id)
        .single();
      if (me) setFollowers((curr) => [me as FollowProfile, ...curr]);
    }
    setFollowBusy(false);
  }

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [
      { data: profileData, error: profileErr },
      { data: pinsData },
      { data: reviewsData },
      { data: followerRows },
      { data: followingRows },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, display_name, bio, avatar_path, compass_text, compass_generated_at"
        )
        .eq("id", profileId)
        .single(),
      supabase
        .from("pins_view")
        .select(
          "id, title, category, subcategory, short_description, description, services, details, lat, lng, created_by, created_by_name, created_at, images"
        )
        .eq("created_by", profileId)
        .order("created_at", { ascending: false }),
      supabase
        .from("pin_reviews")
        .select("id, pin_id, user_id, rating, text, author_label, created_at")
        .eq("user_id", profileId)
        .order("created_at", { ascending: false }),
      supabase
        .from("follows")
        .select("follower_id")
        .eq("following_id", profileId),
      supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", profileId),
    ]);

    if (profileErr || !profileData) {
      setError("Profilen kunde inte laddas.");
      setLoading(false);
      return;
    }

    setProfile(profileData as Profile);
    setPins((pinsData ?? []) as Pin[]);

    const rawReviews = (reviewsData ?? []) as Review[];
    const pinIds = Array.from(new Set(rawReviews.map((r) => r.pin_id)));
    let pinTitles = new Map<string, string>();
    if (pinIds.length > 0) {
      const { data: pinTitleRows } = await supabase
        .from("pins")
        .select("id, title")
        .in("id", pinIds);
      pinTitles = new Map(
        (pinTitleRows ?? []).map((r: { id: string; title: string }) => [
          r.id,
          r.title,
        ])
      );
    }
    setReviews(
      rawReviews.map((r) => ({
        ...r,
        pin_title: pinTitles.get(r.pin_id) ?? null,
      }))
    );

    const followerIds = (followerRows ?? []).map(
      (r: { follower_id: string }) => r.follower_id
    );
    const followingIds = (followingRows ?? []).map(
      (r: { following_id: string }) => r.following_id
    );
    const allIds = Array.from(new Set([...followerIds, ...followingIds]));
    let byId = new Map<string, FollowProfile>();
    if (allIds.length > 0) {
      const { data: ps } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_path")
        .in("id", allIds);
      byId = new Map((ps ?? []).map((p: FollowProfile) => [p.id, p]));
    }
    setFollowers(
      followerIds
        .map((id) => byId.get(id))
        .filter((p): p is FollowProfile => !!p)
    );
    setFollowing(
      followingIds
        .map((id) => byId.get(id))
        .filter((p): p is FollowProfile => !!p)
    );

    if (user && user.id !== profileId) {
      const { data: myFollow } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", user.id)
        .eq("following_id", profileId)
        .maybeSingle();
      setIsFollowing(!!myFollow);
    } else {
      setIsFollowing(false);
    }

    setLoading(false);
  }, [profileId, supabase, user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const direction = isMobile ? "bottom" : "right";
  const avatar = profile ? avatarUrl(supabase, profile.avatar_path) : null;

  return (
    <Drawer.Root
      open
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
              : "inset-y-0 right-0 w-full max-w-2xl")
          }
        >
          <Drawer.Title className="sr-only">
            {profile?.display_name ?? "Profil"}
          </Drawer.Title>

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

          {loading && (
            <div className="flex-1 p-8 text-sm text-neutral-500">
              Laddar profil…
            </div>
          )}

          {error && !loading && (
            <div className="flex-1 p-8 text-sm text-rose-700">{error}</div>
          )}

          {profile && !loading && (
            <div className="flex-1 overflow-y-auto">
              <div className="space-y-6 p-6 pt-12">
                <section className="flex flex-wrap items-start gap-4">
                  <Avatar url={avatar} size={isMobile ? 72 : 96} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <h1 className="truncate text-2xl font-semibold leading-tight">
                      {profile.display_name}
                    </h1>
                    {profile.bio && (
                      <p className="text-sm text-neutral-700 dark:text-neutral-300">
                        {profile.bio}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-3 pt-2 text-xs text-neutral-500">
                      <span>
                        <span className="font-medium text-neutral-700 dark:text-neutral-300">
                          {pins.length}
                        </span>{" "}
                        pins
                      </span>
                      <span>
                        <span className="font-medium text-neutral-700 dark:text-neutral-300">
                          {followers.length}
                        </span>{" "}
                        följare
                      </span>
                      <span>
                        <span className="font-medium text-neutral-700 dark:text-neutral-300">
                          {following.length}
                        </span>{" "}
                        följer
                      </span>
                    </div>
                  </div>
                  <div className="flex-none">
                    {isOwn ? (
                      <button
                        type="button"
                        onClick={() => setEditOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                      >
                        <Pencil className="h-4 w-4" />
                        Redigera
                      </button>
                    ) : user ? (
                      <button
                        type="button"
                        onClick={handleFollow}
                        disabled={followBusy}
                        className={
                          "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium shadow disabled:opacity-50 " +
                          (isFollowing
                            ? "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                            : "bg-rose-500 text-white hover:bg-rose-600")
                        }
                      >
                        {isFollowing ? (
                          <>
                            <UserCheck className="h-4 w-4" />
                            Följer
                          </>
                        ) : (
                          <>
                            <UserPlus className="h-4 w-4" />
                            Följ
                          </>
                        )}
                      </button>
                    ) : null}
                  </div>
                </section>

                <section>
                  <div className="border-b border-neutral-200 dark:border-neutral-800">
                    <nav className="-mb-px flex gap-6 text-sm">
                      {(
                        [
                          ["pins", `Pins (${pins.length})`],
                          ["reviews", `Recensioner (${reviews.length})`],
                          ["follows", `Följare (${followers.length})`],
                        ] as const
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setActiveTab(key)}
                          className={
                            "border-b-2 px-1 py-2 font-medium transition " +
                            (activeTab === key
                              ? "border-rose-500 text-rose-600 dark:text-rose-400"
                              : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300")
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </nav>
                  </div>

                  <div className="pt-4">
                    {activeTab === "pins" && <PinsTab pins={pins} />}
                    {activeTab === "reviews" && <ReviewsTab reviews={reviews} />}
                    {activeTab === "follows" && (
                      <FollowsTab
                        supabase={supabase}
                        followers={followers}
                        following={following}
                      />
                    )}
                  </div>
                </section>

                {isOwn && (
                  <section className="border-t border-neutral-200 pt-4 dark:border-neutral-800">
                    <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                      Konto
                    </h2>
                    {user?.email && (
                      <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-400">
                        {user.email}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                    >
                      <LogOut className="h-4 w-4" />
                      Logga ut
                    </button>
                  </section>
                )}
              </div>
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>

      {isOwn && editOpen && profile && (
        <ProfileEditModal
          profile={profile}
          onClose={() => setEditOpen(false)}
          onSaved={(p) => setProfile(p)}
        />
      )}
    </Drawer.Root>
  );
}

function PinsTab({ pins }: { pins: Pin[] }) {
  if (pins.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        Den här användaren har inte skapat några pins än.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {pins.map((pin) => (
        <li key={pin.id}>
          <Link
            href={`/?pin=${pin.id}`}
            className="flex items-baseline justify-between rounded-lg px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <div>
              <span className="font-medium">{pin.title}</span>
              <span className="ml-2 text-xs text-neutral-500">
                {pin.category}
                {pin.subcategory ? ` · ${pin.subcategory}` : ""}
              </span>
            </div>
            <span className="text-xs text-neutral-400">
              {new Date(pin.created_at).toLocaleDateString("sv-SE")}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ReviewsTab({ reviews }: { reviews: ReviewWithPin[] }) {
  if (reviews.length === 0) {
    return (
      <p className="text-sm text-neutral-500">Inga recensioner skrivna än.</p>
    );
  }
  return (
    <ul className="space-y-3">
      {reviews.map((r) => (
        <li
          key={r.id}
          className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/40"
        >
          <div className="flex items-center justify-between">
            <Link
              href={`/?pin=${r.pin_id}`}
              className="text-sm font-medium hover:underline"
            >
              {r.pin_title ?? "Okänd plats"}
            </Link>
            <div className="flex items-center gap-2">
              <StarRow value={r.rating} />
              <span className="text-[11px] text-neutral-500">
                {new Date(r.created_at).toLocaleDateString("sv-SE")}
              </span>
            </div>
          </div>
          {r.text && (
            <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300">
              {r.text}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function FollowsTab({
  supabase,
  followers,
  following,
}: {
  supabase: ReturnType<typeof createClient>;
  followers: FollowProfile[];
  following: FollowProfile[];
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <FollowsColumn
        supabase={supabase}
        title="Följare"
        list={followers}
        emptyText="Inga följare än."
      />
      <FollowsColumn
        supabase={supabase}
        title="Följer"
        list={following}
        emptyText="Följer inte någon än."
      />
    </div>
  );
}

function FollowsColumn({
  supabase,
  title,
  list,
  emptyText,
}: {
  supabase: ReturnType<typeof createClient>;
  title: string;
  list: FollowProfile[];
  emptyText: string;
}) {
  return (
    <div>
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        {title} ({list.length})
      </h3>
      {list.length === 0 ? (
        <p className="text-sm text-neutral-500">{emptyText}</p>
      ) : (
        <ul className="space-y-1">
          {list.map((p) => {
            const url = avatarUrl(supabase, p.avatar_path);
            return (
              <li key={p.id}>
                <Link
                  href={`/?profile=${p.id}`}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <Avatar url={url} size={32} />
                  <span className="font-medium">{p.display_name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
