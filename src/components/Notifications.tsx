"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Drawer } from "vaul";
import { useNotifications } from "./NotificationsProvider";

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
  const { rows, unread, reload, markAllSeen } = useNotifications();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [open, setOpen] = useState(false);

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reload();
      await markAllSeen();
    }
  }

  const direction = isMobile ? "bottom" : "right";

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpenChange(true)}
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

      <Drawer.Root
        open={open}
        onOpenChange={handleOpenChange}
        direction={direction}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-[940] bg-black/30 backdrop-blur-[1px]" />
          <Drawer.Content
            className={
              "fixed z-[950] flex flex-col bg-white shadow-2xl outline-none ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10 " +
              (isMobile
                ? "inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl"
                : "inset-y-0 right-0 w-full max-w-md")
            }
          >
            {isMobile && (
              <div
                aria-hidden="true"
                className="mx-auto mt-2 h-1.5 w-12 flex-none rounded-full bg-neutral-300 dark:bg-neutral-700"
              />
            )}

            <div className="flex items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-800">
              <Drawer.Title className="text-lg font-semibold">
                Notifications
              </Drawer.Title>
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                aria-label="Close"
                className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {rows.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-neutral-500">
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
                    className="flex w-full flex-col gap-0.5 border-b border-neutral-100 px-4 py-3 text-left hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-800"
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
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}
