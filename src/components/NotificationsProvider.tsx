"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./AuthProvider";

export type NotificationRow = {
  id: string;
  pin_id: string;
  action: string;
  created_at: string;
  editor_name: string | null;
  pin_title: string;
};

type NotificationsValue = {
  rows: NotificationRow[];
  unread: number;
  reload: () => void;
  markAllSeen: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsValue | null>(null);

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { user } = useAuth();

  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [seenAt, setSeenAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setRows([]);
      setSeenAt(null);
      return;
    }

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

    setRows((history ?? []) as NotificationRow[]);
  }, [supabase, user]);

  useEffect(() => {
    load();
  }, [load]);

  // Refetch when the tab regains focus and every 45s.
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

  const unread = useMemo(() => {
    if (!seenAt) return rows.length;
    const cutoff = new Date(seenAt).getTime();
    return rows.filter((r) => new Date(r.created_at).getTime() > cutoff)
      .length;
  }, [rows, seenAt]);

  const markAllSeen = useCallback(async () => {
    if (!user) return;
    const now = new Date().toISOString();
    setSeenAt(now);
    await supabase
      .from("profiles")
      .update({ notifications_seen_at: now })
      .eq("id", user.id);
  }, [supabase, user]);

  const value = useMemo<NotificationsValue>(
    () => ({ rows, unread, reload: load, markAllSeen }),
    [rows, unread, load, markAllSeen]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error(
      "useNotifications must be used within a NotificationsProvider"
    );
  }
  return ctx;
}
