import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";

export const metadata: Metadata = {
  title: "Data sources & credits · TravPad",
  description:
    "Where TravPad's pin data comes from, the open licenses it is shared under, and how to report or correct an entry.",
};

function Section({
  title,
  children,
  id,
}: {
  title: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section className="mt-8" id={id}>
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
        {children}
      </div>
    </section>
  );
}

export default function CreditsPage() {
  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-12 dark:bg-neutral-950">
      <main className="mx-auto max-w-2xl">
        <Link href="/" className="inline-flex items-center gap-2">
          <MapPin className="h-5 w-5 text-rose-500" />
          <span className="text-lg font-semibold tracking-tight">TravPad</span>
        </Link>

        <h1 className="mt-8 text-3xl font-semibold tracking-tight">
          Data sources &amp; credits
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          TravPad would not exist without the open-data communities below.
          Every imported pin keeps a link back to its source.
        </p>

        <Section title="Map tiles">
          <p>
            Base maps are rendered using tile services from{" "}
            <a
              href="https://stadiamaps.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-rose-600 hover:underline"
            >
              Stadia Maps
            </a>{" "}
            and{" "}
            <a
              href="https://carto.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-rose-600 hover:underline"
            >
              CARTO
            </a>
            , both of which build on{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="text-rose-600 hover:underline"
            >
              OpenStreetMap
            </a>{" "}
            data. © OpenStreetMap contributors, available under the{" "}
            <a
              href="https://opendatacommons.org/licenses/odbl/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-rose-600 hover:underline"
            >
              Open Database License (ODbL)
            </a>
            .
          </p>
        </Section>

        <Section title="Imported pins">
          <p>
            The &ldquo;Import places&rdquo; tool pulls candidate pins from four
            open sources. The original source is recorded on each pin and
            shown in the &ldquo;Sources&rdquo; block at the bottom of the pin
            page.
          </p>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              <strong>OpenStreetMap</strong> — geometry, names and tags via the
              Overpass API. Licensed under{" "}
              <a
                href="https://opendatacommons.org/licenses/odbl/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-rose-600 hover:underline"
              >
                ODbL
              </a>
              . © OpenStreetMap contributors.
            </li>
            <li>
              <strong>Wikidata</strong> — coordinates and instance metadata via
              the SPARQL service. Licensed under{" "}
              <a
                href="https://creativecommons.org/publicdomain/zero/1.0/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-rose-600 hover:underline"
              >
                CC0
              </a>
              .
            </li>
            <li>
              <strong>Wikipedia</strong> — summaries and thumbnails via the
              MediaWiki REST API. Licensed under{" "}
              <a
                href="https://creativecommons.org/licenses/by-sa/4.0/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-rose-600 hover:underline"
              >
                CC BY-SA 4.0
              </a>
              .
            </li>
            <li>
              <strong>Wikivoyage</strong> — listing entries from the
              MediaWiki API. Licensed under{" "}
              <a
                href="https://creativecommons.org/licenses/by-sa/4.0/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-rose-600 hover:underline"
              >
                CC BY-SA 4.0
              </a>
              .
            </li>
            <li>
              <strong>UNESCO World Heritage</strong> — site identifiers via
              Wikidata. © UNESCO, sourced indirectly via Wikidata (CC0).
            </li>
          </ul>
        </Section>

        <Section title="Photos">
          <p>
            Photos attached to imported pins come from{" "}
            <a
              href="https://commons.wikimedia.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-rose-600 hover:underline"
            >
              Wikimedia Commons
            </a>{" "}
            via the Wikipedia thumbnail API. Individual photos retain their
            own author and license (typically CC BY-SA or CC BY); follow the
            Wikipedia link in the pin&apos;s &ldquo;Sources&rdquo; block to
            find the photographer and exact terms.
          </p>
          <p>
            Photos uploaded by TravPad users are licensed CC BY-SA 4.0 unless
            stated otherwise — see the next section.
          </p>
        </Section>

        <Section title="User contributions">
          <p>
            All text, photos and lists submitted by TravPad users are
            licensed under{" "}
            <a
              href="https://creativecommons.org/licenses/by-sa/4.0/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-rose-600 hover:underline"
            >
              Creative Commons BY-SA 4.0
            </a>
            . That means anyone (including TravPad and other projects) may
            reuse the content as long as the contributor is credited and
            derivative works carry the same license.
          </p>
          <p>
            Pin attribution shows the contributor&apos;s display name. If you
            don&apos;t want your name shown publicly, change your display
            name from your profile before contributing.
          </p>
        </Section>

        <Section title="Translation">
          <p>
            Wikipedia summaries in languages other than English are passed
            through{" "}
            <a
              href="https://mymemory.translated.net/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-rose-600 hover:underline"
            >
              MyMemory
            </a>{" "}
            machine translation. The translated text is best-effort; the
            link in the &ldquo;Sources&rdquo; block points to the original
            article in its source language.
          </p>
        </Section>

        <Section title="Reporting an issue">
          <p>
            Found a wrong entry, a missing attribution, or a copyright
            concern? Email{" "}
            <a
              href="mailto:hello@travpad.app"
              className="text-rose-600 hover:underline"
            >
              hello@travpad.app
            </a>{" "}
            with the pin&apos;s URL and we&apos;ll act within a week.
          </p>
          <p>
            Errors in the underlying data are usually best fixed at the
            source: edit the place on{" "}
            <a
              href="https://www.openstreetmap.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-rose-600 hover:underline"
            >
              OpenStreetMap
            </a>{" "}
            or{" "}
            <a
              href="https://www.wikidata.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-rose-600 hover:underline"
            >
              Wikidata
            </a>{" "}
            and the next import will pick up the change.
          </p>
        </Section>

        <Section title="Software">
          <p>
            Built with{" "}
            <a
              href="https://nextjs.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-rose-600 hover:underline"
            >
              Next.js
            </a>
            ,{" "}
            <a
              href="https://leafletjs.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-rose-600 hover:underline"
            >
              Leaflet
            </a>
            ,{" "}
            <a
              href="https://supabase.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-rose-600 hover:underline"
            >
              Supabase
            </a>{" "}
            and{" "}
            <a
              href="https://lucide.dev/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-rose-600 hover:underline"
            >
              Lucide icons
            </a>
            .
          </p>
        </Section>

        <p className="mt-10 text-xs text-neutral-500">
          Last updated: 26 May 2026
        </p>
      </main>
    </div>
  );
}
