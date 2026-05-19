"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { User as UserIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { avatarUrl } from "@/lib/avatar";
import { useAuth } from "./AuthProvider";
import { useNotifications } from "./NotificationsProvider";

function oauthAvatar(user: ReturnType<typeof useAuth>["user"]): string | null {
  if (!user) return null;
  const meta = user.user_metadata ?? {};
  return (
    (meta.avatar_url as string | undefined) ??
    (meta.picture as string | undefined) ??
    null
  );
}

export default function ProfileMenu() {
  const { user } = useAuth();
  const { unread } = useNotifications();
  const supabase = useMemo(() => createClient(), []);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);

  // Fetch the user's profile avatar so the icon reflects their uploaded image,
  // not the OAuth one (which may differ).
  useEffect(() => {
    if (!user) {
      setAvatarPath(null);
      return;
    }
    let alive = true;
    supabase
      .from("profiles")
      .select("avatar_path")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setAvatarPath((data?.avatar_path as string | null) ?? null);
      });
    return () => {
      alive = false;
    };
  }, [user, supabase]);

  if (!user) return null;

  const profileUrl = avatarUrl(supabase, avatarPath);
  const fallback = oauthAvatar(user);
  const url = profileUrl ?? fallback;

  return (
    <div className="relative h-10 w-10">
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-ping rounded-full bg-rose-400 opacity-75"
        />
      )}
      <Link
        href={`/?profile=${user.id}`}
        aria-label={
          unread > 0 ? "Open my profile — new updates" : "Open my profile"
        }
        className={
          "relative block h-10 w-10 overflow-hidden rounded-full bg-white shadow-lg transition " +
          (unread > 0
            ? "ring-2 ring-rose-500"
            : "ring-1 ring-black/10 hover:ring-rose-300 dark:ring-white/10 dark:hover:ring-rose-700")
        }
      >
        {url ? (
          <Image
            src={url}
            alt=""
            width={40}
            height={40}
            unoptimized
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-rose-500 text-white">
            <UserIcon className="h-5 w-5" />
          </span>
        )}
      </Link>
    </div>
  );
}
