"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./AuthProvider";

type HistoryRow = {
  id: string;
  pin_id: string;
  action: string;
  created_at: string;
  editor_name: string | null;
  pin_title: string;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

type Props = {
  onOpenPin: (pinId: string) => void;
};

export default function Notifications({ onOpenPin }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const { user } = useAuth();
  const ref = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [seenAt, setSeenAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;

    const [{ data: follows }, { data: profile }] = await Promise.all([
      supabase.from("pin_follows").select("pin_id").eq("user_id", user.id),
      supabase
        .from("profiles")
        .select("notifications_seen_at")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    setSeenAt((profile?.notifications_seen_at as string | null) ?? null);

    const pinIds = (follows ?? []).map((f) => f.pin_id as string);
    if (pinIds.length === 0) {
      setRows([]);
      return;
    }

    const { data: history } = await supabase
      .from("pin_history_view")
      .select(
        "id, pin_id, action, created_at, editor_name, pin_title, edited_by"
      )
      .in("pin_id", pinIds)
      .neq("edited_by", user.id)
      .order("created_at", { ascending: false })
      .limit(30);

    setRows((history ?? []) as HistoryRow[]);
  }, [supabase, user]);

  useEffect(() => {
    load();
  }, [load]);

  // Refetch when the tab regains focus and every 45s, so the badge appears
  // without a manual reload.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") void load();
    }
    document.addEventListener("visibilitychange", onVisible);
    const id = window.setInterval(() => void load(), 45000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(id);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const unread = useMemo(() => {
    if (!seenAt) return rows.length;
    const cutoff = new Date(seenAt).getTime();
    return rows.filter((r) => new Date(r.created_at).getTime() > cutoff).length;
  }, [rows, seenAt]);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && user) {
      await load();
      const now = new Date().toISOString();
      setSeenAt(now);
      await supabase
        .from("profiles")
        .update({ notifications_seen_at: now })
        .eq("id", user.id);
    }
  }

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        aria-label="Notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-black/10 transition hover:bg-neutral-50 dark:bg-neutral-900 dark:ring-white/10 dark:hover:bg-neutral-800"
      >
        <Bell className="h-5 w-5 text-neutral-700 dark:text-neutral-200" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-black/10 dark:bg-neutral-900 dark:ring-white/10">
          <div className="border-b border-neutral-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
            Updates on pins you follow
          </div>
          <div className="max-h-96 overflow-y-auto">
            {rows.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-neutral-500">
                No updates yet. Follow a pin to get edit notifications.
              </p>
            ) : (
              rows.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    onOpenPin(r.pin_id);
                    setOpen(false);
                  }}
                  className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <span className="text-sm text-neutral-700 dark:text-neutral-200">
                    <span className="font-medium">
                      {r.editor_name ?? "Someone"}
                    </span>{" "}
                    {r.action === "created" ? "created" : "updated"}{" "}
                    <span className="font-medium">{r.pin_title}</span>
                  </span>
                  <span className="text-[11px] text-neutral-500">
                    {timeAgo(r.created_at)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
