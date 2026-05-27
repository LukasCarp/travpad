import Link from "next/link";
import { ExternalLink } from "lucide-react";

// Per-pin attribution. Imported pins carry their data origin in `details`
// (source, osm_id, wikidata_id, wikipedia_title/lang, wikivoyage_article).
// User-created pins have none of these and fall back to "Pinned by …".

type AttributionDetails = {
  source?: "osm" | "wikidata" | "wikivoyage" | "unesco";
  osm_id?: string;
  wikidata_id?: string;
  wikipedia_title?: string;
  wikipedia_lang?: string;
  wikivoyage_article?: string;
  wikivoyage_lang?: string;
  unesco?: boolean;
};

type Props = {
  details: AttributionDetails | null | undefined;
  createdByName?: string | null;
  className?: string;
};

function osmHref(osmId: string | undefined): string | null {
  if (!osmId) return null;
  // osmId comes in like "node/12345" or "wikidata/Q12345" — the latter
  // isn't really an OSM URL, it's a synthetic id for Wikidata-only pins.
  if (osmId.startsWith("wikidata/")) return null;
  const [type, id] = osmId.split("/");
  if (!type || !id) return null;
  return `https://www.openstreetmap.org/${type}/${id}`;
}

export default function PinAttribution({
  details,
  createdByName,
  className = "",
}: Props) {
  const d = details ?? {};
  const items: { label: string; license: string; href?: string }[] = [];

  if (d.osm_id) {
    const href = osmHref(d.osm_id);
    items.push({
      label: `OpenStreetMap — ${d.osm_id}`,
      license: "ODbL",
      href: href ?? undefined,
    });
  }
  if (d.wikidata_id) {
    items.push({
      label: `Wikidata — ${d.wikidata_id}`,
      license: "CC0",
      href: `https://www.wikidata.org/wiki/${d.wikidata_id}`,
    });
  }
  if (d.wikipedia_title) {
    const lang = d.wikipedia_lang ?? "en";
    items.push({
      label: `Wikipedia (${lang}) — ${d.wikipedia_title}`,
      license: "CC BY-SA 4.0",
      href: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(
        d.wikipedia_title.replace(/ /g, "_")
      )}`,
    });
  }
  if (d.wikivoyage_article) {
    const lang = d.wikivoyage_lang ?? "en";
    items.push({
      label: `Wikivoyage (${lang}) — ${d.wikivoyage_article}`,
      license: "CC BY-SA 4.0",
      href: `https://${lang}.wikivoyage.org/wiki/${encodeURIComponent(
        d.wikivoyage_article.replace(/ /g, "_")
      )}`,
    });
  }
  if (d.unesco) {
    items.push({
      label: "UNESCO World Heritage",
      license: "Data via Wikidata (CC0)",
      href: "https://whc.unesco.org/en/list/",
    });
  }

  // User-created pins (no imports) get a CC BY-SA 4.0 line crediting the
  // contributor — same license TravPad applies to all user content.
  const userCreated = items.length === 0;

  return (
    <section
      className={
        "border-t border-neutral-200 pt-3 text-[11px] leading-relaxed text-neutral-500 dark:border-neutral-800 dark:text-neutral-400 " +
        className
      }
      aria-label="Sources and licensing"
    >
      <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide">
        Sources
      </h3>
      {userCreated ? (
        <p>
          Contributed by{" "}
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            {createdByName ?? "a TravPad user"}
          </span>
          . Licensed CC BY-SA 4.0.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {items.map((it, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-1">
              {it.href ? (
                <a
                  href={it.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-baseline gap-0.5 underline-offset-2 hover:underline"
                >
                  {it.label}
                  <ExternalLink className="h-2.5 w-2.5 self-center opacity-70" />
                </a>
              ) : (
                <span>{it.label}</span>
              )}
              <span className="opacity-75">— {it.license}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2">
        <Link
          href="/credits"
          className="underline-offset-2 hover:underline"
        >
          About data &amp; licensing
        </Link>
      </p>
    </section>
  );
}
