"use client";

import { useEffect, useState } from "react";
import { Drawer } from "vaul";
import { X } from "lucide-react";
import AboutContent from "./AboutContent";

type Props = {
  open: boolean;
  onClose: () => void;
};

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

// In-app About drawer — opens from the Info button on the map and renders
// the same body as the standalone /about page.
export default function AboutDrawer({ open, onClose }: Props) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const direction = isMobile ? "bottom" : "right";

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      direction={direction}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[800] bg-black/40 backdrop-blur-[1px]" />
        <Drawer.Content
          className={
            "fixed z-[900] flex flex-col bg-neutral-100 text-neutral-900 shadow-2xl outline-none ring-1 ring-black/5 dark:bg-neutral-900 dark:text-neutral-100 dark:ring-white/10 " +
            (isMobile
              ? "inset-x-0 bottom-0 max-h-[90vh] rounded-t-2xl"
              : "inset-y-0 right-0 w-full max-w-2xl")
          }
        >
          <Drawer.Title className="sr-only">About TravPad</Drawer.Title>

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

          <div className="flex-1 overflow-y-auto">
            <AboutContent />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
