"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send, User as UserIcon, X } from "lucide-react";
import { Drawer } from "vaul";
import { createClient } from "@/lib/supabase/client";
import type { DirectMessage } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";

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
  otherUserId: string;
  onClose: () => void;
};

export default function MessageDrawer({ otherUserId, onClose }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const { user } = useAuth();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const [otherName, setOtherName] = useState("");
  const [otherAvatar, setOtherAvatar] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const loadMessages = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("messages")
      .select("id, sender_id, recipient_id, body, created_at, read_at")
      .or(
        `and(sender_id.eq.${user.id},recipient_id.eq.${otherUserId}),` +
          `and(sender_id.eq.${otherUserId},recipient_id.eq.${user.id})`
      )
      .order("created_at", { ascending: true });
    const rows = (data ?? []) as DirectMessage[];
    setMessages(rows);

    // Mark messages addressed to me as read.
    const unreadIds = rows
      .filter((m) => m.recipient_id === user.id && !m.read_at)
      .map((m) => m.id);
    if (unreadIds.length > 0) {
      await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadIds);
    }
  }, [supabase, user, otherUserId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name, avatar_path")
        .eq("id", otherUserId)
        .maybeSingle();
      if (alive && prof) {
        setOtherName((prof.display_name as string) ?? "User");
        const path = prof.avatar_path as string | null;
        setOtherAvatar(
          path
            ? supabase.storage.from("avatars").getPublicUrl(path).data
                .publicUrl
            : null
        );
      }
      await loadMessages();
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [supabase, otherUserId, loadMessages]);

  // Poll for new messages while the conversation is open.
  useEffect(() => {
    const id = window.setInterval(loadMessages, 12000);
    return () => window.clearInterval(id);
  }, [loadMessages]);

  // Keep the latest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || sending || !user) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      sender_id: user.id,
      recipient_id: otherUserId,
      body: trimmed,
    });
    if (!error) {
      setBody("");
      await loadMessages();
    }
    setSending(false);
  }

  const direction = isMobile ? "bottom" : "right";

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
              ? "inset-x-0 bottom-0 h-[85vh] rounded-t-2xl"
              : "inset-y-0 right-0 w-full max-w-md")
          }
        >
          <Drawer.Title className="sr-only">
            {otherName ? `Messages with ${otherName}` : "Messages"}
          </Drawer.Title>

          {/* Header */}
          <div className="flex flex-none items-center gap-3 border-b border-neutral-200 p-4 dark:border-neutral-800">
            <div className="h-9 w-9 flex-none overflow-hidden rounded-full bg-neutral-100 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:ring-neutral-700">
              {otherAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={otherAvatar}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-neutral-400">
                  <UserIcon className="h-5 w-5" />
                </div>
              )}
            </div>
            <h1 className="min-w-0 flex-1 truncate text-base font-semibold">
              {otherName || "Messages"}
            </h1>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex-none rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Conversation */}
          <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
            {loading && (
              <p className="text-sm text-neutral-500">Loading messages…</p>
            )}
            {!loading && messages.length === 0 && (
              <p className="text-sm text-neutral-500">
                No messages yet — say hello.
              </p>
            )}
            {messages.map((m) => {
              const mine = m.sender_id === user?.id;
              return (
                <div
                  key={m.id}
                  className={"flex " + (mine ? "justify-end" : "justify-start")}
                >
                  <div
                    className={
                      "max-w-[80%] rounded-2xl px-3 py-2 text-sm " +
                      (mine
                        ? "bg-rose-500 text-white"
                        : "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100")
                    }
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p
                      className={
                        "mt-0.5 text-[10px] " +
                        (mine ? "text-white/70" : "text-neutral-500")
                      }
                    >
                      {new Date(m.created_at).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Composer */}
          <form
            onSubmit={handleSend}
            className="flex flex-none items-center gap-2 border-t border-neutral-200 p-3 dark:border-neutral-800"
          >
            <input
              type="text"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={1000}
              placeholder="Write a message…"
              className="min-w-0 flex-1 rounded-full border border-neutral-300 bg-transparent px-4 py-2 text-sm outline-none focus:border-rose-500 dark:border-neutral-700"
            />
            <button
              type="submit"
              disabled={sending || !body.trim()}
              aria-label="Send"
              className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-rose-500 text-white shadow hover:bg-rose-600 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
