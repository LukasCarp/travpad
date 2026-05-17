"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, Check, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./AuthProvider";

type ListRow = { id: string; name: string };

export default function AddToList({ pinId }: { pinId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const { user } = useAuth();
  const ref = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<ListRow[]>([]);
  const [memberOf, setMemberOf] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: listData } = await supabase
      .from("lists")
      .select("id, name")
      .eq("owner", user.id)
      .order("created_at");
    const myLists = (listData ?? []) as ListRow[];
    setLists(myLists);

    if (myLists.length > 0) {
      const { data: lp } = await supabase
        .from("list_pins")
        .select("list_id")
        .eq("pin_id", pinId)
        .in(
          "list_id",
          myLists.map((l) => l.id)
        );
      setMemberOf(new Set((lp ?? []).map((r) => r.list_id as string)));
    } else {
      setMemberOf(new Set());
    }
  }, [supabase, user, pinId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function toggle(listId: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    if (memberOf.has(listId)) {
      const { error: delErr } = await supabase
        .from("list_pins")
        .delete()
        .eq("list_id", listId)
        .eq("pin_id", pinId);
      if (delErr) {
        setError(delErr.message);
      } else {
        setMemberOf((s) => {
          const next = new Set(s);
          next.delete(listId);
          return next;
        });
      }
    } else {
      const { error: insErr } = await supabase
        .from("list_pins")
        .insert({ list_id: listId, pin_id: pinId });
      if (insErr) {
        setError(insErr.message);
      } else {
        setMemberOf((s) => new Set(s).add(listId));
      }
    }
    setBusy(false);
  }

  async function createAndAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!user || !name || busy) return;
    setBusy(true);
    setError(null);

    const { data, error: listErr } = await supabase
      .from("lists")
      .insert({ owner: user.id, name })
      .select("id, name")
      .single();
    if (listErr || !data) {
      setError(listErr?.message ?? "Couldn't create the list.");
      setBusy(false);
      return;
    }

    const created = data as ListRow;
    const { error: lpErr } = await supabase
      .from("list_pins")
      .insert({ list_id: created.id, pin_id: pinId });
    if (lpErr) setError(lpErr.message);

    setLists((l) => [...l, created]);
    setMemberOf((s) => new Set(s).add(created.id));
    setNewName("");
    setBusy(false);
  }

  if (!user) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
      >
        <Bookmark className="h-4 w-4" />
        Save to list
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-60 overflow-hidden rounded-lg bg-white shadow-xl ring-1 ring-black/10 dark:bg-neutral-900 dark:ring-white/10">
          <div className="max-h-56 overflow-y-auto py-1">
            {lists.length === 0 && (
              <p className="px-3 py-2 text-xs text-neutral-500">
                No lists yet — create one below.
              </p>
            )}
            {lists.map((l) => {
              const inList = memberOf.has(l.id);
              return (
                <button
                  key={l.id}
                  type="button"
                  disabled={busy}
                  onClick={() => toggle(l.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-800"
                >
                  <span
                    className={
                      "flex h-4 w-4 flex-none items-center justify-center rounded border " +
                      (inList
                        ? "border-rose-500 bg-rose-500 text-white"
                        : "border-neutral-300 dark:border-neutral-600")
                    }
                  >
                    {inList && <Check className="h-3 w-3" />}
                  </span>
                  <span className="flex-1 truncate">{l.name}</span>
                </button>
              );
            })}
          </div>
          {error && (
            <p className="border-t border-neutral-100 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-neutral-800 dark:bg-rose-950/40 dark:text-rose-200">
              {error}
            </p>
          )}

          <form
            onSubmit={createAndAdd}
            className="flex items-center gap-1 border-t border-neutral-100 p-2 dark:border-neutral-800"
          >
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New list…"
              className="min-w-0 flex-1 rounded border border-neutral-300 bg-transparent px-2 py-1 text-sm outline-none focus:border-rose-500 dark:border-neutral-700"
            />
            <button
              type="submit"
              disabled={busy || !newName.trim()}
              aria-label="Create list"
              className="flex-none rounded bg-rose-500 p-1.5 text-white disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
