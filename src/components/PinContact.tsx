import { Globe, Mail, Phone } from "lucide-react";

// A clickable contact box — website, phone and email pulled from a pin's
// `details` jsonb. No "use client": it renders only links, so it works in
// both the server-rendered pin page and the client-side pin drawer.

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export default function PinContact({
  details,
  className = "",
}: {
  details: Record<string, unknown> | null | undefined;
  className?: string;
}) {
  const website = str(details?.website);
  const phone = str(details?.phone);
  const email = str(details?.email);

  if (!website && !phone && !email) return null;

  const websiteHref = website
    ? /^https?:\/\//i.test(website)
      ? website
      : `https://${website}`
    : null;

  const rowClass =
    "flex items-center gap-3 border-t border-neutral-100 px-3 py-2.5 " +
    "text-sm first:border-t-0 hover:bg-neutral-50 dark:border-neutral-800 " +
    "dark:hover:bg-neutral-800/60";

  return (
    <div
      className={
        "overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800 " +
        className
      }
    >
      {websiteHref && (
        <a
          href={websiteHref}
          target="_blank"
          rel="noopener noreferrer"
          className={rowClass}
        >
          <Globe className="h-4 w-4 flex-none text-rose-500" />
          <span className="min-w-0 flex-1 truncate text-rose-600 dark:text-rose-400">
            {website}
          </span>
        </a>
      )}
      {phone && (
        <a href={`tel:${phone.replace(/\s+/g, "")}`} className={rowClass}>
          <Phone className="h-4 w-4 flex-none text-rose-500" />
          <span className="min-w-0 flex-1 truncate">{phone}</span>
        </a>
      )}
      {email && (
        <a href={`mailto:${email}`} className={rowClass}>
          <Mail className="h-4 w-4 flex-none text-rose-500" />
          <span className="min-w-0 flex-1 truncate">{email}</span>
        </a>
      )}
    </div>
  );
}
