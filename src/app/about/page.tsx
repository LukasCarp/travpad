import type { Metadata } from "next";
import Link from "next/link";
import {
  Bookmark,
  Compass,
  Download,
  MapPin,
  Pencil,
  PlayCircle,
  Send,
} from "lucide-react";

// Marketing / landing page. Mostly static text — server-rendered for SEO
// and link previews. Videos live under public/videos/ and are referenced
// by VideoSlot — swap the `src` from null to "/videos/foo.mp4" once a
// clip is recorded.

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

function VideoSlot({
  src,
  label,
  poster,
  className = "",
  aspect = "aspect-video",
  loop = true,
}: {
  src?: string | null;
  label: string;
  poster?: string;
  className?: string;
  aspect?: string;
  loop?: boolean;
}) {
  if (src) {
    return (
      <div
        className={`relative ${aspect} w-full overflow-hidden rounded-2xl shadow-xl ring-1 ring-black/10 dark:ring-white/10 ${className}`}
      >
        <video
          src={src}
          poster={poster}
          controls
          loop={loop}
          playsInline
          preload="metadata"
          aria-label={label}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }
  return (
    <div
      className={`${aspect} flex w-full items-center justify-center rounded-2xl bg-gradient-to-br from-neutral-200 to-neutral-300 text-neutral-500 shadow-xl ring-1 ring-black/10 dark:from-neutral-800 dark:to-neutral-900 dark:text-neutral-400 dark:ring-white/10 ${className}`}
      aria-label={`${label} (video coming)`}
    >
      <div className="flex flex-col items-center gap-2 text-sm">
        <PlayCircle className="h-12 w-12 opacity-50" />
        <span className="font-medium">{label}</span>
        <span className="text-xs opacity-60">Video coming</span>
      </div>
    </div>
  );
}

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

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-16 pt-16 sm:pt-24">
        <h1 className="text-5xl font-semibold leading-tight tracking-tight sm:text-6xl md:text-7xl">
          TravPad
        </h1>
        <p className="mt-4 max-w-3xl text-2xl font-medium text-neutral-700 dark:text-neutral-200 sm:text-3xl">
          A wiki map for travelers and locals.
        </p>
        <p className="mt-3 text-lg italic text-neutral-500 dark:text-neutral-400">
          Drop a pin. Share what you know. Find what others found.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-6 py-3 text-base font-medium text-white shadow-lg transition hover:bg-rose-600"
          >
            Get started — free
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-6 py-3 text-base font-medium text-neutral-800 shadow-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
          >
            Try the map →
          </Link>
        </div>

        <div className="mt-12">
          <VideoSlot
            src="/travpad-promo.mp4"
            label="TravPad in action"
            aspect="aspect-[9/16]"
            className="mx-auto max-w-sm"
            loop={false}
          />
        </div>
      </section>

      {/* What is TravPad */}
      <section className="border-y border-neutral-200/60 bg-white py-20 dark:border-neutral-800/60 dark:bg-neutral-950">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-semibold sm:text-4xl">
            What is TravPad
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-neutral-700 dark:text-neutral-300">
            The world&apos;s weirdest, best, most underrated places — pinned
            by people who&apos;ve been there. TravPad is a living map built
            by locals and travelers, in the spirit of Wikipedia and
            OpenStreetMap. Free, open, and made better by everyone who adds
            to it.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-semibold sm:text-4xl">
            How it works
          </h2>

          <div className="mt-12 grid gap-10 md:grid-cols-3">
            <div>
              <VideoSlot src={null} label="Explore" />
              <div className="mt-5">
                <div className="flex items-center gap-2 text-sm font-medium text-rose-500">
                  <Compass className="h-4 w-4" />
                  Step 1
                </div>
                <h3 className="mt-2 text-xl font-semibold">Explore the map</h3>
                <p className="mt-2 text-neutral-600 dark:text-neutral-300">
                  Browse pins dropped by locals and travelers around the
                  world.
                </p>
              </div>
            </div>

            <div>
              <VideoSlot src={null} label="Drop a pin" />
              <div className="mt-5">
                <div className="flex items-center gap-2 text-sm font-medium text-rose-500">
                  <MapPin className="h-4 w-4" />
                  Step 2
                </div>
                <h3 className="mt-2 text-xl font-semibold">Drop your own</h3>
                <p className="mt-2 text-neutral-600 dark:text-neutral-300">
                  Found something worth sharing? Add it. A quiet beach, a
                  great bakery, a viewpoint no guidebook mentions.
                </p>
              </div>
            </div>

            <div>
              <VideoSlot src={null} label="Share notes & photos" />
              <div className="mt-5">
                <div className="flex items-center gap-2 text-sm font-medium text-rose-500">
                  <Pencil className="h-4 w-4" />
                  Step 3
                </div>
                <h3 className="mt-2 text-xl font-semibold">
                  Share what you know
                </h3>
                <p className="mt-2 text-neutral-600 dark:text-neutral-300">
                  Add notes, tips, photos. Help the next traveler find it.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Travel together, on or offline */}
      <section className="bg-neutral-900 py-20 text-neutral-100 dark:bg-black">
        <div className="mx-auto grid max-w-5xl gap-12 px-6 md:grid-cols-2 md:items-center">
          <div className="order-2 md:order-1">
            <VideoSlot src={null} label="Follow, share, offline" />
          </div>
          <div className="order-1 md:order-2">
            <h2 className="text-3xl font-semibold sm:text-4xl">
              Travel together, on or offline
            </h2>
            <div className="mt-6 space-y-4 text-lg leading-relaxed text-neutral-200">
              <p>
                TravPad is more than pins on a map.
                <span className="ml-1 inline-flex items-center gap-1 font-medium text-rose-300">
                  <Bookmark className="h-4 w-4" /> Follow
                </span>{" "}
                travelers and locals whose taste you trust — see what they
                add, where they&apos;ve been.
              </p>
              <p>
                <span className="inline-flex items-center gap-1 font-medium text-rose-300">
                  <Send className="h-4 w-4" /> Share lists
                </span>{" "}
                with a friend planning the same trip — give them your
                shortlist of favorite cafés, hidden viewpoints or weekend
                spots in one tap.
              </p>
              <p>
                And before you head off,{" "}
                <span className="inline-flex items-center gap-1 font-medium text-rose-300">
                  <Download className="h-4 w-4" /> download
                </span>{" "}
                the area for offline use — map, pins and photos in your
                pocket, ready for the plane, the mountains, or anywhere
                with no signal.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Community */}
      <section className="py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-semibold sm:text-4xl">Community</h2>
          <p className="mt-6 text-lg leading-relaxed text-neutral-700 dark:text-neutral-300">
            TravPad belongs to everyone who uses it. No ads, no algorithms
            pushing you toward sponsored spots — just real places shared by
            real people.
          </p>
          <p className="mt-6 text-2xl font-semibold tracking-tight">
            Like a wiki, but for the road.
          </p>
          <div className="mt-10">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-6 py-3 text-base font-medium text-white shadow-lg transition hover:bg-rose-600"
            >
              Sign up — free
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
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
            <Link href="/" className="hover:text-neutral-900 dark:hover:text-neutral-100">
              Open the map
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
