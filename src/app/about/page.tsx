import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";
import AboutContent from "@/components/AboutContent";

// Marketing / landing page. Mostly static text — server-rendered for SEO
// and link previews. The body lives in <AboutContent /> so the same copy
// can be opened as an in-app drawer.

export const metadata: Metadata = {
  title: "TravPad — A wiki map for travelers and locals",
  description:
    "Drop a pin. Share what you know. Find what others found. TravPad is a community-built travel map — free, open and made better by everyone who adds to it.",
  openGraph: {
    type: "website",
    title: "TravPad — A wiki map for travelers and locals",
    description:
      "Drop a pin. Share what you know. Find what others found. TravPad is a community-built travel map.",
  },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
      {/* Sticky top bar */}
      <header className="sticky top-0 z-40 border-b border-neutral-200/60 bg-neutral-100/85 backdrop-blur dark:border-neutral-800/60 dark:bg-neutral-900/85">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link href="/about" className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-rose-500" />
            <span className="text-lg font-semibold tracking-tight">
              TravPad
            </span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/"
              className="hidden text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100 sm:inline"
            >
              Open the map
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-full bg-rose-500 px-4 py-1.5 text-sm font-medium text-white shadow hover:bg-rose-600"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <AboutContent />

      <footer className="border-t border-neutral-200/60 bg-neutral-100 py-10 text-sm text-neutral-500 dark:border-neutral-800/60 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-rose-500" />
            <span className="font-medium text-neutral-700 dark:text-neutral-200">
              TravPad
            </span>
            <span>© 2026</span>
          </div>
          <nav className="flex flex-wrap items-center gap-4">
            <Link href="/about" className="hover:text-neutral-900 dark:hover:text-neutral-100">
              About
            </Link>
            <Link href="/privacy" className="hover:text-neutral-900 dark:hover:text-neutral-100">
              Privacy
            </Link>
            <Link href="/credits" className="hover:text-neutral-900 dark:hover:text-neutral-100">
              Credits
            </Link>
            <Link href="/" className="hover:text-neutral-900 dark:hover:text-neutral-100">
              Open the map
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
