"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Send, Share2, Trash2, X } from "lucide-react";
import { Drawer } from "vaul";
import { createClient } from "@/lib/supabase/client";
import type { Pin } from "@/lib/supabase";
import { colorForCategory } from "@/lib/pinTaxonomy";
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

const PIN_COLUMNS =
  "id, title, category, subcategory, short_description, description, services, secret, details, lat, lng, created_by, created_by_name, created_at, images";

type Props = {
  listId: string;
  onClose: () => void;
  onOpenPin: (pinId: string) => void;
};

export default function ListDrawer({ listId, onClose, onOpenPin }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const { user } = useAuth();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const [name, setName] = useState("");
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // "Send to friend" — copy this list into a followed user's account.
  const [friends, setFriends] = useState<
    { id: string; display_name: string }[]
  >([]);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sendMsg, setSendMsg] = useState<{ text: string; ok: boolean } | null>(
    null
  );

  const isOwner = !!user && user.id === ownerId;

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);

    const { data: list } = await supabase
      .from("lists")
      .select("id, name, owner")
      .eq("id", listId)
      .maybeSingle();

    if (!list) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setName(list.name as string);
    setOwnerId(list.owner as string);

    const [{ data: ownerProfile }, { data: lp }] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name")
        .eq("id", list.owner)
        .maybeSingle(),
      supabase
        .from("list_pins")
        .select("pin_id, added_at")
        .eq("list_id", listId)
        .order("added_at", { ascending: false }),
    ]);

    setOwnerName((ownerProfile?.display_name as string | null) ?? null);

    const pinIds = (lp ?? []).map((r) => r.pin_id as string);
    if (pinIds.length > 0) {
      const { data: pinData } = await supabase
        .from("pins_view")
        .select(PIN_COLUMNS)
        .in("id", pinIds);
      const byId = new Map(
        ((pinData ?? []) as Pin[]).map((p) => [p.id, p])
      );
      setPins(
        pinIds.map((id) => byId.get(id)).filter((p): p is Pin => !!p)
      );
    } else {
      setPins([]);
    }
    setLoading(false);
  }, [supabase, listId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleShare() {
    const url = `${window.location.origin}/?list=${listId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: name, url });
      } catch {
        // dismissed
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }

  async function toggleSend() {
    const next = !sendOpen;
    setSendOpen(next);
    setSendMsg(null);
    if (next && user) {
      const { data: rows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);
      const ids = (rows ?? []).map(
        (r: { following_id: string }) => r.following_id
      );
      if (ids.length === 0) {
        setFriends([]);
        return;
      }
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      setFriends(
        (profs ?? []).map((p: { id: string; display_name: string }) => ({
          id: p.id,
          display_name: p.display_name ?? "User",
        }))
      );
    }
  }

  async function sendTo(friendId: string, friendName: string) {
    setSendingTo(friendId);
    setSendMsg(null);
    const { error } = await supabase.rpc("send_list", {
      p_list_id: listId,
      p_recipient_id: friendId,
    });
    setSendingTo(null);
    if (error) {
      setSendMsg({ text: `Couldn't send: ${error.message}`, ok: false });
    } else {
      setSendMsg({ text: `Sent to ${friendName}.`, ok: true });
      setSendOpen(false);
    }
  }

  async function removePin(pinId: string) {
    await supabase
      .from("list_pins")
      .delete()
      .eq("list_id", listId)
      .eq("pin_id", pinId);
    setPins((p) => p.filter((x) => x.id !== pinId));
  }

  async function deleteList() {
    await supabase.from("lists").delete().eq("id", listId);
    onClose();
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
              ? "inset-x-0 bottom-0 max-h-[90vh] rounded-t-2xl"
              : "inset-y-0 right-0 w-full max-w-md")
          }
        >
          <Drawer.Title className="sr-only">{name || "List"}</Drawer.Title>

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
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          {loading && (
            <div className="flex-1 p-8 text-sm text-neutral-500">
              Loading list…
            </div>
          )}

          {notFound && !loading && (
            <div className="flex-1 p-8 text-sm text-rose-700">
              This list could not be found.
            </div>
          )}

          {!loading && !notFound && (
            <div className="flex-1 overflow-y-auto p-6 pt-12">
              <h1 className="text-2xl font-semibold leading-tight">{name}</h1>
              <p className="mt-1 text-xs text-neutral-500">
                {ownerName ? `By ${ownerName} · ` : ""}
                {pins.length} pin{pins.length === 1 ? "" : "s"}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                >
                  <Share2 className="h-4 w-4" />
                  {copied ? "Copied!" : "Share"}
                </button>
                {user && (
                  <button
                    type="button"
                    onClick={toggleSend}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                  >
                    <Send className="h-4 w-4" />
                    Send to friend
                  </button>
                )}
              </div>

              {sendOpen && (
                <div className="mt-2 rounded-lg border border-neutral-200 p-2 dark:border-neutral-800">
                  {friends.length === 0 ? (
                    <p className="px-2 py-1 text-sm text-neutral-500">
                      You&apos;re not following anyone yet — follow someone to
                      send them a list.
                    </p>
                  ) : (
                    <ul className="max-h-48 space-y-0.5 overflow-y-auto">
                      {friends.map((f) => (
                        <li key={f.id}>
                          <button
                            type="button"
                            disabled={sendingTo !== null}
                            onClick={() => sendTo(f.id, f.display_name)}
                            className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-800"
                          >
                            <span className="truncate">{f.display_name}</span>
                            {sendingTo === f.id && (
                              <span className="flex-none text-xs text-neutral-500">
                                Sending…
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {sendMsg && (
                <p
                  className={
                    "mt-2 rounded-lg px-3 py-2 text-sm " +
                    (sendMsg.ok
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"
                      : "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-200")
                  }
                >
                  {sendMsg.text}
                </p>
              )}

              <ul className="mt-5 space-y-2">
                {pins.length === 0 && (
                  <p className="text-sm text-neutral-500">
                    This list has no pins yet.
                  </p>
                )}
                {pins.map((pin) => (
                  <li key={pin.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenPin(pin.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      <span
                        className="h-2.5 w-2.5 flex-none rounded-full"
                        style={{
                          backgroundColor: colorForCategory(pin.category),
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {pin.title}
                        </span>
                        <span className="block truncate text-xs text-neutral-500">
                          {pin.category}
                          {pin.subcategory ? ` · ${pin.subcategory}` : ""}
                        </span>
                      </span>
                    </button>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => removePin(pin.id)}
                        aria-label="Remove from list"
                        className="flex-none rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-rose-600 dark:hover:bg-neutral-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              {isOwner && (
                <div className="mt-6 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                  {confirmingDelete ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={deleteList}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500 px-3 py-2 text-sm font-medium text-white shadow hover:bg-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                        Confirm delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDelete(false)}
                        className="rounded-lg px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/30"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete list
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
