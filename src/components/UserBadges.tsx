"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Award,
  BadgeCheck,
  Bookmark,
  Compass,
  Globe,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Icons referenced from the badges.icon column. Keep the keys aligned with
// 0017_badges.sql — unknown values fall back to a generic Award icon.
const ICONS: Record<string, LucideIcon> = {
  Sparkles,
  Compass,
  Globe,
  BadgeCheck,
  Bookmark,
  Award,
};

type EarnedBadge = {
  slug: string;
  name: string;
  description: string;
  icon: string;
  earned_at: string;
  sort_order: number;
};

type Props = {
  userId: string;
  className?: string;
};

export default function UserBadges({ userId, className = "" }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [badges, setBadges] = useState<EarnedBadge[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("user_badges")
        .select(
          "earned_at, badge:badges!inner(slug, name, description, icon, sort_order)"
        )
        .eq("user_id", userId);
      if (!alive) return;
      // PostgREST's TS inference types the joined `badge` as an array even
      // for a single-row inner join, so normalise it here.
      type Row = {
        earned_at: string;
        badge:
          | {
              slug: string;
              name: string;
              description: string;
              icon: string;
              sort_order: number;
            }
          | Array<{
              slug: string;
              name: string;
              description: string;
              icon: string;
              sort_order: number;
            }>;
      };
      const rows = (data ?? []) as unknown as Row[];
      const flat = rows
        .map((r) => {
          const b = Array.isArray(r.badge) ? r.badge[0] : r.badge;
          return b ? { ...b, earned_at: r.earned_at } : null;
        })
        .filter((x): x is EarnedBadge => x !== null)
        .sort((a, b) => a.sort_order - b.sort_order);
      setBadges(flat);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [supabase, userId]);

  if (!loaded || badges.length === 0) return null;

  return (
    <div className={"flex flex-wrap gap-1.5 " + className}>
      {badges.map((b) => {
        const Icon = ICONS[b.icon] ?? Award;
        return (
          <span
            key={b.slug}
            title={`${b.name} — ${b.description}`}
            className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-900"
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {b.name}
          </span>
        );
      })}
    </div>
  );
}
