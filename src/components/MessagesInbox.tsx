"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { User as UserIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DirectMessage } from "@/lib/supabase";
import { avatarUrl } from "@/lib/avatar";
import { useAuth } from "./AuthProvider";

type Conversation = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  lastBody: string;
  lastAt: string;
  unread: number;
};

export default function MessagesInbox({
  onOpenConversation,
  onCountChange,
}: {
  onOpenConversation: (userId: string) => void;
  onCountChange?: (unread: number) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("messages")
      .select("id, sender_id, recipient_id, body, created_at, read_at")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as DirectMessage[];

    // Rows are newest-first, so the first one seen per user is the latest.
    const byUser = new Map<string, Conversation>();
    for (const m of rows) {
      const other = m.sender_id === user.id ? m.recipient_id : m.sender_id;
      let c = byUser.get(other);
      if (!c) {
        c = {
          userId: other,
          name: "",
          avatarUrl: null,
          lastBody: m.body,
          lastAt: m.created_at,
          unread: 0,
        };
        byUser.set(other, c);
      }
      if (m.recipient_id === user.id && !m.read_at) c.unread++;
    }
    const list = Array.from(byUser.values());

    if (list.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_path")
        .in(
          "id",
          list.map((c) => c.userId)
        );
      const pmap = new Map(
        (profs ?? []).map((p: { id: string }) => [p.id, p])
      );
      for (const c of list) {
        const p = pmap.get(c.userId) as
          | { display_name: string; avatar_path: string | null }
          | undefined;
        c.name = p?.display_name ?? "Unknown user";
        c.avatarUrl = avatarUrl(supabase, p?.avatar_path);
      }
    }

    setConversations(list);
    onCountChange?.(list.reduce((sum, c) => sum + c.unread, 0));
    setLoaded(true);
  }, [supabase, user, onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  if (!loaded) return null;

  if (conversations.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        No messages yet. Open another user&apos;s profile and tap Message to
        start a conversation.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {conversations.map((c) => (
        <li key={c.userId}>
          <button
            type="button"
            onClick={() => onOpenConversation(c.userId)}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <div className="h-10 w-10 flex-none overflow-hidden rounded-full bg-neutral-100 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:ring-neutral-700">
              {c.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-neutral-400">
                  <UserIcon className="h-5 w-5" />
                </div>
              )}
            </div>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate font-medium">{c.name}</span>
                {c.unread > 0 && (
                  <span className="flex-none rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                    {c.unread}
                  </span>
                )}
              </span>
              <span
                className={
                  "block truncate text-xs " +
                  (c.unread > 0
                    ? "font-medium text-neutral-700 dark:text-neutral-200"
                    : "text-neutral-500")
                }
              >
                {c.lastBody}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
